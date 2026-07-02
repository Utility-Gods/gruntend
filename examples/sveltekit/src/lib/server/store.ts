import type { Menu, MenuItem, User } from "$lib/types";

let menuSequence = 4;
let itemSequence = 13;
let userSequence = 4;

const users: User[] = [
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

const menus: Menu[] = [
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

export function listUsers(): User[] {
  return users.map(cloneUser);
}

export function createUser(input: { readonly name: string; readonly role: User["role"] }): User {
  const existing = users.find((user) => sameName(user.name, input.name));
  if (existing) return cloneUser(existing);

  const user: User = {
    userId: `user_${userSequence++}`,
    name: input.name,
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return cloneUser(user);
}

export function listMenus(): Menu[] {
  return menus.map(cloneMenu);
}

export function getMenu(menuId: string): Menu | undefined {
  const menu = menus.find((item) => item.menuId === menuId);
  return menu ? cloneMenu(menu) : undefined;
}

export function createMenu(input: {
  readonly name: string;
  readonly description?: string;
  readonly ownerUserId?: string;
}): Menu {
  const existing = menus.find((menu) => sameName(menu.name, input.name));
  if (existing) return cloneMenu(existing);

  const menu: Menu = {
    menuId: `menu_${menuSequence++}`,
    name: input.name,
    description: input.description ?? "Created by the Gruntend agent.",
    ownerUserId: input.ownerUserId ?? users[0].userId,
    createdAt: new Date().toISOString(),
  };
  menus.push(menu);
  return cloneMenu(menu);
}

export function listMenuItems(menuId: string): MenuItem[] {
  return items.filter((item) => item.menuId === menuId).map(cloneMenuItem);
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

  const existing = items.find((item) => item.menuId === input.menuId && sameName(item.name, input.name));
  if (existing) return cloneMenuItem(existing);

  const item: MenuItem = {
    itemId: `item_${itemSequence++}`,
    menuId: input.menuId,
    name: input.name,
    price: input.price,
    tags: [...(input.tags ?? [])],
  };
  items.push(item);
  return cloneMenuItem(item);
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function cloneUser(user: User): User {
  return { ...user };
}

function cloneMenu(menu: Menu): Menu {
  return { ...menu };
}

function cloneMenuItem(item: MenuItem): MenuItem {
  return { ...item, tags: [...item.tags] };
}
