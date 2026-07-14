import { Result } from "better-result";
import type {
  GeneratedUiActionEndEvent,
  GeneratedUiActionEvent,
  GeneratedUiEventName,
  GeneratedUiRenderer,
  GeneratedUiRenderOptions,
  GeneratedUiRenderSession,
} from "../renderer.ts";
import type { GeneratedUi, GeneratedUiFrame } from "../ui/index.ts";

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

export interface GeneratedUiDomTarget {
  innerHTML: string;
  addEventListener(type: string, listener: (event: unknown) => unknown): void;
  removeEventListener(
    type: string,
    listener: (event: unknown) => unknown,
  ): void;
  contains?(value: Node | null): boolean;
}

export interface GeneratedUiDomCommitter<TTarget extends GeneratedUiDomTarget> {
  commit(target: TTarget, frame: GeneratedUiFrame): void;
  clear(target: TTarget): void;
}

const eventAttributes: Record<GeneratedUiEventName, string> = {
  click: "data-gr-click",
  submit: "data-gr-submit",
  input: "data-gr-input",
  change: "data-gr-change",
};

const eventNames = Object.keys(eventAttributes) as GeneratedUiEventName[];

export function createGeneratedUiDomRenderer<
  TTarget extends GeneratedUiDomTarget,
>(
  id: string,
  committer: GeneratedUiDomCommitter<TTarget>,
): GeneratedUiRenderer<TTarget> {
  return Object.freeze({
    id,
    mount(
      target: TTarget,
      ui: GeneratedUi,
      options: GeneratedUiRenderOptions = {},
    ) {
      return mountGeneratedUiDomSession(id, target, ui, options, committer);
    },
  });
}

export function mountGeneratedUiDomSession<
  TTarget extends GeneratedUiDomTarget,
>(
  rendererId: string,
  target: TTarget,
  ui: GeneratedUi,
  options: GeneratedUiRenderOptions,
  committer: GeneratedUiDomCommitter<TTarget>,
): GeneratedUiRenderSession {
  let currentUi = ui;
  let revision = 0;
  let destroyed = false;

  function failRender(error: unknown) {
    try {
      committer.clear(target);
    } catch (clearError) {
      options.onError?.(clearError);
      return;
    }
    options.onError?.(error);
  }

  function render() {
    if (destroyed) return;

    const frame = currentUi.render();
    if (Result.isError(frame)) {
      failRender(frame.unwrapError());
      return;
    }

    try {
      committer.commit(target, frame.value);
      options.onRender?.(frame.value);
    } catch (error) {
      failRender(error);
    }
  }

  async function runHandler(
    handlerId: string,
    event?: unknown,
    eventName?: GeneratedUiEventName,
  ): Promise<void> {
    if (destroyed) return;

    const actionRevision = revision;
    const actionUi = currentUi;
    const action: GeneratedUiActionEvent = { handlerId, eventName };
    options.onActionStart?.(action);

    try {
      if (event === undefined) {
        await actionUi.runHandler(handlerId);
      } else {
        await actionUi.runHandler(
          handlerId,
          createGeneratedEventPayload(event),
        );
      }
      if (!destroyed && actionRevision === revision && actionUi === currentUi) {
        render();
      }
      if (destroyed) return;
      const completed: GeneratedUiActionEndEvent = {
        ...action,
        status: "done",
      };
      options.onActionEnd?.(completed);
    } catch (error) {
      if (destroyed) return;
      options.onError?.(error);
      const failed: GeneratedUiActionEndEvent = {
        ...action,
        status: "error",
        error,
      };
      options.onActionEnd?.(failed);
    }
  }

  const onEvent = (event: unknown) => {
    const match = findGeneratedHandler(event, target);
    if (!match) return;

    if (match.eventName === "click" || match.eventName === "submit") {
      preventDefault(event);
    }

    return runHandler(match.handlerId, event, match.eventName);
  };

  render();

  for (const eventName of eventNames) {
    target.addEventListener(eventName, onEvent);
  }

  return {
    rendererId,
    render,
    runHandler,
    update(nextUi) {
      if (destroyed || currentUi === nextUi) return;
      revision += 1;
      currentUi.destroy();
      currentUi = nextUi;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      revision += 1;
      currentUi.destroy();

      for (const eventName of eventNames) {
        target.removeEventListener(eventName, onEvent);
      }

      committer.clear(target);
    },
  };
}

export function findGeneratedHandler(
  event: unknown,
  root?: GeneratedUiDomTarget,
): GeneratedUiHandlerMatch | undefined {
  const eventName = readEventName(event);
  if (!eventName) return undefined;

  const attribute = eventAttributes[eventName];
  const control = readHandlerTarget(event, attribute);
  if (!control || !belongsToRoot(control, root)) return undefined;

  const handlerId = control.getAttribute(attribute)?.trim();
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

interface HandlerTarget {
  getAttribute(attribute: string): string | null | undefined;
}

function readHandlerTarget(
  event: unknown,
  attribute: string,
): HandlerTarget | undefined {
  const target = readEventTarget(event);
  if (!isClosestTarget(target)) return undefined;
  return target.closest(`[${attribute}]`) ?? undefined;
}

function belongsToRoot(
  target: HandlerTarget,
  root?: GeneratedUiDomTarget,
): boolean {
  if (!root || typeof root.contains !== "function") return true;
  if ((target as unknown) === root) return false;
  return root.contains(target as unknown as Node);
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
  closest(selector: string): HandlerTarget | null | undefined;
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
