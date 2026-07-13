# Gruntend

Typed tool namespaces and generated UI for app-owned capabilities.

Current beta: `0.1.0`

Gruntend lets an app expose a small capability surface to an LLM, receive a JavaScript code plan, and execute that plan through app-owned handlers. In UI mode, the plan can return safe `html` tagged-template UI with local component state.

```text
defineTools()     app capability surface
generateCodePlan  LLM → JavaScript plan
runCodePlan       scoped execution through handlers
ui-runtime        html tagged templates → delegated browser UI
```

## Install

```bash
pnpm add gruntend valibot
```

## Define tools

```ts
import { createGruntendClient } from "gruntend/client";
import { defineTools } from "gruntend/tool";
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

const gruntend = createGruntendClient({ tools });
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
import { generateCodePlan, getModel } from "gruntend/generate";

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

`ui: { kind: "tagged-html" }` tells the model to return UI using the provided `html` tagged template, not string-built HTML or UI JSON.

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

With the default JailJS executor, standard built-ins such as `Promise` are still available for `async` code and `Promise.all(...)`.
The default executor applies an operation budget with `maxOps`; use a custom executor when you need a worker, process, isolate, or remote sandbox as the outer execution boundary.
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

JailJS is the default code-plan executor. Applications can replace it with their own interpreter, worker, isolate, or remote execution service without changing tool contracts or handlers.

```ts
import type { CodePlanExecutor } from "gruntend/code-plan";

const executor: CodePlanExecutor = async ({
  code,
  globals,
  maxOps,
  signal,
}) => {
  return myInterpreter.evaluate(code, {
    globals,
    maxOps,
    signal,
  });
};

const gruntend = createGruntendClient({
  tools,
  executor,
});
```

The executor receives Gruntend-owned globals: `input`, `tools`, a safe `console`, and `html` when UI mode is enabled. It also receives `maxOps` and the run `signal` so custom backends can enforce budgets and cancellation. If the signal is already aborted, Gruntend fails the run before invoking the executor.
The `code` value is the generated async function body; custom executors own any wrapping, parsing, or remote execution protocol they need.

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
import { createGeneratedUi, createHtmlTag } from "gruntend/ui";
import { mountGeneratedUi } from "gruntend/ui/dom";

const html = createHtmlTag();

const result = await gruntend.runCodePlan(plan.code, {
  input: plan.input,
  handlers,
  ui: { html },
});

const ui = createGeneratedUi(result.result).unwrap();
const frame = ui.render().unwrap();

// frame.html is safe compiled HTML.
// frame.handlers maps delegated handler ids to generated functions.

mountGeneratedUi(rootElement, ui);
```

Framework adapters are thin wrappers over the same DOM primitive. They do not own Gruntend state; pass the `GeneratedUi` returned by `createGeneratedUi()`.

### Svelte

```svelte
<script lang="ts">
  import type { GeneratedUi as GeneratedUiModel } from "gruntend/ui";
  import GeneratedUi from "gruntend/ui/svelte";

  let { ui }: { ui: GeneratedUiModel } = $props();
</script>

<GeneratedUi
  class="agent-generated-ui"
  {ui}
  onError={(error) => console.error(error)}
/>
```

### React

```tsx
import type { GeneratedUi as GeneratedUiModel } from "gruntend/ui";
import { GeneratedUi } from "gruntend/ui/react";

export function AgentResult({ ui }: { ui: GeneratedUiModel }) {
  return (
    <GeneratedUi
      className="agent-generated-ui"
      ui={ui}
      onError={console.error}
    />
  );
}
```

### Solid

```tsx
import type { GeneratedUi as GeneratedUiModel } from "gruntend/ui";
import { GeneratedUi } from "gruntend/ui/solid";

export function AgentResult(props: { ui: GeneratedUiModel }) {
  return (
    <GeneratedUi
      class="agent-generated-ui"
      ui={props.ui}
      onError={console.error}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import type { GeneratedUi as GeneratedUiModel } from "gruntend/ui";
import GeneratedUi from "gruntend/ui/vue";

defineProps<{ ui: GeneratedUiModel }>();

function reportError(error: unknown) {
  console.error(error);
}
</script>

<template>
  <GeneratedUi class="agent-generated-ui" :ui="ui" @error="reportError" />
</template>
```

The Svelte, React, and Solid adapters accept `onError`, `onRender`, `onActionStart`, and `onActionEnd` callbacks. The Vue adapter emits `error`, `render`, `action-start`, and `action-end` events. The consuming app supplies its framework dependency; Gruntend keeps these adapters as optional subpath exports.

Framework adapter exports are source-backed through explicit `types` and `import` export conditions for now, so each host app can compile its own framework format. Core runtime exports such as `gruntend/client`, `gruntend/code-plan`, `gruntend/tool`, and `gruntend/ui` are published from `dist`.

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
OPENAI_MODEL=gpt-5.5
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
