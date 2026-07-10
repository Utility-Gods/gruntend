import { duplicateMenuItem } from "$lib/server/store";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = ({ params }) => {
  try {
    const item = duplicateMenuItem({ menuId: params.menuId, itemId: params.itemId });
    return json({ item }, { status: 201 });
  } catch (caught) {
    return json(
      { message: caught instanceof Error ? caught.message : "Unable to duplicate menu item." },
      { status: 404 },
    );
  }
};
