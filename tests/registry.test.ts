import { assertEquals, assertThrows } from "@std/assert";
import { createToolRegistry, defineTool, type StandardSchemaV1 } from "../mod.ts";

function schema<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "genopen-test",
      validate(value: unknown) {
        return { value: value as T };
      },
    },
  };
}

const addTool = defineTool({
  name: "calculator.add",
  description: "Add two numbers.",
  input: schema<{ a: number; b: number }>(),
  output: schema<{ value: number }>(),
  execution: "parallel",
  execute({ input }) {
    return { data: { value: input.a + input.b } };
  },
});

const multiplyTool = defineTool({
  name: "calculator.multiply",
  description: "Multiply two numbers.",
  input: schema<{ a: number; b: number }>(),
  output: schema<{ value: number }>(),
  execution: "parallel",
  execute({ input }) {
    return { data: { value: input.a * input.b } };
  },
});

Deno.test("createToolRegistry stores tools by name", () => {
  const registry = createToolRegistry([addTool, multiplyTool]);

  assertEquals(registry.tools(), [addTool, multiplyTool]);
  assertEquals(registry.get("calculator.add"), addTool);
  assertEquals(registry.get("calculator.multiply"), multiplyTool);
  assertEquals(registry.get("missing.tool"), undefined);
});

Deno.test("createToolRegistry rejects duplicate tool names", () => {
  assertThrows(
    () => createToolRegistry([addTool, addTool]),
    Error,
    'Tool "calculator.add" is already registered.',
  );
});

Deno.test("tool registry can be used to execute a named tool", async () => {
  const registry = createToolRegistry([addTool]);
  const tool = registry.get("calculator.add");

  if (!tool) {
    throw new Error("Expected calculator.add to be registered");
  }

  const result = await tool.execute({ input: { a: 2, b: 3 } });

  assertEquals(result, { data: { value: 5 } });
});
