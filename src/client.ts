import { createToolRegistry, type ToolRegistry } from "./registry.ts";
import type { Tool, ToolHandlerMap } from "./tool.ts";
import { runWorkflow, type WorkflowMachineConfig, type WorkflowRunResult } from "./workflow.ts";

export interface GenOpenClientOptions<TTools extends readonly Tool[] = readonly Tool[]> {
  readonly tools?: TTools;
  readonly registry?: ToolRegistry<TTools[number]>;
}

export interface GenOpenClient<TTools extends readonly Tool[] = readonly Tool[]> {
  readonly registry: ToolRegistry<TTools[number]>;
  runWorkflow(workflow: WorkflowMachineConfig, options: GenOpenClientRunOptions<TTools>): Promise<WorkflowRunResult>;
}

export interface GenOpenClientRunOptions<TTools extends readonly Tool[] = readonly Tool[]> {
  readonly handlers: ToolHandlerMap<TTools>;
  readonly signal?: AbortSignal;
}

export function createGenOpenClient<const TTools extends readonly Tool[]>(
  options: GenOpenClientOptions<TTools>,
): GenOpenClient<TTools> {
  const registry = options.registry ?? createToolRegistry(options.tools ?? []);

  return {
    registry,
    runWorkflow(workflow, runOptions) {
      return runWorkflow({
        workflow,
        registry,
        handlers: runOptions.handlers,
        signal: runOptions.signal,
      });
    },
  };
}
