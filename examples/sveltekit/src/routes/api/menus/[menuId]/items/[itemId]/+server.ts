import { deleteMenuItem, getMenuItem } from "$lib/server/store";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params }) => {
  const item = getMenuItem({ menuId: params.menuId, itemId: params.itemId });

  if (!item) {
    return json({ message: `Menu item "${params.itemId}" was not found.` }, { status: 404 });
  }

  return json({ item });
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
