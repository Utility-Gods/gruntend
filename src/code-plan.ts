import { Result } from "better-result";
import { Interpreter } from "@mariozechner/jailjs";
import { transformToES5 } from "@mariozechner/jailjs/transform";
import type { ToolRegistry } from "./registry.ts";
import type { UiTemplateTag } from "./ui-runtime.ts";
import type {
  RetryPolicy,
  RuntimeEvent,
  ToolRunError,
  ToolRunErrorType,
} from "./runtime.ts";
import {
  err,
  ok,
  parseStandardSchema,
  type Tool,
  type ToolHandler,
  type ToolHandlerMapFor,
  type ToolOk,
  type ToolResult,
} from "./tool.ts";

export interface CodePlanUiRuntimeOptions {
  readonly html: UiTemplateTag;
}

export interface CodePlanRunOptions<TTool extends Tool = Tool> {
  readonly code: string;
  readonly input?: unknown;
  readonly registry: ToolRegistry<TTool>;
  readonly handlers: ToolHandlerMapFor<TTool>;
  readonly id?: string;
  readonly signal?: AbortSignal;
  readonly retry?: RetryPolicy;
  readonly ui?: CodePlanUiRuntimeOptions;
  readonly onEvent?: (event: RuntimeEvent) => void;
}

export interface CodePlanRunResult {
  readonly status: "done" | "failed";
  readonly result?: unknown;
  readonly errors: Record<string, ToolRunError>;
  readonly error?: string;
}

interface ToolContractError extends Error {
  readonly type: ToolRunErrorType;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
}

