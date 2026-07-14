import type { GeneratedUiRenderer } from "../renderer.ts";
import {
  createGeneratedUiDomRenderer,
  type GeneratedUiDomTarget,
} from "./dom-runtime.ts";

export type DomGeneratedUiTarget = GeneratedUiDomTarget;

export function createDomGeneratedUiRenderer(): GeneratedUiRenderer<DomGeneratedUiTarget> {
  return createGeneratedUiDomRenderer("dom", {
    commit(target, frame) {
      target.innerHTML = frame.html;
    },
    clear(target) {
      target.innerHTML = "";
    },
  });
}
