import { expect, test } from "vitest";
import type { GeneratedUiRenderer } from "../src/renderer.ts";
import { createGeneratedUi, createHtmlTag } from "../src/ui/index.ts";

export function runRendererConformance(
  name: string,
  createRenderer: () => GeneratedUiRenderer<FakeRendererTarget>,
): void {
  test(`${name}: pins the renderer for the mounted session`, async () => {
    const html = createHtmlTag();
    const target = new FakeRendererTarget();
    let count = 0;
    const ui = createGeneratedUi(
      () => html`<button onclick=${() => (count += 1)}>${count}</button>`,
    ).unwrap();
    const renderer = createRenderer();
    const session = renderer.mount(target, ui);

    expect(session.rendererId).toBe(renderer.id);
    expect(target.innerHTML).toBe('<button data-gr-click="h0">0</button>');

    await target.emit("click", {
      type: "click",
      target: fakeHandlerTarget({ "data-gr-click": "h0" }),
      preventDefault() {},
    });

    expect(target.innerHTML).toBe('<button data-gr-click="h0">1</button>');
    expect(session.rendererId).toBe(renderer.id);
    session.destroy();
  });

  test(`${name}: updates UI without changing renderer and clears on destroy`, () => {
    const html = createHtmlTag();
    const target = new FakeRendererTarget();
    let firstDestroyed = 0;
    let secondDestroyed = 0;
    const first = createGeneratedUi({
      call: () => html`<p>First</p>`,
      destroy: () => (firstDestroyed += 1),
    }).unwrap();
    const second = createGeneratedUi({
      call: () => html`<p>Second</p>`,
      destroy: () => (secondDestroyed += 1),
    }).unwrap();
    const renderer = createRenderer();
    const session = renderer.mount(target, first);

    session.update(second);

    expect(session.rendererId).toBe(renderer.id);
    expect(target.innerHTML).toBe("<p>Second</p>");
    expect(firstDestroyed).toBe(1);

    session.destroy();

    expect(target.innerHTML).toBe("");
    expect(secondDestroyed).toBe(1);
  });

  test(`${name}: ignores stale action renders after a UI update`, async () => {
    const html = createHtmlTag();
    const target = new FakeRendererTarget();
    let resolveAction: (() => void) | undefined;
    const first = createGeneratedUi(
      () =>
        html`<button
          onclick=${() =>
            new Promise<void>((resolve) => {
              resolveAction = resolve;
            })}
        >
          First
        </button>`,
    ).unwrap();
    const second = createGeneratedUi(() => html`<p>Second</p>`).unwrap();
    const session = createRenderer().mount(target, first);
    const pending = session.runHandler("h0");

    session.update(second);
    resolveAction?.();
    await pending;

    expect(target.innerHTML).toBe("<p>Second</p>");
    session.destroy();
  });

  test(`${name}: clears the mounted surface after a render failure`, () => {
    const html = createHtmlTag();
    const target = new FakeRendererTarget();
    const errors: unknown[] = [];
    const valid = createGeneratedUi(() => html`<p>Visible</p>`).unwrap();
    const invalid = createGeneratedUi(() => "not a template").unwrap();
    const session = createRenderer().mount(target, valid, {
      onError(error) {
        errors.push(error);
      },
    });

    session.update(invalid);

    expect(target.innerHTML).toBe("");
    expect(errors).toHaveLength(1);
    session.destroy();
  });
}

export class FakeRendererTarget {
  innerHTML = "";
  private readonly listeners = new Map<
    string,
    Set<(event: unknown) => unknown>
  >();

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

  replaceChildren(...nodes: readonly (Node | string)[]): void {
    if (nodes.length === 0) {
      this.innerHTML = "";
      return;
    }

    const fragment = nodes[0] as DocumentFragment & { __html?: string };
    this.innerHTML = fragment.__html ?? "";
  }

  async emit(type: string, event: unknown): Promise<void> {
    const listeners = [...(this.listeners.get(type) ?? [])];
    await Promise.all(listeners.map((listener) => listener(event)));
  }
}

export function fakeDocumentFragment(html: string): DocumentFragment {
  return { __html: html } as unknown as DocumentFragment;
}

function fakeHandlerTarget(attributes: Readonly<Record<string, string>>) {
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
