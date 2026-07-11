import type { Menu, MenuItem, User } from "$lib/types";

export interface StoreContext {
  readonly platform?: App.Platform;
}

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

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type D1PreparedStatement = {
  bind(...values: readonly unknown[]): D1PreparedStatement;
  all<TRow = unknown>(): Promise<{ readonly results?: readonly TRow[] }>;
  first<TRow = unknown>(): Promise<TRow | null>;
  run(): Promise<unknown>;
};

const seedUsers: readonly User[] = [
  {
    userId: "user_1",
    name: "Maya Chen",
    role: "owner",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  {
    userId: "user_2",
    name: "Owen Patel",
    role: "chef",
    createdAt: "2026-01-02T10:00:00.000Z",
  },
  {
    userId: "user_3",
    name: "Avery Stone",
    role: "manager",
    createdAt: "2026-01-03T10:00:00.000Z",
  },
];

const seedMenus: readonly Menu[] = [
  {
    menuId: "menu_1",
    name: "Dinner Menu",
    description: "Core evening menu with best sellers.",
    ownerUserId: "user_1",
    createdAt: "2026-01-04T10:00:00.000Z",
  },
  {
    menuId: "menu_2",
    name: "Brunch Menu",
    description: "Weekend brunch specials.",
    ownerUserId: "user_2",
    createdAt: "2026-01-05T10:00:00.000Z",
  },
  {
    menuId: "menu_3",
    name: "Drinks Menu",
    description: "Coffee, tea, mocktails, and fresh juices.",
    ownerUserId: "user_3",
    createdAt: "2026-01-06T10:00:00.000Z",
  },
];

const seedItems: readonly MenuItem[] = [
  {
    itemId: "item_1",
    menuId: "menu_1",
    name: "Smash Burger",
    price: 14,
    tags: ["beef", "popular"],
  },
  {
    itemId: "item_2",
    menuId: "menu_1",
    name: "Truffle Fries",
    price: 8,
    tags: ["vegetarian", "shareable"],
  },
  {
    itemId: "item_3",
    menuId: "menu_1",
    name: "Caesar Salad",
    price: 11,
    tags: ["salad"],
  },
  {
    itemId: "item_4",
    menuId: "menu_1",
    name: "Roasted Salmon",
    price: 22,
    tags: ["seafood"],
  },
  {
    itemId: "item_5",
    menuId: "menu_2",
    name: "Avocado Toast",
    price: 13,
    tags: ["vegetarian"],
  },
  {
    itemId: "item_6",
    menuId: "menu_2",
    name: "Blueberry Pancakes",
    price: 12,
    tags: ["sweet"],
  },
  {
    itemId: "item_7",
    menuId: "menu_2",
    name: "Breakfast Tacos",
    price: 14,
    tags: ["eggs", "spicy"],
  },
  {
    itemId: "item_8",
    menuId: "menu_2",
    name: "Granola Bowl",
    price: 10,
    tags: ["vegetarian"],
  },
  {
    itemId: "item_9",
    menuId: "menu_3",
    name: "Cold Brew",
    price: 5,
    tags: ["coffee"],
  },
  {
    itemId: "item_10",
    menuId: "menu_3",
    name: "Ginger Lemonade",
    price: 6,
    tags: ["mocktail"],
  },
  {
    itemId: "item_11",
    menuId: "menu_3",
    name: "Mint Iced Tea",
    price: 5,
    tags: ["tea"],
  },
  {
    itemId: "item_12",
    menuId: "menu_3",
    name: "Seasonal Spritz",
    price: 8,
    tags: ["mocktail", "seasonal"],
  },
];

const memoryStore = createMemoryStore();
const initializedD1 = new WeakSet<D1Database>();

export async function listUsers(context: StoreContext = {}): Promise<User[]> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.listUsers();

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM users ORDER BY user_id")
    .all<UserRow>();
  return [...(rows.results ?? [])].map(rowToUser);
}

export async function createUser(
  input: { readonly name: string; readonly role: User["role"] },
  context: StoreContext = {},
): Promise<User> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.createUser(input);

  await ensureD1(d1);
  const existing = await d1
    .prepare("SELECT * FROM users WHERE lower(name) = lower(?)")
    .bind(input.name)
    .first<UserRow>();
  if (existing) return rowToUser(existing);

  const user: User = {
    userId: newD1Id("user"),
    name: input.name,
    role: input.role,
    createdAt: new Date().toISOString(),
  };

  await d1
    .prepare(
      "INSERT INTO users (user_id, name, role, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(user.userId, user.name, user.role, user.createdAt)
    .run();

  return user;
}

