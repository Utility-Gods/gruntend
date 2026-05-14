import { assertEquals } from "@std/assert";
import {
  createToolRegistry,
  defineTool,
  runWorkflow,
  type WorkflowMachineConfig,
} from "../mod.ts";
import * as v from "valibot";

Deno.test("runWorkflow consumes XState-style JSON and executes a single tool invoke", async () => {
  const add = defineTool({
    name: "calculator.add",
    description: "Add two numbers.",
    input: v.object({
      a: v.number(),
      b: v.number(),
    }),
    output: v.object({
      value: v.number(),
    }),
    execute({ input }) {
      return {
        data: {
          value: input.a + input.b,
        },
      };
    },
  });

  const registry = createToolRegistry([add]);
  const workflow: WorkflowMachineConfig = {
    id: "math",
    initial: "add",
    states: {
      add: {
        invoke: {
          src: "tool",
          input: {
            tool: "calculator.add",
            params: {
              a: 2,
              b: 3,
            },
          },
          onDone: "completed",
        },
      },
      completed: {
        type: "final",
      },
    },
  };

  const result = await runWorkflow({ workflow, registry });

  assertEquals(result, {
    status: "done",
    outputs: {
      add: {
        data: {
          value: 5,
        },
      },
    },
    finalState: "completed",
  });
});

Deno.test("runWorkflow resolves refs between deterministic dependent tool states", async () => {
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      menuId: v.string(),
      name: v.string(),
    }),
    execute({ input }) {
      return {
        data: {
          menuId: `menu:${input.name}`,
          name: input.name,
        },
      };
    },
  });

  const createMenuItem = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({
      menuId: v.string(),
      name: v.string(),
      price: v.number(),
    }),
    output: v.object({
      itemId: v.string(),
      menuId: v.string(),
      name: v.string(),
    }),
    execute({ input }) {
      return {
        data: {
          itemId: `item:${input.menuId}:${input.name}`,
          menuId: input.menuId,
          name: input.name,
        },
      };
    },
  });

  const registry = createToolRegistry([createMenu, createMenuItem]);
  const workflow: WorkflowMachineConfig = {
    id: "menu",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: {
              name: "Dinner",
            },
          },
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
      completed: {
        type: "final",
      },
    },
  };

  const result = await runWorkflow({ workflow, registry });

  assertEquals(result, {
    status: "done",
    outputs: {
      createMenu: {
        data: {
          menuId: "menu:Dinner",
          name: "Dinner",
        },
      },
      createBurger: {
        data: {
          itemId: "item:menu:Dinner:Burger",
          menuId: "menu:Dinner",
          name: "Burger",
        },
      },
    },
    finalState: "completed",
  });
});

Deno.test("runWorkflow follows onError when a tool fails", async () => {
  const failTool = defineTool({
    name: "menu.item.create",
    description: "Create a menu item.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      itemId: v.string(),
    }),
    execute({ input }) {
      throw new Error(`Cannot create item ${input.name}`);
    },
  });

  const registry = createToolRegistry([failTool]);
  const workflow: WorkflowMachineConfig = {
    id: "menu-failure",
    initial: "createItem",
    states: {
      createItem: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.item.create",
            params: {
              name: "Broken Burger",
            },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };

  const result = await runWorkflow({ workflow, registry });

  assertEquals(result, {
    status: "failed",
    outputs: {},
    finalState: "failed",
  });
});

Deno.test("runWorkflow retries a failing tool invoke before following onError", async () => {
  let attempts = 0;

  const flakyTool = defineTool({
    name: "menu.item.create",
    description: "Create a menu item with a transient failure.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      itemId: v.string(),
    }),
    execute({ input }) {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("Transient failure");
      }

      return {
        data: {
          itemId: `item:${input.name}`,
        },
      };
    },
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
            params: {
              name: "Burger",
            },
            retry: {
              maxAttempts: 2,
            },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };

  const result = await runWorkflow({ workflow, registry });

  assertEquals(attempts, 2);
  assertEquals(result, {
    status: "done",
    outputs: {
      createItem: {
        data: {
          itemId: "item:Burger",
        },
      },
    },
    finalState: "completed",
  });
});
