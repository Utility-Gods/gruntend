import type {
  GeneratedUiActionEndEvent,
  GeneratedUiActionEvent,
  GeneratedUiEventName,
  GeneratedUiRenderOptions,
  GeneratedUiRenderSession,
} from "../renderer.ts";
import { createDomGeneratedUiRenderer } from "../renderers/dom.ts";
import {
  createGeneratedEventPayload as createEventPayload,
  findGeneratedHandler as findHandler,
  type GeneratedUiDomTarget,
  type GeneratedUiEventPayload,
  type GeneratedUiHandlerMatch,
} from "../renderers/dom-runtime.ts";
import type { GeneratedUi } from "./index.ts";

export type {
  GeneratedUiActionEndEvent,
  GeneratedUiActionEvent,
  GeneratedUiEventName,
  GeneratedUiEventPayload,
  GeneratedUiHandlerMatch,
};

export type GeneratedUiMountOptions = GeneratedUiRenderOptions;
export type GeneratedUiMountElement = GeneratedUiDomTarget;
export type GeneratedUiMountHandle = GeneratedUiRenderSession;

const domRenderer = createDomGeneratedUiRenderer();

export function mountGeneratedUi(
  element: GeneratedUiMountElement,
  ui: GeneratedUi,
  options: GeneratedUiMountOptions = {},
): GeneratedUiMountHandle {
  return domRenderer.mount(element, ui, options);
}

export function findGeneratedHandler(
  event: unknown,
  root?: GeneratedUiMountElement,
): GeneratedUiHandlerMatch | undefined {
  return findHandler(event, root);
}

export function createGeneratedEventPayload(
  event: unknown,
): GeneratedUiEventPayload {
  return createEventPayload(event);
}
