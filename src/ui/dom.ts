import { Result } from "better-result";
import type { UiCallable, UiRenderCleanup } from "../ui-runtime.ts";
import type { GeneratedUi, GeneratedUiFrame } from "./index.ts";

export type GeneratedUiEventName = "click" | "submit" | "input" | "change";

export interface GeneratedUiHandlerMatch {
  readonly eventName: GeneratedUiEventName;
  readonly attribute: string;
  readonly handlerId: string;
}

export interface GeneratedUiEventPayload {
  readonly type: string;
  readonly target?: {
    readonly name: string;
    readonly value: string;
    readonly checked: boolean;
  };
  preventDefault(): void;
}

export interface GeneratedUiActionEvent {
  readonly handlerId: string;
  readonly eventName?: GeneratedUiEventName;
}

export interface GeneratedUiActionEndEvent extends GeneratedUiActionEvent {
  readonly status: "done" | "error";
  readonly error?: unknown;
}

export interface GeneratedUiMountOptions {
  readonly onError?: (error: unknown) => void;
  readonly onRender?: (frame: GeneratedUiFrame) => void;
  readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
  readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
}

export interface GeneratedUiMountElement {
  innerHTML: string;
  querySelector?(selector: string): Element | null;
  addEventListener(type: string, listener: (event: unknown) => unknown): void;
  removeEventListener(
    type: string,
    listener: (event: unknown) => unknown,
  ): void;
}

export interface GeneratedUiMountHandle {
  render(): void;
  runHandler(
    handlerId: string,
    event?: unknown,
    eventName?: GeneratedUiEventName,
  ): Promise<void>;
  update(nextUi: GeneratedUi): void;
  destroy(): void;
}

const eventAttributes: Record<GeneratedUiEventName, string> = {
  click: "data-gr-click",
  submit: "data-gr-submit",
  input: "data-gr-input",
  change: "data-gr-change",
};

export function mountGeneratedUi(
  element: GeneratedUiMountElement,
  ui: GeneratedUi,
  options: GeneratedUiMountOptions = {},
): GeneratedUiMountHandle {
  let currentUi = ui;
  let destroyed = false;
  let renderCleanups: UiRenderCleanup[] = [];

  function cleanupRenderers() {
    const cleanups = renderCleanups;
    renderCleanups = [];

    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (error) {
        options.onError?.(error);
      }
    }
  }

  function render() {
    if (destroyed) return;

    const frame = currentUi.render();
    if (Result.isError(frame)) {
      options.onError?.(frame.unwrapError());
      return;
    }

    cleanupRenderers();
    element.innerHTML = frame.value.html;
    mountRenderers(frame.value);
    options.onRender?.(frame.value);
  }

  function mountRenderers(frame: GeneratedUiFrame) {
    for (const mount of frame.mounts ?? []) {
      const target = element.querySelector?.(
        `[data-gr-render="${mount.id}"]`,
      );

      if (!target) {
        options.onError?.(
          new Error(`Generated UI renderer target "${mount.id}" was not found.`),
        );
        continue;
      }

      try {
        const cleanup = mount.renderer.mount({
          target,
          value: mount.value,
          call: callRendererCallback,
          requestRender() {
            queueMicrotask(render);
          },
        });
        if (cleanup) renderCleanups.push(cleanup);
      } catch (error) {
        options.onError?.(error);
      }
    }
  }

  async function runHandler(
    handlerId: string,
    event?: unknown,
    eventName?: GeneratedUiEventName,
  ): Promise<void> {
    if (destroyed) return;

    options.onActionStart?.({ handlerId, eventName });

    try {
      if (event === undefined) {
        await currentUi.runHandler(handlerId);
      } else {
        await currentUi.runHandler(
          handlerId,
          createGeneratedEventPayload(event),
        );
      }
      render();
      options.onActionEnd?.({ handlerId, eventName, status: "done" });
    } catch (error) {
      options.onError?.(error);
      options.onActionEnd?.({ handlerId, eventName, status: "error", error });
    }
  }

  const onEvent = (event: unknown) => {
    const match = findGeneratedHandler(event);
    if (!match) return;

    if (match.eventName === "click" || match.eventName === "submit") {
      preventDefault(event);
    }

    return runHandler(match.handlerId, event, match.eventName);
  };

  render();

  for (const eventName of Object.keys(eventAttributes)) {
    element.addEventListener(eventName, onEvent);
  }

  return {
    render,
    runHandler,
    update(nextUi) {
      currentUi = nextUi;
      render();
    },
    destroy() {
      destroyed = true;
      cleanupRenderers();

      for (const eventName of Object.keys(eventAttributes)) {
        element.removeEventListener(eventName, onEvent);
      }
    },
  };
}

function callRendererCallback(
  callback: UiCallable,
  ...args: readonly unknown[]
): unknown {
  if (typeof callback === "function") return callback(...args);
  return callback.call(undefined, ...args);
}

export function findGeneratedHandler(
  event: unknown,
): GeneratedUiHandlerMatch | undefined {
  const eventName = readEventName(event);
  if (!eventName) return undefined;

  const attribute = eventAttributes[eventName];
  const handlerId = readHandlerId(event, attribute);
  if (!handlerId) return undefined;

  return { eventName, attribute, handlerId };
}

export function createGeneratedEventPayload(
  event: unknown,
): GeneratedUiEventPayload {
  const target = readEventTarget(event);
  const control = isFormControlLike(target) ? target : undefined;

  return {
    type: readEventType(event),
    target: control
      ? {
          name: stringValue(control.name),
          value: stringValue(control.value),
          checked: booleanValue(control.checked),
        }
      : undefined,
    preventDefault() {
      preventDefault(event);
    },
  };
}

function readHandlerId(event: unknown, attribute: string): string | undefined {
  const target = readEventTarget(event);
  if (!isClosestTarget(target)) return undefined;

  const control = target.closest(`[${attribute}]`);
  const handlerId = control?.getAttribute(attribute)?.trim();
  return handlerId || undefined;
}

function readEventName(event: unknown): GeneratedUiEventName | undefined {
  const type = readEventType(event);
  return type in eventAttributes ? (type as GeneratedUiEventName) : undefined;
}

function readEventType(event: unknown): string {
  return isRecord(event) && typeof event.type === "string" ? event.type : "";
}

function readEventTarget(event: unknown): unknown {
  return isRecord(event) ? event.target : undefined;
}

function preventDefault(event: unknown): void {
  if (isRecord(event) && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
}

function isClosestTarget(value: unknown): value is {
  closest(
    selector: string,
  ):
    | { getAttribute(attribute: string): string | null | undefined }
    | null
    | undefined;
} {
  return isRecord(value) && typeof value.closest === "function";
}

function isFormControlLike(
  value: unknown,
): value is { name?: unknown; value?: unknown; checked?: unknown } {
  return (
    isRecord(value) &&
    ("value" in value || "checked" in value || "name" in value)
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : value === undefined || value === null
      ? ""
      : String(value);
}

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
