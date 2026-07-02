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
- input schema
- output schema

Ordering, branching, loops, and parallelism live in the generated code plan.

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

## Development

```bash
pnpm install
pnpm test
pnpm check
```

Run the Svelte example:

```bash
pnpm --filter gruntend-svelte-example dev
```

Build the example:

```bash
pnpm --filter gruntend-svelte-example build
```
