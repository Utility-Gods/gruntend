import type { User } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch("/api/users");
  const data = (await response.json()) as { readonly users: readonly User[] };

  return {
    users: data.users,
  };
};
