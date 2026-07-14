# Gruntend

Typed tool namespaces and generated UI for app-owned capabilities.

[![npm version](https://img.shields.io/npm/v/gruntend-sdk.svg)](https://www.npmjs.com/package/gruntend-sdk)

Gruntend lets an app expose a small capability surface to an LLM, receive a JavaScript code plan, and execute that plan through app-owned handlers. In UI mode, the plan can return safe `html` tagged-template UI with local component state.

> [!CAUTION]
> Gruntend is a public beta under active development and is not production-ready. Do not expose sensitive production capabilities or rely on an executor as the only security boundary.

```text
defineTools()     app capability surface
generateCodePlan  LLM → JavaScript plan
runCodePlan       scoped execution through handlers
ui-runtime        html tagged templates → delegated browser UI
```

## Install

```bash
pnpm add gruntend-sdk valibot
```

## Define tools

```ts
import { createGruntendClient } from "gruntend-sdk/client";
import { createJailJsCodePlanExecutor } from "gruntend-sdk/executor/jailjs";
import { defineTools } from "gruntend-sdk/tool";
import * as v from "valibot";

const tools = defineTools({
  menu: {
    items: {
      list: {
        description: "List menu items from a menu.",
        input: v.object({ menuId: v.string() }),
        output: v.object({
          items: v.array(v.object({ name: v.string(), price: v.number() })),
        }),
        parameters: {
          type: "object",
          properties: { menuId: { type: "string" } },
          required: ["menuId"],
        },
        returns: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    item: {
      duplicate: {
        description: "Duplicate one menu item.",
        input: v.object({ menuId: v.string(), itemId: v.string() }),
        output: v.object({
          item: v.object({
            itemId: v.string(),
            name: v.string(),
            price: v.number(),
          }),
        }),
      },
    },
  },
});

const gruntend = createGruntendClient({
  tools,
  executor: createJailJsCodePlanExecutor(),
});
```

A tool contract is just:

- namespace/name
- description
- input schema
- output schema
- optional model-facing `parameters` / `returns`

Handlers stay owned by the app. Gruntend validates generated tool inputs and handler outputs at runtime.

## Generate a code plan

```ts
import { generateCodePlan, getModel } from "gruntend-sdk/generate";

const generated = await generateCodePlan({
  tools,
  task: "Show all menu items and expose their available actions.",
  input: {
    menus: await listMenus(),
  },
  ui: { kind: "tagged-html" },
  model: getModel("openai", "gpt-5.5"),
  options: {
    apiKey: process.env.OPENAI_API_KEY,
    reasoning: "low",
    maxTokens: 5000,
  },
});

const { summary, input, code } = generated.plan;
```

Applications may pass an exact first-class prompt instead of using the default:

```ts
import { createCodePlanPrompt } from "gruntend-sdk/generate";

const defaults = createCodePlanPrompt({ tools, task, input });
const prompt = {
  system: `${defaults.system}\n\n${applicationPlanningPolicy}`,
  user: defaults.user,
};

const generated = await generateCodePlan({
  model,
  tools,
  task,
  input,
  prompt,
});
```

Model selection, prompt policy, and generation quality remain application-owned. Gruntend executes and validates the resulting code plan.

`ui: { kind: "tagged-html" }` tells the model to return UI using the provided `html` tagged template, not string-built HTML or UI JSON.

Generated UI can include native SVG charts through a restricted element and attribute allowlist. Geometry and presentation remain part of the JavaScript plan:

```js
return html`<svg viewBox="0 0 640 240" role="img" aria-label="Revenue">
  <rect x="20" y="40" width="50" height="160" fill="#f54a00"></rect>
</svg>`;
```

The SVG profile rejects scripts, styles, inline event strings, namespace attributes, external resources, `foreignObject`, images, `use`, animation, filter elements, unknown elements, malformed tags, and forged runtime targets. Interpolations are escaped. This profile is for markup produced through the `html` tag, not for sanitizing uploaded arbitrary SVG files.

Generated UI should return either a template:

```js
return html`<section class="surface-card">Done</section>`;
```

or a render function for local component state:

```js
var count = 0;
function increment() {
  count = count + 1;
}

return function render() {
  return html`
    <section class="surface-card">
      <p class="surface-text">Count: ${count}</p>
      <button type="button" class="surface-action" onclick=${increment}>
        Increment
      </button>
    </section>
  `;
};
```

## Run a code plan

```ts
const result = await gruntend.runCodePlan(code, {
  input,
  handlers: {
    "menu.items.list": async ({ input, ok }) =>
      ok({ items: await listMenuItems(input.menuId) }),

    "menu.item.duplicate": async ({ input, ok }) =>
      ok({ item: await duplicateMenuItem(input.menuId, input.itemId) }),
  },
});
```

Generated code can access only injected globals:

```text
input
tools
console
html when UI mode is provided at runtime
```

With the JailJS executor selected, standard built-ins such as `Promise` are still available for `async` code and `Promise.all(...)`.
JailJS applies an operation budget with `maxOps`. The QuickJS browser executor instead enforces WASM runtime memory, stack, and deadline limits.
The built-in budget is an interpreter operation budget, not a wall-clock or memory isolation boundary.

Use normal JavaScript for orchestration:

```js
const itemResults = await Promise.all(
  menus.map(function (menu) {
    return tools.menu.items.list({ menuId: menu.menuId });
  }),
);
```

Expected handler failures use `err(...)`; successful handlers use `ok(...)`.

```ts
return ok({ menuId: "menu_1" });
```

```ts
return err({
  code: "MISSING_AUTH",
  message: "Missing auth token.",
  retryable: false,
});
```

## Bring your own executor

Executor selection is explicit. JailJS is a lightweight `controlled` executor; the QuickJS browser executor uses a separate WASM realm and reports `isolated`. A run uses exactly one selected executor and Gruntend never falls back to or replays the plan with another executor.

```ts
import type { CodePlanExecutor } from "gruntend-sdk/executor";

const executor: CodePlanExecutor = {
  profile: {
    id: "my-browser-runtime",
    trust: "controlled",
    supportsGeneratedUi: false,
  },
  execute({ code, globals, maxOps, signal }) {
    return myInterpreter.evaluate(code, {
      globals,
      maxOps,
      signal,
    });
  },
};

const gruntend = createGruntendClient({
  tools,
  executor,
});
```

The executor receives Gruntend-owned globals: `input`, `tools`, a safe `console`, and `html` when UI mode is enabled. It also receives `maxOps` and the run `signal` so custom backends can enforce budgets and cancellation. If the signal is already aborted, Gruntend fails the run before invoking the executor. The `code` value is the generated async function body.

Use QuickJS in a browser by creating it asynchronously before client construction:

```ts
import { createQuickJsBrowserCodePlanExecutor } from "gruntend-sdk/executor/quickjs-browser";

const executor = await createQuickJsBrowserCodePlanExecutor();
const gruntend = createGruntendClient({ tools, executor });
```

The SvelteKit demo defaults to JailJS and provides a compact per-run selector for trying QuickJS/WASM in the browser. Its temporary `500_000` operation allowance applies to JailJS runs. Node executors, Workers, transports, and asynchronous UI sessions are deferred work.

## Release process

The repository uses Changesets for versioning, changelog updates, release PRs, and npm publishing.

For a user-facing package change:

```bash
pnpm changeset
```

When changesets land on `main`, the release workflow opens a version PR. Merging that PR publishes to npm with provenance when the repository has `NPM_TOKEN` configured.

See [docs/RELEASE.md](docs/RELEASE.md) for the full release checklist.

## Render generated UI

```ts
import { createGeneratedUi, createHtmlTag } from "gruntend-sdk/ui";
import { createDomPurifyGeneratedUiRenderer } from "gruntend-sdk/renderer/dom-purify";

const html = createHtmlTag();
const renderer = createDomPurifyGeneratedUiRenderer();

const result = await gruntend.runCodePlan(plan.code, {
  input: plan.input,
  handlers,
  ui: { html },
});

const ui = createGeneratedUi(result.result).unwrap();
const session = renderer.mount(rootElement, ui, {
  onError: console.error,
});
```

`GeneratedUiRenderer` is a first-class object strategy. A renderer is selected when a UI session mounts and remains fixed for that session; `session.update(nextUi)` changes only the generated UI value, and `session.destroy()` tears down the mounted UI. The model does not select renderers.

The DOMPurify renderer is the recommended browser renderer. It uses an exact DOMPurify dependency, a Gruntend-specific tag and attribute allowlist, disables arbitrary `data-*` attributes and unknown protocols, fails closed when DOMPurify is unavailable, and commits the sanitized `DocumentFragment` directly with `replaceChildren()`.

Renderer sanitization and plan-code isolation are separate boundaries. DOMPurify hardens generated markup; it does not sandbox generated JavaScript or reduce the authority of registered tool handlers. Select an isolated executor independently when the plan code is not trusted.

For controlled integrations that need the existing compiled-HTML sink, `createDomGeneratedUiRenderer()` is available from `gruntend-sdk/renderer/dom`. The compatibility helper `mountGeneratedUi()` remains available from `gruntend-sdk/ui/dom`.

Framework adapters are thin wrappers over the selected renderer. They do not own Gruntend state; pass both the renderer and the `GeneratedUi` returned by `createGeneratedUi()`.

### Svelte

```svelte
<script lang="ts">
  import type { GeneratedUi as GeneratedUiModel } from "gruntend-sdk/ui";
  import { createDomPurifyGeneratedUiRenderer } from "gruntend-sdk/renderer/dom-purify";
  import GeneratedUi from "gruntend-sdk/ui/svelte";

  let { ui }: { ui: GeneratedUiModel } = $props();
  const renderer = createDomPurifyGeneratedUiRenderer();
</script>

<GeneratedUi
  class="agent-generated-ui"
  {ui}
  {renderer}
  onError={(error) => console.error(error)}
/>
```

### React

```tsx
import type { GeneratedUi as GeneratedUiModel } from "gruntend-sdk/ui";
import { createDomPurifyGeneratedUiRenderer } from "gruntend-sdk/renderer/dom-purify";
import { GeneratedUi } from "gruntend-sdk/ui/react";

const renderer = createDomPurifyGeneratedUiRenderer();

export function AgentResult({ ui }: { ui: GeneratedUiModel }) {
  return (
    <GeneratedUi
      className="agent-generated-ui"
      ui={ui}
      renderer={renderer}
      onError={console.error}
    />
  );
}
```

### Solid

```tsx
import type { GeneratedUi as GeneratedUiModel } from "gruntend-sdk/ui";
import { createDomPurifyGeneratedUiRenderer } from "gruntend-sdk/renderer/dom-purify";
import { GeneratedUi } from "gruntend-sdk/ui/solid";

const renderer = createDomPurifyGeneratedUiRenderer();

export function AgentResult(props: { ui: GeneratedUiModel }) {
  return (
    <GeneratedUi
      class="agent-generated-ui"
      ui={props.ui}
      renderer={renderer}
      onError={console.error}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import type { GeneratedUi as GeneratedUiModel } from "gruntend-sdk/ui";
import { createDomPurifyGeneratedUiRenderer } from "gruntend-sdk/renderer/dom-purify";
import GeneratedUi from "gruntend-sdk/ui/vue";

defineProps<{ ui: GeneratedUiModel }>();
const renderer = createDomPurifyGeneratedUiRenderer();

function reportError(error: unknown) {
  console.error(error);
}
</script>

<template>
  <GeneratedUi
    class="agent-generated-ui"
    :ui="ui"
    :renderer="renderer"
    @error="reportError"
  />
</template>
```

The Svelte, React, and Solid adapters require a `renderer` and accept `onError`, `onRender`, `onActionStart`, and `onActionEnd` callbacks. The Vue adapter requires `renderer` and emits `error`, `render`, `action-start`, and `action-end` events. Treat the renderer prop as immutable for the mounted component lifetime. The consuming app supplies its framework dependency; Gruntend keeps these adapters as optional subpath exports.

Framework adapter exports are source-backed through explicit `types` and `import` export conditions for now, so each host app can compile its own framework format. Core runtime exports such as `gruntend-sdk/client`, `gruntend-sdk/code-plan`, `gruntend-sdk/tool`, and `gruntend-sdk/ui` are published from `dist`.

Event handlers are written naturally:

```js
html`<button onclick=${increment}>Increment</button>`;
```

but compiled to inert delegated attributes before reaching the browser:

```html
<button data-gr-click="h0">Increment</button>
```

The browser never receives real inline JavaScript.

## Lifecycle events

`runCodePlan()` emits one lifecycle stream:

```text
plan.started
plan.console
tool.started
tool.retrying
tool.completed
tool.failed
plan.completed
plan.failed
```

```ts
await gruntend.runCodePlan(code, {
  handlers,
  onEvent(event) {
    console.log(event.type);
  },
});
```

## SvelteKit example

`examples/sveltekit` is the main example app. It includes seeded restaurant data, SvelteKit remote functions, a tool namespace over app-owned handlers, and an `/agent` route that runs generated tagged-template UI through Gruntend.

Run mock mode:

```bash
pnpm build
pnpm --filter gruntend-sveltekit-example dev
```

Use real LLM mode with `examples/sveltekit/.env`:

```env
GRUNTEND_AGENT_MODE=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.1
OPENAI_SUGGESTION_MODEL=gpt-5-nano
```

Then open:

```text
/agent
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm check
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```
