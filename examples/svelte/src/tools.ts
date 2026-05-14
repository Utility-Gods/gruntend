import { createToolRegistry, defineTool } from "../../../mod.ts";
import * as v from "valibot";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AppContext {
  readonly authToken: string;
  readonly tenantId: string;
}

function appContext(context: unknown): AppContext {
  return context as AppContext;
}

export const addTool = defineTool({
  name: "calculator.add",
  description: "Add two numbers together.",
  input: v.object({
    a: v.number(),
    b: v.number(),
  }),
  output: v.object({
    value: v.number(),
  }),
  execution: "parallel",
  async execute({ input }) {
    await wait(150);
    return {
      data: {
        value: input.a + input.b,
      },
    };
  },
});

export const multiplyTool = defineTool({
  name: "calculator.multiply",
  description: "Multiply two numbers together.",
  input: v.object({
    a: v.number(),
    b: v.number(),
  }),
  output: v.object({
    value: v.number(),
  }),
  execution: "parallel",
  async execute({ input }) {
    await wait(150);
    return {
      data: {
        value: input.a * input.b,
      },
    };
  },
});

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
  async execute({ input, context }) {
    const app = appContext(context);

    await wait(250);
    return {
      data: {
        menuId: `${app.tenantId}:menu:${input.name.toLowerCase().replaceAll(" ", "-")}`,
        name: input.name,
      },
    };
  },
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
  async execute({ input, context }) {
    const app = appContext(context);

    await wait(200);
    return {
      data: {
        itemId: `${app.tenantId}:item:${input.menuId}:${input.name.toLowerCase().replaceAll(" ", "-")}`,
        menuId: input.menuId,
        name: input.name,
      },
    };
  },
});

export const exampleTools = [
  addTool,
  multiplyTool,
  createMenuTool,
  createMenuItemTool,
] as const;

export const toolRegistry = createToolRegistry(exampleTools);