export async function listMenus(context: StoreContext = {}): Promise<Menu[]> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.listMenus();

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM menus ORDER BY menu_id")
    .all<MenuRow>();
  return [...(rows.results ?? [])].map(rowToMenu);
}

export async function getMenu(
  menuId: string,
  context: StoreContext = {},
): Promise<Menu | undefined> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.getMenu(menuId);

  await ensureD1(d1);
  const menu = await d1
    .prepare("SELECT * FROM menus WHERE menu_id = ?")
    .bind(menuId)
    .first<MenuRow>();
  return menu ? rowToMenu(menu) : undefined;
}

export async function createMenu(
  input: {
    readonly name: string;
    readonly description?: string;
    readonly ownerUserId?: string;
  },
  context: StoreContext = {},
): Promise<Menu> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.createMenu(input);

  await ensureD1(d1);
  const existing = await d1
    .prepare("SELECT * FROM menus WHERE lower(name) = lower(?)")
    .bind(input.name)
    .first<MenuRow>();
  if (existing) return rowToMenu(existing);

  const menu: Menu = {
    menuId: newD1Id("menu"),
    name: input.name,
    description: input.description ?? "Created by the Gruntend agent.",
    ownerUserId: input.ownerUserId ?? "user_1",
    createdAt: new Date().toISOString(),
  };

  await d1
    .prepare(
      "INSERT INTO menus (menu_id, name, description, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      menu.menuId,
      menu.name,
      menu.description,
      menu.ownerUserId,
      menu.createdAt,
    )
    .run();

  return menu;
}

export async function listMenuItems(
  menuId: string,
  context: StoreContext = {},
): Promise<MenuItem[]> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.listMenuItems(menuId);

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM menu_items WHERE menu_id = ? ORDER BY item_id")
    .bind(menuId)
    .all<MenuItemRow>();
  return [...(rows.results ?? [])].map(rowToMenuItem);
}

export async function getMenuItem(
  input: { readonly menuId: string; readonly itemId: string },
  context: StoreContext = {},
): Promise<MenuItem | undefined> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.getMenuItem(input);

  await ensureD1(d1);
  const item = await d1
    .prepare("SELECT * FROM menu_items WHERE menu_id = ? AND item_id = ?")
    .bind(input.menuId, input.itemId)
    .first<MenuItemRow>();
  return item ? rowToMenuItem(item) : undefined;
}

export async function createMenuItem(
  input: {
    readonly menuId: string;
    readonly name: string;
    readonly price: number;
    readonly tags?: readonly string[];
  },
  context: StoreContext = {},
): Promise<MenuItem> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.createMenuItem(input);

  await ensureD1(d1);
  const menu = await getMenu(input.menuId, context);
  if (!menu) throw new Error(`Menu "${input.menuId}" does not exist.`);

  const existing = await d1
    .prepare(
      "SELECT * FROM menu_items WHERE menu_id = ? AND lower(name) = lower(?)",
    )
    .bind(input.menuId, input.name)
    .first<MenuItemRow>();
  if (existing) return rowToMenuItem(existing);

  const item: MenuItem = {
    itemId: newD1Id("item"),
    menuId: input.menuId,
    name: input.name,
    price: input.price,
    tags: [...(input.tags ?? [])],
  };

  await d1
    .prepare(
      "INSERT INTO menu_items (item_id, menu_id, name, price, tags_json) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      item.itemId,
      item.menuId,
      item.name,
      item.price,
      JSON.stringify(item.tags),
    )
    .run();

  return item;
}

export async function duplicateMenuItem(
  input: { readonly menuId: string; readonly itemId: string },
  context: StoreContext = {},
): Promise<MenuItem> {
  const source = await getMenuItem(input, context);
  if (!source) throw new Error(`Menu item "${input.itemId}" was not found.`);

  return createMenuItem(
    {
      menuId: source.menuId,
      name: await nextCopyName(source.menuId, source.name, context),
      price: source.price,
      tags: source.tags,
    },
    context,
  );
}

