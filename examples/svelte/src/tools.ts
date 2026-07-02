import { createToolRegistry } from "gruntend/registry";
import { defineTools } from "gruntend/tool";
import * as v from "valibot";

export const exampleTools = defineTools({
  menu: {
    create: {
      description: "Create a menu and return the created menu id.",
      input: v.object({
        name: v.string(),
      }),
      output: v.object({
        menuId: v.string(),
        name: v.string(),
      }),
    },
    item: {
      create: {
        description: "Create one menu item inside an existing menu.",
        input: v.object({
          menuId: v.string(),
          name: v.string(),
          price: v.number(),
        }),
        output: v.object({
          itemId: v.string(),
          menuId: v.string(),
          name: v.string(),
        }),
      },
    },
  },
});

export const toolRegistry = createToolRegistry(exampleTools);
