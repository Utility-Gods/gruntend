import { expect, test } from "vitest";
import { runCodePlan } from "../src/code-plan.ts";
import { createGruntendClient } from "../src/client.ts";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools, type ToolHandlerMap } from "../src/tool.ts";
import * as v from "valibot";

test("runCodePlan executes LLM-generated code against registered tool handlers", async () => {
  const menuTools = defineTools({
    menu: {
      items: {
        list: {
          description: "List menu items from a source menu.",
          input: v.object({ menuId: v.string() }),
          output: v.object({
            items: v.array(v.object({ name: v.string(), price: v.number() })),
          }),
        },
      },
      findOrCreate: {
        description: "Find or create a destination menu.",
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

  const registry = createToolRegistry(menuTools);

  const handlers = {
    "menu.items.list": ({ ok }) =>
      ok({
        items: [
          { name: "Burger", price: 12 },
          { name: "Fries", price: 5 },
        ],
      }),
    "menu.findOrCreate": ({ input, ok }) =>
      ok({
        menuId: `menu:${input.name.toLowerCase().replaceAll(" ", "-")}`,
        name: input.name,
      }),
    "menu.item.create": ({ input, ok }) =>
      ok({
        itemId: `item:${input.menuId}:${input.name.toLowerCase()}`,
        name: input.name,
      }),
  } satisfies ToolHandlerMap<typeof menuTools>;

  const code = `
    const source = await tools.menu.items.list({
      menuId: input.sourceMenuId,
    });

    const target = await tools.menu.findOrCreate({
      name: input.targetMenuName,
    });

    const created = await Promise.all(
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

  const result = await runCodePlan({
    code,
    input: {
      sourceMenuId: "menu:source",
      targetMenuName: "Lunch Menu",
    },
    registry,
    handlers,
  });

  expect(result).toEqual({
    status: "done",
    result: {
      targetMenuId: "menu:lunch-menu",
      copiedItems: ["Burger", "Fries"],
    },
    errors: {},
  });
});

test("runCodePlan exposes flat bracket tool aliases for dot-named tool calls", async () => {
  const menuTools = defineTools({
    menu: {
      items: {
        list: {
          description: "List menu items.",
          input: v.object({ menuId: v.string() }),
          output: v.object({ items: v.array(v.object({ name: v.string() })) }),
        },
      },
    },
  });

  const result = await runCodePlan({
    code: `
      const result = await tools["menu.items.list"]({ menuId: input.menuId });
      return result.items.map(function (item) { return item.name; });
    `,
    input: { menuId: "menu_1" },
    registry: createToolRegistry(menuTools),
    handlers: {
      "menu.items.list": ({ ok }) => ok({ items: [{ name: "Fries" }] }),
    },
  });

  expect(result).toEqual({
    status: "done",
    result: ["Fries"],
    errors: {},
  });
});

test("runCodePlan branches on prior tool output", async () => {
  const menuTools = defineTools({
    menu: {
      find: {
        description: "Find a menu by name.",
        input: v.object({ name: v.string() }),
        output: v.object({ exists: v.boolean(), menuId: v.string() }),
      },
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });

  const registry = createToolRegistry(menuTools);
  let createCalls = 0;

  const handlers = {
    "menu.find": ({ input, ok }) =>
      ok({
        exists: input.name === "Dinner",
        menuId: input.name === "Dinner" ? "menu:dinner" : "",
      }),
    "menu.create": ({ input, ok }) => {
      createCalls += 1;
      return ok({ menuId: `menu:${input.name.toLowerCase()}` });
    },
  } satisfies ToolHandlerMap<typeof menuTools>;

  const code = `
    const existing = await tools.menu.find({ name: input.name });

    if (existing.exists) {
      return {
        action: "reused",
        menuId: existing.menuId,
      };
    }

    const created = await tools.menu.create({ name: input.name });
    return {
      action: "created",
      menuId: created.menuId,
    };
  `;

  const reused = await runCodePlan({
    code,
    input: { name: "Dinner" },
    registry,
    handlers,
  });

  expect(reused).toEqual({
    status: "done",
    result: { action: "reused", menuId: "menu:dinner" },
    errors: {},
  });
  expect(createCalls).toBe(0);

  const created = await runCodePlan({
    code,
    input: { name: "Lunch" },
    registry,
    handlers,
  });

  expect(created).toEqual({
    status: "done",
    result: { action: "created", menuId: "menu:lunch" },
    errors: {},
  });
  expect(createCalls).toBe(1);
});

test("Gruntend client runs a code plan with the registered tool handlers", async () => {
  const tools = defineTools({
    math: {
      double: {
        description: "Double a number.",
        input: v.object({ value: v.number() }),
        output: v.object({ value: v.number() }),
      },
    },
  });

  const client = createGruntendClient({ tools });

  const result = await client.runCodePlan(
    "return await tools.math.double({ value: input.value });",
    {
      input: { value: 21 },
      handlers: {
        "math.double": ({ input, ok }) => ok({ value: input.value * 2 }),
      },
    },
  );

  expect(result).toEqual({
    status: "done",
    result: { value: 42 },
    errors: {},
  });
});
