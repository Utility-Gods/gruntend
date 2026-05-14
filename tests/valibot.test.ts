import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { defineTool } from "../mod.ts";

Deno.test("defineTool accepts Valibot standard schema contracts", async () => {
  const add = defineTool({
    name: "calculator.add",
    description: "Add two numbers.",
    input: v.object({
      a: v.number(),
      b: v.number(),
    }),
    output: v.object({
      value: v.number(),
    }),
    execute({ input }) {
      return {
        data: {
          value: input.a + input.b,
        },
      };
    },
  });

  const result = await add.execute({ input: { a: 2, b: 3 } });

  assertEquals(result, { data: { value: 5 } });
});
