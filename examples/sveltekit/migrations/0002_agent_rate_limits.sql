CREATE TABLE IF NOT EXISTS agent_rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
