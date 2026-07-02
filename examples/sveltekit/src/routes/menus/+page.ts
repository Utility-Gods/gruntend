import type { Menu } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch("/api/menus");
  const data = (await response.json()) as { readonly menus: readonly Menu[] };

  return {
    menus: data.menus,
  };
};
