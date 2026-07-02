import { json } from "@sveltejs/kit";
import { createMenu, listMenus } from "$lib/server/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  return json({ menus: listMenus() });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    readonly name?: unknown;
    readonly description?: unknown;
    readonly ownerUserId?: unknown;
  };

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return json({ message: "Menu name is required." }, { status: 400 });
  }

  const menu = createMenu({
    name: body.name,
    description: typeof body.description === "string" ? body.description : undefined,
    ownerUserId: typeof body.ownerUserId === "string" ? body.ownerUserId : undefined,
  });

  return json({ menu }, { status: 201 });
};
