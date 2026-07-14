import type { ToolHandlerMap, ToolResult } from "gruntend-sdk/tool";
import {
  createMenuCommand,
  createMenuItemCommand,
  createOrderCommand,
  createUserCommand,
  deleteMenuItemCommand,
  duplicateMenuItemCommand,
  getMenuById,
  getCustomers,
  getMenuItems,
  getMenus,
  getOrders,
  getPayments,
  getReservations,
  getRestaurantTables,
  getShifts,
  getUsers,
  updateMenuItemCommand,
  updateOrderStatusCommand,
} from "$lib/remote/example.remote";
import type {
  Customer,
  Menu,
  MenuItem,
  Order,
  Payment,
  Reservation,
  RestaurantTable,
  Shift,
  User,
} from "$lib/types";
import type { appTools } from "./tools";

type MenusOutput = { readonly menus: Menu[] };
type MenuOutput = { readonly menu: Menu };
type MenuItemsOutput = { readonly items: MenuItem[] };
type MenuItemOutput = { readonly item: MenuItem };
type CustomersOutput = { readonly customers: Customer[] };
type OrdersOutput = { readonly orders: Order[] };
type OrderOutput = { readonly order: Order };
type PaymentsOutput = { readonly payments: Payment[] };
type ReservationsOutput = { readonly reservations: Reservation[] };
type TablesOutput = { readonly tables: RestaurantTable[] };
type ShiftsOutput = { readonly shifts: Shift[] };
type UsersOutput = { readonly users: User[] };
type UserOutput = { readonly user: User };

type BrowserHandlerOptions = {
  readonly canMutate: () => boolean;
};

export function createBrowserHandlers(
  options: BrowserHandlerOptions,
): ToolHandlerMap<typeof appTools> {
  return {
    "menus.list": async ({ ok, err }) =>
      runTool(() => getMenus().run() as Promise<MenusOutput>, ok, err),

    "menus.get": async ({ input, ok, err }) =>
      runTool(
        () => getMenuById(toPlainInput(input)).run() as Promise<MenuOutput>,
        ok,
        err,
      ),

    "menus.create": async ({ input, ok, err }) =>
      runMutation(
        options,
        () => createMenuCommand(toPlainInput(input)) as Promise<MenuOutput>,
        ok,
        err,
      ),

    "menu.items.list": async ({ input, ok, err }) =>
      runTool(
        () =>
          getMenuItems(toPlainInput(input)).run() as Promise<MenuItemsOutput>,
        ok,
        err,
      ),

    "menu.item.create": async ({ input, ok, err }) =>
      runMutation(
        options,
        () =>
          createMenuItemCommand(toPlainInput(input)) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.duplicate": async ({ input, ok, err }) =>
      runMutation(
        options,
        () =>
          duplicateMenuItemCommand(
            toPlainInput(input),
          ) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.update": async ({ input, ok, err }) =>
      runMutation(
        options,
        () =>
          updateMenuItemCommand(toPlainInput(input)) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.delete": async ({ input, ok, err }) =>
      runMutation(
        options,
        () =>
          deleteMenuItemCommand(toPlainInput(input)) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "customers.list": async ({ ok, err }) =>
      runTool(() => getCustomers().run() as Promise<CustomersOutput>, ok, err),

    "orders.list": async ({ ok, err }) =>
      runTool(() => getOrders().run() as Promise<OrdersOutput>, ok, err),

    "orders.create": async ({ input, ok, err }) =>
      runMutation(
        options,
        () => createOrderCommand(toPlainInput(input)) as Promise<OrderOutput>,
        ok,
        err,
      ),

    "orders.status.update": async ({ input, ok, err }) =>
      runMutation(
        options,
        () => updateOrderStatusCommand(toPlainInput(input)) as Promise<OrderOutput>,
        ok,
        err,
      ),

    "tables.list": async ({ ok, err }) =>
      runTool(() => getRestaurantTables().run() as Promise<TablesOutput>, ok, err),

    "payments.list": async ({ ok, err }) =>
      runTool(() => getPayments().run() as Promise<PaymentsOutput>, ok, err),

    "shifts.list": async ({ ok, err }) =>
      runTool(() => getShifts().run() as Promise<ShiftsOutput>, ok, err),

    "reservations.list": async ({ ok, err }) =>
      runTool(() => getReservations().run() as Promise<ReservationsOutput>, ok, err),

    "users.list": async ({ ok, err }) =>
      runTool(() => getUsers().run() as Promise<UsersOutput>, ok, err),

    "users.create": async ({ input, ok, err }) =>
      runMutation(
        options,
        () => createUserCommand(toPlainInput(input)) as Promise<UserOutput>,
        ok,
        err,
      ),
  };
}

function toPlainInput<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => toPlainInput(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPlainInput(item)]),
    ) as T;
  }

  return value;
}

function runMutation<TData>(
  options: BrowserHandlerOptions,
  run: () => Promise<TData>,
  ok: (data: TData) => ToolResult<TData>,
  err: (error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  }) => ToolResult<never>,
): Promise<ToolResult<TData>> | ToolResult<never> {
  if (!options.canMutate()) {
    return err({
      code: "CONFIRMATION_REQUIRED",
      message: "Use a generated UI action to confirm this change.",
      retryable: false,
    });
  }

  return runTool(run, ok, err);
}

async function runTool<TData>(
  run: () => Promise<TData>,
  ok: (data: TData) => ToolResult<TData>,
  err: (error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  }) => ToolResult<never>,
): Promise<ToolResult<TData>> {
  try {
    return ok(await run());
  } catch (caught) {
    return err({
      code: "REMOTE_FUNCTION_ERROR",
      message:
        caught instanceof Error
          ? caught.message
          : "The example remote function failed.",
      retryable: false,
    });
  }
}
