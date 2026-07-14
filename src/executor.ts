import type { RuntimeConsoleLevel } from "./runtime.ts";
import type { UiTemplateTag } from "./ui-runtime.ts";

export type CodePlanExecutorTrust = "controlled" | "isolated";

export interface CodePlanExecutorProfile {
  /** Stable identifier used in diagnostics and explicit selection tests. */
  readonly id: string;
  /** Describes the intended trust boundary; it is not runtime proof. */
  readonly trust: CodePlanExecutorTrust;
  /** Whether this executor can preserve the current generated-UI contract. */
  readonly supportsGeneratedUi: boolean;
}

export interface CodePlanConsole {
  readonly debug: (...args: readonly unknown[]) => void;
  readonly log: (...args: readonly unknown[]) => void;
  readonly info: (...args: readonly unknown[]) => void;
  readonly warn: (...args: readonly unknown[]) => void;
  readonly error: (...args: readonly unknown[]) => void;
}

export interface CodePlanConsoleMessage {
  readonly level: RuntimeConsoleLevel;
  readonly args: readonly unknown[];
}

export type CodePlanConsoleHandler = (message: CodePlanConsoleMessage) => void;

export interface CodePlanExecutionGlobals {
  readonly input: unknown;
  readonly tools: Record<string, unknown>;
  readonly console: CodePlanConsole;
  readonly html?: UiTemplateTag;
}

export interface CodePlanExecutorContext {
  readonly code: string;
  readonly globals: CodePlanExecutionGlobals;
  readonly maxOps: number;
  readonly signal?: AbortSignal;
}

export interface CodePlanExecutor {
  readonly profile: CodePlanExecutorProfile;
  execute(context: CodePlanExecutorContext): Promise<unknown> | unknown;
}

export type CodePlanExecutorErrorCode =
  | "executor_aborted"
  | "executor_initialization_failed"
  | "executor_unavailable"
  | "executor_execution_failed"
  | "executor_unsupported_generated_ui";

export class CodePlanExecutorError extends Error {
  readonly code: CodePlanExecutorErrorCode;

  constructor(code: CodePlanExecutorErrorCode, message: string) {
    super(message);
    this.name = "CodePlanExecutorError";
    this.code = code;
  }
}

export function executorError(
  code: CodePlanExecutorErrorCode,
  message: string,
): CodePlanExecutorError {
  return new CodePlanExecutorError(code, message);
}

export function isCodePlanExecutorError(
  value: unknown,
): value is CodePlanExecutorError {
  return value instanceof CodePlanExecutorError;
}
