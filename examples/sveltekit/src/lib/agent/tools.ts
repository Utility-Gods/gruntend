import { defineTools } from "gruntend-sdk/tool";
import * as v from "valibot";

const roleSchema = v.picklist(["owner", "chef", "manager", "server", "host"]);

const userSchema = v.object({
  userId: v.string(),
  name: v.string(),
  role: roleSchema,
  createdAt: v.string(),
});

const menuSchema = v.object({
  menuId: v.string(),
  name: v.string(),
  description: v.string(),
  ownerUserId: v.string(),
  createdAt: v.string(),
});

const menuItemSchema = v.object({
  itemId: v.string(),
  menuId: v.string(),
  name: v.string(),
  price: v.number(),
  tags: v.array(v.string()),
});

const customerSchema = v.object({
  customerId: v.string(),
  name: v.string(),
  email: v.string(),
  loyaltyTier: v.picklist(["standard", "silver", "gold"]),
  createdAt: v.string(),
});

const restaurantTableSchema = v.object({
  tableId: v.string(),
  name: v.string(),
  section: v.picklist(["dining-room", "patio", "bar"]),
  seats: v.number(),
  active: v.boolean(),
});

const paymentSchema = v.object({
  paymentId: v.string(),
  orderId: v.string(),
  amount: v.number(),
  tip: v.number(),
  method: v.picklist(["cash", "card", "gift-card"]),
  status: v.picklist(["pending", "paid", "refunded", "voided"]),
  paidAt: v.nullable(v.string()),
});

const shiftSchema = v.object({
  shiftId: v.string(),
  userId: v.string(),
  station: v.picklist(["floor", "bar", "kitchen", "host", "management"]),
  startsAt: v.string(),
  endsAt: v.string(),
});

const reservationSchema = v.object({
  reservationId: v.string(),
  customerId: v.string(),
  tableId: v.string(),
  orderId: v.nullable(v.string()),
  partySize: v.number(),
  status: v.picklist(["booked", "seated", "completed", "cancelled", "no-show"]),
  reservedAt: v.string(),
});

const orderLineSchema = v.object({
  lineId: v.string(),
  orderId: v.string(),
  menuId: v.string(),
  itemId: v.string(),
  itemName: v.string(),
  unitPrice: v.number(),
  quantity: v.number(),
});

const orderSchema = v.object({
  orderId: v.string(),
  tableName: v.string(),
  tableId: v.nullable(v.string()),
  table: v.nullable(restaurantTableSchema),
  customerId: v.string(),
  customer: customerSchema,
  assignedUserId: v.string(),
  serviceType: v.picklist(["dine-in", "takeout", "delivery"]),
  partySize: v.number(),
  status: v.picklist(["open", "preparing", "served", "cancelled"]),
  lines: v.array(orderLineSchema),
  payment: v.nullable(paymentSchema),
  total: v.number(),
  createdAt: v.string(),
  closedAt: v.nullable(v.string()),
});

