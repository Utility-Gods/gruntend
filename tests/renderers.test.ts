import { expect, test } from "vitest";
import type { Config as DomPurifyConfig } from "dompurify";
import { createDomPurifyGeneratedUiRenderer } from "../src/ui/renderers/dom-purify.ts";
import { createGeneratedUi, createHtmlTag } from "../src/ui/index.ts";
import {
  FakeRendererTarget,
  fakeDocumentFragment,
  runRendererConformance,
} from "./renderer-conformance.ts";

runRendererConformance("DOMPurify renderer", () =>
  createDomPurifyGeneratedUiRenderer({
    purifier: {
      isSupported: true,
      sanitize(html) {
        return fakeDocumentFragment(html);
      },
    },
  }),
);

test("DOMPurify renderer supplies a closed generated-UI policy", () => {
  const html = createHtmlTag();
  let receivedConfig:
    | (DomPurifyConfig & { readonly RETURN_DOM_FRAGMENT: true })
    | undefined;
  const renderer = createDomPurifyGeneratedUiRenderer({
    purifier: {
      isSupported: true,
      sanitize(value, config) {
        receivedConfig = config;
        return fakeDocumentFragment(value);
      },
    },
  });
  const ui = createGeneratedUi(
    () => html`<button onclick=${() => undefined}>Safe</button>`,
  ).unwrap();
  const session = renderer.mount(new FakeRendererTarget(), ui);

  expect(receivedConfig).toMatchObject({
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOW_SELF_CLOSE_IN_ATTR: false,
    SANITIZE_DOM: true,
    SAFE_FOR_XML: true,
    RETURN_DOM_FRAGMENT: true,
  });
  expect(receivedConfig?.ALLOWED_TAGS).toContain("button");
  expect(receivedConfig?.ALLOWED_TAGS).not.toContain("script");
  expect(receivedConfig?.ALLOWED_ATTR).toContain("data-gr-click");
  expect(receivedConfig?.ALLOWED_ATTR).not.toContain("style");
  expect(receivedConfig?.FORBID_TAGS).toEqual(
    expect.arrayContaining(["script", "style", "template"]),
  );
  expect(receivedConfig?.FORBID_ATTR).toEqual(
    expect.arrayContaining(["src", "srcdoc", "style", "onclick"]),
  );
  session.destroy();
});

test("DOMPurify renderer fails closed when DOMPurify is unavailable", () => {
  const html = createHtmlTag();
  const errors: unknown[] = [];
  let sanitizeCalls = 0;
  const renderer = createDomPurifyGeneratedUiRenderer({
    purifier: {
      isSupported: false,
      sanitize(value) {
        sanitizeCalls += 1;
        return fakeDocumentFragment(value);
      },
    },
  });
  const target = new FakeRendererTarget();
  const ui = createGeneratedUi(() => html`<p>Hidden</p>`).unwrap();
  const session = renderer.mount(target, ui, {
    onError(error) {
      errors.push(error);
    },
  });

  expect(target.innerHTML).toBe("");
  expect(sanitizeCalls).toBe(0);
  expect(errors).toHaveLength(1);
  expect(String(errors[0])).toContain("DOMPurify is not supported");
  session.destroy();
});