export async function updateMenuItem(
  input: {
    readonly menuId: string;
    readonly itemId: string;
    readonly name?: string;
    readonly price?: number;
    readonly tags?: readonly string[];
  },
  context: StoreContext = {},
): Promise<MenuItem> {
  const existing = await getMenuItem(input, context);
  if (!existing) throw new Error(`Menu item "${input.itemId}" was not found.`);

  const next: MenuItem = {
    ...existing,
    name: input.name ?? existing.name,
    price: input.price ?? existing.price,
    tags: input.tags ? [...input.tags] : existing.tags,
  };

  const d1 = readD1(context);
  if (!d1) return memoryStore.updateMenuItem(input);

  await d1
    .prepare(
      "UPDATE menu_items SET name = ?, price = ?, tags_json = ? WHERE menu_id = ? AND item_id = ?",
    )
    .bind(
      next.name,
      next.price,
      JSON.stringify(next.tags),
      input.menuId,
      input.itemId,
    )
    .run();

  return next;
}

export async function deleteMenuItem(
  input: { readonly menuId: string; readonly itemId: string },
  context: StoreContext = {},
): Promise<MenuItem> {
  const item = await getMenuItem(input, context);
  if (!item) throw new Error(`Menu item "${input.itemId}" was not found.`);

  const d1 = readD1(context);
  if (!d1) return memoryStore.deleteMenuItem(input);

  await d1
    .prepare("DELETE FROM menu_items WHERE menu_id = ? AND item_id = ?")
    .bind(input.menuId, input.itemId)
    .run();
  return item;
}

