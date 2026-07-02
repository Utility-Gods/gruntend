import { error, json } from "@sveltejs/kit";
import { getMenu } from "$lib/server/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params }) => {
  const menu = getMenu(params.menuId);

  if (!menu) {
    error(404, `Menu "${params.menuId}" was not found.`);
  }

  return json({ menu });
};
