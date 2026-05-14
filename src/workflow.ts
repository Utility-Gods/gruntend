import { createActor, fromPromise, setup, toPromise } from "xstate";
import type { ToolRegistry } from "./registry.ts";
import type { ToolResult } from "./tool.ts";

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

export interface WorkflowRunOptions {
  readonly workflow: WorkflowMachineConfig;
  readonly registry: ToolRegistry;
  readonly context?: unknown;
  readonly signal?: AbortSignal;
}

export interface WorkflowRunResult {
  readonly status: "done" | "failed";
  readonly outputs: Record<string, ToolResult<unknown>>;
  readonly finalState: string;
}

interface CompiledToolInvokeInput extends WorkflowToolInvokeInput {
  readonly state: string;
}

export async function runWorkflow(options: WorkflowRunOptions): Promise<WorkflowRunResult> {
  const outputs: Record<string, ToolResult<unknown>> = {};
  const workflow = compileWorkflow(options.workflow);

  const machineSetup = setup({
    actors: {
      tool: fromPromise<unknown, CompiledToolInvokeInput>(async ({ input, signal }) => {
        const tool = options.registry.get(input.tool);

        if (!tool) {
          throw new Error(`Workflow references unknown tool "${input.tool}".`);
        }

        const result = await executeWithRetry({
          execute: () =>
            tool.execute({
              input: resolveWorkflowValue(input.params, outputs),
              context: options.context,
              signal: options.signal ?? signal,
            }),
          retry: input.retry,
        });

        outputs[input.state] = result;
        return result;
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
    finalState,
  };
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
