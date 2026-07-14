PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  table_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL CHECK (section IN ('dining-room', 'patio', 'bar')),
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 20),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

INSERT OR IGNORE INTO restaurant_tables (table_id, name, section, seats, active) VALUES
  ('table_1', 'Table 1', 'dining-room', 4, 1),
  ('table_2', 'Table 2', 'dining-room', 2, 1),
  ('table_3', 'Table 3', 'dining-room', 4, 1),
  ('table_4', 'Table 4', 'dining-room', 2, 1),
  ('table_5', 'Table 5', 'dining-room', 4, 1),
  ('table_6', 'Table 6', 'dining-room', 6, 1),
  ('table_7', 'Table 7', 'dining-room', 4, 1),
  ('table_8', 'Table 8', 'dining-room', 6, 1),
  ('table_9', 'Patio 1', 'patio', 4, 1),
  ('table_10', 'Patio 2', 'patio', 4, 1),
  ('table_11', 'Patio 4', 'patio', 6, 1),
  ('table_12', 'Patio 5', 'patio', 2, 1),
  ('table_13', 'Bar 1', 'bar', 2, 1),
  ('table_14', 'Bar 3', 'bar', 2, 1);

ALTER TABLE orders ADD COLUMN table_id TEXT REFERENCES restaurant_tables(table_id);
ALTER TABLE orders ADD COLUMN closed_at TEXT;

UPDATE orders SET table_id = CASE table_name
  WHEN 'Table 1' THEN 'table_1'
  WHEN 'Table 2' THEN 'table_2'
  WHEN 'Table 3' THEN 'table_3'
  WHEN 'Table 4' THEN 'table_4'
  WHEN 'Table 5' THEN 'table_5'
  WHEN 'Table 6' THEN 'table_6'
  WHEN 'Table 7' THEN 'table_7'
  WHEN 'Table 8' THEN 'table_8'
  WHEN 'Patio 1' THEN 'table_9'
  WHEN 'Patio 2' THEN 'table_10'
  WHEN 'Patio 4' THEN 'table_11'
  WHEN 'Patio 5' THEN 'table_12'
  WHEN 'Bar 1' THEN 'table_13'
  WHEN 'Bar 3' THEN 'table_14'
END
WHERE service_type = 'dine-in';

UPDATE orders SET table_name = 'Pickup 003' WHERE order_id = 'order_3';
UPDATE orders SET table_name = 'Delivery 005' WHERE order_id = 'order_5';
UPDATE orders SET table_name = 'Pickup 006' WHERE order_id = 'order_6';
UPDATE orders SET table_name = 'Pickup 009' WHERE order_id = 'order_9';
UPDATE orders SET table_name = 'Delivery 010' WHERE order_id = 'order_10';
UPDATE orders SET table_name = 'Pickup 012' WHERE order_id = 'order_12';

-- Restore mutable showcase records to their canonical seed state before adding lifecycle constraints.
UPDATE orders SET status = 'preparing' WHERE order_id = 'order_13';
UPDATE orders SET status = 'open' WHERE order_id = 'order_14';

UPDATE orders SET closed_at = CASE order_id
  WHEN 'order_1' THEN '2026-07-07T19:05:00.000Z'
  WHEN 'order_2' THEN '2026-07-07T21:02:00.000Z'
  WHEN 'order_3' THEN '2026-07-08T12:42:00.000Z'
  WHEN 'order_4' THEN '2026-07-08T19:48:00.000Z'
  WHEN 'order_5' THEN '2026-07-09T18:49:00.000Z'
  WHEN 'order_6' THEN '2026-07-09T21:10:00.000Z'
  WHEN 'order_7' THEN '2026-07-10T12:12:00.000Z'
  WHEN 'order_8' THEN '2026-07-10T20:18:00.000Z'
  WHEN 'order_9' THEN '2026-07-11T13:20:00.000Z'
  WHEN 'order_10' THEN '2026-07-11T21:17:00.000Z'
  WHEN 'order_11' THEN '2026-07-12T13:44:00.000Z'
  WHEN 'order_12' THEN '2026-07-12T20:38:00.000Z'
END
WHERE status IN ('served', 'cancelled');

INSERT OR IGNORE INTO users (user_id, name, role, created_at) VALUES
  ('user_4', 'Jamie Reed', 'server', '2026-01-07T10:00:00.000Z'),
  ('user_5', 'Morgan Lee', 'server', '2026-01-08T10:00:00.000Z'),
  ('user_6', 'Taylor Brooks', 'host', '2026-01-09T10:00:00.000Z');

UPDATE orders SET assigned_user_id = CASE
  WHEN CAST(substr(order_id, 7) AS INTEGER) % 3 = 1 THEN 'user_4'
  WHEN CAST(substr(order_id, 7) AS INTEGER) % 3 = 2 THEN 'user_5'
  ELSE 'user_3'
