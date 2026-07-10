import { json } from "@sveltejs/kit";
import { createUser, listUsers } from "$lib/server/store";
import type { User } from "$lib/types";
import type { RequestHandler } from "./$types";

const allowedRoles = new Set<User["role"]>(["owner", "chef", "manager"]);

export const GET: RequestHandler = () => {
  return json({ users: listUsers() });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as {
    readonly name?: unknown;
    readonly role?: unknown;
  };

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return json({ message: "User name is required." }, { status: 400 });
  }

  if (
    typeof body.role !== "string" ||
    !allowedRoles.has(body.role as User["role"])
  ) {
    return json(
      { message: "User role must be owner, chef, or manager." },
      { status: 400 },
    );
  }

  const user = createUser({
    name: body.name,
    role: body.role as User["role"],
  });

  return json({ user }, { status: 201 });
};
