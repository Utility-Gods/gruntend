PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  loyalty_tier TEXT NOT NULL CHECK (loyalty_tier IN ('standard', 'silver', 'gold')),
  visits INTEGER NOT NULL CHECK (visits >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  assigned_user_id TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('dine-in', 'takeout', 'delivery')),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'preparing', 'served', 'cancelled')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (assigned_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS order_lines (
  line_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menus(menu_id),
  FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS order_lines_order_id_idx ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS order_lines_item_id_idx ON order_lines(item_id);

INSERT OR IGNORE INTO customers (customer_id, name, loyalty_tier, visits, created_at) VALUES
  ('customer_1', 'Lena Ortiz', 'gold', 28, '2025-10-12T09:00:00.000Z'),
  ('customer_2', 'Noah Williams', 'silver', 14, '2026-01-08T09:00:00.000Z'),
  ('customer_3', 'Priya Shah', 'standard', 5, '2026-04-18T09:00:00.000Z'),
  ('customer_4', 'Eli Brooks', 'gold', 34, '2025-08-03T09:00:00.000Z'),
  ('customer_5', 'Sofia Kim', 'silver', 11, '2026-02-21T09:00:00.000Z');

INSERT OR IGNORE INTO orders (order_id, table_name, customer_id, assigned_user_id, service_type, party_size, status, created_at) VALUES
  ('order_1', 'Table 4', 'customer_1', 'user_1', 'dine-in', 2, 'served', '2026-07-07T18:20:00.000Z'),
  ('order_2', 'Patio 2', 'customer_2', 'user_2', 'dine-in', 3, 'served', '2026-07-07T20:05:00.000Z'),
  ('order_3', 'Bar 1', 'customer_3', 'user_3', 'takeout', 4, 'served', '2026-07-08T12:15:00.000Z'),
  ('order_4', 'Table 7', 'customer_4', 'user_1', 'dine-in', 1, 'cancelled', '2026-07-08T19:40:00.000Z'),
  ('order_5', 'Table 3', 'customer_5', 'user_2', 'delivery', 2, 'served', '2026-07-09T18:05:00.000Z'),
  ('order_6', 'Patio 5', 'customer_1', 'user_3', 'takeout', 3, 'served', '2026-07-09T20:35:00.000Z'),
  ('order_7', 'Table 1', 'customer_2', 'user_1', 'dine-in', 4, 'served', '2026-07-10T11:30:00.000Z'),
  ('order_8', 'Table 6', 'customer_3', 'user_2', 'dine-in', 1, 'served', '2026-07-10T19:10:00.000Z'),
  ('order_9', 'Patio 1', 'customer_4', 'user_3', 'takeout', 2, 'served', '2026-07-11T12:45:00.000Z'),
  ('order_10', 'Table 8', 'customer_5', 'user_1', 'delivery', 3, 'served', '2026-07-11T20:20:00.000Z'),
  ('order_11', 'Bar 3', 'customer_1', 'user_2', 'dine-in', 4, 'served', '2026-07-12T13:05:00.000Z'),
  ('order_12', 'Table 2', 'customer_2', 'user_3', 'takeout', 1, 'served', '2026-07-12T19:55:00.000Z'),
  ('order_13', 'Patio 4', 'customer_3', 'user_1', 'dine-in', 2, 'preparing', '2026-07-13T19:25:00.000Z'),
  ('order_14', 'Table 5', 'customer_4', 'user_2', 'dine-in', 3, 'open', '2026-07-13T19:42:00.000Z');

INSERT OR IGNORE INTO order_lines (line_id, order_id, menu_id, item_id, item_name, unit_price, quantity) VALUES
  ('order_1_line_1', 'order_1', 'menu_1', 'item_1', 'Smash Burger', 14, 2),
  ('order_1_line_2', 'order_1', 'menu_1', 'item_2', 'Truffle Fries', 8, 1),
  ('order_2_line_1', 'order_2', 'menu_1', 'item_4', 'Roasted Salmon', 22, 1),
  ('order_2_line_2', 'order_2', 'menu_3', 'item_10', 'Ginger Lemonade', 6, 2),
  ('order_3_line_1', 'order_3', 'menu_3', 'item_9', 'Cold Brew', 5, 2),
  ('order_3_line_2', 'order_3', 'menu_2', 'item_5', 'Avocado Toast', 13, 1),
  ('order_4_line_1', 'order_4', 'menu_1', 'item_1', 'Smash Burger', 14, 1),
  ('order_5_line_1', 'order_5', 'menu_1', 'item_3', 'Caesar Salad', 11, 2),
  ('order_5_line_2', 'order_5', 'menu_3', 'item_11', 'Mint Iced Tea', 5, 2),
  ('order_6_line_1', 'order_6', 'menu_1', 'item_4', 'Roasted Salmon', 22, 2),
  ('order_6_line_2', 'order_6', 'menu_3', 'item_12', 'Seasonal Spritz', 8, 2),
  ('order_7_line_1', 'order_7', 'menu_2', 'item_6', 'Blueberry Pancakes', 12, 2),
  ('order_7_line_2', 'order_7', 'menu_3', 'item_9', 'Cold Brew', 5, 2),
  ('order_8_line_1', 'order_8', 'menu_1', 'item_1', 'Smash Burger', 14, 3),
  ('order_8_line_2', 'order_8', 'menu_1', 'item_2', 'Truffle Fries', 8, 2),
  ('order_8_line_3', 'order_8', 'menu_3', 'item_10', 'Ginger Lemonade', 6, 2),
  ('order_9_line_1', 'order_9', 'menu_2', 'item_5', 'Avocado Toast', 13, 2),
  ('order_9_line_2', 'order_9', 'menu_2', 'item_8', 'Granola Bowl', 10, 1),
  ('order_9_line_3', 'order_9', 'menu_3', 'item_11', 'Mint Iced Tea', 5, 2),
  ('order_10_line_1', 'order_10', 'menu_1', 'item_4', 'Roasted Salmon', 22, 1),
  ('order_10_line_2', 'order_10', 'menu_1', 'item_1', 'Smash Burger', 14, 2),
  ('order_10_line_3', 'order_10', 'menu_3', 'item_12', 'Seasonal Spritz', 8, 3),
  ('order_11_line_1', 'order_11', 'menu_2', 'item_7', 'Breakfast Tacos', 14, 2),
  ('order_11_line_2', 'order_11', 'menu_3', 'item_10', 'Ginger Lemonade', 6, 2),
  ('order_12_line_1', 'order_12', 'menu_1', 'item_1', 'Smash Burger', 14, 2),
  ('order_12_line_2', 'order_12', 'menu_1', 'item_3', 'Caesar Salad', 11, 1),
  ('order_12_line_3', 'order_12', 'menu_3', 'item_9', 'Cold Brew', 5, 2),
  ('order_13_line_1', 'order_13', 'menu_1', 'item_4', 'Roasted Salmon', 22, 1),
  ('order_13_line_2', 'order_13', 'menu_1', 'item_2', 'Truffle Fries', 8, 2),
  ('order_14_line_1', 'order_14', 'menu_1', 'item_1', 'Smash Burger', 14, 1),
  ('order_14_line_2', 'order_14', 'menu_3', 'item_10', 'Ginger Lemonade', 6, 2);
