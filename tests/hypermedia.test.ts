import { Result } from "better-result";
import { expect, test } from "vitest";
import {
  hydrateHtmlSurface,
  matchSemanticActionPath,
  materializeHtmlSurface,
  parseSemanticActionPath,
  type HtmlSurfaceActionSubmission,
} from "../src/hypermedia.ts";

class FakeRoot {
  readonly listeners = new Map<string, Set<(event: FakeEvent) => void>>();

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: (event: FakeEvent) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: FakeEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeEvent {
  defaultPrevented = false;

  constructor(readonly target: FakeElement) {}

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  parent: FakeElement | undefined;

  constructor(
    readonly tagName: string,
    readonly attributes: Record<string, string> = {},
    readonly elements: FakeElement[] = [],
  ) {}

  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  closest(selector: string): FakeElement | null {
    if (matchesSelector(this, selector)) return this;
    return this.parent?.closest(selector) ?? null;
  }
}

class FakeSelect extends FakeElement {
  constructor(
    attributes: Record<string, string>,
    readonly selectedOptions: FakeElement[],
  ) {
    super("select", attributes);
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (selector === "[gr-href]") {
    return element.getAttribute("gr-href") !== null;
  }

  if (selector === "form[gr-href]") {
    return element.tagName.toLowerCase() === "form" && element.getAttribute("gr-href") !== null;
  }

  return false;
}

test("materializeHtmlSurface replaces model control refs with gr-href semantic hrefs", () => {
  const result = materializeHtmlSurface({
    html: `<button gr-control="delete-item">Delete</button>`,
    controls: {
      "delete-item": {
        href: "/menus/menu_1/items/item_2/actions/delete",
      },
    },
    mintAction(control) {
      return control.href;
    },
  });

  expect(Result.isOk(result)).toBe(true);
  expect(result.unwrap()).toEqual({
    html: `<button gr-href="/menus/menu_1/items/item_2/actions/delete">Delete</button>`,
  });
});

test("parseSemanticActionPath parses nested hypermedia action paths", () => {
  const parsed = parseSemanticActionPath("/menus/menu_1/items/item_2/actions/duplicate?confirm=true&tag=veg&tag=copy").unwrap();

  expect(parsed).toEqual({
    path: "/menus/menu_1/items/item_2/actions/duplicate",
    segments: ["menus", "menu_1", "items", "item_2", "actions", "duplicate"],
    query: {
      confirm: "true",
      tag: ["veg", "copy"],
    },
  });
});

test("matchSemanticActionPath extracts params from nested brace patterns", () => {
  const matched = matchSemanticActionPath(
    "/menus/menu_1/items/item_2/actions/duplicate",
    "/menus/{menuId}/items/{itemId}/actions/{action}",
  ).unwrap();

  expect(matched).toEqual({
    path: "/menus/menu_1/items/item_2/actions/duplicate",
    pattern: "/menus/{menuId}/items/{itemId}/actions/{action}",
    params: {
      menuId: "menu_1",
      itemId: "item_2",
      action: "duplicate",
    },
  });
});

test("matchSemanticActionPath rejects paths that do not match the pattern", () => {
  const result = matchSemanticActionPath("/users/user_1", "/menus/{menuId}");

  expect(Result.isError(result)).toBe(true);
  expect(result.unwrapError()).toEqual({
    code: "not_matched",
    message: 'Action path "/users/user_1" does not match pattern "/menus/{menuId}".',
  });
});

test("hydrateHtmlSurface submits semantic hrefs from gr-href controls", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const button = new FakeElement("button", { "gr-href": "/actions/start" });
  const event = new FakeEvent(button);

  const hydration = hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("click", event);

  expect(event.defaultPrevented).toBe(true);
  expect(calls).toEqual([
    {
      actionId: "/actions/start",
      submission: { type: "click" },
    },
  ]);

  hydration.dispose();
  root.dispatch("click", new FakeEvent(button));

  expect(calls).toHaveLength(1);
});

test("hydrateHtmlSurface submits semantic action paths", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const button = new FakeElement("button", { "gr-href": "/menus/create" });

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("click", new FakeEvent(button));

  expect(calls).toEqual([
    {
      actionId: "/menus/create",
      submission: { type: "click" },
    },
  ]);
});

test("hydrateHtmlSurface submits gr-href semantic paths", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const link = new FakeElement("a", { "gr-href": "/menus/menu_1/items/item_2/actions/duplicate" });

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("click", new FakeEvent(link));

  expect(calls).toEqual([
    {
      actionId: "/menus/menu_1/items/item_2/actions/duplicate",
      submission: { type: "click" },
    },
  ]);
});

test("hydrateHtmlSurface submits gr-href form values", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const form = new FakeElement("form", { "gr-href": "/menus/create" }, [
    new FakeElement("input", { name: "name", value: "Lunch" }),
  ]);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("submit", new FakeEvent(form));

  expect(calls).toEqual([
    {
      actionId: "/menus/create",
      submission: { type: "submit", values: { name: "Lunch" } },
    },
  ]);
});