END;

ALTER TABLE customers ADD COLUMN email TEXT;
UPDATE customers SET email = CASE customer_id
  WHEN 'customer_1' THEN 'lena.ortiz@example.com'
  WHEN 'customer_2' THEN 'noah.williams@example.com'
  WHEN 'customer_3' THEN 'priya.shah@example.com'
  WHEN 'customer_4' THEN 'eli.brooks@example.com'
  WHEN 'customer_5' THEN 'sofia.kim@example.com'
END;
UPDATE customers SET loyalty_tier = CASE customer_id
  WHEN 'customer_1' THEN 'gold'
  WHEN 'customer_2' THEN 'silver'
  WHEN 'customer_3' THEN 'silver'
  WHEN 'customer_4' THEN 'standard'
  WHEN 'customer_5' THEN 'silver'
END;

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_idx ON customers(email);

CREATE TRIGGER customers_email_insert
BEFORE INSERT ON customers
WHEN NEW.email IS NULL OR trim(NEW.email) = ''
BEGIN
  SELECT RAISE(ABORT, 'Customers require an email address.');
END;

CREATE TRIGGER customers_email_update
BEFORE UPDATE OF email ON customers
WHEN NEW.email IS NULL OR trim(NEW.email) = ''
BEGIN
  SELECT RAISE(ABORT, 'Customers require an email address.');
END;

CREATE INDEX IF NOT EXISTS orders_table_id_idx ON orders(table_id);
CREATE INDEX IF NOT EXISTS orders_assigned_user_id_idx ON orders(assigned_user_id);

