PRAGMA foreign_keys = ON;

-- Visit counts are derived from orders. Keeping a mutable aggregate would let it drift.
ALTER TABLE customers DROP COLUMN visits;

-- The original sample party exceeded the capacity of Bar 3.
UPDATE orders SET party_size = 2 WHERE order_id = 'order_11';

CREATE TRIGGER orders_table_capacity_insert
BEFORE INSERT ON orders
WHEN NEW.table_id IS NOT NULL
  AND NEW.party_size > (SELECT seats FROM restaurant_tables WHERE table_id = NEW.table_id)
BEGIN
  SELECT RAISE(ABORT, 'Order party exceeds table capacity.');
END;

CREATE TRIGGER orders_table_capacity_update
BEFORE UPDATE OF table_id, party_size ON orders
WHEN NEW.table_id IS NOT NULL
  AND NEW.party_size > (SELECT seats FROM restaurant_tables WHERE table_id = NEW.table_id)
BEGIN
  SELECT RAISE(ABORT, 'Order party exceeds table capacity.');
END;

CREATE TRIGGER payments_amount_insert
BEFORE INSERT ON payments
WHEN NEW.status = 'paid'
  AND abs(
    NEW.amount - (
      SELECT coalesce(sum(unit_price * quantity), 0)
      FROM order_lines
      WHERE order_id = NEW.order_id
    )
  ) > 0.005
BEGIN
  SELECT RAISE(ABORT, 'Paid amount must equal the order-line total.');
END;

CREATE TRIGGER payments_amount_update
BEFORE UPDATE OF order_id, amount, status ON payments
WHEN NEW.status = 'paid'
  AND abs(
    NEW.amount - (
      SELECT coalesce(sum(unit_price * quantity), 0)
      FROM order_lines
      WHERE order_id = NEW.order_id
    )
  ) > 0.005
BEGIN
  SELECT RAISE(ABORT, 'Paid amount must equal the order-line total.');
END;

CREATE TRIGGER reservations_capacity_insert
BEFORE INSERT ON reservations
WHEN NEW.party_size > (SELECT seats FROM restaurant_tables WHERE table_id = NEW.table_id)
BEGIN
  SELECT RAISE(ABORT, 'Reservation party exceeds table capacity.');
END;

CREATE TRIGGER reservations_capacity_update
BEFORE UPDATE OF table_id, party_size ON reservations
WHEN NEW.party_size > (SELECT seats FROM restaurant_tables WHERE table_id = NEW.table_id)
BEGIN
  SELECT RAISE(ABORT, 'Reservation party exceeds table capacity.');
END;

CREATE TRIGGER reservations_order_relationship_insert
BEFORE INSERT ON reservations
WHEN NEW.order_id IS NOT NULL AND EXISTS (
  SELECT 1
  FROM orders
  WHERE order_id = NEW.order_id
    AND (
      customer_id <> NEW.customer_id
      OR table_id <> NEW.table_id
      OR party_size <> NEW.party_size
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Linked reservation and order relationships do not match.');
END;

CREATE TRIGGER reservations_order_relationship_update
BEFORE UPDATE OF customer_id, table_id, order_id, party_size ON reservations
WHEN NEW.order_id IS NOT NULL AND EXISTS (
  SELECT 1
  FROM orders
  WHERE order_id = NEW.order_id
    AND (
      customer_id <> NEW.customer_id
      OR table_id <> NEW.table_id
      OR party_size <> NEW.party_size
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Linked reservation and order relationships do not match.');
END;
