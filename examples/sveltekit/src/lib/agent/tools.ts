import { defineTools } from "gruntend/tool";
import * as v from "valibot";

const roleSchema = v.picklist(["owner", "chef", "manager"]);

const userSchema = v.object({
  userId: v.string(),
  name: v.string(),
  role: roleSchema,
  createdAt: v.string(),
});

const menuSchema = v.object({
  menuId: v.string(),
  name: v.string(),
  description: v.string(),
  ownerUserId: v.string(),
  createdAt: v.string(),
});

const menuItemSchema = v.object({
  itemId: v.string(),
  menuId: v.string(),
  name: v.string(),
  price: v.number(),
  tags: v.array(v.string()),
});

export const appTools = defineTools({
  menus: {
    list: {
      description: "List all restaurant menus.",
      input: v.object({}),
      output: v.object({ menus: v.array(menuSchema) }),
    },
    get: {
      description: "Get one restaurant menu by id.",
      input: v.object({ menuId: v.string() }),
      output: v.object({ menu: menuSchema }),
    },
    create: {
      description: "Find or create a restaurant menu by name.",
      input: v.object({
        name: v.string(),
        description: v.optional(v.string()),
        ownerUserId: v.optional(v.string()),
      }),
      output: v.object({ menu: menuSchema }),
    },
  },
  menu: {
    items: {
      list: {
        description: "List items for a menu.",
        input: v.object({ menuId: v.string() }),
        output: v.object({ items: v.array(menuItemSchema) }),
      },
    },
    item: {
      create: {
        description: "Create one item in a menu.",
        input: v.object({
          menuId: v.string(),
          name: v.string(),
          price: v.number(),
          tags: v.optional(v.array(v.string())),
        }),
        output: v.object({ item: menuItemSchema }),
      },
    },
  },
  users: {
    list: {
      description: "List restaurant team users.",
      input: v.object({}),
      output: v.object({ users: v.array(userSchema) }),
    },
    create: {
      description: "Find or create a restaurant team user.",
      input: v.object({
        name: v.string(),
        role: roleSchema,
      }),
      output: v.object({ user: userSchema }),
    },
  },
});
