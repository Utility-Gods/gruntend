import { createActor, fromPromise, setup, toPromise } from "xstate";
import type { ToolRegistry } from "./registry.ts";
import {
  parseStandardSchema,
  ok,
  err,
  type Tool,
  type ToolExecutionError,
  type ToolHandler,
  type ToolHandlerMapFor,
  type ToolResult,
} from "./tool.ts";

export type WorkflowStateType = "final" | "parallel";

export type WorkflowJsonValue =
  | string
  | number
  | boolean
  | null
  | WorkflowRef
  | readonly WorkflowJsonValue[]
  | { readonly [key: string]: WorkflowJsonValue };

export interface WorkflowRef {
  readonly $ref: string;
}

export interface WorkflowMachineConfig {
  readonly id: string;
  readonly initial?: string;
  readonly type?: WorkflowStateType;
  readonly states: Record<string, WorkflowStateConfig>;
}

export interface WorkflowStateConfig {
  readonly type?: WorkflowStateType;
  readonly initial?: string;
  readonly states?: Record<string, WorkflowStateConfig>;
  readonly invoke?: WorkflowInvokeConfig;
  readonly onDone?: string | WorkflowTransitionConfig;
}

export interface WorkflowInvokeConfig {
  readonly src: "tool";
  readonly input: WorkflowToolInvokeInput;
  readonly onDone?: string | WorkflowTransitionConfig;
  readonly onError?: string | WorkflowTransitionConfig;
}

export interface WorkflowToolInvokeInput {
  readonly tool: string;
  readonly params: Record<string, WorkflowJsonValue>;
  readonly retry?: WorkflowRetryPolicy;
}

export interface WorkflowRetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs?: number;
}

export interface WorkflowTransitionConfig {
  readonly target: string;
}

export interface WorkflowRunOptions<TTool extends Tool = Tool> {
  readonly workflow: WorkflowMachineConfig;
  readonly registry: ToolRegistry<TTool>;
  readonly handlers: ToolHandlerMapFor<TTool>;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: WorkflowRuntimeEvent) => void;
}

export type WorkflowRuntimeEvent =
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ToolRetryingEvent
  | ToolFailedEvent;

export interface WorkflowStartedEvent {
  readonly type: "workflow.started";
  readonly workflowId: string;
}

export interface WorkflowCompletedEvent {
  readonly type: "workflow.completed";
  readonly workflowId: string;
  readonly finalState: string;
}

export interface WorkflowFailedEvent {
  readonly type: "workflow.failed";
  readonly workflowId: string;
  readonly finalState: string;
  readonly errors: Record<string, WorkflowError>;
}

export interface ToolStartedEvent {
  readonly type: "tool.started";
  readonly workflowId: string;
  readonly state: string;
  readonly tool: string;
  readonly input: unknown;
}

export interface ToolCompletedEvent {
  readonly type: "tool.completed";
  readonly workflowId: string;
  readonly state: string;
  readonly tool: string;
  readonly output: ToolResult<unknown>;
}

export interface ToolRetryingEvent {
  readonly type: "tool.retrying";
  readonly workflowId: string;
  readonly state: string;
  readonly tool: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly nextAttempt: number;
  readonly error: WorkflowError;
}

export interface ToolFailedEvent {
  readonly type: "tool.failed";
  readonly workflowId: string;
  readonly state: string;
  readonly tool: string;
  readonly error: WorkflowError;
}

export type WorkflowErrorType =
  | "unknown_tool"
  | "missing_handler"
  | "invalid_input"
  | "invalid_output"
  | "handler_error";

export interface WorkflowError {
  readonly type: WorkflowErrorType;
  readonly state: string;
  readonly tool: string;
  readonly message: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
}

export interface WorkflowRunResult {
  readonly status: "done" | "failed";
  readonly outputs: Record<string, ToolResult<unknown>>;
  readonly errors: Record<string, WorkflowError>;
  readonly finalState: string;
}

interface CompiledToolInvokeInput extends WorkflowToolInvokeInput {
  readonly state: string;
}

export async function runWorkflow<TTool extends Tool>(
  options: WorkflowRunOptions<TTool>,
): Promise<WorkflowRunResult> {
  const outputs: Record<string, ToolResult<unknown>> = {};
  const errors: Record<string, WorkflowError> = {};
  const workflow = compileWorkflow(options.workflow);
  options.onEvent?.({
    type: "workflow.started",
    workflowId: options.workflow.id,
  });

  const machineSetup = setup({
    actors: {
      tool: fromPromise<unknown, CompiledToolInvokeInput>(
        async ({ input, signal }) => {
          try {
            const result = await executeToolInvoke({
              workflowId: options.workflow.id,
              input,
              registry: options.registry,
              handlers: options.handlers as Record<
                string,
                ToolHandler<unknown, unknown>
              >,
              outputs,
              signal: options.signal ?? signal,
              onEvent: options.onEvent,
            });

            outputs[input.state] = result;
            return result;
          } catch (error) {
            const workflowError = toWorkflowError(
              error,
              input.state,
              input.tool,
            );
            errors[input.state] = workflowError;
            options.onEvent?.({
              type: "tool.failed",
              workflowId: options.workflow.id,
              state: input.state,
              tool: input.tool,
              error: workflowError,
            });
            throw error;
          }
        },
      ),
    },
  });
  const machine = machineSetup.createMachine(
    workflow as Parameters<typeof machineSetup.createMachine>[0],
  );

  const actor = createActor(machine);
  actor.start();
  await toPromise(actor);

  const finalState = finalStateName(actor.getSnapshot().value);

  const status = finalState === "failed" ? "failed" : "done";

  options.onEvent?.(
    status === "failed"
      ? {
          type: "workflow.failed",
          workflowId: options.workflow.id,
          finalState,
          errors,
        }
      : {
          type: "workflow.completed",
          workflowId: options.workflow.id,
          finalState,
        },
  );

  return {
    status,
    outputs,
    errors,
    finalState,
  };
}

