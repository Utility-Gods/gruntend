"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeneratedUiActionEndEvent,
  GeneratedUiActionEvent,
  GeneratedUiRenderer,
  GeneratedUiRenderSession,
} from "../../renderer.ts";
import type {
  GeneratedUi as GeneratedUiController,
  GeneratedUiFrame,
} from "../index.ts";

export interface GeneratedUiProps {
  readonly ui: GeneratedUiController;
  readonly renderer: GeneratedUiRenderer<HTMLDivElement>;
  readonly class?: string;
  readonly className?: string;
  readonly onError?: (error: unknown) => void;
  readonly onRender?: (frame: GeneratedUiFrame) => void;
  readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
  readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
}

interface GeneratedUiCallbacks {
  readonly onError?: (error: unknown) => void;
  readonly onRender?: (frame: GeneratedUiFrame) => void;
  readonly onActionStart?: (event: GeneratedUiActionEvent) => void;
  readonly onActionEnd?: (event: GeneratedUiActionEndEvent) => void;
}

export function GeneratedUi({
  ui,
  renderer,
  class: classProp,
  className,
  onError,
  onRender,
  onActionStart,
  onActionEnd,
}: GeneratedUiProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef<GeneratedUiRenderSession | null>(null);
  const mountedUiRef = useRef<GeneratedUiController | null>(null);
  const callbacksRef = useRef<GeneratedUiCallbacks>({});
  const [running, setRunning] = useState(false);
  const [surfaceError, setSurfaceError] = useState("");

  callbacksRef.current = { onError, onRender, onActionStart, onActionEnd };

  useEffect(() => {
    if (!rootRef.current) return undefined;

    mountedUiRef.current = ui;
    mountedRef.current = renderer.mount(rootRef.current, ui, {
      onError(error) {
        setSurfaceError(errorText(error));
        callbacksRef.current.onError?.(error);
      },
      onRender(frame) {
        setSurfaceError("");
        callbacksRef.current.onRender?.(frame);
      },
      onActionStart(event) {
        setRunning(true);
        callbacksRef.current.onActionStart?.(event);
      },
      onActionEnd(event) {
        setRunning(false);
        callbacksRef.current.onActionEnd?.(event);
      },
    });

    return () => {
      mountedRef.current?.destroy();
      mountedRef.current = null;
      mountedUiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current || mountedUiRef.current === ui) return;

    mountedUiRef.current = ui;
    mountedRef.current.update(ui);
  }, [ui]);

  return (
    <div className={joinClasses("generated-ui-shell", classProp, className)}>
      <div ref={rootRef} className="generated-ui" />
      {running ? (
        <p className="generated-ui-status">Running generated action...</p>
      ) : null}
      {surfaceError ? (
        <p className="generated-ui-error">{surfaceError}</p>
      ) : null}
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
