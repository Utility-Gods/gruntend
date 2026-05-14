import { createToolRegistry, type ToolRegistry } from "./registry.ts";
import type { Tool } from "./tool.ts";
import { runWorkflow, type WorkflowMachineConfig, type WorkflowRunResult } from "./workflow.ts";

export interface GenOpenClientOptions<Context = unknown> {
  readonly tools?: readonly Tool[];
  readonly registry?: ToolRegistry;
  readonly context?: Context;
}

export interface GenOpenClient {
  readonly registry: ToolRegistry;
  runWorkflow(workflow: WorkflowMachineConfig, options?: GenOpenClientRunOptions): Promise<WorkflowRunResult>;
}

export interface GenOpenClientRunOptions {
  readonly signal?: AbortSignal;
}

export function createGenOpenClient<Context = unknown>(
  options: GenOpenClientOptions<Context>,
): GenOpenClient {
  const registry = options.registry ?? createToolRegistry(options.tools ?? []);

  return {
    registry,
    runWorkflow(workflow, runOptions) {
      return runWorkflow({
        workflow,
        registry,
        context: options.context,
        signal: runOptions?.signal,
      });
    },
  };
}
