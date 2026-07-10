import type { Menu, MenuItem } from "$lib/types";
import type { PageLoad } from "./$types";

type MenuWithItems = Menu & {
  readonly items: readonly MenuItem[];
};

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch("/api/menus");
  const data = (await response.json()) as { readonly menus: readonly Menu[] };

  const menus = await Promise.all(
    data.menus.map(async (menu): Promise<MenuWithItems> => {
      const itemsResponse = await fetch(`/api/menus/${menu.menuId}/items`);
      const itemsData = (await itemsResponse.json()) as {
        readonly items: readonly MenuItem[];
      };

      return {
        ...menu,
        items: itemsData.items,
      };
    }),
  );

  return {
    menus,
  };
};
