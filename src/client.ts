import { type CodePlanRunResult, runCodePlan } from "./code-plan.ts";
import { createToolRegistry, type ToolRegistry } from "./registry.ts";
import type { RetryPolicy, RuntimeEvent } from "./runtime.ts";
import type { Tool, ToolHandlerMap } from "./tool.ts";

export interface GruntendClientOptions<
  TTools extends readonly Tool[] = readonly Tool[],
> {
  readonly tools?: TTools;
  readonly registry?: ToolRegistry<TTools[number]>;
}

export interface GruntendClient<
  TTools extends readonly Tool[] = readonly Tool[],
> {
  readonly registry: ToolRegistry<TTools[number]>;
  runCodePlan(
    code: string,
    options: GruntendClientCodePlanRunOptions<TTools>,
  ): Promise<CodePlanRunResult>;
}

export interface GruntendClientCodePlanRunOptions<
  TTools extends readonly Tool[] = readonly Tool[],
> {
  readonly input?: unknown;
  readonly id?: string;
  readonly retry?: RetryPolicy;
  readonly handlers: ToolHandlerMap<TTools>;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: RuntimeEvent) => void;
}

export function createGruntendClient<const TTools extends readonly Tool[]>(
  options: GruntendClientOptions<TTools>,
): GruntendClient<TTools> {
  const registry = options.registry ?? createToolRegistry(options.tools ?? []);

  return {
    registry,
    runCodePlan(code, runOptions) {
      return runCodePlan({
        code,
        input: runOptions.input,
        id: runOptions.id,
        registry,
        handlers: runOptions.handlers,
        signal: runOptions.signal,
        retry: runOptions.retry,
        onEvent: runOptions.onEvent,
      });
    },
  };
}
