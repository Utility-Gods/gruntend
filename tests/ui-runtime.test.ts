import { Result } from "better-result";
import { expect, test } from "vitest";
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

test("createUiComponent supports delegated SVG events and closure rerendering", () => {
  const html = createUiTemplateTag();
  let selected = false;
  const component = createUiComponent(function render() {
    return html`<svg viewBox="0 0 100 100">
      <g
        onclick=${() => {
          selected = true;
        }}
      >
        <rect
          width="100"
          height="100"
          fill=${selected ? "#0f172a" : "#f54a00"}
        ></rect>
      </g>
    </svg>`;
  }).unwrap();

  expect(compactMarkup(component.render().unwrap().html)).toContain(
    '<g data-gr-click="h0"><rect width="100" height="100" fill="#f54a00">',
  );
  component.dispatch("h0");
  expect(compactMarkup(component.render().unwrap().html)).toContain(
    '<g data-gr-click="h0"><rect width="100" height="100" fill="#0f172a">',
  );
});

test("compileUiTemplate supports mixed quoted attribute interpolation", () => {
  const html = createUiTemplateTag();
  const width = 720;
  const height = 280;
  const period = "this week";

  const compiled = compileUiTemplate(
    html`<svg
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Sales ${period}"
    ></svg>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<svg viewBox="0 0 720 280" role="img" aria-label="Sales this week"></svg>',
  );
});

test("compileUiTemplate supports boolean attribute interpolation", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<select>
      <option value="a" selected=${true}>A</option>
      <option value="b" selected=${false}>B</option>
    </select>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<select>\n      <option value="a" selected="selected">A</option>\n      <option value="b">B</option>\n    </select>',
  );
});

test("compileUiTemplate supports nested templates from normal JavaScript arrays", () => {
  const html = createUiTemplateTag();
  const items = ["Fries", "Soup"];

  const compiled = compileUiTemplate(
    html`<ul>
      ${items.map((item) => html`<li>${item}</li>`)}
    </ul>`,
  ).unwrap();

  expect(compiled.html).toBe(
    "<ul>\n      <li>Fries</li><li>Soup</li>\n    </ul>",
  );
});

test("compileUiTemplate preserves safe SVG chart markup", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<svg viewBox="0 0 640 240" role="img" aria-label="Daily revenue">
      <rect x=${20} y=${40} width=${50} height=${160} fill="#f54a00"></rect>
      <text x="45" y="220" text-anchor="middle">Monday</text>
    </svg>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<svg viewBox="0 0 640 240" role="img" aria-label="Daily revenue">\n      <rect x="20" y="40" width="50" height="160" fill="#f54a00"></rect>\n      <text x="45" y="220" text-anchor="middle">Monday</text>\n    </svg>',
  );
});

test("compileUiTemplate preserves self-closing SVG elements", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<svg viewBox="0 0 100 100">
      <rect width="40" height="80" />
      <text x="50" y="95">Revenue</text>
    </svg>`,
  ).unwrap();

  expect(compactMarkup(compiled.html)).toBe(
    '<svg viewBox="0 0 100 100"><rect width="40" height="80" /><text x="50" y="95">Revenue</text></svg>',
  );
});

test("compileUiTemplate rejects unsafe SVG capabilities", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<svg>
      <foreignObject><div>Unsafe</div></foreignObject>
    </svg>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "foreignobject" is not allowed.',
  });
});

test.each([
  "foreignObject",
  "image",
  "use",
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "filter",
  "feImage",
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "math",
])("compileUiTemplate rejects the SVG-adjacent %s element", (tag) => {
  const compiled = compileUiTemplate({
    strings: [`<svg><${tag}></${tag}></svg>`],
    values: [],
  });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError().code).toBe("unsafe_tag");
});

