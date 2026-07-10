import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";
import type {
  GeneratedUi as GeneratedUiController,
  GeneratedUiFrame,
} from "../index.ts";
import {
  mountGeneratedUi,
  type GeneratedUiActionEndEvent,
  type GeneratedUiActionEvent,
  type GeneratedUiMountHandle,
} from "../dom.ts";

export interface GeneratedUiProps {
  readonly ui: GeneratedUiController;
  readonly class?: string;
  readonly className?: string;
  readonly onError?: (error: unknown) => void;
  readonly onRender?: (frame: GeneratedUiFrame) => void;
  readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
  readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
}

export function GeneratedUi(props: GeneratedUiProps): JSX.Element {
  let root: HTMLDivElement | undefined;
  let mounted: GeneratedUiMountHandle | undefined;
  let mountedUi: GeneratedUiController | undefined;
  const [running, setRunning] = createSignal(false);
  const [surfaceError, setSurfaceError] = createSignal("");

  onMount(() => {
    if (!root) return;

    mountedUi = props.ui;
    mounted = mountGeneratedUi(root, props.ui, {
      onError(error) {
        setSurfaceError(errorText(error));
        props.onError?.(error);
      },
      onRender(frame) {
        setSurfaceError("");
        props.onRender?.(frame);
      },
      onActionStart(event) {
        setRunning(true);
        props.onActionStart?.(event);
      },
      onActionEnd(event) {
        setRunning(false);
        props.onActionEnd?.(event);
      },
    });
  });

  createEffect(() => {
    const nextUi = props.ui;
    if (!mounted || mountedUi === nextUi) return;

    mountedUi = nextUi;
    mounted.update(nextUi);
  });

  onCleanup(() => {
    mounted?.destroy();
    mounted = undefined;
    mountedUi = undefined;
  });

  return (
    <div
      class={joinClasses("generated-ui-shell", props.class, props.className)}
    >
      <div
        ref={(element) => {
          root = element;
        }}
        class="generated-ui"
      />
      {running() ? (
        <p class="generated-ui-status">Running generated action...</p>
      ) : null}
      {surfaceError() ? <p class="generated-ui-error">{surfaceError()}</p> : null}
    </div>
  );
}

export default GeneratedUi;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function joinClasses(...classes: readonly (string | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
