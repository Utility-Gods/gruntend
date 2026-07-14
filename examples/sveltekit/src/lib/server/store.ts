import type {
  Customer,
  Menu,
  MenuItem,
  Order,
  OrderLine,
  OrderServiceType,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Reservation,
  RestaurantTable,
  Shift,
  User,
} from "$lib/types";

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

type CustomerRow = {
  readonly customer_id: string;
  readonly name: string;
  readonly email: string;
  readonly loyalty_tier: Customer["loyaltyTier"];
  readonly created_at: string;
};

type RestaurantTableRow = {
  readonly table_id: string;
  readonly name: string;
  readonly section: RestaurantTable["section"];
  readonly seats: number;
  readonly active: number;
};

type PaymentRow = {
  readonly payment_id: string;
  readonly order_id: string;
  readonly amount: number;
  readonly tip: number;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly paid_at: string | null;
};

type ShiftRow = {
  readonly shift_id: string;
  readonly user_id: string;
  readonly station: Shift["station"];
  readonly starts_at: string;
  readonly ends_at: string;
};

type ReservationRow = {
  readonly reservation_id: string;
  readonly customer_id: string;
  readonly table_id: string;
  readonly order_id: string | null;
  readonly party_size: number;
  readonly status: Reservation["status"];
  readonly reserved_at: string;
};

type OrderRow = {
  readonly order_id: string;
  readonly table_name: string;
  readonly table_id: string | null;
  readonly customer_id: string;
  readonly assigned_user_id: string;
  readonly service_type: OrderServiceType;
  readonly party_size: number;
  readonly status: OrderStatus;
  readonly created_at: string;
  readonly closed_at: string | null;
};

