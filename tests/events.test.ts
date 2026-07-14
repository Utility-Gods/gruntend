import { expect, test } from "vitest";
import { createGruntendClient } from "../src/client.ts";
import { createJailJsCodePlanExecutor } from "../src/executors/jailjs.ts";
import type { RuntimeEvent } from "../src/runtime.ts";
import { defineTools } from "../src/tool.ts";
import * as v from "valibot";

test("runCodePlan emits plan and tool lifecycle events through onEvent", async () => {
  const events: RuntimeEvent[] = [];
  const tools = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });
  const client = createGruntendClient({
    tools,
    executor: createJailJsCodePlanExecutor(),
  });

  await client.runCodePlan(
    `return await tools.menu.create({ name: "Dinner" });`,
    {
      id: "create-menu",
      handlers: {
        "menu.create": ({ input, ok }) => ok({ menuId: `menu:${input.name}` }),
      },
      onEvent: (event) => events.push(event),
    },
  );

  expect(events.map((event) => event.type)).toEqual([
    "plan.started",
    "tool.started",
    "tool.completed",
    "plan.completed",
  ]);
  expect(events[0]).toEqual({
    type: "plan.started",
    planId: "create-menu",
    executorId: "jailjs",
  });
  expect(events[1]).toEqual({
    type: "tool.started",
    planId: "create-menu",
    callId: "call1",
    tool: "menu.create",
    input: { name: "Dinner" },
  });
  expect(events[2]).toEqual({
    type: "tool.completed",
    planId: "create-menu",
    callId: "call1",
    tool: "menu.create",
    output: expect.objectContaining({
      status: "ok",
      value: { menuId: "menu:Dinner" },
    }),
  });
  expect(events[3]).toEqual({
    type: "plan.completed",
    planId: "create-menu",
    executorId: "jailjs",
    result: { menuId: "menu:Dinner" },
  });
});

test("runCodePlan emits retry events when a retryable tool error will be retried", async () => {
  const events: RuntimeEvent[] = [];
  const tools = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });
  const client = createGruntendClient({
    tools,
    executor: createJailJsCodePlanExecutor(),
  });

  await client.runCodePlan(
    `return await tools.menu.create({ name: "Dinner" });`,
    {
      id: "create-menu-retry",
      retry: { maxAttempts: 2 },
      handlers: {
        "menu.create": ({ input, ok, err, attempt }) => {
          if (attempt === 1) {
            return err({
              code: "TEMPORARY_FAILURE",
              message: "Temporary menu API failure.",
              retryable: true,
            });
          }

          return ok({ menuId: `menu:${input.name}` });
        },
      },
      onEvent: (event) => events.push(event),
    },
  );

  expect(events.map((event) => event.type)).toEqual([
    "plan.started",
    "tool.started",
    "tool.retrying",
    "tool.started",
    "tool.completed",
    "plan.completed",
  ]);
  expect(events[2]).toEqual({
    type: "tool.retrying",
    planId: "create-menu-retry",
    callId: "call1",
    tool: "menu.create",
    attempt: 1,
    maxAttempts: 2,
    nextAttempt: 2,
    error: {
      type: "handler_error",
      callId: "call1",
      tool: "menu.create",
      message: "Temporary menu API failure.",
      code: "TEMPORARY_FAILURE",
      retryable: true,
    },
  });
});
