import { expect, test } from "vitest";
import { defineTools, type StandardSchemaV1 } from "../src/tool.ts";

function schema<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "gruntend-test",
      validate(value) {
        return { value: value as T };
      },
    },
  };
}

test("defineTools flattens a namespace into dot-named tool contracts", () => {
  const listInput = schema<{ menuId: string }>();
  const listOutput = schema<{ items: readonly { name: string }[] }>();
  const createInput = schema<{ menuId: string; name: string }>();
  const createOutput = schema<{ itemId: string }>();

  const tools = defineTools({
    menu: {
      items: {
        list: {
          description: "List menu items.",
          input: listInput,
          output: listOutput,
        },
      },
      item: {
        create: {
          description: "Create one menu item.",
          input: createInput,
          output: createOutput,
        },
      },
    },
  });

  expect(tools.map((tool) => tool.name)).toEqual([
    "menu.items.list",
    "menu.item.create",
  ]);
  expect(tools[0].description).toBe("List menu items.");
  expect(tools[0].input).toBe(listInput);
  expect(tools[0].output).toBe(listOutput);
  expect(tools[1].description).toBe("Create one menu item.");
  expect(tools[1].input).toBe(createInput);
  expect(tools[1].output).toBe(createOutput);
});

test("defineTools preserves explicit model-facing parameter metadata", () => {
  const parameters = {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  };
  const returns = {
    type: "object",
    properties: { itemId: { type: "string" } },
  };

  const [tool] = defineTools({
    menu: {
      create: {
        description: "Create a menu.",
        input: schema<{ name: string }>(),
        output: schema<{ itemId: string }>(),
        parameters,
        returns,
      },
    },
  });

  expect(tool.parameters).toBe(parameters);
  expect(tool.returns).toBe(returns);
});

test("defineTools preserves the namespace declaration order", () => {
  const tools = defineTools({
    math: {
      add: {
        description: "Add two numbers.",
        input: schema<{ a: number; b: number }>(),
        output: schema<{ value: number }>(),
      },
      multiply: {
        description: "Multiply two numbers.",
        input: schema<{ a: number; b: number }>(),
        output: schema<{ value: number }>(),
      },
    },
  });

  expect(tools.map((tool) => tool.name)).toEqual([
    "math.add",
    "math.multiply",
  ]);
});