type OrderLineRow = {
  readonly line_id: string;
  readonly order_id: string;
  readonly menu_id: string;
  readonly item_id: string;
  readonly item_name: string;
  readonly unit_price: number;
  readonly quantity: number;
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
  {
    userId: "user_4",
    name: "Jamie Reed",
    role: "server",
    createdAt: "2026-01-07T10:00:00.000Z",
  },
  {
    userId: "user_5",
    name: "Morgan Lee",
    role: "server",
    createdAt: "2026-01-08T10:00:00.000Z",
  },
  {
    userId: "user_6",
    name: "Taylor Brooks",
    role: "host",
    createdAt: "2026-01-09T10:00:00.000Z",
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

const seedTables: readonly RestaurantTable[] = [
  { tableId: "table_1", name: "Table 1", section: "dining-room", seats: 4, active: true },
  { tableId: "table_2", name: "Table 2", section: "dining-room", seats: 2, active: true },
  { tableId: "table_3", name: "Table 3", section: "dining-room", seats: 4, active: true },
  { tableId: "table_4", name: "Table 4", section: "dining-room", seats: 2, active: true },
  { tableId: "table_5", name: "Table 5", section: "dining-room", seats: 4, active: true },
  { tableId: "table_6", name: "Table 6", section: "dining-room", seats: 6, active: true },
  { tableId: "table_7", name: "Table 7", section: "dining-room", seats: 4, active: true },
  { tableId: "table_8", name: "Table 8", section: "dining-room", seats: 6, active: true },
  { tableId: "table_9", name: "Patio 1", section: "patio", seats: 4, active: true },
  { tableId: "table_10", name: "Patio 2", section: "patio", seats: 4, active: true },
  { tableId: "table_11", name: "Patio 4", section: "patio", seats: 6, active: true },
  { tableId: "table_12", name: "Patio 5", section: "patio", seats: 2, active: true },
  { tableId: "table_13", name: "Bar 1", section: "bar", seats: 2, active: true },
  { tableId: "table_14", name: "Bar 3", section: "bar", seats: 2, active: true },
];

const seedCustomers: readonly Customer[] = [
  { customerId: "customer_1", name: "Lena Ortiz", email: "lena.ortiz@example.com", loyaltyTier: "gold", createdAt: "2025-10-12T09:00:00.000Z" },
  { customerId: "customer_2", name: "Noah Williams", email: "noah.williams@example.com", loyaltyTier: "silver", createdAt: "2026-01-08T09:00:00.000Z" },
  { customerId: "customer_3", name: "Priya Shah", email: "priya.shah@example.com", loyaltyTier: "silver", createdAt: "2026-04-18T09:00:00.000Z" },
  { customerId: "customer_4", name: "Eli Brooks", email: "eli.brooks@example.com", loyaltyTier: "standard", createdAt: "2025-08-03T09:00:00.000Z" },
  { customerId: "customer_5", name: "Sofia Kim", email: "sofia.kim@example.com", loyaltyTier: "silver", createdAt: "2026-02-21T09:00:00.000Z" },
];

const seedOrders: readonly Order[] = [
  seedOrder("order_1", "Table 4", "served", "2026-07-07T18:20:00.000Z", [["item_1", 2], ["item_2", 1]]),
  seedOrder("order_2", "Patio 2", "served", "2026-07-07T20:05:00.000Z", [["item_4", 1], ["item_10", 2]]),
  seedOrder("order_3", "Bar 1", "served", "2026-07-08T12:15:00.000Z", [["item_9", 2], ["item_5", 1]]),
  seedOrder("order_4", "Table 7", "cancelled", "2026-07-08T19:40:00.000Z", [["item_1", 1]]),
  seedOrder("order_5", "Table 3", "served", "2026-07-09T18:05:00.000Z", [["item_3", 2], ["item_11", 2]]),
  seedOrder("order_6", "Patio 5", "served", "2026-07-09T20:35:00.000Z", [["item_4", 2], ["item_12", 2]]),
  seedOrder("order_7", "Table 1", "served", "2026-07-10T11:30:00.000Z", [["item_6", 2], ["item_9", 2]]),
  seedOrder("order_8", "Table 6", "served", "2026-07-10T19:10:00.000Z", [["item_1", 3], ["item_2", 2], ["item_10", 2]]),
  seedOrder("order_9", "Patio 1", "served", "2026-07-11T12:45:00.000Z", [["item_5", 2], ["item_8", 1], ["item_11", 2]]),
  seedOrder("order_10", "Table 8", "served", "2026-07-11T20:20:00.000Z", [["item_4", 1], ["item_1", 2], ["item_12", 3]]),
  seedOrder("order_11", "Bar 3", "served", "2026-07-12T13:05:00.000Z", [["item_7", 2], ["item_10", 2]]),
  seedOrder("order_12", "Table 2", "served", "2026-07-12T19:55:00.000Z", [["item_1", 2], ["item_3", 1], ["item_9", 2]]),
  seedOrder("order_13", "Patio 4", "preparing", "2026-07-13T19:25:00.000Z", [["item_4", 1], ["item_2", 2]]),
  seedOrder("order_14", "Table 5", "open", "2026-07-13T19:42:00.000Z", [["item_1", 1], ["item_10", 2]]),
];

function seedOrder(
  orderId: string,
  tableName: string,
  status: OrderStatus,
  createdAt: string,
  entries: readonly (readonly [string, number])[],
): Order {
  const sequence = Number(orderId.replace("order_", ""));
  const customer = seedCustomers[(sequence - 1) % seedCustomers.length];
  const lines = entries.map(([itemId, quantity], index): OrderLine => {
    const item = seedItems.find((entry) => entry.itemId === itemId);
    if (!item) throw new Error(`Seed menu item "${itemId}" was not found.`);
    return {
      lineId: `${orderId}_line_${index + 1}`,
      orderId,
      menuId: item.menuId,
      itemId,
      itemName: item.name,
      unitPrice: item.price,
      quantity,
    };
  });
  const serviceType: OrderServiceType =
    sequence % 5 === 0
      ? "delivery"
      : sequence % 3 === 0
        ? "takeout"
        : "dine-in";
  const table =
    serviceType === "dine-in"
      ? seedTables.find((entry) => entry.name === tableName) ?? null
      : null;
  return {
    orderId,
    tableName,
    tableId: table?.tableId ?? null,
    table: table ? { ...table } : null,
    customerId: customer.customerId,
    customer: copyCustomer(customer),
    assignedUserId:
      sequence % 3 === 1 ? "user_4" : sequence % 3 === 2 ? "user_5" : "user_3",
    serviceType,
    partySize: table
      ? Math.min((sequence % 4) + 1, table.seats)
      : (sequence % 4) + 1,
    status,
    lines,
    payment: null,
    total: orderTotal(lines),
    createdAt,
    closedAt:
      status === "served" || status === "cancelled"
        ? new Date(Date.parse(createdAt) + 45 * 60 * 1000).toISOString()
        : null,
  };
}

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
    userId: createStoreId("user"),
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
    menuId: createStoreId("menu"),
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

export async function listCustomers(
  context: StoreContext = {},
): Promise<Customer[]> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.listCustomers();

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM customers ORDER BY name")
    .all<CustomerRow>();
  return [...(rows.results ?? [])].map(rowToCustomer);
}

export async function listRestaurantTables(
  context: StoreContext = {},
): Promise<RestaurantTable[]> {
  const d1 = readD1(context);
  if (!d1) return seedTables.map((table) => ({ ...table }));

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM restaurant_tables ORDER BY table_id")
    .all<RestaurantTableRow>();
  return [...(rows.results ?? [])].map(rowToRestaurantTable);
}

export async function listPayments(
  context: StoreContext = {},
): Promise<Payment[]> {
  const d1 = readD1(context);
  if (!d1) return [];

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM payments ORDER BY paid_at DESC, payment_id")
    .all<PaymentRow>();
  return [...(rows.results ?? [])].map(rowToPayment);
}

export async function listShifts(
  context: StoreContext = {},
): Promise<Shift[]> {
  const d1 = readD1(context);
  if (!d1) return [];

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM shifts ORDER BY starts_at, shift_id")
    .all<ShiftRow>();
  return [...(rows.results ?? [])].map(rowToShift);
}

export async function listReservations(
  context: StoreContext = {},
): Promise<Reservation[]> {
  const d1 = readD1(context);
  if (!d1) return [];

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM reservations ORDER BY reserved_at, reservation_id")
    .all<ReservationRow>();
  return [...(rows.results ?? [])].map(rowToReservation);
}

export async function listOrders(
  context: StoreContext = {},
): Promise<Order[]> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.listOrders();

  await ensureD1(d1);
  const rows = await d1
    .prepare("SELECT * FROM orders ORDER BY created_at DESC, order_id DESC")
    .all<OrderRow>();
  const orders = await Promise.all(
    [...(rows.results ?? [])].map(async (row) => {
      const [lines, customerRow, tableRow, paymentRow] = await Promise.all([
        d1
          .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY line_id")
          .bind(row.order_id)
          .all<OrderLineRow>(),
        d1
          .prepare("SELECT * FROM customers WHERE customer_id = ?")
          .bind(row.customer_id)
          .first<CustomerRow>(),
        row.table_id
          ? d1
              .prepare("SELECT * FROM restaurant_tables WHERE table_id = ?")
              .bind(row.table_id)
              .first<RestaurantTableRow>()
          : Promise.resolve(null),
        d1
          .prepare("SELECT * FROM payments WHERE order_id = ?")
          .bind(row.order_id)
          .first<PaymentRow>(),
      ]);
      if (!customerRow) throw new Error(`Customer "${row.customer_id}" was not found.`);
      return rowToOrder(
        row,
        rowToCustomer(customerRow),
        tableRow ? rowToRestaurantTable(tableRow) : null,
        paymentRow ? rowToPayment(paymentRow) : null,
        [...(lines.results ?? [])].map(rowToOrderLine),
      );
    }),
  );
  return orders;
}