const roleModel = { enum: ["owner", "chef", "manager", "server", "host"] };
const userModel = {
  type: "object",
  properties: {
    userId: { type: "string" },
    name: { type: "string" },
    role: roleModel,
    createdAt: { type: "string" },
  },
  required: ["userId", "name", "role", "createdAt"],
};
const menuModel = {
  type: "object",
  properties: {
    menuId: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    ownerUserId: { type: "string" },
    createdAt: { type: "string" },
  },
  required: ["menuId", "name", "description", "ownerUserId", "createdAt"],
};
const menuItemModel = {
  type: "object",
  properties: {
    itemId: { type: "string" },
    menuId: { type: "string" },
    name: { type: "string" },
    price: { type: "number" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["itemId", "menuId", "name", "price", "tags"],
};
const customerModel = {
  type: "object",
  properties: {
    customerId: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    loyaltyTier: { enum: ["standard", "silver", "gold"] },
    createdAt: { type: "string" },
  },
  required: ["customerId", "name", "email", "loyaltyTier", "createdAt"],
};
const restaurantTableModel = {
  type: "object",
  properties: {
    tableId: { type: "string" },
    name: { type: "string" },
    section: { enum: ["dining-room", "patio", "bar"] },
    seats: { type: "number" },
    active: { type: "boolean" },
  },
  required: ["tableId", "name", "section", "seats", "active"],
};
const paymentModel = {
  type: "object",
  properties: {
    paymentId: { type: "string" },
    orderId: { type: "string" },
    amount: { type: "number" },
    tip: { type: "number" },
    method: { enum: ["cash", "card", "gift-card"] },
    status: { enum: ["pending", "paid", "refunded", "voided"] },
    paidAt: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "paymentId",
    "orderId",
    "amount",
    "tip",
    "method",
    "status",
    "paidAt",
  ],
};
const shiftModel = {
  type: "object",
  properties: {
    shiftId: { type: "string" },
    userId: { type: "string" },
    station: { enum: ["floor", "bar", "kitchen", "host", "management"] },
    startsAt: { type: "string" },
    endsAt: { type: "string" },
  },
  required: ["shiftId", "userId", "station", "startsAt", "endsAt"],
};
const reservationModel = {
  type: "object",
  properties: {
    reservationId: { type: "string" },
    customerId: { type: "string" },
    tableId: { type: "string" },
    orderId: { anyOf: [{ type: "string" }, { type: "null" }] },
    partySize: { type: "number" },
    status: { enum: ["booked", "seated", "completed", "cancelled", "no-show"] },
    reservedAt: { type: "string" },
  },
  required: [
    "reservationId",
    "customerId",
    "tableId",
    "orderId",
    "partySize",
    "status",
    "reservedAt",
  ],
};
const orderLineModel = {
  type: "object",
  properties: {
    lineId: { type: "string" },
    orderId: { type: "string" },
    menuId: { type: "string" },
    itemId: { type: "string" },
    itemName: { type: "string" },
    unitPrice: { type: "number" },
    quantity: { type: "number" },
  },
  required: [
    "lineId",
    "orderId",
    "menuId",
    "itemId",
    "itemName",
    "unitPrice",
    "quantity",
  ],
};
const orderModel = {
  type: "object",
  properties: {
    orderId: { type: "string" },
    tableName: { type: "string" },
    tableId: { anyOf: [{ type: "string" }, { type: "null" }] },
    table: { anyOf: [restaurantTableModel, { type: "null" }] },
    customerId: { type: "string" },
    customer: customerModel,
    assignedUserId: { type: "string" },
    serviceType: { enum: ["dine-in", "takeout", "delivery"] },
    partySize: { type: "number" },
    status: { enum: ["open", "preparing", "served", "cancelled"] },
    lines: { type: "array", items: orderLineModel },
    payment: { anyOf: [paymentModel, { type: "null" }] },
    total: { type: "number" },
    createdAt: { type: "string" },
    closedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "orderId",
    "tableName",
    "tableId",
    "table",
    "customerId",
    "customer",
    "assignedUserId",
    "serviceType",
    "partySize",
    "status",
    "lines",
    "payment",
    "total",
    "createdAt",
    "closedAt",
  ],
};
const emptyParameters = { type: "object", properties: {}, required: [] };

export const appTools = defineTools({
  menus: {
    list: {
      description: "List all restaurant menus.",
      input: v.object({}),
      output: v.object({ menus: v.array(menuSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { menus: { type: "array", items: menuModel } },
        required: ["menus"],
      },
    },
    get: {
      description: "Get one restaurant menu by id.",
      input: v.object({ menuId: v.string() }),
      output: v.object({ menu: menuSchema }),
      parameters: {
        type: "object",
        properties: { menuId: { type: "string" } },
        required: ["menuId"],
      },
      returns: {
        type: "object",
        properties: { menu: menuModel },
        required: ["menu"],
      },
    },
    create: {
      description: "Find or create a restaurant menu by name.",
      input: v.object({
        name: v.string(),
        description: v.optional(v.string()),
        ownerUserId: v.optional(v.string()),
      }),
      output: v.object({ menu: menuSchema }),
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          ownerUserId: { type: "string" },
        },
        required: ["name"],
      },
      returns: {
        type: "object",
        properties: { menu: menuModel },
        required: ["menu"],
      },
    },
  },
  menu: {
    items: {
      list: {
        description: "List items for a menu.",
        input: v.object({ menuId: v.string() }),
        output: v.object({ items: v.array(menuItemSchema) }),
        parameters: {
          type: "object",
          properties: { menuId: { type: "string" } },
          required: ["menuId"],
        },
        returns: {
          type: "object",
          properties: { items: { type: "array", items: menuItemModel } },
          required: ["items"],
        },
      },
    },
    item: {
      create: {
        description: "Create one item in a menu.",
        input: v.object({
          menuId: v.string(),
          name: v.string(),
          price: v.number(),
          tags: v.optional(v.array(v.string())),
        }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["menuId", "name", "price"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      duplicate: {
        description: "Duplicate one menu item.",
        input: v.object({ menuId: v.string(), itemId: v.string() }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      update: {
        description:
          "Update one menu item. Use this to change item name, price, tags, or to apply percentage price changes.",
        input: v.object({
          menuId: v.string(),
          itemId: v.string(),
          name: v.optional(v.string()),
          price: v.optional(v.number()),
          tags: v.optional(v.array(v.string())),
        }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
      delete: {
        description: "Delete one menu item.",
        input: v.object({ menuId: v.string(), itemId: v.string() }),
        output: v.object({ item: menuItemSchema }),
        parameters: {
          type: "object",
          properties: {
            menuId: { type: "string" },
            itemId: { type: "string" },
          },
          required: ["menuId", "itemId"],
        },
        returns: {
          type: "object",
          properties: { item: menuItemModel },
          required: ["item"],
        },
      },
    },
  },
  customers: {
    list: {
      description: "List restaurant customers and loyalty details.",
      input: v.object({}),
      output: v.object({ customers: v.array(customerSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { customers: { type: "array", items: customerModel } },
        required: ["customers"],
      },
    },
  },
  orders: {
    list: {
      description:
        "List orders with customer, service, status, item, quantity, price, staff, and timestamp details.",
      input: v.object({}),
      output: v.object({ orders: v.array(orderSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { orders: { type: "array", items: orderModel } },
        required: ["orders"],
      },
    },
    create: {
      description: "Create an order for a customer from existing menu items.",
      input: v.object({
        tableName: v.string(),
        tableId: v.optional(v.string()),
        customerId: v.string(),
        assignedUserId: v.string(),
        serviceType: v.picklist(["dine-in", "takeout", "delivery"]),
        partySize: v.pipe(v.number(), v.integer(), v.minValue(1)),
        items: v.pipe(
          v.array(
            v.object({
              menuId: v.string(),
              itemId: v.string(),
              quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
            }),
          ),
          v.minLength(1),
        ),
      }),
      output: v.object({ order: orderSchema }),
      parameters: {
        type: "object",
        properties: {
          tableName: { type: "string" },
          tableId: { type: "string" },
          customerId: { type: "string" },
          assignedUserId: { type: "string" },
          serviceType: { enum: ["dine-in", "takeout", "delivery"] },
          partySize: { type: "integer", minimum: 1 },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                menuId: { type: "string" },
                itemId: { type: "string" },
                quantity: { type: "integer", minimum: 1 },
              },
              required: ["menuId", "itemId", "quantity"],
            },
          },
        },
        required: [
          "tableName",
          "customerId",
          "assignedUserId",
          "serviceType",
          "partySize",
          "items",
        ],
      },
      returns: {
        type: "object",
        properties: { order: orderModel },
        required: ["order"],
      },
    },
    status: {
      update: {
        description: "Update an order status.",
        input: v.object({
          orderId: v.string(),
          status: v.picklist(["open", "preparing", "served", "cancelled"]),
        }),
        output: v.object({ order: orderSchema }),
        parameters: {
          type: "object",
          properties: {
            orderId: { type: "string" },
            status: { enum: ["open", "preparing", "served", "cancelled"] },
          },
          required: ["orderId", "status"],
        },
        returns: {
          type: "object",
          properties: { order: orderModel },
          required: ["order"],
        },
      },
    },
  },
  tables: {
    list: {
      description:
        "List physical restaurant tables, sections, capacities, and availability configuration.",
      input: v.object({}),
      output: v.object({ tables: v.array(restaurantTableSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { tables: { type: "array", items: restaurantTableModel } },
        required: ["tables"],
      },
    },
  },
  payments: {
    list: {
      description:
        "List order payments, tips, methods, and settlement statuses.",
      input: v.object({}),
      output: v.object({ payments: v.array(paymentSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { payments: { type: "array", items: paymentModel } },
        required: ["payments"],
      },
    },
  },
  shifts: {
    list: {
      description: "List staff shifts with stations and start/end times.",
      input: v.object({}),
      output: v.object({ shifts: v.array(shiftSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { shifts: { type: "array", items: shiftModel } },
        required: ["shifts"],
      },
    },
  },
  reservations: {
    list: {
      description:
        "List reservations with customers, tables, parties, statuses, times, and linked orders.",
      input: v.object({}),
      output: v.object({ reservations: v.array(reservationSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: {
          reservations: { type: "array", items: reservationModel },
        },
        required: ["reservations"],
      },
    },
  },
  users: {
    list: {
      description: "List restaurant team users.",
      input: v.object({}),
      output: v.object({ users: v.array(userSchema) }),
      parameters: emptyParameters,
      returns: {
        type: "object",
        properties: { users: { type: "array", items: userModel } },
        required: ["users"],
      },
    },
    create: {
      description: "Find or create a restaurant team user.",
      input: v.object({
        name: v.string(),
        role: roleSchema,
      }),
      output: v.object({ user: userSchema }),
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: roleModel,
        },
        required: ["name", "role"],
      },
      returns: {
        type: "object",
        properties: { user: userModel },
        required: ["user"],
      },
    },
  },
});