CREATE TRIGGER orders_service_table_insert
BEFORE INSERT ON orders
WHEN (NEW.service_type = 'dine-in' AND NEW.table_id IS NULL)
  OR (NEW.service_type <> 'dine-in' AND NEW.table_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Dine-in orders require a table; off-premise orders cannot have one.');
END;

CREATE TRIGGER orders_service_table_update
BEFORE UPDATE OF service_type, table_id ON orders
WHEN (NEW.service_type = 'dine-in' AND NEW.table_id IS NULL)
  OR (NEW.service_type <> 'dine-in' AND NEW.table_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Dine-in orders require a table; off-premise orders cannot have one.');
END;

CREATE TRIGGER orders_closed_at_insert
BEFORE INSERT ON orders
WHEN (NEW.status IN ('served', 'cancelled') AND NEW.closed_at IS NULL)
  OR (NEW.status IN ('open', 'preparing') AND NEW.closed_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Order status and closed_at are inconsistent.');
END;

CREATE TRIGGER orders_closed_at_update
BEFORE UPDATE OF status, closed_at ON orders
WHEN (NEW.status IN ('served', 'cancelled') AND NEW.closed_at IS NULL)
  OR (NEW.status IN ('open', 'preparing') AND NEW.closed_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Order status and closed_at are inconsistent.');
END;

CREATE TRIGGER orders_status_transition
BEFORE UPDATE OF status ON orders
WHEN NOT (
  OLD.status = NEW.status
  OR (OLD.status = 'open' AND NEW.status IN ('preparing', 'cancelled'))
  OR (OLD.status = 'preparing' AND NEW.status IN ('served', 'cancelled'))
)
BEGIN
  SELECT RAISE(ABORT, 'Invalid order status transition.');
END;

CREATE TRIGGER orders_assigned_staff_insert
BEFORE INSERT ON orders
WHEN (SELECT role FROM users WHERE user_id = NEW.assigned_user_id) NOT IN ('owner', 'manager', 'server')
BEGIN
  SELECT RAISE(ABORT, 'Orders must be assigned to floor staff.');
END;

CREATE TRIGGER orders_assigned_staff_update
BEFORE UPDATE OF assigned_user_id ON orders
WHEN (SELECT role FROM users WHERE user_id = NEW.assigned_user_id) NOT IN ('owner', 'manager', 'server')
BEGIN
  SELECT RAISE(ABORT, 'Orders must be assigned to floor staff.');
END;

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL CHECK (amount >= 0),
  tip REAL NOT NULL DEFAULT 0 CHECK (tip >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'gift-card')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'voided')),
  paid_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CHECK (
    (status = 'paid' AND amount > 0 AND paid_at IS NOT NULL)
    OR (status <> 'paid')
  )
);

INSERT OR IGNORE INTO payments (payment_id, order_id, amount, tip, method, status, paid_at) VALUES
  ('payment_1', 'order_1', 36, 7, 'card', 'paid', '2026-07-07T19:05:00.000Z'),
  ('payment_2', 'order_2', 34, 6, 'card', 'paid', '2026-07-07T21:02:00.000Z'),
  ('payment_3', 'order_3', 23, 0, 'cash', 'paid', '2026-07-08T12:42:00.000Z'),
  ('payment_5', 'order_5', 32, 5, 'card', 'paid', '2026-07-09T18:49:00.000Z'),
  ('payment_6', 'order_6', 60, 0, 'gift-card', 'paid', '2026-07-09T21:10:00.000Z'),
  ('payment_7', 'order_7', 34, 7, 'card', 'paid', '2026-07-10T12:12:00.000Z'),
  ('payment_8', 'order_8', 70, 14, 'card', 'paid', '2026-07-10T20:18:00.000Z'),
  ('payment_9', 'order_9', 46, 0, 'cash', 'paid', '2026-07-11T13:20:00.000Z'),
  ('payment_10', 'order_10', 74, 12, 'card', 'paid', '2026-07-11T21:17:00.000Z'),
  ('payment_11', 'order_11', 40, 8, 'card', 'paid', '2026-07-12T13:44:00.000Z'),
  ('payment_12', 'order_12', 49, 9, 'card', 'paid', '2026-07-12T20:38:00.000Z');

CREATE TABLE IF NOT EXISTS shifts (
  shift_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  station TEXT NOT NULL CHECK (station IN ('floor', 'bar', 'kitchen', 'host', 'management')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  CHECK (ends_at > starts_at),
  UNIQUE (user_id, starts_at)
);

INSERT OR IGNORE INTO shifts (shift_id, user_id, station, starts_at, ends_at) VALUES
  ('shift_1', 'user_4', 'floor', '2026-07-07T16:00:00.000Z', '2026-07-08T00:00:00.000Z'),
  ('shift_2', 'user_5', 'floor', '2026-07-07T16:00:00.000Z', '2026-07-08T00:00:00.000Z'),
  ('shift_3', 'user_3', 'management', '2026-07-08T10:00:00.000Z', '2026-07-08T22:00:00.000Z'),
  ('shift_4', 'user_4', 'floor', '2026-07-08T16:00:00.000Z', '2026-07-09T00:00:00.000Z'),
  ('shift_5', 'user_5', 'floor', '2026-07-09T16:00:00.000Z', '2026-07-10T00:00:00.000Z'),
  ('shift_6', 'user_3', 'management', '2026-07-09T16:00:00.000Z', '2026-07-10T00:00:00.000Z'),
  ('shift_7', 'user_4', 'floor', '2026-07-10T10:00:00.000Z', '2026-07-10T22:00:00.000Z'),
  ('shift_8', 'user_5', 'floor', '2026-07-10T16:00:00.000Z', '2026-07-11T00:00:00.000Z'),
  ('shift_9', 'user_3', 'management', '2026-07-11T10:00:00.000Z', '2026-07-11T22:00:00.000Z'),
  ('shift_10', 'user_4', 'floor', '2026-07-11T16:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shift_11', 'user_5', 'floor', '2026-07-12T10:00:00.000Z', '2026-07-12T22:00:00.000Z'),
  ('shift_12', 'user_3', 'management', '2026-07-12T10:00:00.000Z', '2026-07-12T22:00:00.000Z'),
  ('shift_13', 'user_4', 'floor', '2026-07-13T16:00:00.000Z', '2026-07-14T00:00:00.000Z'),
  ('shift_14', 'user_5', 'floor', '2026-07-13T16:00:00.000Z', '2026-07-14T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  order_id TEXT UNIQUE,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL CHECK (status IN ('booked', 'seated', 'completed', 'cancelled', 'no-show')),
  reserved_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(table_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

INSERT OR IGNORE INTO reservations (reservation_id, customer_id, table_id, order_id, party_size, status, reserved_at) VALUES
  ('reservation_1', 'customer_1', 'table_4', 'order_1', 2, 'completed', '2026-07-07T18:00:00.000Z'),
  ('reservation_2', 'customer_2', 'table_10', 'order_2', 3, 'completed', '2026-07-07T20:00:00.000Z'),
  ('reservation_3', 'customer_3', 'table_6', 'order_8', 1, 'completed', '2026-07-10T19:00:00.000Z'),
  ('reservation_4', 'customer_3', 'table_11', 'order_13', 2, 'seated', '2026-07-13T19:15:00.000Z'),
  ('reservation_5', 'customer_5', 'table_3', NULL, 4, 'no-show', '2026-07-12T18:30:00.000Z'),
  ('reservation_6', 'customer_2', 'table_7', NULL, 4, 'booked', '2026-07-15T19:00:00.000Z');

CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS shifts_user_id_idx ON shifts(user_id);
CREATE INDEX IF NOT EXISTS shifts_starts_at_idx ON shifts(starts_at);
CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS reservations_reserved_at_idx ON reservations(reserved_at);
