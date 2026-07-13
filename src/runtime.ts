import type { ToolOk } from "./tool.ts";

export type RetryPolicy = {
  readonly maxAttempts?: number;
  readonly delayMs?: number;
};

export type RuntimeConsoleLevel = "debug" | "log" | "info" | "warn" | "error";

export type ToolRunErrorType =
  | "unknown_tool"
  | "missing_handler"
  | "invalid_input"
  | "invalid_output"
  | "handler_error";

export interface ToolRunError {
  readonly type: ToolRunErrorType;
  readonly callId: string;
  readonly tool: string;
  readonly message: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
}

export type RuntimeEvent =
  | PlanStartedEvent
  | PlanConsoleEvent
  | PlanCompletedEvent
  | PlanFailedEvent
  | ToolStartedEvent
  | ToolRetryingEvent
  | ToolCompletedEvent
  | ToolFailedEvent;

export interface PlanStartedEvent {
  readonly type: "plan.started";
  readonly planId: string;
}

export interface PlanConsoleEvent {
  readonly type: "plan.console";
  readonly planId: string;
  readonly level: RuntimeConsoleLevel;
  readonly args: readonly unknown[];
}

export interface PlanCompletedEvent {
  readonly type: "plan.completed";
  readonly planId: string;
  readonly result: unknown;
}

export interface PlanFailedEvent {
  readonly type: "plan.failed";
  readonly planId: string;
  readonly error: string;
  readonly errors: Record<string, ToolRunError>;
}

export interface ToolStartedEvent {
  readonly type: "tool.started";
  readonly planId: string;
  readonly callId: string;
  readonly tool: string;
  readonly input: unknown;
}

export interface ToolRetryingEvent {
  readonly type: "tool.retrying";
  readonly planId: string;
  readonly callId: string;
  readonly tool: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly nextAttempt: number;
  readonly error: ToolRunError;
}

export interface ToolCompletedEvent {
  readonly type: "tool.completed";
  readonly planId: string;
  readonly callId: string;
  readonly tool: string;
  readonly output: ToolOk<unknown>;
}

export interface ToolFailedEvent {
  readonly type: "tool.failed";
  readonly planId: string;
  readonly callId: string;
  readonly tool: string;
  readonly error: ToolRunError;
}
