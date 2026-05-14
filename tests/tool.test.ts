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

Deno.test("defineTool preserves the tool contract and executes async handlers", async () => {
  const createMenuInput = schema<{ name: string }>();
  const createMenuOutput = schema<{ menuId: string; name: string }>();

  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a restaurant menu",
    input: createMenuInput,
    output: createMenuOutput,
    execution: "sequential",
    async execute({ input, signal }) {
      assertEquals(signal?.aborted, false);

      return {
        data: {
          menuId: `menu:${input.name}`,
          name: input.name,
        },
      };
    },
  });

  const controller = new AbortController();
  const result = await createMenu.execute({
    input: { name: "Dinner" },
    signal: controller.signal,
  });

  assertEquals(createMenu.name, "menu.create");
  assertEquals(createMenu.description, "Create a restaurant menu");
  assertEquals(createMenu.input, createMenuInput);
  assertEquals(createMenu.output, createMenuOutput);
  assertEquals(createMenu.execution, "sequential");
  assertEquals(result, {
    data: {
      menuId: "menu:Dinner",
      name: "Dinner",
    },
  });
});

Deno.test("defineTool can mark a tool as parallelizable", () => {
  const createMenuItem = defineTool({
    name: "menu.item.create",
    description: "Create one menu item",
    input: schema<{ menuId: string; name: string }>(),
    output: schema<{ itemId: string; menuId: string }>(),
    execution: "parallel",
    execute({ input }) {
      return {
        data: {
          itemId: `item:${input.name}`,
          menuId: input.menuId,
        },
      };
    },
  });

  assertEquals(createMenuItem.execution, "parallel");
});
