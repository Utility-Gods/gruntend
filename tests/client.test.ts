import { expect, test } from "vitest";
import { createGruntendClient } from "../src/client.ts";
import type { CodePlanExecutor } from "../src/executor.ts";
import { createJailJsCodePlanExecutor } from "../src/executors/jailjs.ts";
import { defineTools } from "../src/tool.ts";
import * as v from "valibot";

test("Gruntend client runs an LLM code plan with app-owned closure handlers", async () => {
  let receivedAuthToken = "";

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
  const authToken = "secret-token";

  const result = await client.runCodePlan(
    `
      const menu = await tools.menu.create({ name: "Dinner" });
      return menu;
    `,
    {
      handlers: {
        "menu.create": ({ input, ok }) => {
          receivedAuthToken = authToken;
          return ok({ menuId: `menu:${input.name}` });
        },
      },
    },
  );

  expect(receivedAuthToken).toBe("secret-token");
  expect(result).toEqual({
    status: "done",
    result: { menuId: "menu:Dinner" },
    errors: {},
  });
});

test("Gruntend client can use a custom executor", async () => {
  const tools = defineTools({});
  const executor: CodePlanExecutor = {
    profile: {
      id: "custom-test",
      trust: "controlled",
      supportsGeneratedUi: false,
    },
    execute: ({ code, globals, maxOps }) => ({
      code,
      input: globals.input,
      maxOps,
    }),
  };
  const client = createGruntendClient({
    tools,
    executor,
    maxOps: 123,
  });

  const result = await client.runCodePlan("return input.value;", {
    input: { value: 9 },
    handlers: {},
  });

  expect(result).toEqual({
    status: "done",
    result: {
      code: "return input.value;",
      input: { value: 9 },
      maxOps: 123,
    },
    errors: {},
  });
});