test.each([
  '<svg><a href="https://attacker.example">Open</a></svg>',
  '<svg><a href="//attacker.example">Open</a></svg>',
  '<svg><a href="/\\attacker.example">Open</a></svg>',
  '<svg><a href="javascript:alert(1)">Open</a></svg>',
  '<svg><a href="data:text/html,attack">Open</a></svg>',
  '<svg><a href="&#x6a;avascript:alert(1)">Open</a></svg>',
  '<svg><path fill="url(https://attacker.example/paint.svg#x)"></path></svg>',
  '<svg><path stroke="url(javascript:alert(1))"></path></svg>',
  '<svg><path fill="url(data:image/svg+xml,attack)"></path></svg>',
  '<svg><path fill="u\\72l(https://attacker.example/x)"></path></svg>',
])("compileUiTemplate rejects external SVG resources in %s", (markup) => {
  const compiled = compileUiTemplate({ strings: [markup], values: [] });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError().code).toBe("unsafe_attribute");
});

test.each([
  '<svg style="display:block"></svg>',
  '<svg><a xlink:href="#target">Open</a></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  '<svg><path onload="alert(1)"></path></svg>',
  '<svg><path ONCLICK="alert(1)"></path></svg>',
])("compileUiTemplate rejects executable SVG attributes in %s", (markup) => {
  const compiled = compileUiTemplate({ strings: [markup], values: [] });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError().code).toBe("unsafe_attribute");
});

test("compileUiTemplate scans quoted greater-than characters without hiding later tags", () => {
  const compiled = compileUiTemplate({
    strings: ['<svg><g aria-label=">"><base href="/"></base></g></svg>'],
    values: [],
  });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "base" is not allowed.',
  });
});

test("compileUiTemplate cannot hide blocked tags with comments", () => {
  const compiled = compileUiTemplate({
    strings: ["<svg><scr<!-- hidden -->ipt>alert(1)</script></svg>"],
    values: [],
  });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "script" is not allowed.',
  });
});

test("compileUiTemplate rejects malformed generated markup", () => {
  const compiled = compileUiTemplate({
    strings: ['<svg><path aria-label="unterminated></path></svg>'],
    values: [],
  });

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: "Malformed generated markup is not allowed.",
  });
});

test("compileUiTemplate permits only local navigation and local paint fragments", () => {
  const html = createUiTemplateTag();
  const compiled = compileUiTemplate(
    html`<svg>
      <a href="#details"><path fill="url(#paint)"></path></a>
    </svg>`,
  ).unwrap();

  expect(compactMarkup(compiled.html)).toBe(
    '<svg><a href="#details"><path fill="url(#paint)"></path></a></svg>',
  );
});

test("compileUiTemplate canonicalizes safe local href interpolation", () => {
  const html = createUiTemplateTag();
  const compiled = compileUiTemplate(
    html`<a href=${"/orders?status=open&sort=asc"}>Orders</a>`,
  ).unwrap();

  expect(compiled.html).toBe(
    '<a href="/orders?status=open&amp;sort=asc">Orders</a>',
  );
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

test("compileUiTemplate rejects mixed event-handler attributes", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<button onclick="prefix-${() => undefined}">Bad</button>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_interpolation",
    message: "Interpolations cannot change tag or attribute structure.",
  });
});

test("compileUiTemplate rejects unsafe tags", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<script>
      alert(1);
    </script>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_tag",
    message: 'Tag "script" is not allowed.',
  });
});

test("compileUiTemplate rejects spoofed delegated handler attributes", () => {
  const html = createUiTemplateTag();

  const compiled = compileUiTemplate(
    html`<button type="button" data-gr-click="h0">Bad</button>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_attribute",
    message:
      'Generated handler attribute "data-gr-click" references an unknown handler.',
  });
});

test("compileUiTemplate rejects duplicated delegated handler targets", () => {
  const html = createUiTemplateTag();
  const handler = () => undefined;
  const compiled = compileUiTemplate(
    html`<button data-gr-click="h0">Spoof</button
      ><button onclick=${handler}>Real</button>`,
  );

  expect(Result.isError(compiled)).toBe(true);
  expect(compiled.unwrapError()).toEqual({
    code: "unsafe_attribute",
    message:
      'Generated handler attribute "data-gr-click" references an unknown handler.',
  });
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
  expect(firstRender.html).toBe(
    '<button type="button" data-gr-click="h0">Count: 0</button>',
  );

  component.dispatch("h0");

  const secondRender = component.render().unwrap();
  expect(secondRender.html).toBe(
    '<button type="button" data-gr-click="h0">Count: 1</button>',
  );
});

function compactMarkup(markup: string): string {
  return markup.replace(/>\s+</g, "><").trim();
}

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
