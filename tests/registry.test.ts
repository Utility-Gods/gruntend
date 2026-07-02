import { expect, test } from "vitest";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools, type StandardSchemaV1 } from "../src/tool.ts";

function schema<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "gruntend-test",
      validate(value: unknown) {
        return { value: value as T };
      },
    },
  };
}

const calculatorTools = defineTools({
  calculator: {
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

const [addTool, multiplyTool] = calculatorTools;

test("createToolRegistry stores tools by name", () => {
  const registry = createToolRegistry(calculatorTools);

  expect(registry.tools()).toEqual(calculatorTools);
  expect(registry.get("calculator.add")).toBe(addTool);
  expect(registry.get("calculator.multiply")).toBe(multiplyTool);
  expect(registry.get("missing.tool")).toBeUndefined();
});

test("createToolRegistry rejects duplicate tool names", () => {
  expect(() => createToolRegistry([addTool, addTool])).toThrow(
    'Tool "calculator.add" is already registered.',
  );
});
