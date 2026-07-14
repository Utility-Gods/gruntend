PRAGMA foreign_keys = OFF;

CREATE TABLE order_lines_next (
  line_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

INSERT INTO order_lines_next (
  line_id,
  order_id,
  menu_id,
  item_id,
  item_name,
  unit_price,
  quantity
)
SELECT
  line_id,
  order_id,
  menu_id,
  item_id,
  item_name,
  unit_price,
  quantity
FROM order_lines;

DROP TABLE order_lines;
ALTER TABLE order_lines_next RENAME TO order_lines;

CREATE INDEX order_lines_order_id_idx ON order_lines(order_id);
CREATE INDEX order_lines_item_id_idx ON order_lines(item_id);

PRAGMA foreign_keys = ON;
