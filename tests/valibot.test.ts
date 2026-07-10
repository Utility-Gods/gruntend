import { expect, test } from "vitest";
import * as v from "valibot";
import { defineTools, parseStandardSchema } from "../src/tool.ts";

test("defineTools accepts Valibot standard schema contracts", async () => {
  const [add] = defineTools({
    calculator: {
      add: {
        description: "Add two numbers.",
        input: v.object({
          a: v.number(),
          b: v.number(),
        }),
        output: v.object({
          value: v.number(),
        }),
      },
    },
  });

  const input = await parseStandardSchema(add.input, { a: 2, b: 3 });
  const output = await parseStandardSchema(add.output, {
    value: input.a + input.b,
  });

  expect(output).toEqual({ value: 5 });
});
