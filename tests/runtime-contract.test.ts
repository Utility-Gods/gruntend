import { expect, test } from "vitest";
import { createGruntendClient } from "../src/client.ts";
import { defineTools } from "../src/tool.ts";
import * as v from "valibot";

test("runtime handlers are closures supplied when a code plan is triggered", async () => {
  const tools = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });

  const client = createGruntendClient({ tools });
  const authToken = "runtime-token";

  const result = await client.runCodePlan(
    `return await tools.menu.create({ name: "Dinner" });`,
    {
      handlers: {
        "menu.create": async ({ input, ok }) =>
          ok({ menuId: `${authToken}:${input.name}` }),
      },
    },
  );

  expect(result.status).toBe("done");
  expect(result.result).toEqual({ menuId: "runtime-token:Dinner" });
});

test("runtime rejects invalid LLM tool input before calling the handler", async () => {
  let handlerCalls = 0;

  const tools = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });

  const client = createGruntendClient({ tools });

  const result = await client.runCodePlan(
    `return await tools.menu.create({ name: 123 });`,
    {
      handlers: {
        "menu.create": ({ ok }) => {
          handlerCalls += 1;
          return ok({ menuId: "should-not-run" });
        },
      },
    },
  );

  expect(handlerCalls).toBe(0);
  expect(result.status).toBe("failed");
  expect(result.errors.call1).toEqual({
    type: "invalid_input",
    callId: "call1",
    tool: "menu.create",
    message: 'Tool "menu.create" received invalid input.',
    retryable: false,
  });
});

test("runtime rejects handler output that violates the tool output contract", async () => {
  const tools = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: v.object({ name: v.string() }),
        output: v.object({ menuId: v.string() }),
      },
    },
  });

  const client = createGruntendClient({ tools });

  const result = await client.runCodePlan(
    `return await tools.menu.create({ name: "Dinner" });`,
    {
      handlers: {
        "menu.create": ({ ok }) =>
          ok({ id: "wrong-shape" } as unknown as { menuId: string }),
      },
    },
  );

  expect(result.status).toBe("failed");
  expect(result.errors.call1).toEqual({
    type: "invalid_output",
    callId: "call1",
    tool: "menu.create",
    message: 'Tool "menu.create" returned invalid output.',
    retryable: false,
  });
});
