import { deleteMenuItem, getMenuItem, updateMenuItem } from "$lib/server/store";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params }) => {
  const item = getMenuItem({ menuId: params.menuId, itemId: params.itemId });

  if (!item) {
    return json({ message: `Menu item "${params.itemId}" was not found.` }, { status: 404 });
  }

  return json({ item });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    readonly name?: unknown;
    readonly price?: unknown;
    readonly tags?: unknown;
  };

  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length === 0)) {
    return json({ message: "Item name must be a non-empty string." }, { status: 400 });
  }

  if (body.price !== undefined && (typeof body.price !== "number" || Number.isNaN(body.price))) {
    return json({ message: "Item price must be a number." }, { status: 400 });
  }

  try {
    const item = updateMenuItem({
      menuId: params.menuId,
      itemId: params.itemId,
      name: typeof body.name === "string" ? body.name : undefined,
      price: typeof body.price === "number" ? body.price : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    });
    return json({ item });
  } catch (caught) {
    return json(
      { message: caught instanceof Error ? caught.message : "Unable to update menu item." },
      { status: 404 },
    );
  }
};

export const DELETE: RequestHandler = ({ params }) => {
  try {
    const item = deleteMenuItem({ menuId: params.menuId, itemId: params.itemId });
    return json({ item });
  } catch (caught) {
    return json(
      { message: caught instanceof Error ? caught.message : "Unable to delete menu item." },
      { status: 404 },
    );
  }
};
