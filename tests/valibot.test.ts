import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { defineTool, parseStandardSchema } from "../mod.ts";

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
  });

  const input = await parseStandardSchema(add.input, { a: 2, b: 3 });
  const output = await parseStandardSchema(add.output, { value: input.a + input.b });

  assertEquals(output, { value: 5 });
});
