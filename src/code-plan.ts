import { Result } from "better-result";
import {
  CodePlanExecutorError,
  type CodePlanConsole,
  type CodePlanConsoleHandler,
  type CodePlanExecutionGlobals,
  type CodePlanExecutor,
  type CodePlanExecutorErrorCode,
  type CodePlanExecutorContext,
} from "./executor.ts";
import type { ToolRegistry } from "./registry.ts";
import type { UiTemplateTag } from "./ui-runtime.ts";
import type {
  RuntimeConsoleLevel,
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

export type {
  CodePlanConsole,
  CodePlanConsoleHandler,
  CodePlanConsoleMessage,
  CodePlanExecutionGlobals,
  CodePlanExecutor,
  CodePlanExecutorContext,
  CodePlanExecutorErrorCode,
  CodePlanExecutorProfile,
  CodePlanExecutorTrust,
} from "./executor.ts";

export interface CodePlanRunOptions<TTool extends Tool = Tool> {
  readonly code: string;
  readonly input?: unknown;
  readonly registry: ToolRegistry<TTool>;
  readonly handlers: ToolHandlerMapFor<TTool>;
  readonly id?: string;
  readonly signal?: AbortSignal;
  readonly retry?: RetryPolicy;
  readonly executor: CodePlanExecutor;
  readonly maxOps?: number;
  readonly console?: CodePlanConsole;
  readonly ui?: CodePlanUiRuntimeOptions;
  readonly onEvent?: (event: RuntimeEvent) => void;
}

export interface CodePlanRunResult {
  readonly status: "done" | "failed";
  readonly result?: unknown;
  readonly errors: Record<string, ToolRunError>;
  readonly error?: string;
  readonly errorCode?: CodePlanExecutorErrorCode;
  readonly executorId?: string;
}

interface ToolContractError extends Error {
  readonly type: ToolRunErrorType;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
}

export const defaultCodePlanMaxOps = 100_000;

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

  const executor = options.executor;

  if (options.ui && !executor.profile.supportsGeneratedUi) {
    return failExecutorRun({
      planId,
      executorId: executor.profile.id,
      code: "executor_unsupported_generated_ui",
      message: `Executor "${executor.profile.id}" does not support generated UI.`,
      errors,
      onEvent: options.onEvent,
    });
  }

  if (options.signal?.aborted) {
    return failExecutorRun({
      planId,
      executorId: executor.profile.id,
      code: "executor_aborted",
      message: "Code plan execution aborted.",
      errors,
      onEvent: options.onEvent,
    });
  }

  options.onEvent?.({
    type: "plan.started",
    planId,
    executorId: executor.profile.id,
  });

  try {
    const result = await executor.execute({
      code: options.code,
      globals: createExecutionGlobals({
        input: options.input ?? {},
        tools,
        console:
          options.console ??
          createSafeCodePlanConsole((message) => {
            options.onEvent?.({ type: "plan.console", planId, ...message });
          }),
        ui: options.ui,
      }),
      maxOps: options.maxOps ?? defaultCodePlanMaxOps,
      signal: options.signal,
    });

    options.onEvent?.({
      type: "plan.completed",
      planId,
      executorId: executor.profile.id,
      result,
    });

    return {
      status: "done",
      result,
      errors,
    };
  } catch (error) {
    const failure = normalizeExecutorFailure(error, options.signal);
    return failExecutorRun({
      planId,
      executorId: executor.profile.id,
      code: failure.code,
      message: failure.message,
      errors,
      onEvent: options.onEvent,
    });
  }
}

function normalizeExecutorFailure(
  error: unknown,
  signal?: AbortSignal,
): { readonly code: CodePlanExecutorErrorCode; readonly message: string } {
  if (signal?.aborted) {
    return {
      code: "executor_aborted",
      message: "Code plan execution aborted.",
    };
  }

  if (error instanceof CodePlanExecutorError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "executor_execution_failed",
    message: error instanceof Error ? error.message : String(error),
  };
}

function failExecutorRun(options: {
  readonly planId: string;
  readonly executorId: string;
  readonly code: CodePlanExecutorErrorCode;
  readonly message: string;
  readonly errors: Record<string, ToolRunError>;
  readonly onEvent?: (event: RuntimeEvent) => void;
}): CodePlanRunResult {
  options.onEvent?.({
    type: "plan.failed",
    planId: options.planId,
    executorId: options.executorId,
    errorCode: options.code,
    error: options.message,
    errors: options.errors,
  });

  return {
    status: "failed",
    errors: options.errors,
    error: options.message,
    errorCode: options.code,
    executorId: options.executorId,
  };
}

export function createSafeCodePlanConsole(
  onMessage?: CodePlanConsoleHandler,
): CodePlanConsole {
  const emit = (level: RuntimeConsoleLevel, args: readonly unknown[]) => {
    onMessage?.({
      level,
      args: args.map((value) => sanitizeConsoleValue(value)),
    });
  };

  return Object.freeze({
    debug: (...args: readonly unknown[]) => emit("debug", args),
    log: (...args: readonly unknown[]) => emit("log", args),
    info: (...args: readonly unknown[]) => emit("info", args),
    warn: (...args: readonly unknown[]) => emit("warn", args),
    error: (...args: readonly unknown[]) => emit("error", args),
  });
}

function createExecutionGlobals(options: {
  readonly input: unknown;
  readonly tools: Record<string, unknown>;
  readonly console: CodePlanConsole;
  readonly ui?: CodePlanUiRuntimeOptions;
}): CodePlanExecutionGlobals {
  return {
    input: options.input,
    tools: options.tools,
    console: options.console,
    ...(options.ui ? { html: options.ui.html } : {}),
  };
}

function sanitizeConsoleValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > 1_000 ? `${value.slice(0, 1_000)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }
  if (typeof value === "function") return "[Function]";

  if (depth >= 2) {
    return Array.isArray(value) ? "[Array]" : "[Object]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeConsoleValue(item, depth + 1));
  }

  if (typeof value === "object") {
    let entries: [string, unknown][];
    try {
      entries = Object.entries(value as Record<string, unknown>).slice(0, 20);
    } catch {
      return "[Object]";
    }
    return Object.fromEntries(
      entries.map(([key, item]) => [
        key,
        sanitizeConsoleValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
}

function createToolsObject(
  tools: readonly Tool[],
  call: (toolName: string, params: unknown) => Promise<unknown>,
): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const tool of tools) {
    root[tool.name] = (params: unknown) => call(tool.name, params);

    const path = tool.name.split(".");
    const methodName = path.pop();
    if (!methodName) continue;

    let current = root;
    const namespace: string[] = [];
    for (const segment of path) {
      namespace.push(segment);
      const existing = current[segment];
      if (
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        current = existing as Record<string, unknown>;
      } else {
        const next: Record<string, unknown> = {};
        current[segment] = next;
        current = next;
      }
      root[namespace.join(".")] = current;
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
  readonly execute: (context: {
    readonly attempt: number;
    readonly maxAttempts: number;
  }) => Promise<ToolOk<unknown>>;
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
