import { createToolRegistry, defineTool } from "../../../mod.ts";
import * as v from "valibot";

export const createMenuTool = defineTool({
  name: "menu.create",
  description: "Create a menu and return the created menu id.",
  input: v.object({
    name: v.string(),
  }),
  output: v.object({
    menuId: v.string(),
    name: v.string(),
  }),
  execution: "sequential",
});

export const createMenuItemTool = defineTool({
  name: "menu.item.create",
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
  execution: "parallel",
});

export const exampleTools = [
  createMenuTool,
  createMenuItemTool,
] as const;

export const toolRegistry = createToolRegistry(exampleTools);
