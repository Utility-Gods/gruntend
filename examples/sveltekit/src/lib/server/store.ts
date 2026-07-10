import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import type { Menu, MenuItem, User } from "$lib/types";

const dbPath = join(process.cwd(), ".gruntend", "example.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS menus (
  menu_id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS menu_items (
  item_id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  price REAL NOT NULL,
  tags_json TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(menu_id) ON DELETE CASCADE,
  UNIQUE (menu_id, name)
)`);

seedDatabase();

type UserRow = {
  readonly user_id: string;
  readonly name: string;
  readonly role: User["role"];
  readonly created_at: string;
};

type MenuRow = {
  readonly menu_id: string;
  readonly name: string;
  readonly description: string;
  readonly owner_user_id: string;
  readonly created_at: string;
};

type MenuItemRow = {
  readonly item_id: string;
  readonly menu_id: string;
  readonly name: string;
  readonly price: number;
  readonly tags_json: string;
};

export function listUsers(): User[] {
  return db.query<UserRow, []>("SELECT * FROM users ORDER BY user_id").all().map(rowToUser);
}

export function createUser(input: { readonly name: string; readonly role: User["role"] }): User {
  const existing = db.query<UserRow, [string]>("SELECT * FROM users WHERE name = ? COLLATE NOCASE").get(input.name);
  if (existing) return rowToUser(existing);

  const user: User = {
    userId: nextId("users", "user_id", "user"),
    name: input.name,
    role: input.role,
    createdAt: new Date().toISOString(),
  };

  db.run(
    "INSERT INTO users (user_id, name, role, created_at) VALUES (?, ?, ?, ?)",
    user.userId,
    user.name,
    user.role,
    user.createdAt,
  );

  return user;
}

export function listMenus(): Menu[] {
  return db.query<MenuRow, []>("SELECT * FROM menus ORDER BY menu_id").all().map(rowToMenu);
}

export function getMenu(menuId: string): Menu | undefined {
  const menu = db.query<MenuRow, [string]>("SELECT * FROM menus WHERE menu_id = ?").get(menuId);
  return menu ? rowToMenu(menu) : undefined;
}

export function createMenu(input: {
  readonly name: string;
  readonly description?: string;
  readonly ownerUserId?: string;
}): Menu {
  const existing = db.query<MenuRow, [string]>("SELECT * FROM menus WHERE name = ? COLLATE NOCASE").get(input.name);
  if (existing) return rowToMenu(existing);

  const menu: Menu = {
    menuId: nextId("menus", "menu_id", "menu"),
    name: input.name,
    description: input.description ?? "Created by the Gruntend agent.",
    ownerUserId: input.ownerUserId ?? "user_1",
    createdAt: new Date().toISOString(),
  };

  db.run(
    "INSERT INTO menus (menu_id, name, description, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
    menu.menuId,
    menu.name,
    menu.description,
    menu.ownerUserId,
    menu.createdAt,
  );

  return menu;
}

export function listMenuItems(menuId: string): MenuItem[] {
  return db
    .query<MenuItemRow, [string]>("SELECT * FROM menu_items WHERE menu_id = ? ORDER BY item_id")
    .all(menuId)
    .map(rowToMenuItem);
}

export function getMenuItem(input: { readonly menuId: string; readonly itemId: string }): MenuItem | undefined {
  const item = db
    .query<MenuItemRow, [string, string]>("SELECT * FROM menu_items WHERE menu_id = ? AND item_id = ?")
    .get(input.menuId, input.itemId);

  return item ? rowToMenuItem(item) : undefined;
}

export function createMenuItem(input: {
  readonly menuId: string;
  readonly name: string;
  readonly price: number;
  readonly tags?: readonly string[];
}): MenuItem {
  const menu = getMenu(input.menuId);
  if (!menu) {
    throw new Error(`Menu "${input.menuId}" does not exist.`);
  }

  const existing = db
    .query<MenuItemRow, [string, string]>("SELECT * FROM menu_items WHERE menu_id = ? AND name = ? COLLATE NOCASE")
    .get(input.menuId, input.name);
  if (existing) return rowToMenuItem(existing);

  const item: MenuItem = {
    itemId: nextId("menu_items", "item_id", "item"),
    menuId: input.menuId,
    name: input.name,
    price: input.price,
    tags: [...(input.tags ?? [])],
  };

  db.run(
    "INSERT INTO menu_items (item_id, menu_id, name, price, tags_json) VALUES (?, ?, ?, ?, ?)",
    item.itemId,
    item.menuId,
    item.name,
    item.price,
    JSON.stringify(item.tags),
  );

  return item;
}

export function duplicateMenuItem(input: { readonly menuId: string; readonly itemId: string }): MenuItem {
  const source = getMenuItem(input);
  if (!source) {
    throw new Error(`Menu item "${input.itemId}" was not found.`);
  }

  return createMenuItem({
    menuId: source.menuId,
    name: nextCopyName(source.menuId, source.name),
    price: source.price,
    tags: source.tags,
  });
}

export function updateMenuItem(input: {
  readonly menuId: string;
  readonly itemId: string;
  readonly name?: string;
  readonly price?: number;
  readonly tags?: readonly string[];
}): MenuItem {
  const existing = getMenuItem(input);
  if (!existing) {
    throw new Error(`Menu item "${input.itemId}" was not found.`);
  }

  const next: MenuItem = {
    ...existing,
    name: input.name ?? existing.name,
    price: input.price ?? existing.price,
    tags: input.tags ? [...input.tags] : existing.tags,
  };

  db.run(
    "UPDATE menu_items SET name = ?, price = ?, tags_json = ? WHERE menu_id = ? AND item_id = ?",
    next.name,
    next.price,
    JSON.stringify(next.tags),
    input.menuId,
    input.itemId,
  );

  return next;
}

export function deleteMenuItem(input: { readonly menuId: string; readonly itemId: string }): MenuItem {
  const item = getMenuItem(input);
  if (!item) {
    throw new Error(`Menu item "${input.itemId}" was not found.`);
  }

  db.run("DELETE FROM menu_items WHERE menu_id = ? AND item_id = ?", input.menuId, input.itemId);
  return item;
}

function seedDatabase() {
  const userCount = db.query<{ readonly count: number }, []>("SELECT COUNT(*) as count FROM users").get()?.count ?? 0;
  if (userCount > 0) return;

  const users: User[] = [
    { userId: "user_1", name: "Maya Chen", role: "owner", createdAt: "2026-01-01T10:00:00.000Z" },
    { userId: "user_2", name: "Owen Patel", role: "chef", createdAt: "2026-01-02T10:00:00.000Z" },
    { userId: "user_3", name: "Avery Stone", role: "manager", createdAt: "2026-01-03T10:00:00.000Z" },
  ];

  const menus: Menu[] = [
    { menuId: "menu_1", name: "Dinner Menu", description: "Core evening menu with best sellers.", ownerUserId: "user_1", createdAt: "2026-01-04T10:00:00.000Z" },
    { menuId: "menu_2", name: "Brunch Menu", description: "Weekend brunch specials.", ownerUserId: "user_2", createdAt: "2026-01-05T10:00:00.000Z" },
    { menuId: "menu_3", name: "Drinks Menu", description: "Coffee, tea, mocktails, and fresh juices.", ownerUserId: "user_3", createdAt: "2026-01-06T10:00:00.000Z" },
  ];

  const items: MenuItem[] = [
    { itemId: "item_1", menuId: "menu_1", name: "Smash Burger", price: 14, tags: ["beef", "popular"] },
    { itemId: "item_2", menuId: "menu_1", name: "Truffle Fries", price: 8, tags: ["vegetarian", "shareable"] },
    { itemId: "item_3", menuId: "menu_1", name: "Caesar Salad", price: 11, tags: ["salad"] },
    { itemId: "item_4", menuId: "menu_1", name: "Roasted Salmon", price: 22, tags: ["seafood"] },
    { itemId: "item_5", menuId: "menu_2", name: "Avocado Toast", price: 13, tags: ["vegetarian"] },
    { itemId: "item_6", menuId: "menu_2", name: "Blueberry Pancakes", price: 12, tags: ["sweet"] },
    { itemId: "item_7", menuId: "menu_2", name: "Breakfast Tacos", price: 14, tags: ["eggs", "spicy"] },
    { itemId: "item_8", menuId: "menu_2", name: "Granola Bowl", price: 10, tags: ["vegetarian"] },
    { itemId: "item_9", menuId: "menu_3", name: "Cold Brew", price: 5, tags: ["coffee"] },
    { itemId: "item_10", menuId: "menu_3", name: "Ginger Lemonade", price: 6, tags: ["mocktail"] },
    { itemId: "item_11", menuId: "menu_3", name: "Mint Iced Tea", price: 5, tags: ["tea"] },
    { itemId: "item_12", menuId: "menu_3", name: "Seasonal Spritz", price: 8, tags: ["mocktail", "seasonal"] },
  ];

  const insertUser = db.query("INSERT INTO users (user_id, name, role, created_at) VALUES (?, ?, ?, ?)");
  const insertMenu = db.query("INSERT INTO menus (menu_id, name, description, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)");
  const insertItem = db.query("INSERT INTO menu_items (item_id, menu_id, name, price, tags_json) VALUES (?, ?, ?, ?, ?)");

  db.transaction(() => {
    for (const user of users) insertUser.run(user.userId, user.name, user.role, user.createdAt);
    for (const menu of menus) insertMenu.run(menu.menuId, menu.name, menu.description, menu.ownerUserId, menu.createdAt);
    for (const item of items) insertItem.run(item.itemId, item.menuId, item.name, item.price, JSON.stringify(item.tags));
  })();
}

function nextId(table: string, column: string, prefix: string): string {
  const rows = db.query<{ readonly id: string }, []>(`SELECT ${column} as id FROM ${table}`).all();
  let max = 0;

  for (const row of rows) {
    const value = Number(row.id.replace(`${prefix}_`, ""));
    if (Number.isFinite(value) && value > max) max = value;
  }

  return `${prefix}_${max + 1}`;
}

function nextCopyName(menuId: string, name: string): string {
  let suffix = 1;
  let candidate = `Copy of ${name}`;

  while (
    db
      .query<MenuItemRow, [string, string]>("SELECT * FROM menu_items WHERE menu_id = ? AND name = ? COLLATE NOCASE")
      .get(menuId, candidate)
  ) {
    suffix = suffix + 1;
    candidate = `Copy ${suffix} of ${name}`;
  }

  return candidate;
}

function rowToUser(row: UserRow): User {
  return {
    userId: row.user_id,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function rowToMenu(row: MenuRow): Menu {
  return {
    menuId: row.menu_id,
    name: row.name,
    description: row.description,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
  };
}

function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    itemId: row.item_id,
    menuId: row.menu_id,
    name: row.name,
    price: row.price,
    tags: JSON.parse(row.tags_json) as string[],
  };
}
