import DOMPurify from "dompurify";
import type { Config as DomPurifyConfig } from "dompurify";
import type { GeneratedUiRenderer } from "../renderer.ts";
import {
  generatedUiAllowedAttributes,
  generatedUiAllowedTags,
  generatedUiForbiddenAttributes,
  generatedUiForbiddenTags,
  generatedUiRuntimeAttributes,
} from "../ui-policy.ts";
import {
  createGeneratedUiDomRenderer,
  type GeneratedUiDomTarget,
} from "./dom-runtime.ts";

export interface DomPurifyGeneratedUiTarget extends GeneratedUiDomTarget {
  replaceChildren(...nodes: readonly (Node | string)[]): void;
}

export interface GeneratedUiDomPurifier {
  readonly isSupported: boolean;
  sanitize(
    html: string,
    config: DomPurifyConfig & { readonly RETURN_DOM_FRAGMENT: true },
  ): DocumentFragment;
}

export interface DomPurifyGeneratedUiRendererOptions {
  readonly purifier?: GeneratedUiDomPurifier;
}

const strictDomPurifyConfig = {
  ALLOWED_TAGS: [...generatedUiAllowedTags],
  ALLOWED_ATTR: [
    ...generatedUiAllowedAttributes,
    ...generatedUiRuntimeAttributes,
  ],
  ALLOWED_NAMESPACES: [
    "http://www.w3.org/1999/xhtml",
    "http://www.w3.org/2000/svg",
  ],
  FORBID_TAGS: [...generatedUiForbiddenTags],
  FORBID_ATTR: [...generatedUiForbiddenAttributes],
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_SELF_CLOSE_IN_ATTR: false,
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: null,
    attributeNameCheck: null,
    allowCustomizedBuiltInElements: false,
  },
  SANITIZE_DOM: true,
  SAFE_FOR_XML: true,
  RETURN_DOM_FRAGMENT: true,
} satisfies DomPurifyConfig & { readonly RETURN_DOM_FRAGMENT: true };

export function createDomPurifyGeneratedUiRenderer(
  options: DomPurifyGeneratedUiRendererOptions = {},
): GeneratedUiRenderer<DomPurifyGeneratedUiTarget> {
  const purifier: GeneratedUiDomPurifier = options.purifier ?? DOMPurify;

  return createGeneratedUiDomRenderer("dom-purify", {
    commit(target, frame) {
      if (!purifier.isSupported) {
        throw new Error("DOMPurify is not supported in this environment.");
      }

      const fragment = purifier.sanitize(frame.html, strictDomPurifyConfig);
      target.replaceChildren(fragment);
    },
    clear(target) {
      target.replaceChildren();
    },
  });
}