export async function createOrder(
  input: {
    readonly tableName: string;
    readonly tableId?: string;
    readonly customerId: string;
    readonly assignedUserId: string;
    readonly serviceType: OrderServiceType;
    readonly partySize: number;
    readonly items: readonly {
      readonly menuId: string;
      readonly itemId: string;
      readonly quantity: number;
    }[];
  },
  context: StoreContext = {},
): Promise<Order> {
  if (input.items.length === 0) throw new Error("An order needs at least one item.");
  const d1 = readD1(context);
  if (!d1) return memoryStore.createOrder(input);

  await ensureD1(d1);
  const orderId = createStoreId("order");
  const tables = await listRestaurantTables(context);
  const table = input.tableId
    ? tables.find((entry) => entry.tableId === input.tableId)
    : undefined;
  validateOrderLocation(input.serviceType, table, input.partySize);
  const staff = await listUsers(context);
  const assignedUser = staff.find((entry) => entry.userId === input.assignedUserId);
  if (!assignedUser || !["owner", "manager", "server"].includes(assignedUser.role)) {
    throw new Error("Orders must be assigned to an owner, manager, or server.");
  }
  const customers = await listCustomers(context);
  const customer = customers.find((entry) => entry.customerId === input.customerId);
  if (!customer) throw new Error(`Customer "${input.customerId}" was not found.`);
  const lines = await createOrderLines(orderId, input.items, context);
  const order: Order = {
    orderId,
    tableName: table?.name ?? input.tableName,
    tableId: table?.tableId ?? null,
    table: table ? { ...table } : null,
    customerId: customer.customerId,
    customer,
    assignedUserId: input.assignedUserId,
    serviceType: input.serviceType,
    partySize: input.partySize,
    status: "open",
    lines,
    payment: null,
    total: orderTotal(lines),
    createdAt: new Date().toISOString(),
    closedAt: null,
  };

  await d1
    .prepare("INSERT INTO orders (order_id, table_name, table_id, customer_id, assigned_user_id, service_type, party_size, status, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(order.orderId, order.tableName, order.tableId, order.customerId, order.assignedUserId, order.serviceType, order.partySize, order.status, order.createdAt, order.closedAt)
    .run();
  for (const line of lines) {
    await insertOrderLine(d1, line);
  }
  return copyOrder(order);
}

export async function updateOrderStatus(
  input: { readonly orderId: string; readonly status: OrderStatus },
  context: StoreContext = {},
): Promise<Order> {
  const d1 = readD1(context);
  if (!d1) return memoryStore.updateOrderStatus(input);

  await ensureD1(d1);
  const orders = await listOrders(context);
  const existing = orders.find((order) => order.orderId === input.orderId);
  if (!existing) throw new Error(`Order "${input.orderId}" was not found.`);
  validateOrderStatusTransition(existing.status, input.status);
  const closedAt =
    input.status === "served" || input.status === "cancelled"
      ? new Date().toISOString()
      : null;
  await d1
    .prepare("UPDATE orders SET status = ?, closed_at = ? WHERE order_id = ?")
    .bind(input.status, closedAt, input.orderId)
    .run();
  return { ...existing, status: input.status, closedAt };
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
    itemId: createStoreId("item"),
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
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      loyalty_tier TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS restaurant_tables (
      table_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      section TEXT NOT NULL,
      seats INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      table_id TEXT,
      customer_id TEXT NOT NULL,
      assigned_user_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY (table_id) REFERENCES restaurant_tables(table_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (assigned_user_id) REFERENCES users(user_id)
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS order_lines (
      line_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
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

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS payments (
      payment_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      tip REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS shifts (
      shift_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      station TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS reservations (
      reservation_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      table_id TEXT NOT NULL,
      order_id TEXT,
      party_size INTEGER NOT NULL,
      status TEXT NOT NULL,
      reserved_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (table_id) REFERENCES restaurant_tables(table_id),
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )`,
    )
    .run();

  const customerCount = await db
    .prepare("SELECT COUNT(*) as count FROM customers")
    .first<{ readonly count: number }>();
  if ((customerCount?.count ?? 0) === 0) {
    for (const customer of seedCustomers) {
      await db
        .prepare("INSERT INTO customers (customer_id, name, email, loyalty_tier, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(customer.customerId, customer.name, customer.email, customer.loyaltyTier, customer.createdAt)
        .run();
    }
  }

  const tableCount = await db
    .prepare("SELECT COUNT(*) as count FROM restaurant_tables")
    .first<{ readonly count: number }>();
  if ((tableCount?.count ?? 0) === 0) {
    for (const table of seedTables) {
      await db
        .prepare("INSERT INTO restaurant_tables (table_id, name, section, seats, active) VALUES (?, ?, ?, ?, ?)")
        .bind(table.tableId, table.name, table.section, table.seats, table.active ? 1 : 0)
        .run();
    }
  }

  const orderCount = await db
    .prepare("SELECT COUNT(*) as count FROM orders")
    .first<{ readonly count: number }>();
  if ((orderCount?.count ?? 0) === 0) {
    for (const order of seedOrders) {
      await db
        .prepare("INSERT INTO orders (order_id, table_name, table_id, customer_id, assigned_user_id, service_type, party_size, status, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(order.orderId, order.tableName, order.tableId, order.customerId, order.assignedUserId, order.serviceType, order.partySize, order.status, order.createdAt, order.closedAt)
        .run();
      for (const line of order.lines) await insertOrderLine(db, line);
    }
  }

  initializedD1.add(db);
}

function createStoreId(prefix: string): string {
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
  const customers = new Map(
    seedCustomers.map((customer) => [customer.customerId, copyCustomer(customer)]),
  );
  const orders = new Map(
    seedOrders.map((order) => [order.orderId, copyOrder(order)]),
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
    listCustomers(): Customer[] {
      return [...customers.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(copyCustomer);
    },
    listOrders(): Order[] {
      return [...orders.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(copyOrder);
    },
    createOrder(input: {
      readonly tableName: string;
      readonly tableId?: string;
      readonly customerId: string;
      readonly assignedUserId: string;
      readonly serviceType: OrderServiceType;
      readonly partySize: number;
      readonly items: readonly {
        readonly menuId: string;
        readonly itemId: string;
        readonly quantity: number;
      }[];
    }): Order {
      if (input.items.length === 0) throw new Error("An order needs at least one item.");
      const orderId = nextMemoryId(orders.keys(), "order");
      const table = input.tableId
        ? seedTables.find((entry) => entry.tableId === input.tableId)
        : undefined;
      validateOrderLocation(input.serviceType, table, input.partySize);
      const assignedUser = users.get(input.assignedUserId);
      if (!assignedUser || !["owner", "manager", "server"].includes(assignedUser.role))
        throw new Error("Orders must be assigned to an owner, manager, or server.");
      const customer = customers.get(input.customerId);
      if (!customer) throw new Error(`Customer "${input.customerId}" was not found.`);
      const lines = input.items.map((entry, index): OrderLine => {
        const item = items.get(entry.itemId);
        if (!item || item.menuId !== entry.menuId)
          throw new Error(`Menu item "${entry.itemId}" was not found.`);
        return {
          lineId: `${orderId}_line_${index + 1}`,
          orderId,
          menuId: item.menuId,
          itemId: item.itemId,
          itemName: item.name,
          unitPrice: item.price,
          quantity: entry.quantity,
        };
      });
      const order: Order = {
        orderId,
        tableName: table?.name ?? input.tableName,
        tableId: table?.tableId ?? null,
        table: table ? { ...table } : null,
        customerId: customer.customerId,
        customer: copyCustomer(customer),
        assignedUserId: input.assignedUserId,
        serviceType: input.serviceType,
        partySize: input.partySize,
        status: "open",
        lines,
        payment: null,
        total: orderTotal(lines),
        createdAt: new Date().toISOString(),
        closedAt: null,
      };
      orders.set(orderId, order);
      return copyOrder(order);
    },
    updateOrderStatus(input: {
      readonly orderId: string;
      readonly status: OrderStatus;
    }): Order {
      const order = orders.get(input.orderId);
      if (!order) throw new Error(`Order "${input.orderId}" was not found.`);
      validateOrderStatusTransition(order.status, input.status);
      const updated = {
        ...order,
        status: input.status,
        closedAt:
          input.status === "served" || input.status === "cancelled"
            ? new Date().toISOString()
            : null,
      };
      orders.set(input.orderId, updated);
      return copyOrder(updated);
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

async function createOrderLines(
  orderId: string,
  entries: readonly {
    readonly menuId: string;
    readonly itemId: string;
    readonly quantity: number;
  }[],
  context: StoreContext,
): Promise<OrderLine[]> {
  return Promise.all(
    entries.map(async (entry, index) => {
      if (!Number.isInteger(entry.quantity) || entry.quantity < 1)
        throw new Error("Order quantities must be positive integers.");
      const item = await getMenuItem(entry, context);
      if (!item) throw new Error(`Menu item "${entry.itemId}" was not found.`);
      return {
        lineId: `${orderId}_line_${index + 1}`,
        orderId,
        menuId: item.menuId,
        itemId: item.itemId,
        itemName: item.name,
        unitPrice: item.price,
        quantity: entry.quantity,
      };
    }),
  );
}

async function insertOrderLine(db: D1Database, line: OrderLine): Promise<void> {
  await db
    .prepare("INSERT INTO order_lines (line_id, order_id, menu_id, item_id, item_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(line.lineId, line.orderId, line.menuId, line.itemId, line.itemName, line.unitPrice, line.quantity)
    .run();
}

function orderTotal(lines: readonly OrderLine[]): number {
  return lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    loyaltyTier: row.loyalty_tier,
    createdAt: row.created_at,
  };
}

function rowToRestaurantTable(row: RestaurantTableRow): RestaurantTable {
  return {
    tableId: row.table_id,
    name: row.name,
    section: row.section,
    seats: row.seats,
    active: row.active === 1,
  };
}

function rowToPayment(row: PaymentRow): Payment {
  return {
    paymentId: row.payment_id,
    orderId: row.order_id,
    amount: row.amount,
    tip: row.tip,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
  };
}

function rowToShift(row: ShiftRow): Shift {
  return {
    shiftId: row.shift_id,
    userId: row.user_id,
    station: row.station,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

function rowToReservation(row: ReservationRow): Reservation {
  return {
    reservationId: row.reservation_id,
    customerId: row.customer_id,
    tableId: row.table_id,
    orderId: row.order_id,
    partySize: row.party_size,
    status: row.status,
    reservedAt: row.reserved_at,
  };
}

function rowToOrder(
  row: OrderRow,
  customer: Customer,
  table: RestaurantTable | null,
  payment: Payment | null,
  lines: OrderLine[],
): Order {
  return {
    orderId: row.order_id,
    tableName: row.table_name,
    tableId: row.table_id,
    table,
    customerId: row.customer_id,
    customer,
    assignedUserId: row.assigned_user_id,
    serviceType: row.service_type,
    partySize: row.party_size,
    status: row.status,
    lines,
    payment,
    total: orderTotal(lines),
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

function rowToOrderLine(row: OrderLineRow): OrderLine {
  return {
    lineId: row.line_id,
    orderId: row.order_id,
    menuId: row.menu_id,
    itemId: row.item_id,
    itemName: row.item_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
  };
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

function copyCustomer(customer: Customer): Customer {
  return { ...customer };
}

function copyOrder(order: Order): Order {
  return {
    ...order,
    customer: copyCustomer(order.customer),
    table: order.table ? { ...order.table } : null,
    payment: order.payment ? { ...order.payment } : null,
    lines: order.lines.map((line) => ({ ...line })),
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

function validateOrderLocation(
  serviceType: OrderServiceType,
  table: RestaurantTable | undefined,
  partySize: number,
): void {
  if (serviceType === "dine-in" && !table)
    throw new Error("Dine-in orders require an active restaurant table.");
  if (serviceType !== "dine-in" && table)
    throw new Error("Takeout and delivery orders cannot be assigned a table.");
  if (!Number.isInteger(partySize) || partySize < 1)
    throw new Error("Order party size must be a positive integer.");
  if (table && !table.active)
    throw new Error(`Restaurant table "${table.tableId}" is inactive.`);
  if (table && partySize > table.seats)
    throw new Error(
      `Party of ${partySize} exceeds ${table.name}'s ${table.seats}-seat capacity.`,
    );
}

function validateOrderStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
): void {
  const allowed: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
    open: ["open", "preparing", "cancelled"],
    preparing: ["preparing", "served", "cancelled"],
    served: ["served"],
    cancelled: ["cancelled"],
  };
  if (!allowed[current].includes(next))
    throw new Error(`Order status cannot move from "${current}" to "${next}".`);
}

function sameText(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}
