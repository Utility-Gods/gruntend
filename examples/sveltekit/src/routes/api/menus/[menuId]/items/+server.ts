import { json } from "@sveltejs/kit";
import { createMenuItem, getMenu, listMenuItems } from "$lib/server/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params }) => {
  const menu = getMenu(params.menuId);

  if (!menu) {
    return json(
      { message: `Menu "${params.menuId}" was not found.` },
      { status: 404 },
    );
  }

  return json({ items: listMenuItems(params.menuId) });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    readonly name?: unknown;
    readonly price?: unknown;
    readonly tags?: unknown;
  };

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return json({ message: "Item name is required." }, { status: 400 });
  }

  if (typeof body.price !== "number" || Number.isNaN(body.price)) {
    return json({ message: "Item price must be a number." }, { status: 400 });
  }

  try {
    const item = createMenuItem({
      menuId: params.menuId,
      name: body.name,
      price: body.price,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    });

    return json({ item }, { status: 201 });
  } catch (caught) {
    return json(
      {
        message:
          caught instanceof Error
            ? caught.message
            : "Unable to create menu item.",
      },
      { status: 404 },
    );
  }
};
