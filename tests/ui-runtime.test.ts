import { expect, test } from "vitest";
import { Result } from "better-result";
import { runCodePlan } from "../src/code-plan.ts";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools } from "../src/tool.ts";
import {
  compileUiTemplate,
  createUiComponent,
  createUiTemplateTag,
} from "../src/ui-runtime.ts";

test("compileUiTemplate rewrites function event slots to delegated handler attributes", () => {
  const html = createUiTemplateTag();
  const increment = () => undefined;

  const compiled = compileUiTemplate(
    html`<button type="button" onclick=${increment}>Increment</button>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<button type="button" data-gr-click="h0">Increment</button>',
  );
  expect(compiled.handlers).toEqual({ h0: increment });
});

test("compileUiTemplate escapes text and attribute interpolation values", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<p class=${"<tag>"}>${'<img src=x onerror="alert(1)">'}</p>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<p class="&lt;tag&gt;">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
  );
});

test("compileUiTemplate supports nested templates from normal JavaScript arrays", () => {
  const html = createUiTemplateTag();
  const items = ["Fries", "Soup"];

  const compiled = compileUiTemplate(
    html`<ul>${items.map((item) => html`<li>${item}</li>`)}</ul>`,
  ).unwrap();

  expect(compiled.html).toBe("<ul><li>Fries</li><li>Soup</li></ul>");
});

test("compileUiTemplate supports event handlers after interpolated attributes", () => {
  const html = createUiTemplateTag();
  const select = () => undefined;

  const compiled = compileUiTemplate(
    html`<button type="button" class=${"surface-item"} onclick=${select}>Select</button>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<button type="button" class="surface-item" data-gr-click="h0">Select</button>',
  );
  expect(compiled.handlers).toEqual({ h0: select });
});

test("compileUiTemplate rejects static event attributes", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<button onclick="alert(1)">Bad</button>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_attribute",
    message: 'Static event attribute "onclick" is not allowed.',
  });
});

test("compileUiTemplate rejects interpolation that changes tag structure", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(html`<bu${"tton"}>Bad</button>`);

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_interpolation",
    message: "Interpolations cannot change tag or attribute structure.",
  });
});

test("compileUiTemplate keeps only allowlisted meaningful attributes", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<a href="https://evil.example" gr-href="/menus" data-random="x" aria-label="Menus">Menus</a>`,
  ).unwrap();

  expect(compiled.html).toBe('<a gr-href="/menus" aria-label="Menus">Menus</a>');
});

test("compileUiTemplate rejects unsafe tags", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(html`<script>alert(1)</script>`);

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "script" is not allowed.',
  });
});

test("runCodePlan generated UI rejects script tags at render time", async () => {
  const result = await runCodePlan({
    code: `
      return html\`<section><script>alert("pwned")</script></section>\`;
    `,
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("done");
  const component = createUiComponent(result.result).unwrap();
  const rendered = component.render();

  expect(Result.isError(rendered)).toBe(true);
  expect(rendered.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "script" is not allowed.',
  });
});

test("runCodePlan generated UI rejects static event handler attributes", async () => {
  const result = await runCodePlan({
    code: `
      return html\`<button type="button" onclick="evil()">Bad</button>\`;
    `,
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("done");
  const component = createUiComponent(result.result).unwrap();
  const rendered = component.render();

  expect(Result.isError(rendered)).toBe(true);
  expect(rendered.unwrapError()).toEqual({
    code: "unsafe_attribute",
    message: 'Static event attribute "onclick" is not allowed.',
  });
});

test("runCodePlan generated UI escapes raw html payload interpolation", async () => {
  const result = await runCodePlan({
    code: `
      var payload = '<img src=x onerror="evil()"><script>alert("pwned")</script>';
      return html\`<section>\${payload}</section>\`;
    `,
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("done");
  const component = createUiComponent(result.result).unwrap();
  const rendered = component.render().unwrap();

  expect(rendered.html).toBe(
    '<section>&lt;img src=x onerror=&quot;evil()&quot;&gt;&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;</section>',
  );
});

test("createUiComponent renders a returned html template", () => {
  const html = createUiTemplateTag();

  const component = createUiComponent(html`<p>Hello ${"Avi"}</p>`).unwrap();
  const rendered = component.render().unwrap();

  expect(rendered.html).toBe("<p>Hello Avi</p>");
});

test("runCodePlan can return an interpreted render function with local state", async () => {
  const result = await runCodePlan({
    code: `
      var count = 0;

      return function render() {
        return html\`<button type="button" onclick=\${function () {
          count = count + 1;
        }}>Count: \${count}</button>\`;
      };
    `,
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("done");
  const component = createUiComponent(result.result).unwrap();

  const firstRender = component.render().unwrap();
  expect(firstRender.html).toBe('<button type="button" data-gr-click="h0">Count: 0</button>');

  component.dispatch("h0");

  const secondRender = component.render().unwrap();
  expect(secondRender.html).toBe('<button type="button" data-gr-click="h0">Count: 1</button>');
});

test("runCodePlan can return a tagged-template menu page with local selection state", async () => {
  const result = await runCodePlan({
    code: `
      var selected = [];

      function toggle(itemId) {
        var index = selected.indexOf(itemId);

        if (index === -1) {
          selected.push(itemId);
          return;
        }

        selected.splice(index, 1);
      }

      return function render() {
        return html\`<section><h2>\${input.menuName}</h2><p>\${selected.length} selected</p><div>\${input.items.map(function (item) {
          return html\`<button type="button" onclick=\${function () {
            toggle(item.itemId);
          }}>\${item.name}</button>\`;
        })}</div></section>\`;
      };
    `,
    input: {
      menuName: "Dinner Menu",
      items: [
        { itemId: "item_1", name: "Truffle Fries" },
        { itemId: "item_2", name: "Caesar Salad" },
      ],
    },
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("done");
  const component = createUiComponent(result.result).unwrap();

  const firstRender = component.render().unwrap();
  expect(firstRender.html).toBe(
    '<section><h2>Dinner Menu</h2><p>0 selected</p><div><button type="button" data-gr-click="h0">Truffle Fries</button><button type="button" data-gr-click="h1">Caesar Salad</button></div></section>',
  );

  component.dispatch("h1");

  const secondRender = component.render().unwrap();
  expect(secondRender.html).toBe(
    '<section><h2>Dinner Menu</h2><p>1 selected</p><div><button type="button" data-gr-click="h0">Truffle Fries</button><button type="button" data-gr-click="h1">Caesar Salad</button></div></section>',
  );
});

test("runCodePlan does not expose browser globals to generated UI code", async () => {
  const result = await runCodePlan({
    code: `return window.document;`,
    registry: createToolRegistry(defineTools({})),
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(result.status).toBe("failed");
  expect(result.error).toBe("window is not defined");
});
