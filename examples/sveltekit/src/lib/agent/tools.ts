import { defineTools } from "gruntend-sdk/tool";
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

const roleModel = { enum: ["owner", "chef", "manager"] };
const userModel = {
  type: "object",
  properties: {
    userId: { type: "string" },
    name: { type: "string" },
    role: roleModel,
    createdAt: { type: "string" },
  },
  required: ["userId", "name", "role", "createdAt"],
};
const menuModel = {
  type: "object",
  properties: {
    menuId: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    ownerUserId: { type: "string" },
    createdAt: { type: "string" },
  },
  required: ["menuId", "name", "description", "ownerUserId", "createdAt"],
};
const menuItemModel = {
  type: "object",
  properties: {
    itemId: { type: "string" },
    menuId: { type: "string" },
    name: { type: "string" },
    price: { type: "number" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["itemId", "menuId", "name", "price", "tags"],
};
const emptyParameters = { type: "object", properties: {}, required: [] };

export const appTools = defineTools({
  menus: {
    list: {
      description: "List all restaurant menus.",
      input: v.object({}),
      output: v.object({ menus: v.array(menuSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { menus: { type: "array", items: menuModel } },
        required: ["menus"],
      },
    },
    get: {
      description: "Get one restaurant menu by id.",
      input: v.object({ menuId: v.string() }),
      output: v.object({ menu: menuSchema }),
      parameters: {
        type: "object",
        properties: { menuId: { type: "string" } },
        required: ["menuId"],
      },
      returns: {
        type: "object",
        properties: { menu: menuModel },
        required: ["menu"],
      },
    },
    create: {
      description: "Find or create a restaurant menu by name.",
      input: v.object({
        name: v.string(),
        description: v.optional(v.string()),
        ownerUserId: v.optional(v.string()),
      }),
      output: v.object({ menu: menuSchema }),
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          ownerUserId: { type: "string" },
        },
        required: ["name"],
      },
      returns: {
        type: "object",
        properties: { menu: menuModel },
        required: ["menu"],
      },
    },
  },
  menu: {
    items: {
      list: {
        description: "List items for a menu.",
        input: v.object({ menuId: v.string() }),
        output: v.object({ items: v.array(menuItemSchema) }),
        parameters: {
          type: "object",
          properties: { menuId: { type: "string" } },
          required: ["menuId"],
        },
        returns: {
          type: "object",
          properties: { items: { type: "array", items: menuItemModel } },
          required: ["items"],
        },
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
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["menuId", "name", "price"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      duplicate: {
        description: "Duplicate one menu item.",
        input: v.object({ menuId: v.string(), itemId: v.string() }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      update: {
        description:
          "Update one menu item. Use this to change item name, price, tags, or to apply percentage price changes.",
        input: v.object({
          menuId: v.string(),
          itemId: v.string(),
          name: v.optional(v.string()),
          price: v.optional(v.number()),
          tags: v.optional(v.array(v.string())),
        }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      delete: {
        description: "Delete one menu item.",
        input: v.object({ menuId: v.string(), itemId: v.string() }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
    },
  },
  users: {
    list: {
      description: "List restaurant team users.",
      input: v.object({}),
      output: v.object({ users: v.array(userSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { users: { type: "array", items: userModel } },
        required: ["users"],
      },
    },
    create: {
      description: "Find or create a restaurant team user.",
      input: v.object({
        name: v.string(),
        role: roleSchema,
      }),
      output: v.object({ user: userSchema }),
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: roleModel,
        },
        required: ["name", "role"],
      },
      returns: {
        type: "object",
        properties: { user: userModel },
        required: ["user"],
      },
    },
  },
});