async function ensureD1(db: D1Database): Promise<void> {
  if (initializedD1.has(db)) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS menus (
      menu_id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      description TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS menu_items (
      item_id TEXT PRIMARY KEY,
      menu_id TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      price REAL NOT NULL,
      tags_json TEXT NOT NULL,
      FOREIGN KEY (menu_id) REFERENCES menus(menu_id) ON DELETE CASCADE,
      UNIQUE (menu_id, name)
    )`,
    )
    .run();

  const count = await db
    .prepare("SELECT COUNT(*) as count FROM users")
    .first<{ readonly count: number }>();

  if ((count?.count ?? 0) === 0) {
    for (const user of seedUsers) {
      await db
        .prepare(
          "INSERT INTO users (user_id, name, role, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(user.userId, user.name, user.role, user.createdAt)
        .run();
    }
    for (const menu of seedMenus) {
      await db
        .prepare(
          "INSERT INTO menus (menu_id, name, description, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          menu.menuId,
          menu.name,
          menu.description,
          menu.ownerUserId,
          menu.createdAt,
        )
        .run();
    }
    for (const item of seedItems) {
      await db
        .prepare(
          "INSERT INTO menu_items (item_id, menu_id, name, price, tags_json) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          item.itemId,
          item.menuId,
          item.name,
          item.price,
          JSON.stringify(item.tags),
        )
        .run();
    }
  }

  initializedD1.add(db);
}

function newD1Id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function nextCopyName(
  menuId: string,
  name: string,
  context: StoreContext,
): Promise<string> {
  let suffix = 1;
  let candidate = `Copy of ${name}`;

  while (await menuItemNameExists(menuId, candidate, context)) {
    suffix = suffix + 1;
    candidate = `Copy ${suffix} of ${name}`;
  }

  return candidate;
}

async function menuItemNameExists(
  menuId: string,
  name: string,
  context: StoreContext,
): Promise<boolean> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.menuItemNameExists(menuId, name);

  await ensureD1(d1);
  const row = await d1
    .prepare(
      "SELECT item_id FROM menu_items WHERE menu_id = ? AND lower(name) = lower(?)",
    )
    .bind(menuId, name)
    .first<{ readonly item_id: string }>();
  return !!row;
}

function readD1(context: StoreContext): D1Database | undefined {
  return context.platform?.env?.GRUNTEND_DB;
}

function createMemoryStore() {
  const users = new Map(seedUsers.map((user) => [user.userId, { ...user }]));
  const menus = new Map(seedMenus.map((menu) => [menu.menuId, { ...menu }]));
  const items = new Map(
    seedItems.map((item) => [item.itemId, { ...item, tags: [...item.tags] }]),
  );

  return {
    listUsers(): User[] {
      return [...users.values()].sort(byId("userId")).map(copyUser);
    },
    createUser(input: {
      readonly name: string;
      readonly role: User["role"];
    }): User {
      const existing = [...users.values()].find((user) =>
        sameText(user.name, input.name),
      );
      if (existing) return copyUser(existing);

      const user: User = {
        userId: nextMemoryId(users.keys(), "user"),
        name: input.name,
        role: input.role,
        createdAt: new Date().toISOString(),
      };
      users.set(user.userId, user);
      return copyUser(user);
    },
    listMenus(): Menu[] {
      return [...menus.values()].sort(byId("menuId")).map(copyMenu);
    },
    getMenu(menuId: string): Menu | undefined {
      const menu = menus.get(menuId);
      return menu ? copyMenu(menu) : undefined;
    },
    createMenu(input: {
      readonly name: string;
      readonly description?: string;
      readonly ownerUserId?: string;
    }): Menu {
      const existing = [...menus.values()].find((menu) =>
        sameText(menu.name, input.name),
      );
      if (existing) return copyMenu(existing);

      const menu: Menu = {
        menuId: nextMemoryId(menus.keys(), "menu"),
        name: input.name,
        description: input.description ?? "Created by the Gruntend agent.",
        ownerUserId: input.ownerUserId ?? "user_1",
        createdAt: new Date().toISOString(),
      };
      menus.set(menu.menuId, menu);
      return copyMenu(menu);
    },
    listMenuItems(menuId: string): MenuItem[] {
      return [...items.values()]
        .filter((item) => item.menuId === menuId)
        .sort(byId("itemId"))
        .map(copyMenuItem);
    },
    getMenuItem(input: {
      readonly menuId: string;
      readonly itemId: string;
    }): MenuItem | undefined {
      const item = items.get(input.itemId);
      return item?.menuId === input.menuId ? copyMenuItem(item) : undefined;
    },
    createMenuItem(input: {
      readonly menuId: string;
      readonly name: string;
      readonly price: number;
      readonly tags?: readonly string[];
    }): MenuItem {
      if (!menus.has(input.menuId))
        throw new Error(`Menu "${input.menuId}" does not exist.`);
      const existing = [...items.values()].find(
        (item) =>
          item.menuId === input.menuId && sameText(item.name, input.name),
      );
      if (existing) return copyMenuItem(existing);

      const item: MenuItem = {
        itemId: nextMemoryId(items.keys(), "item"),
        menuId: input.menuId,
        name: input.name,
        price: input.price,
        tags: [...(input.tags ?? [])],
      };
      items.set(item.itemId, item);
      return copyMenuItem(item);
    },
    updateMenuItem(input: {
      readonly menuId: string;
      readonly itemId: string;
      readonly name?: string;
      readonly price?: number;
      readonly tags?: readonly string[];
    }): MenuItem {
      const existing = items.get(input.itemId);
      if (!existing || existing.menuId !== input.menuId)
        throw new Error(`Menu item "${input.itemId}" was not found.`);

      const next: MenuItem = {
        ...existing,
        name: input.name ?? existing.name,
        price: input.price ?? existing.price,
        tags: input.tags ? [...input.tags] : existing.tags,
      };
      items.set(next.itemId, next);
      return copyMenuItem(next);
    },
    deleteMenuItem(input: {
      readonly menuId: string;
      readonly itemId: string;
    }): MenuItem {
      const existing = items.get(input.itemId);
      if (!existing || existing.menuId !== input.menuId)
        throw new Error(`Menu item "${input.itemId}" was not found.`);

      items.delete(input.itemId);
      return copyMenuItem(existing);
    },
    menuItemNameExists(menuId: string, name: string): boolean {
      return [...items.values()].some(
        (item) => item.menuId === menuId && sameText(item.name, name),
      );
    },
  };
}

function nextMemoryId(ids: Iterable<string>, prefix: string): string {
  let max = 0;

  for (const id of ids) {
    const value = Number(id.replace(`${prefix}_`, ""));
    if (Number.isFinite(value) && value > max) max = value;
  }

  return `${prefix}_${max + 1}`;
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

function copyUser(user: User): User {
  return { ...user };
}

function copyMenu(menu: Menu): Menu {
  return { ...menu };
}

function copyMenuItem(item: MenuItem): MenuItem {
  return { ...item, tags: [...item.tags] };
}

function byId<TKey extends string>(key: TKey) {
  return <TItem extends Record<TKey, string>>(left: TItem, right: TItem) =>
    left[key].localeCompare(right[key], undefined, { numeric: true });
}

function sameText(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}
