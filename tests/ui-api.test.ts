import { expect, test } from "vitest";
import {
  compileHtmlTemplate,
  createGeneratedUi,
  createHtmlTag,
} from "../src/ui/index.ts";

test("compileHtmlTemplate returns safe html and delegated handler ids", () => {
  const html = createHtmlTag();
  const increment = () => undefined;

  const frame = compileHtmlTemplate(
    html`<button type="button" onclick=${increment}>Increment</button>`,
  ).unwrap();

  expect(frame.html).toBe(
    '<button type="button" data-gr-click="h0">Increment</button>',
  );
  expect(frame.handlers).toEqual({ h0: increment });
});

test("compileHtmlTemplate supports quoted attribute interpolation values", () => {
  const html = createHtmlTag();

  const frame = compileHtmlTemplate(
    html`<input type="text" value="${'summer "special"'}" />`,
  ).unwrap();

  expect(frame.html).toBe(
    '<input type="text" value="summer &quot;special&quot;">',
  );
});

test("createGeneratedUi renders generated closure state and runs generated handlers", () => {
  const html = createHtmlTag();
  let count = 0;

  const ui = createGeneratedUi(function render() {
    return html`<button
      type="button"
      onclick=${function () {
        count = count + 1;
      }}
    >
      Count: ${count}
    </button>`;
  }).unwrap();

  const first = ui.render().unwrap();
  expect(first.html).toBe(
    '<button type="button" data-gr-click="h0">Count: 0</button>',
  );

  ui.runHandler("h0");

  const second = ui.render().unwrap();
  expect(second.html).toBe(
    '<button type="button" data-gr-click="h0">Count: 1</button>',
  );
});
