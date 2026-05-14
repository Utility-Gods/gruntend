import { assertEquals } from "@std/assert";
import { defineTool, type StandardSchemaV1 } from "../mod.ts";

function schema<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "genopen-test",
      validate(value) {
        return { value: value as T };
      },
    },
  };
}

Deno.test("defineTool preserves the tool contract", () => {
  const createMenuInput = schema<{ name: string }>();
  const createMenuOutput = schema<{ menuId: string; name: string }>();

  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a restaurant menu",
    input: createMenuInput,
    output: createMenuOutput,
    execution: "sequential",
  });

  assertEquals(createMenu.name, "menu.create");
  assertEquals(createMenu.description, "Create a restaurant menu");
  assertEquals(createMenu.input, createMenuInput);
  assertEquals(createMenu.output, createMenuOutput);
  assertEquals(createMenu.execution, "sequential");
});

Deno.test("defineTool can mark a tool as parallelizable", () => {
  const createMenuItem = defineTool({
    name: "menu.item.create",
    description: "Create one menu item",
    input: schema<{ menuId: string; name: string }>(),
    output: schema<{ itemId: string; menuId: string }>(),
    execution: "parallel",
  });

  assertEquals(createMenuItem.execution, "parallel");
});