export async function runCodePlan<TTool extends Tool>(
  options: CodePlanRunOptions<TTool>,
): Promise<CodePlanRunResult> {
  const planId = options.id ?? "code-plan";
  const errors: Record<string, ToolRunError> = {};
  let callCount = 0;

  const tools = createToolsObject(
    options.registry.tools(),
    async (toolName, params) => {
      const callId = `call${++callCount}`;

      try {
        const output = await executeToolCall({
          planId,
          callId,
          tool: toolName,
          params,
          registry: options.registry,
          handlers: options.handlers as Record<
            string,
            ToolHandler<unknown, unknown>
          >,
          signal: options.signal,
          retry: options.retry,
          onEvent: options.onEvent,
        });

        return output.value;
      } catch (error) {
        const toolError = toToolRunError(error, callId, toolName);
        errors[callId] = toolError;
        options.onEvent?.({
          type: "tool.failed",
          planId,
          callId,
          tool: toolName,
          error: toolError,
        });
        throw error;
      }
    },
  );

  options.onEvent?.({ type: "plan.started", planId });

  try {
    const ast = transformToES5(wrapCodePlan(options.code));
    const interpreter = new Interpreter({
      Promise,
      console,
      input: options.input ?? {},
      parallel: (values: readonly unknown[]) => Promise.all(values),
      tools,
      ...(options.ui ? { html: options.ui.html } : {}),
    });
    const result = await interpreter.evaluate(ast);

    options.onEvent?.({ type: "plan.completed", planId, result });

    return {
      status: "done",
      result,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.onEvent?.({
      type: "plan.failed",
      planId,
      error: message,
      errors,
    });

    return {
      status: "failed",
      errors,
      error: message,
    };
  }
}

function wrapCodePlan(code: string): string {
  return `(async () => {\n${stripMarkdownFence(code)}\n})();`;
}

function stripMarkdownFence(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(
    /^```(?:ts|tsx|js|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$/,
  );
  return match ? match[1] : code;
}

function createToolsObject(
  tools: readonly Tool[],
  call: (toolName: string, params: unknown) => Promise<unknown>,
): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const tool of tools) {
    const path = tool.name.split(".");
    const methodName = path.pop();
    if (!methodName) continue;

    let current = root;
    for (const segment of path) {
      const existing = current[segment];
      if (
        existing && typeof existing === "object" && !Array.isArray(existing)
      ) {
        current = existing as Record<string, unknown>;
      } else {
        const next: Record<string, unknown> = {};
        current[segment] = next;
        current = next;
      }
    }

    current[methodName] = (params: unknown) => call(tool.name, params);
  }

  return root;
}

async function executeToolCall(options: {
  readonly planId: string;
  readonly callId: string;
  readonly tool: string;
  readonly params: unknown;
  readonly registry: ToolRegistry;
  readonly handlers: Record<string, ToolHandler<unknown, unknown>>;
  readonly signal?: AbortSignal;
  readonly retry?: RetryPolicy;
  readonly onEvent?: (event: RuntimeEvent) => void;
}): Promise<ToolOk<unknown>> {
  const tool = options.registry.get(options.tool);

  if (!tool) {
    throw newToolContractError(
      "unknown_tool",
      `Code plan references unknown tool "${options.tool}".`,
    );
  }

  const handler = options.handlers[options.tool];

  if (!handler) {
    throw newToolContractError(
      "missing_handler",
      `Tool "${options.tool}" does not have a runtime handler.`,
    );
  }

  return await executeWithRetry({
    execute: async ({ attempt, maxAttempts }) => {
      let parsedInput: unknown;

      try {
        parsedInput = await parseStandardSchema(tool.input, options.params);
      } catch {
        throw newToolContractError(
          "invalid_input",
          `Tool "${options.tool}" received invalid input.`,
          { retryable: false },
        );
      }

      options.onEvent?.({
        type: "tool.started",
        planId: options.planId,
        callId: options.callId,
        tool: options.tool,
        input: parsedInput,
      });

      let result: ToolResult<unknown>;

      try {
        result = await handler({
          input: parsedInput,
          signal: options.signal,
          ok,
          err,
          maxAttempts,
          attempt,
        });
      } catch (error) {
        if (isToolContractError(error)) {
          throw error;
        }

        throw newToolContractError(
          "handler_error",
          error instanceof Error
            ? error.message
            : `Tool "${options.tool}" handler failed.`,
          { retryable: true },
        );
      }

      if (Result.isError(result)) {
        throw newToolContractError("handler_error", result.error.message, {
          code: result.error.code,
          retryable: result.error.retryable ?? false,
          details: result.error.details,
        });
      }

      try {
        const parsedOutput = await parseStandardSchema(
          tool.output,
          result.value,
        );
        const output = ok(parsedOutput);
        options.onEvent?.({
          type: "tool.completed",
          planId: options.planId,
          callId: options.callId,
          tool: options.tool,
          output,
        });
        return output;
      } catch {
        throw newToolContractError(
          "invalid_output",
          `Tool "${options.tool}" returned invalid output.`,
          { retryable: false },
        );
      }
    },
    retry: options.retry,
    onRetry: ({ error, attempt, maxAttempts }) => {
      options.onEvent?.({
        type: "tool.retrying",
        planId: options.planId,
        callId: options.callId,
        tool: options.tool,
        attempt,
        maxAttempts,
        nextAttempt: attempt + 1,
        error: toToolRunError(error, options.callId, options.tool),
      });
    },
  });
}

function newToolContractError(
  type: ToolRunErrorType,
  message: string,
  options: {
    readonly code?: string;
    readonly retryable?: boolean;
    readonly details?: Record<string, unknown>;
  } = {},
): ToolContractError {
  const error = new Error(message) as ToolContractError;
  Object.defineProperties(error, {
    type: { value: type, enumerable: true },
    code: { value: options.code, enumerable: true },
    retryable: { value: options.retryable, enumerable: true },
    details: { value: options.details, enumerable: true },
  });
  return error;
}

function isToolContractError(error: unknown): error is ToolContractError {
  return error instanceof Error && "type" in error;
}

function toToolRunError(
  error: unknown,
  callId: string,
  tool: string,
): ToolRunError {
  if (isToolContractError(error)) {
    return {
      type: error.type,
      callId,
      tool,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(typeof error.retryable === "boolean"
        ? { retryable: error.retryable }
        : {}),
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    type: "handler_error",
    callId,
    tool,
    message: error instanceof Error ? error.message : String(error),
  };
}

async function executeWithRetry(options: {
  readonly execute: (
    context: { readonly attempt: number; readonly maxAttempts: number },
  ) => Promise<ToolOk<unknown>>;
  readonly retry?: RetryPolicy;
  readonly onRetry?: (context: {
    readonly error: unknown;
    readonly attempt: number;
    readonly maxAttempts: number;
  }) => void;
}): Promise<ToolOk<unknown>> {
  const maxAttempts = options.retry?.maxAttempts ?? 1;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await options.execute({ attempt, maxAttempts });
    } catch (error) {
      lastError = error;

      if (isToolContractError(error) && error.retryable === false) {
        break;
      }

      if (attempt < maxAttempts) {
        options.onRetry?.({ error, attempt, maxAttempts });

        if (options.retry?.delayMs) {
          await delay(options.retry.delayMs);
        }
      }
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
