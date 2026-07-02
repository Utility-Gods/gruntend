import { error } from "@sveltejs/kit";
import type { Menu, MenuItem } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, params }) => {
  const [menuResponse, itemsResponse] = await Promise.all([
    fetch(`/api/menus/${params.menuId}`),
    fetch(`/api/menus/${params.menuId}/items`),
  ]);

  if (!menuResponse.ok) {
    error(menuResponse.status, `Menu "${params.menuId}" was not found.`);
  }

  const menuData = (await menuResponse.json()) as { readonly menu: Menu };
  const itemData = (await itemsResponse.json()) as { readonly items: readonly MenuItem[] };

  return {
    menu: menuData.menu,
    items: itemData.items,
  };
};
