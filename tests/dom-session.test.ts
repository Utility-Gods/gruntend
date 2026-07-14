import { expect, test } from "vitest";
import {
  createGeneratedEventPayload,
  findGeneratedHandler,
} from "../src/ui/renderers/dom-session.ts";

test("findGeneratedHandler reads delegated handler ids from event targets", () => {
  const target = fakeTarget({ "data-gr-click": "h0" });

  expect(findGeneratedHandler({ type: "click", target })).toEqual({
    eventName: "click",
    attribute: "data-gr-click",
    handlerId: "h0",
  });
});

test("findGeneratedHandler rejects delegated targets outside the mounted root", () => {
  const target = fakeTarget({ "data-gr-click": "h0" });
  const root = {
    addEventListener() {},
    removeEventListener() {},
    contains() {
      return false;
    },
  };

  expect(findGeneratedHandler({ type: "click", target }, root)).toBeUndefined();
});

test("createGeneratedEventPayload exposes only safe event fields", () => {
  let prevented = false;
  const payload = createGeneratedEventPayload({
    type: "change",
    target: { name: "item", value: "item_1", checked: true },
    preventDefault() {
      prevented = true;
    },
  });

  expect(payload.type).toBe("change");
  expect(payload.target).toEqual({
    name: "item",
    value: "item_1",
    checked: true,
  });

  payload.preventDefault();

  expect(prevented).toBe(true);
});

function fakeTarget(attributes: Record<string, string>) {
  return {
    closest(selector: string) {
      const name = selector.match(/^\[([^\]]+)\]$/)?.[1];
      if (!name || !(name in attributes)) return null;

      return {
        getAttribute(attribute: string) {
          return attribute === name ? attributes[name] : null;
        },
      };
    },
  };
}
