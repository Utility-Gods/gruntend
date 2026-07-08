# Gruntend

Typed tool namespaces for LLM-generated code plans.

Gruntend lets an application expose a small, typed capability surface to an LLM, receive a code-like plan, and execute that plan through app-owned runtime handlers.

```text
defineTools()        app capability surface
LLM code plan        orchestration
runtime handlers     real app effects
runtime events       execution trace
```

## Install

```bash
pnpm add gruntend valibot
```

## Define tools

Gruntend 0.1 uses explicit subpath imports. There is no barrel file.

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
                properties: { name: { type: "string" }, price: { type: "number" } },
              },
            },
          },
        },
      },
    },
    item: {
      create: {
        description: "Create one menu item.",
        input: v.object({
          menuId: v.string(),
          name: v.string(),
          price: v.number(),
        }),
        output: v.object({ itemId: v.string(), name: v.string() }),
      },
    },
  },
});

const gruntend = createGruntendClient({ tools });
```

A tool contract is only:

- namespace/name
- description
- input schema for runtime validation
- output schema for runtime validation
- optional `parameters` / `returns` model-facing data for code-plan generation

`parameters` and `returns` are plain model-facing data; Gruntend does not inspect validation schema internals.

Ordering, branching, loops, and parallelism live in the generated code plan.

## Generate a code plan

For real LLM calls, Gruntend owns the prompt contract and JSON parsing. App code passes a typed request: tools, the user's task, optional app data, a pi-ai model, and pi-ai options.

```ts
import { generateCodePlan, getModel } from "gruntend/generate";

const generated = await generateCodePlan({
  tools,
  task: "Copy the dinner menu into a lunch menu",
  input: {
    menus: await listMenus(),
  },
  model: getModel("openai", "gpt-5.1"),
  options: {
    apiKey: process.env.OPENAI_API_KEY,
    reasoning: "low",
    maxTokens: 5000,
  },
});

// typed Gruntend plan
const { summary, input, code } = generated.plan;

// pi-ai-compatible raw response for inspection/logging
console.log(generated.message.usage);
```

`generateCodePlan()` returns:

```ts
{
  plan: {
    summary: string;
    input: Record<string, unknown>;
    code: string;
  };
  text: string;
  message: AssistantMessage;
}
```

Prompts are backend details of Gruntend. The application chooses the model/options and provides user/app input; Gruntend builds the LLM request, validates the response, and returns a code plan that can be executed with `runCodePlan()`.

## Run a code plan

```ts
const code = `
const source = await tools.menu.items.list({
  menuId: input.sourceMenuId,
});

const created = await parallel(
  source.items.map((item) =>
    tools.menu.item.create({
      menuId: input.targetMenuId,
      name: item.name,
      price: item.price,
    })
  )
);

return {
  copiedItems: created.map((item) => item.name),
};
`;

const result = await gruntend.runCodePlan(code, {
  input: {
    sourceMenuId: "menu:source",
    targetMenuId: "menu:target",
  },
  handlers: {
    "menu.items.list": async ({ ok }) =>
      ok({ items: [{ name: "Burger", price: 12 }] }),

    "menu.item.create": async ({ input, ok }) =>
      ok({ itemId: `item:${input.name}`, name: input.name }),
  },
});
```

## Conditional plans

Because plans are code, they can branch on prior tool output:

```ts
const existing = await tools.menu.find({ name: input.name });

if (existing.exists) {
  return { action: "reused", menuId: existing.menuId };
}

const created = await tools.menu.create({ name: input.name });
return { action: "created", menuId: created.menuId };
```

## Runtime boundary

Generated code can access only the injected plan globals:

```ts
input
tools
parallel(promises)
console
```

App internals stay inside handlers: auth, cookies, stores, database clients, API clients, route state, etc.

For each tool call, Gruntend:

1. checks that the tool exists
2. validates generated input
3. calls the app-owned handler
4. handles `ok(...)` / `err(...)`
5. retries retryable failures when configured
6. validates successful output
7. returns plain validated data to the code plan
8. emits lifecycle events

## Handler results

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

Expected failures should use `err(...)`. Unexpected failures may throw.

## Events

`runCodePlan()` emits one lifecycle stream:

```text
plan.started
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

## Examples

### SvelteKit app

`examples/sveltekit` is the main application example. It uses pinned latest SvelteKit, seeded Bun SQLite API data, normal app routes, and an agent route powered by `gruntend/generate` + pi-ai/OpenAI.

Routes:

- `/` — app dashboard
- `/menus` — menus from `/api/menus`
- `/users` — seeded users from `/api/users`
- `/agent` — pi-ai/OpenAI generation → Gruntend code plan → app API handlers

For real LLM mode, copy `examples/sveltekit/.env.example` to `examples/sveltekit/.env` and set `OPENAI_API_KEY`. The key stays server-only.

Run it:

```bash
pnpm --filter gruntend-sveltekit-example dev
```

Check/build it:

```bash
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```


## Development

```bash
pnpm install
pnpm test
pnpm check
```
