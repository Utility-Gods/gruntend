import { assertEquals } from "@std/assert";
import {
  createToolRegistry,
  defineTool,
  runWorkflow,
  type ToolHandlerMapFor,
  type WorkflowMachineConfig,
} from "../mod.ts";
import * as v from "valibot";

Deno.test("runWorkflow consumes XState-style JSON and executes a single tool invoke", async () => {
  const add = defineTool({
    name: "calculator.add",
    description: "Add two numbers.",
    input: v.object({ a: v.number(), b: v.number() }),
    output: v.object({ value: v.number() }),
  });

  const registry = createToolRegistry([add]);
  const workflow: WorkflowMachineConfig = {
    id: "math",
    initial: "add",
    states: {
      add: {
        invoke: {
          src: "tool",
          input: { tool: "calculator.add", params: { a: 2, b: 3 } },
          onDone: "completed",
        },
      },
      completed: { type: "final" },
    },
  };

  const handlers = {
    "calculator.add": ({ input, ok }) => ok({ value: input.a + input.b }),
  } satisfies ToolHandlerMapFor<typeof add>;

  const result = await runWorkflow({
    workflow,
    registry,
    handlers,
  });

  assertEquals(result, {
    status: "done",
    outputs: { add: { ok: true, data: { value: 5 } } },
    errors: {},
    finalState: "completed",
  });
});

Deno.test("runWorkflow resolves refs between deterministic dependent tool states", async () => {
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({ name: v.string() }),
    output: v.object({ menuId: v.string(), name: v.string() }),
  });

  const createMenuItem = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({ menuId: v.string(), name: v.string(), price: v.number() }),
    output: v.object({ itemId: v.string(), menuId: v.string(), name: v.string() }),
  });

  const registry = createToolRegistry([createMenu, createMenuItem]);
  const workflow: WorkflowMachineConfig = {
    id: "menu",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: { tool: "menu.create", params: { name: "Dinner" } },
          onDone: "createBurger",
        },
      },
      createBurger: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: {
              menuId: { $ref: "createMenu.data.menuId" },
              name: "Burger",
              price: 12,
            },
          },
          onDone: "completed",
        },
      },
      completed: { type: "final" },
    },
  };

  const handlers = {
    "menu.create": ({ input, ok }) => ok({
      menuId: `menu:${input.name}`,
      name: input.name,
    }),
    "menu.item.create": ({ input, ok }) => ok({
      itemId: `item:${input.menuId}:${input.name}`,
      menuId: input.menuId,
      name: input.name,
    }),
  } satisfies ToolHandlerMapFor<typeof createMenu | typeof createMenuItem>;

  const result = await runWorkflow({
    workflow,
    registry,
    handlers,
  });

  assertEquals(result, {
    status: "done",
    outputs: {
      createMenu: { ok: true, data: { menuId: "menu:Dinner", name: "Dinner" } },
      createBurger: {
        ok: true,
        data: { itemId: "item:menu:Dinner:Burger", menuId: "menu:Dinner", name: "Burger" },
      },
    },
    errors: {},
    finalState: "completed",
  });
});

Deno.test("runWorkflow follows onError when a tool fails", async () => {
  const failTool = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({ name: v.string() }),
    output: v.object({ itemId: v.string() }),
  });

  const registry = createToolRegistry([failTool]);
  const workflow: WorkflowMachineConfig = {
    id: "menu-failure",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: { tool: "menu.item.create", params: { name: "Broken Burger" } },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  const handlers = {
    "menu.item.create": ({ input }) => {
      throw new Error(`Cannot create item ${input.name}`);
    },
  } satisfies ToolHandlerMapFor<typeof failTool>;

  const result = await runWorkflow({
    workflow,
    registry,
    handlers,
  });

  assertEquals(result.status, "failed");
  assertEquals(result.outputs, {});
  assertEquals(result.finalState, "failed");
  assertEquals(result.errors.createItem, {
    type: "handler_error",
    state: "createItem",
    tool: "menu.item.create",
    message: "Cannot create item Broken Burger",
    retryable: true,
  });
});

