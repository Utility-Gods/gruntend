import type { ToolHandlerMap } from "gruntend/tool";
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
import type { appTools } from "./tools";

export function createBrowserHandlers(): ToolHandlerMap<typeof appTools> {
  return {
    "menus.list": async ({ ok, err }) => runTool(() => getMenus(), ok, err),

    "menus.get": async ({ input, ok, err }) =>
      runTool(() => getMenuById(input), ok, err),

    "menus.create": async ({ input, ok, err }) =>
      runTool(() => createMenuCommand(input), ok, err),

    "menu.items.list": async ({ input, ok, err }) =>
      runTool(() => getMenuItems(input), ok, err),

    "menu.item.create": async ({ input, ok, err }) =>
      runTool(() => createMenuItemCommand(input), ok, err),

    "menu.item.duplicate": async ({ input, ok, err }) =>
      runTool(() => duplicateMenuItemCommand(input), ok, err),

    "menu.item.update": async ({ input, ok, err }) =>
      runTool(() => updateMenuItemCommand(input), ok, err),

    "menu.item.delete": async ({ input, ok, err }) =>
      runTool(() => deleteMenuItemCommand(input), ok, err),

    "users.list": async ({ ok, err }) => runTool(() => getUsers(), ok, err),

    "users.create": async ({ input, ok, err }) =>
      runTool(() => createUserCommand(input), ok, err),
  };
}

async function runTool<TData>(
  run: () => Promise<TData>,
  ok: (data: TData) => unknown,
  err: (error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  }) => unknown,
): Promise<unknown> {
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