async function executeToolInvoke(options: {
  readonly workflowId: string;
  readonly input: CompiledToolInvokeInput;
  readonly registry: ToolRegistry;
  readonly handlers: Record<string, ToolHandler<unknown, unknown>>;
  readonly outputs: Record<string, ToolResult<unknown>>;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: WorkflowRuntimeEvent) => void;
}): Promise<ToolResult<unknown>> {
  const tool = options.registry.get(options.input.tool);

  if (!tool) {
    throw newToolContractError(
      "unknown_tool",
      `Workflow references unknown tool "${options.input.tool}".`,
    );
  }

  const handler = options.handlers[options.input.tool];

  if (!handler) {
    throw newToolContractError(
      "missing_handler",
      `Tool "${options.input.tool}" does not have a runtime handler.`,
    );
  }

  return await executeWithRetry({
    execute: async ({ attempt, maxAttempts }) => {
      const rawInput = resolveWorkflowValue(
        options.input.params,
        options.outputs,
      );
      let parsedInput: unknown;

      try {
        parsedInput = await parseStandardSchema(tool.input, rawInput);
      } catch {
        throw newToolContractError(
          "invalid_input",
          `Tool "${options.input.tool}" received invalid input.`,
          { retryable: false },
        );
      }

      options.onEvent?.({
        type: "tool.started",
        workflowId: options.workflowId,
        state: options.input.state,
        tool: options.input.tool,
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
            : `Tool "${options.input.tool}" handler failed.`,
          { retryable: true },
        );
      }

      if (!result.ok) {
        throw newToolContractError(
          "handler_error",
          result.error.message,
          {
            code: result.error.code,
            retryable: result.error.retryable ?? false,
            details: result.error.details,
          },
        );
      }

      try {
        const parsedOutput = await parseStandardSchema(
          tool.output,
          result.data,
        );
        const output = ok(parsedOutput);
        options.onEvent?.({
          type: "tool.completed",
          workflowId: options.workflowId,
          state: options.input.state,
          tool: options.input.tool,
          output,
        });
        return output;
      } catch {
        throw newToolContractError(
          "invalid_output",
          `Tool "${options.input.tool}" returned invalid output.`,
          { retryable: false },
        );
      }
    },
    retry: options.input.retry,
    onRetry: ({ error, attempt, maxAttempts }) => {
      options.onEvent?.({
        type: "tool.retrying",
        workflowId: options.workflowId,
        state: options.input.state,
        tool: options.input.tool,
        attempt,
        maxAttempts,
        nextAttempt: attempt + 1,
        error: toWorkflowError(error, options.input.state, options.input.tool),
      });
    },
  });
}

interface ToolContractError extends Error {
  readonly type: WorkflowErrorType;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
}

function newToolContractError(
  type: WorkflowErrorType,
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

function toWorkflowError(
  error: unknown,
  state: string,
  tool: string,
): WorkflowError {
  if (isToolContractError(error)) {
    return {
      type: error.type,
      state,
      tool,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(typeof error.retryable === "boolean" ? { retryable: error.retryable } : {}),
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    type: "handler_error",
    state,
    tool,
    message: error instanceof Error ? error.message : String(error),
  };
}

async function executeWithRetry(options: {
  readonly execute: (context: { readonly attempt: number; readonly maxAttempts: number }) => Promise<ToolResult<unknown>>;
  readonly retry?: WorkflowRetryPolicy;
  readonly onRetry?: (context: {
    readonly error: unknown;
    readonly attempt: number;
    readonly maxAttempts: number;
  }) => void;
}): Promise<ToolResult<unknown>> {
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

function compileWorkflow(
  workflow: WorkflowMachineConfig,
): WorkflowMachineConfig {
  return {
    ...workflow,
    states: compileStates(workflow.states),
  };
}

function compileStates(
  states: Record<string, WorkflowStateConfig>,
  parentPath = "",
): Record<string, WorkflowStateConfig> {
  return Object.fromEntries(
    Object.entries(states).map(([stateName, state]) => {
      const path = parentPath ? `${parentPath}.${stateName}` : stateName;
      return [stateName, compileState(path, state)];
    }),
  );
}

function compileState(
  statePath: string,
  state: WorkflowStateConfig,
): WorkflowStateConfig {
  return {
    ...state,
    states: state.states ? compileStates(state.states, statePath) : undefined,
    invoke: state.invoke
      ? {
          ...state.invoke,
          input: {
            ...state.invoke.input,
            state: statePath,
          } as CompiledToolInvokeInput,
        }
      : undefined,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finalStateName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function resolveWorkflowValue(
  value: WorkflowJsonValue,
  outputs: Record<string, ToolResult<unknown>>,
): unknown {
  if (isWorkflowRef(value)) {
    return resolveWorkflowRef(value.$ref, outputs);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveWorkflowValue(item, outputs));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveWorkflowValue(item, outputs),
      ]),
    );
  }

  return value;
}

function isWorkflowRef(value: WorkflowJsonValue): value is WorkflowRef {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "$ref" in value
  );
}

function resolveWorkflowRef(
  ref: string,
  outputs: Record<string, ToolResult<unknown>>,
): unknown {
  const path = ref.split(".");
  let current: unknown = outputs;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      throw new Error(`Workflow reference "${ref}" could not be resolved.`);
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
