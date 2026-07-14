import { createGruntendClient } from "gruntend-sdk/client";
import type { CodePlanExecutor } from "gruntend-sdk/executor";
import { createJailJsCodePlanExecutor } from "gruntend-sdk/executor/jailjs";
import { appTools } from "./tools";

export const jailJsExecutor = createJailJsCodePlanExecutor();

let quickJsExecutorPromise: Promise<CodePlanExecutor> | undefined;

export function getQuickJsBrowserExecutor(): Promise<CodePlanExecutor> {
  return (quickJsExecutorPromise ??= import(
    "gruntend-sdk/executor/quickjs-browser"
  ).then(({ createQuickJsBrowserCodePlanExecutor }) =>
    createQuickJsBrowserCodePlanExecutor({
      memoryLimitBytes: 32 * 1024 * 1024,
      maxStackBytes: 512 * 1024,
      timeoutMs: 10_000,
    }),
  ));
}

export const gruntend = createGruntendClient({
  tools: appTools,
  executor: jailJsExecutor,
});