test("hydrateHtmlSurface submits form values for hypermedia forms", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const form = new FakeElement("form", { "gr-href": "/menus/create" }, [
    new FakeElement("input", { name: "name", value: "Lunch" }),
    new FakeElement("input", { name: "tags", value: "seasonal" }),
    new FakeElement("input", { name: "tags", value: "public" }),
    new FakeElement("input", { name: "skip", value: "no", disabled: "" }),
  ]);
  const submit = new FakeEvent(form);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("submit", submit);

  expect(submit.defaultPrevented).toBe(true);
  expect(calls).toEqual([
    {
      actionId: "/menus/create",
      submission: {
        type: "submit",
        values: {
          name: "Lunch",
          tags: ["seasonal", "public"],
        },
      },
    },
  ]);
});

test("hydrateHtmlSurface submits selected checkbox and radio values", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const form = new FakeElement("form", { "gr-href": "/menus/menu_1/items/filter" }, [
    new FakeElement("input", {
      type: "checkbox",
      name: "features",
      value: "vegan",
      checked: "",
    }),
    new FakeElement("input", {
      type: "checkbox",
      name: "features",
      value: "spicy",
    }),
    new FakeElement("input", {
      type: "checkbox",
      name: "features",
      value: "seasonal",
      checked: "",
    }),
    new FakeElement("input", {
      type: "radio",
      name: "sort",
      value: "price",
    }),
    new FakeElement("input", {
      type: "radio",
      name: "sort",
      value: "name",
      checked: "",
    }),
  ]);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("submit", new FakeEvent(form));

  expect(calls).toEqual([
    {
      actionId: "/menus/menu_1/items/filter",
      submission: {
        type: "submit",
        values: {
          features: ["vegan", "seasonal"],
          sort: "name",
        },
      },
    },
  ]);
});

test("hydrateHtmlSurface submits selected multi-select values", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const form = new FakeElement("form", { "gr-href": "/menus/select" }, [
    new FakeSelect(
      { name: "menus", multiple: "" },
      [
        new FakeElement("option", { value: "lunch" }),
        new FakeElement("option", { value: "dinner" }),
      ],
    ),
  ]);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("submit", new FakeEvent(form));

  expect(calls).toEqual([
    {
      actionId: "/menus/select",
      submission: {
        type: "submit",
        values: {
          menus: ["lunch", "dinner"],
        },
      },
    },
  ]);
});

test("hydrateHtmlSurface forwards better-result action errors", async () => {
  const root = new FakeRoot();
  const button = new FakeElement("button", { "gr-href": "/actions/expired" });
  const errors: unknown[] = [];

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction() {
      return Result.err({ code: "expired_action" });
    },
    onError(error) {
      errors.push(error);
    },
  });

  root.dispatch("click", new FakeEvent(button));
  await Promise.resolve();

  expect(errors).toEqual([{ code: "expired_action" }]);
});

test("hydrateHtmlSurface dispose removes click and submit listeners", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const button = new FakeElement("button", { "gr-href": "/actions/click" });
  const form = new FakeElement("form", { "gr-href": "/actions/submit" }, [
    new FakeElement("input", { name: "name", value: "Dinner" }),
  ]);

  const hydration = hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  expect(root.listenerCount("click")).toBe(1);
  expect(root.listenerCount("submit")).toBe(1);

  hydration.dispose();
  hydration.dispose();

  expect(root.listenerCount("click")).toBe(0);
  expect(root.listenerCount("submit")).toBe(0);

  root.dispatch("click", new FakeEvent(button));
  root.dispatch("submit", new FakeEvent(form));

  expect(calls).toEqual([]);
});

test("hydrateHtmlSurface resolves nested click targets to the nearest action control", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const button = new FakeElement("button", { "gr-href": "/actions/parent" });
  const label = new FakeElement("span");
  button.append(label);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("click", new FakeEvent(label));

  expect(calls).toEqual([
    {
      actionId: "/actions/parent",
      submission: { type: "click" },
    },
  ]);
});

test("hydrateHtmlSurface ignores blank action ids", () => {
  const root = new FakeRoot();
  const calls: { actionId: string; submission: HtmlSurfaceActionSubmission }[] =
    [];
  const blankButton = new FakeElement("button", { "gr-href": "  " });
  const blankForm = new FakeElement("form", { "gr-href": "\t" });
  const click = new FakeEvent(blankButton);
  const submit = new FakeEvent(blankForm);

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId, submission) {
      calls.push({ actionId, submission });
    },
  });

  root.dispatch("click", click);
  root.dispatch("submit", submit);

  expect(click.defaultPrevented).toBe(false);
  expect(submit.defaultPrevented).toBe(false);
  expect(calls).toEqual([]);
});

test("hydrateHtmlSurface routes submitAction errors to onError", async () => {
  const root = new FakeRoot();
  const thrown = new Error("sync failed");
  const rejected = new Error("async failed");
  const errors: unknown[] = [];
  const syncButton = new FakeElement("button", { "gr-href": "/actions/sync" });
  const asyncButton = new FakeElement("button", { "gr-href": "/actions/async" });

  hydrateHtmlSurface(root as unknown as EventTarget, {
    submitAction(actionId) {
      if (actionId === "/actions/sync") throw thrown;
      return Promise.reject(rejected);
    },
    onError(error) {
      errors.push(error);
    },
  });

  root.dispatch("click", new FakeEvent(syncButton));
  root.dispatch("click", new FakeEvent(asyncButton));
  await Promise.resolve();
  await Promise.resolve();

  expect(errors).toEqual([thrown, rejected]);
});
