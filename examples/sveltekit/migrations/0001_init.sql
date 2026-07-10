CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menus (
  menu_id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS menu_items (
  item_id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  price REAL NOT NULL,
  tags_json TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(menu_id) ON DELETE CASCADE,
  UNIQUE (menu_id, name)
);

INSERT OR IGNORE INTO users (user_id, name, role, created_at) VALUES
  ('user_1', 'Maya Chen', 'owner', '2026-01-01T10:00:00.000Z'),
  ('user_2', 'Owen Patel', 'chef', '2026-01-02T10:00:00.000Z'),
  ('user_3', 'Avery Stone', 'manager', '2026-01-03T10:00:00.000Z');

INSERT OR IGNORE INTO menus (menu_id, name, description, owner_user_id, created_at) VALUES
  ('menu_1', 'Dinner Menu', 'Core evening menu with best sellers.', 'user_1', '2026-01-04T10:00:00.000Z'),
  ('menu_2', 'Brunch Menu', 'Weekend brunch specials.', 'user_2', '2026-01-05T10:00:00.000Z'),
  ('menu_3', 'Drinks Menu', 'Coffee, tea, mocktails, and fresh juices.', 'user_3', '2026-01-06T10:00:00.000Z');

INSERT OR IGNORE INTO menu_items (item_id, menu_id, name, price, tags_json) VALUES
  ('item_1', 'menu_1', 'Smash Burger', 14, '["beef","popular"]'),
  ('item_2', 'menu_1', 'Truffle Fries', 8, '["vegetarian","shareable"]'),
  ('item_3', 'menu_1', 'Caesar Salad', 11, '["salad"]'),
  ('item_4', 'menu_1', 'Roasted Salmon', 22, '["seafood"]'),
  ('item_5', 'menu_2', 'Avocado Toast', 13, '["vegetarian"]'),
  ('item_6', 'menu_2', 'Blueberry Pancakes', 12, '["sweet"]'),
  ('item_7', 'menu_2', 'Breakfast Tacos', 14, '["eggs","spicy"]'),
  ('item_8', 'menu_2', 'Granola Bowl', 10, '["vegetarian"]'),
  ('item_9', 'menu_3', 'Cold Brew', 5, '["coffee"]'),
  ('item_10', 'menu_3', 'Ginger Lemonade', 6, '["mocktail"]'),
  ('item_11', 'menu_3', 'Mint Iced Tea', 5, '["tea"]'),
  ('item_12', 'menu_3', 'Seasonal Spritz', 8, '["mocktail","seasonal"]');
