import type { GeneratedUi, GeneratedUiFrame } from "./index.ts";

export type GeneratedUiEventName = "click" | "submit" | "input" | "change";

export interface GeneratedUiActionEvent {
  readonly handlerId: string;
  readonly eventName?: GeneratedUiEventName;
}

export interface GeneratedUiActionEndEvent extends GeneratedUiActionEvent {
  readonly status: "done" | "error";
  readonly error?: unknown;
}

export interface GeneratedUiRenderOptions {
  readonly onError?: (error: unknown) => void;
  readonly onRender?: (frame: GeneratedUiFrame) => void;
  readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
  readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
}

export interface GeneratedUiRenderSession {
  readonly rendererId: string;
  render(): void;
  runHandler(
    handlerId: string,
    event?: unknown,
    eventName?: GeneratedUiEventName,
  ): Promise<void>;
  update(nextUi: GeneratedUi): void;
  destroy(): void;
}

export interface GeneratedUiRenderer<TTarget> {
  readonly id: string;
  mount(
    target: TTarget,
    ui: GeneratedUi,
    options?: GeneratedUiRenderOptions,
  ): GeneratedUiRenderSession;
}
