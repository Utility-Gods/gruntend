import type { Menu, User } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const [menusResponse, usersResponse] = await Promise.all([
    fetch("/api/menus"),
    fetch("/api/users"),
  ]);

  const menusData = (await menusResponse.json()) as { readonly menus: readonly Menu[] };
  const usersData = (await usersResponse.json()) as { readonly users: readonly User[] };

  return {
    menus: menusData.menus,
    users: usersData.users,
  };
};
