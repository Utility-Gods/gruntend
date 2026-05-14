import { createActor, fromPromise, setup, toPromise } from "xstate";
import type { ToolRegistry } from "./registry.ts";
import {
  parseStandardSchema,
  type Tool,
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
}

export type WorkflowErrorType = "unknown_tool" | "missing_handler" | "invalid_input" | "invalid_output" | "handler_error";

export interface WorkflowError {
  readonly type: WorkflowErrorType;
  readonly state: string;
  readonly tool: string;
  readonly message: string;
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

  const machineSetup = setup({
    actors: {
      tool: fromPromise<unknown, CompiledToolInvokeInput>(async ({ input, signal }) => {
        try {
          const result = await executeToolInvoke({
            input,
            registry: options.registry,
            handlers: options.handlers as Record<string, ToolHandler<unknown, unknown>>,
            outputs,
            signal: options.signal ?? signal,
          });

          outputs[input.state] = result;
          return result;
        } catch (error) {
          errors[input.state] = toWorkflowError(error, input.state, input.tool);
          throw error;
        }
      }),
    },
  });
  const machine = machineSetup.createMachine(
    workflow as Parameters<typeof machineSetup.createMachine>[0],
  );

  const actor = createActor(machine);
  actor.start();
  await toPromise(actor);

  const finalState = finalStateName(actor.getSnapshot().value);

  return {
    status: finalState === "failed" ? "failed" : "done",
    outputs,
    errors,
    finalState,
  };
}

async function executeToolInvoke(options: {
  readonly input: CompiledToolInvokeInput;
  readonly registry: ToolRegistry;
  readonly handlers: Record<string, ToolHandler<unknown, unknown>>;
  readonly outputs: Record<string, ToolResult<unknown>>;
  readonly signal?: AbortSignal;
}): Promise<ToolResult<unknown>> {
  const tool = options.registry.get(options.input.tool);

  if (!tool) {
    throw newToolContractError("unknown_tool", `Workflow references unknown tool "${options.input.tool}".`);
  }

  const handler = options.handlers[options.input.tool];

  if (!handler) {
    throw newToolContractError("missing_handler", `Tool "${options.input.tool}" does not have a runtime handler.`);
  }

  return await executeWithRetry({
    execute: async () => {
      const rawInput = resolveWorkflowValue(options.input.params, options.outputs);
      let parsedInput: unknown;

      try {
        parsedInput = await parseStandardSchema(tool.input, rawInput);
      } catch {
        throw newToolContractError("invalid_input", `Tool "${options.input.tool}" received invalid input.`);
      }

      let result: ToolResult<unknown>;

      try {
        result = await handler({
          input: parsedInput,
          signal: options.signal,
        });
      } catch (error) {
        if (isToolContractError(error)) {
          throw error;
        }

        throw newToolContractError(
          "handler_error",
          error instanceof Error ? error.message : `Tool "${options.input.tool}" handler failed.`,
        );
      }

      try {
        const parsedOutput = await parseStandardSchema(tool.output, result.data);
        return { data: parsedOutput };
      } catch {
        throw newToolContractError("invalid_output", `Tool "${options.input.tool}" returned invalid output.`);
      }
    },
    retry: options.input.retry,
  });
}

interface ToolContractError extends Error {
  readonly type: WorkflowErrorType;
}

function newToolContractError(type: WorkflowErrorType, message: string): ToolContractError {
  const error = new Error(message) as ToolContractError;
  Object.defineProperty(error, "type", {
    value: type,
    enumerable: true,
  });
  return error;
}

function isToolContractError(error: unknown): error is ToolContractError {
  return error instanceof Error && "type" in error;
}

function toWorkflowError(error: unknown, state: string, tool: string): WorkflowError {
  if (isToolContractError(error)) {
    return {
      type: error.type,
      state,
      tool,
      message: error.message,
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
  readonly execute: () => Promise<ToolResult<unknown>> | ToolResult<unknown>;
  readonly retry?: WorkflowRetryPolicy;
}): Promise<ToolResult<unknown>> {
  const maxAttempts = options.retry?.maxAttempts ?? 1;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await options.execute();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && options.retry?.delayMs) {
        await delay(options.retry.delayMs);
      }
    }
  }

  throw lastError;
}

function compileWorkflow(workflow: WorkflowMachineConfig): WorkflowMachineConfig {
  return {
    ...workflow,
    states: compileStates(workflow.states),
  };
}

function compileStates(states: Record<string, WorkflowStateConfig>): Record<string, WorkflowStateConfig> {
  return Object.fromEntries(
    Object.entries(states).map(([stateName, state]) => [stateName, compileState(stateName, state)]),
  );
}

function compileState(stateName: string, state: WorkflowStateConfig): WorkflowStateConfig {
  return {
    ...state,
    states: state.states ? compileStates(state.states) : undefined,
    invoke: state.invoke
      ? {
        ...state.invoke,
        input: {
          ...state.invoke.input,
          state: stateName,
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

function resolveWorkflowValue(value: WorkflowJsonValue, outputs: Record<string, ToolResult<unknown>>): unknown {
  if (isWorkflowRef(value)) {
    return resolveWorkflowRef(value.$ref, outputs);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveWorkflowValue(item, outputs));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveWorkflowValue(item, outputs)]),
    );
  }

  return value;
}

function isWorkflowRef(value: WorkflowJsonValue): value is WorkflowRef {
  return !!value && typeof value === "object" && !Array.isArray(value) && "$ref" in value;
}

function resolveWorkflowRef(ref: string, outputs: Record<string, ToolResult<unknown>>): unknown {
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
