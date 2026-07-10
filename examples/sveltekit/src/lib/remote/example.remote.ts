import { command, getRequestEvent, query, requested } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import {
  createMenu,
  createMenuItem,
  createUser,
  deleteMenuItem,
  duplicateMenuItem,
  getMenu,
  getMenuItem,
  listMenuItems,
  listMenus,
  listUsers,
  updateMenuItem,
} from "$lib/server/store";
import type { Menu, MenuItem } from "$lib/types";

export type MenuWithItems = Menu & {
  readonly items: readonly MenuItem[];
};

const menuIdSchema = v.object({
  menuId: v.string(),
});

const menuItemIdSchema = v.object({
  menuId: v.string(),
  itemId: v.string(),
});

const createMenuSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  description: v.optional(v.string()),
  ownerUserId: v.optional(v.string()),
});

const createMenuItemSchema = v.object({
  menuId: v.string(),
  name: v.pipe(v.string(), v.nonEmpty()),
  price: v.number(),
  tags: v.optional(v.array(v.string())),
});

const updateMenuItemSchema = v.object({
  menuId: v.string(),
  itemId: v.string(),
  name: v.optional(v.string()),
  price: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
});

const createUserSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  role: v.picklist(["owner", "chef", "manager"]),
});

export const getUsers = query(async () => {
  return { users: await listUsers(requestStore()) };
});

export const createUserCommand = command(createUserSchema, async (input) => {
  const result = { user: await createUser(input, requestStore()) };
  await requested(getUsers, 5).refreshAll();
  return result;
});

export const getMenus = query(async () => {
  return { menus: await listMenus(requestStore()) };
});

export const getMenusWithItems = query(async () => {
  const context = requestStore();
  const menus = await listMenus(context);
  const menusWithItems = await Promise.all(
    menus.map(
      async (menu): Promise<MenuWithItems> => ({
        ...menu,
        items: await listMenuItems(menu.menuId, context),
      }),
    ),
  );

  return { menus: menusWithItems };
});

export const getMenuById = query(menuIdSchema, async ({ menuId }) => {
  const menu = await getMenu(menuId, requestStore());
  if (!menu) error(404, `Menu "${menuId}" was not found.`);
  return { menu };
});

export const createMenuCommand = command(createMenuSchema, async (input) => {
  const result = { menu: await createMenu(input, requestStore()) };
  await requested(getMenus, 5).refreshAll();
  await requested(getMenusWithItems, 5).refreshAll();
  return result;
});

export const getMenuItems = query(menuIdSchema, async ({ menuId }) => {
  const context = requestStore();
  const menu = await getMenu(menuId, context);
  if (!menu) error(404, `Menu "${menuId}" was not found.`);
  return { items: await listMenuItems(menuId, context) };
});

export const getMenuItemById = query(
  menuItemIdSchema,
  async ({ menuId, itemId }) => {
    const item = await getMenuItem({ menuId, itemId }, requestStore());
    if (!item) error(404, `Menu item "${itemId}" was not found.`);
    return { item };
  },
);

export const createMenuItemCommand = command(
  createMenuItemSchema,
  async (input) => {
    const result = { item: await createMenuItem(input, requestStore()) };
    await requested(getMenuItems, 10).refreshAll();
    await requested(getMenusWithItems, 5).refreshAll();
    return result;
  },
);

export const updateMenuItemCommand = command(
  updateMenuItemSchema,
  async (input) => {
    const result = { item: await updateMenuItem(input, requestStore()) };
    await requested(getMenuItemById, 10).refreshAll();
    await requested(getMenuItems, 10).refreshAll();
    await requested(getMenusWithItems, 5).refreshAll();
    return result;
  },
);

export const duplicateMenuItemCommand = command(
  menuItemIdSchema,
  async (input) => {
    const result = { item: await duplicateMenuItem(input, requestStore()) };
    await requested(getMenuItems, 10).refreshAll();
    await requested(getMenusWithItems, 5).refreshAll();
    return result;
  },
);

export const deleteMenuItemCommand = command(
  menuItemIdSchema,
  async (input) => {
    const result = { item: await deleteMenuItem(input, requestStore()) };
    await requested(getMenuItemById, 10).refreshAll();
    await requested(getMenuItems, 10).refreshAll();
    await requested(getMenusWithItems, 5).refreshAll();
    return result;
  },
);

function requestStore() {
  const event = getRequestEvent();
  return { platform: event.platform };
}
