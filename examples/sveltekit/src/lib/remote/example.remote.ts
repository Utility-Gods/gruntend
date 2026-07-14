import { command, getRequestEvent, query, requested } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import {
  createMenu,
  createMenuItem,
  createOrder,
  createUser,
  deleteMenuItem,
  duplicateMenuItem,
  getMenu,
  getMenuItem,
  listCustomers,
  listMenuItems,
  listMenus,
  listOrders,
  listPayments,
  listReservations,
  listRestaurantTables,
  listShifts,
  listUsers,
  updateMenuItem,
  updateOrderStatus,
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

const createOrderSchema = v.object({
  tableName: v.pipe(v.string(), v.nonEmpty()),
  tableId: v.optional(v.string()),
  customerId: v.string(),
  assignedUserId: v.string(),
  serviceType: v.picklist(["dine-in", "takeout", "delivery"]),
  partySize: v.pipe(v.number(), v.integer(), v.minValue(1)),
  items: v.pipe(
    v.array(
      v.object({
        menuId: v.string(),
        itemId: v.string(),
        quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
      }),
    ),
    v.minLength(1),
  ),
});

const updateOrderStatusSchema = v.object({
  orderId: v.string(),
  status: v.picklist(["open", "preparing", "served", "cancelled"]),
});

const createUserSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  role: v.picklist(["owner", "chef", "manager", "server", "host"]),
});

export const getCustomers = query(async () => {
  return { customers: await listCustomers(requestStore()) };
});

export const getOrders = query(async () => {
  return { orders: await listOrders(requestStore()) };
});

export const getRestaurantTables = query(async () => {
  return { tables: await listRestaurantTables(requestStore()) };
});

export const getPayments = query(async () => {
  return { payments: await listPayments(requestStore()) };
});

export const getShifts = query(async () => {
  return { shifts: await listShifts(requestStore()) };
});

export const getReservations = query(async () => {
  return { reservations: await listReservations(requestStore()) };
});

export const createOrderCommand = command(createOrderSchema, async (input) => {
  const result = { order: await createOrder(input, requestStore()) };
  await requested(getOrders, 5).refreshAll();
  return result;
});

export const updateOrderStatusCommand = command(
  updateOrderStatusSchema,
  async (input) => {
    const result = { order: await updateOrderStatus(input, requestStore()) };
    await requested(getOrders, 5).refreshAll();
    return result;
  },
);

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
