import type { ToolHandlerMap, ToolResult } from "gruntend-sdk/tool";
import {
  createMenuCommand,
  createMenuItemCommand,
  createUserCommand,
  deleteMenuItemCommand,
  duplicateMenuItemCommand,
  getMenuById,
  getMenuItems,
  getMenus,
  getUsers,
  updateMenuItemCommand,
} from "$lib/remote/example.remote";
import type { Menu, MenuItem, User } from "$lib/types";
import type { appTools } from "./tools";

type MenusOutput = { readonly menus: Menu[] };
type MenuOutput = { readonly menu: Menu };
type MenuItemsOutput = { readonly items: MenuItem[] };
type MenuItemOutput = { readonly item: MenuItem };
type UsersOutput = { readonly users: User[] };
type UserOutput = { readonly user: User };

export function createBrowserHandlers(): ToolHandlerMap<typeof appTools> {
  return {
    "menus.list": async ({ ok, err }) =>
      runTool(() => getMenus().run() as Promise<MenusOutput>, ok, err),

    "menus.get": async ({ input, ok, err }) =>
      runTool(() => getMenuById(input).run() as Promise<MenuOutput>, ok, err),

    "menus.create": async ({ input, ok, err }) =>
      runTool(() => createMenuCommand(input) as Promise<MenuOutput>, ok, err),

    "menu.items.list": async ({ input, ok, err }) =>
      runTool(() => getMenuItems(input).run() as Promise<MenuItemsOutput>, ok, err),

    "menu.item.create": async ({ input, ok, err }) =>
      runTool(
        () => createMenuItemCommand(input) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.duplicate": async ({ input, ok, err }) =>
      runTool(
        () => duplicateMenuItemCommand(input) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.update": async ({ input, ok, err }) =>
      runTool(
        () => updateMenuItemCommand(input) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "menu.item.delete": async ({ input, ok, err }) =>
      runTool(
        () => deleteMenuItemCommand(input) as Promise<MenuItemOutput>,
        ok,
        err,
      ),

    "users.list": async ({ ok, err }) =>
      runTool(() => getUsers().run() as Promise<UsersOutput>, ok, err),

    "users.create": async ({ input, ok, err }) =>
      runTool(() => createUserCommand(input) as Promise<UserOutput>, ok, err),
  };
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