Deno.test("runWorkflow retries a thrown handler exception before following onError", async () => {
  let attempts = 0;

  const flakyTool = defineTool({
    name: "menu.item.create",
    description: "Create a menu item with a transient failure.",
    input: v.object({ name: v.string() }),
    output: v.object({ itemId: v.string() }),
  });

  const registry = createToolRegistry([flakyTool]);
  const workflow: WorkflowMachineConfig = {
    id: "menu-retry",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: { name: "Burger" },
            retry: { maxAttempts: 2 },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  const handlers = {
    "menu.item.create": ({ input, ok }) => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("Transient failure");
      }

      return ok({ itemId: `item:${input.name}` });
    },
  } satisfies ToolHandlerMapFor<typeof flakyTool>;

  const result = await runWorkflow({
    workflow,
    registry,
    handlers,
  });

  assertEquals(attempts, 2);
  assertEquals(result, {
    status: "done",
    outputs: { createItem: { ok: true, data: { itemId: "item:Burger" } } },
    errors: {},
    finalState: "completed",
  });
});

Deno.test("runWorkflow retries a controlled retryable tool error", async () => {
  let attempts = 0;
  const seenAttempts: number[] = [];
  const seenMaxAttempts: number[] = [];

  const createItem = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({ name: v.string() }),
    output: v.object({ itemId: v.string() }),
  });

  const registry = createToolRegistry([createItem]);
  const workflow: WorkflowMachineConfig = {
    id: "controlled-retry",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: { name: "Burger" },
            retry: { maxAttempts: 3 },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  const handlers = {
    "menu.item.create": ({ input, ok, err, attempt, maxAttempts }) => {
      attempts += 1;
      seenAttempts.push(attempt);
      seenMaxAttempts.push(maxAttempts);

      if (attempt < 3) {
        return err({
          code: "TEMPORARY_UPSTREAM_FAILURE",
          message: "Kitchen API is temporarily unavailable.",
          retryable: true,
        });
      }

      return ok({ itemId: `item:${input.name}` });
    },
  } satisfies ToolHandlerMapFor<typeof createItem>;

  const result = await runWorkflow({ workflow, registry, handlers });

  assertEquals(attempts, 3);
  assertEquals(seenAttempts, [1, 2, 3]);
  assertEquals(seenMaxAttempts, [3, 3, 3]);
  assertEquals(result, {
    status: "done",
    outputs: { createItem: { ok: true, data: { itemId: "item:Burger" } } },
    errors: {},
    finalState: "completed",
  });
});

Deno.test("runWorkflow does not retry a controlled non-retryable tool error", async () => {
  let attempts = 0;

  const createItem = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({ name: v.string() }),
    output: v.object({ itemId: v.string() }),
  });

  const registry = createToolRegistry([createItem]);
  const workflow: WorkflowMachineConfig = {
    id: "controlled-no-retry",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: { name: "Burger" },
            retry: { maxAttempts: 3 },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  const handlers = {
    "menu.item.create": ({ err }) => {
      attempts += 1;

      return err({
        code: "VALIDATION_FAILED",
        message: "The item cannot be created.",
        retryable: false,
        details: { reason: "duplicate" },
      });
    },
  } satisfies ToolHandlerMapFor<typeof createItem>;

  const result = await runWorkflow({ workflow, registry, handlers });

  assertEquals(attempts, 1);
  assertEquals(result.status, "failed");
  assertEquals(result.outputs, {});
  assertEquals(result.finalState, "failed");
  assertEquals(result.errors.createItem, {
    type: "handler_error",
    state: "createItem",
    tool: "menu.item.create",
    message: "The item cannot be created.",
    code: "VALIDATION_FAILED",
    retryable: false,
    details: { reason: "duplicate" },
  });
});

Deno.test("runWorkflow does not retry invalid handler output", async () => {
  let attempts = 0;

  const createItem = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({ name: v.string() }),
    output: v.object({ itemId: v.string() }),
  });

  const registry = createToolRegistry([createItem]);
  const workflow: WorkflowMachineConfig = {
    id: "invalid-output-no-retry",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: { name: "Burger" },
            retry: { maxAttempts: 3 },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  const handlers = {
    "menu.item.create": ({ ok }) => {
      attempts += 1;
      return ok({ id: "wrong" } as unknown as { itemId: string });
    },
  } satisfies ToolHandlerMapFor<typeof createItem>;

  const result = await runWorkflow({ workflow, registry, handlers });

  assertEquals(attempts, 1);
  assertEquals(result.status, "failed");
  assertEquals(result.errors.createItem, {
    type: "invalid_output",
    state: "createItem",
    tool: "menu.item.create",
    message: 'Tool "menu.item.create" returned invalid output.',
    retryable: false,
  });
});
