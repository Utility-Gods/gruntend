# Gruntend 0.1 API

Gruntend lets an app expose a typed namespace of capabilities, ask an LLM for a small code plan, and execute that plan through app-owned handlers.

```text
Tool namespace
↓
LLM code plan
↓
Gruntend runtime
↓
validated app handlers
```

There is no workflow JSON in the 0.1 API. Composition lives in code: `await`, `if`, `for`, `map`, and `parallel(...)`.

## Define tools

Import concrete modules directly. Gruntend does not use barrel files.

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
    findOrCreate: {
      description: "Find or create a menu by name.",
      input: v.object({ name: v.string() }),
      output: v.object({ menuId: v.string(), name: v.string() }),
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
```

`defineTools()` flattens that namespace into dot-named tool contracts:

```text
menu.items.list
menu.findOrCreate
menu.item.create
```

A tool contract only needs:

- namespace/name
- description
- input schema for runtime validation
- output schema for runtime validation
- optional `parameters` / `returns` plain model-facing data for code-plan generation

Gruntend does not inspect validation schema internals. If the LLM needs parameter/return shapes, pass them explicitly as plain data.

It does not declare ordering or concurrency behavior. The plan code decides that.

## Generate a code plan

`gruntend/generate` is the LLM boundary. The app passes typed data and pi-ai configuration; Gruntend owns prompt construction, the LLM call, response parsing, and response validation.

```ts
import { generateCodePlan, getModel } from "gruntend/generate";

const generated = await generateCodePlan({
  tools,
  task: "Copy Dinner Menu into Lunch Menu",
  input: { menus: await listMenus() },
  model: getModel("openai", "gpt-5.1"),
  options: {
    apiKey: process.env.OPENAI_API_KEY,
    reasoning: "low",
    maxTokens: 5000,
  },
});

const { summary, input, code } = generated.plan;
```

The response is:

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

## Create a client

```ts
const gruntend = createGruntendClient({ tools });
```

## Execute a code plan

```ts
const code = `
const source = await tools.menu.items.list({
  menuId: input.sourceMenuId,
});

const target = await tools.menu.findOrCreate({
  name: input.targetMenuName,
});

const created = await parallel(
  source.items.map((item) =>
    tools.menu.item.create({
      menuId: target.menuId,
      name: item.name,
      price: item.price,
    })
  )
);

return {
  targetMenuId: target.menuId,
  copiedItems: created.map((item) => item.name),
};
`;

const result = await gruntend.runCodePlan(code, {
  input: {
    sourceMenuId: "menu:source",
    targetMenuName: "Lunch Menu",
  },
  handlers: {
    "menu.items.list": async ({ ok }) => ok({ items: [] }),
    "menu.findOrCreate": async ({ input, ok }) =>
      ok({ menuId: `menu:${input.name}`, name: input.name }),
    "menu.item.create": async ({ input, ok }) =>
      ok({ itemId: `item:${input.name}`, name: input.name }),
  },
});
```

The generated code receives only:

```ts
declare const input: unknown;
declare const tools: ToolNamespace;
declare function parallel<T>(values: readonly Promise<T>[]): Promise<T[]>;
declare const console: Console;
```

App internals stay inside handlers.

## Handler result protocol

Expected success:

```ts
return ok({ menuId: "menu_1" });
```

Expected failure:

```ts
return err({
  code: "MISSING_AUTH",
  message: "Missing auth token.",
  retryable: false,
});
```

Unexpected failures can still throw. Thrown handler errors are retryable by default.

## Runtime guarantees

For every tool call Gruntend:

1. checks the tool exists
2. validates generated input
3. calls the app-owned handler
4. honors `ok(...)` / `err(...)`
5. retries when configured and retryable
6. validates successful output
7. emits runtime events
8. returns plain validated data back to the code plan

## Events

`runCodePlan()` emits one event stream:

```text
plan.started
tool.started
tool.retrying
tool.completed
tool.failed
plan.completed
plan.failed
```

Example:

```ts
await gruntend.runCodePlan(code, {
  handlers,
  onEvent(event) {
    console.log(event.type);
  },
});
```

## Mental model

```text
defineTools = app capability surface
code plan = orchestration
handlers = real app effects
runtime events = execution trace
```
