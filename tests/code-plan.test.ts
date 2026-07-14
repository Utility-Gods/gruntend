import { expect, test } from "vitest";
import { runCodePlan } from "../src/code-plan.ts";
import type { CodePlanExecutor } from "../src/executor.ts";
import { createJailJsCodePlanExecutor } from "../src/executors/jailjs.ts";
import { createGruntendClient } from "../src/client.ts";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools, type ToolHandlerMap } from "../src/tool.ts";
import * as v from "valibot";

const jailJsExecutor = createJailJsCodePlanExecutor();

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
    executor: jailJsExecutor,
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

test("runCodePlan exposes bracket tool aliases for dot-named tool calls", async () => {
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

  const registry = createToolRegistry(menuTools);
  const handlers = {
    "menu.items.list": ({ ok }) => ok({ items: [{ name: "Fries" }] }),
  } satisfies ToolHandlerMap<typeof menuTools>;

  const flatResult = await runCodePlan({
    executor: jailJsExecutor,
    code: `
      const result = await tools["menu.items.list"]({ menuId: input.menuId });
      return result.items.map(function (item) { return item.name; });
    `,
    input: { menuId: "menu_1" },
    registry,
    handlers,
  });

  expect(flatResult).toEqual({
    status: "done",
    result: ["Fries"],
    errors: {},
  });

  const namespaceResult = await runCodePlan({
    executor: jailJsExecutor,
    code: `
      const result = await tools["menu.items"].list({ menuId: input.menuId });
      return result.items.map(function (item) { return item.name; });
    `,
    input: { menuId: "menu_1" },
    registry,
    handlers,
  });

  expect(namespaceResult).toEqual({
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
    executor: jailJsExecutor,
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
    executor: jailJsExecutor,
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

  const client = createGruntendClient({ tools, executor: jailJsExecutor });

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

test("runCodePlan can use a custom executor", async () => {
  const tools = defineTools({});
  const registry = createToolRegistry(tools);
  const controller = new AbortController();
  const executor: CodePlanExecutor = {
    profile: {
      id: "test-executor",
      trust: "controlled",
      supportsGeneratedUi: false,
    },
    execute({ code, globals, signal }) {
      expect(code).toContain("return input.value");
      return {
        input: globals.input,
        hasTools: typeof globals.tools === "object",
        hasSignal: signal === controller.signal,
        hasPromiseGlobal: "Promise" in globals,
        usesHostConsole: globals.console === console,
      };
    },
  };

  const result = await runCodePlan({
    code: "return input.value;",
    input: { value: 7 },
    registry,
    handlers: {},
    executor,
    signal: controller.signal,
  });

  expect(result).toEqual({
    status: "done",
    result: {
      input: { value: 7 },
      hasTools: true,
      hasSignal: true,
      hasPromiseGlobal: false,
      usesHostConsole: false,
    },
    errors: {},
  });
});

test("runCodePlan emits console calls through the lifecycle stream", async () => {
  const tools = defineTools({});
  const registry = createToolRegistry(tools);
  const events: unknown[] = [];

  const result = await runCodePlan({
    executor: jailJsExecutor,
    code: `
      console.log("hello", input.value);
      return "done";
    `,
    input: { value: 7 },
    registry,
    handlers: {},
    onEvent: (event) => events.push(event),
  });

  expect(result.status).toBe("done");
  expect(events).toContainEqual({
    type: "plan.console",
    planId: "code-plan",
    level: "log",
    args: ["hello", 7],
  });
});

test("runCodePlan does not execute when the signal is already aborted", async () => {
  const tools = defineTools({});
  const registry = createToolRegistry(tools);
  const controller = new AbortController();
  const events: unknown[] = [];
  let executed = false;
  controller.abort();

  const result = await runCodePlan({
    code: "return 1;",
    registry,
    handlers: {},
    signal: controller.signal,
    executor: {
      profile: {
        id: "never-runs",
        trust: "controlled",
        supportsGeneratedUi: false,
      },
      execute() {
        executed = true;
        return 1;
      },
    },
    onEvent: (event) => events.push(event),
  });

  expect(executed).toBe(false);
  expect(events).toEqual([
    {
      type: "plan.failed",
      planId: "code-plan",
      executorId: "never-runs",
      errorCode: "executor_aborted",
      error: "Code plan execution aborted.",
      errors: {},
    },
  ]);
  expect(result).toEqual({
    status: "failed",
    errors: {},
    error: "Code plan execution aborted.",
    errorCode: "executor_aborted",
    executorId: "never-runs",
  });
});

test("runCodePlan applies a configured interpreter operation budget", async () => {
  const tools = defineTools({});
  const registry = createToolRegistry(tools);

  const result = await runCodePlan({
    code: "while (true) {}",
    registry,
    handlers: {},
    executor: createJailJsCodePlanExecutor(),
    maxOps: 100,
  });

  expect(result.status).toBe("failed");
  expect(result.error).toContain("maximum operations exceeded");
});
