import type { ToolHandlerMap } from "gruntend/tool";
import type { Menu, MenuItem, User } from "$lib/types";
import type { appTools } from "./tools";

type Fetcher = typeof fetch;

type ApiError = {
  readonly message?: string;
};

export function createBrowserHandlers(fetcher: Fetcher): ToolHandlerMap<typeof appTools> {
  return {
    "menus.list": async ({ ok, err }) => {
      const response = await requestJson<{ menus: Menu[] }>(fetcher, "/api/menus");
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menus.get": async ({ input, ok, err }) => {
      const response = await requestJson<{ menu: Menu }>(fetcher, `/api/menus/${input.menuId}`);
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menus.create": async ({ input, ok, err }) => {
      const response = await requestJson<{ menu: Menu }>(fetcher, "/api/menus", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menu.items.list": async ({ input, ok, err }) => {
      const response = await requestJson<{ items: MenuItem[] }>(fetcher, `/api/menus/${input.menuId}/items`);
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menu.item.create": async ({ input, ok, err }) => {
      const response = await requestJson<{ item: MenuItem }>(fetcher, `/api/menus/${input.menuId}/items`, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          price: input.price,
          tags: input.tags ?? [],
        }),
      });
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menu.item.duplicate": async ({ input, ok, err }) => {
      const response = await requestJson<{ item: MenuItem }>(
        fetcher,
        `/api/menus/${input.menuId}/items/${input.itemId}/duplicate`,
        { method: "POST" },
      );
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "menu.item.delete": async ({ input, ok, err }) => {
      const response = await requestJson<{ item: MenuItem }>(fetcher, `/api/menus/${input.menuId}/items/${input.itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "users.list": async ({ ok, err }) => {
      const response = await requestJson<{ users: User[] }>(fetcher, "/api/users");
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },

    "users.create": async ({ input, ok, err }) => {
      const response = await requestJson<{ user: User }>(fetcher, "/api/users", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!response.ok) return err(toHandlerError(response.error));
      return ok(response.data);
    },
  };
}

async function requestJson<TData>(
  fetcher: Fetcher,
  url: string,
  init: RequestInit = {},
): Promise<{ readonly ok: true; readonly data: TData } | { readonly ok: false; readonly error: ApiError }> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

  const data = (await response.json()) as TData | ApiError;

  if (!response.ok) {
    return { ok: false, error: data as ApiError };
  }

  return { ok: true, data: data as TData };
}

function toHandlerError(error: ApiError) {
  return {
    code: "API_ERROR",
    message: error.message ?? "The example API request failed.",
    retryable: false,
  };
}
