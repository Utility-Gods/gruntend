import { expect, test } from "vitest";
import {
  createGeneratedUi,
  createHtmlTag,
  createRenderPrimitive,
} from "../src/ui/index.ts";
import {
  createGeneratedEventPayload,
  findGeneratedHandler,
  mountGeneratedUi,
  type GeneratedUiMountElement,
} from "../src/ui/dom.ts";

test("findGeneratedHandler reads delegated handler ids from event targets", () => {
  const target = fakeTarget({ "data-gr-click": "h0" });

  expect(findGeneratedHandler({ type: "click", target })).toEqual({
    eventName: "click",
    attribute: "data-gr-click",
    handlerId: "h0",
  });
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

test("mountGeneratedUi mounts and cleans up registered renderers", () => {
  const html = createHtmlTag();
  const lifecycle: string[] = [];
  const chart = createRenderPrimitive({
    name: "chart",
    create: (args) => String(args[0]),
    mount({ target, value }) {
      lifecycle.push(`mount:${target.getAttribute("data-gr-render")}:${value}`);
      return () => lifecycle.push(`cleanup:${value}`);
    },
  });
  const ui = createGeneratedUi(
    html`<section>${chart("revenue")}</section>`,
  ).unwrap();
  const element = new FakeMountElement();

  const mounted = mountGeneratedUi(element, ui);

  expect(lifecycle).toEqual(["mount:r0:revenue"]);
  mounted.destroy();
  expect(lifecycle).toEqual(["mount:r0:revenue", "cleanup:revenue"]);
});

test("mountGeneratedUi renders, delegates events, and rerenders after handlers", async () => {
  const html = createHtmlTag();
  let count = 0;

  const inc = function () {
    count = count + 1;
  };

  const ui = createGeneratedUi(function render() {
    return html`<button type="button" onclick=${inc}>Count: ${count}</button>`;
  }).unwrap();
  const element = new FakeMountElement();
  const actions: string[] = [];

  const mounted = mountGeneratedUi(element, ui, {
    onActionStart(event) {
      actions.push(`start:${event.handlerId}`);
    },
    onActionEnd(event) {
      actions.push(`end:${event.handlerId}:${event.status}`);
    },
  });

  expect(element.innerHTML).toBe(
    '<button type="button" data-gr-click="h0">Count: 0</button>',
  );

  await element.emit("click", {
    type: "click",
    target: fakeTarget({ "data-gr-click": "h0" }),
    preventDefault() {},
  });

  expect(element.innerHTML).toBe(
    '<button type="button" data-gr-click="h0">Count: 1</button>',
  );
  expect(actions).toEqual(["start:h0", "end:h0:done"]);

  mounted.destroy();
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

class FakeMountElement implements GeneratedUiMountElement {
  innerHTML = "";
  private readonly listeners = new Map<
    string,
    Set<(event: unknown) => unknown>
  >();

  querySelector(selector: string): Element | null {
    const id = selector.match(/^\[data-gr-render="([^"]+)"\]$/)?.[1];
    if (!id || !this.innerHTML.includes(`data-gr-render="${id}"`)) return null;

    return {
      getAttribute(name: string) {
        return name === "data-gr-render" ? id : null;
      },
    } as unknown as Element;
  }

  addEventListener(type: string, listener: (event: unknown) => unknown): void {
    const listeners =
      this.listeners.get(type) ?? new Set<(event: unknown) => unknown>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: (event: unknown) => unknown,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  async emit(type: string, event: unknown): Promise<void> {
    const listeners = [...(this.listeners.get(type) ?? [])];

    await Promise.all(listeners.map((listener) => listener(event)));
    await Promise.resolve();
  }
}
