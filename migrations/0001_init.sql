-- D1 migration: 初始化预定表
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_ts TEXT NOT NULL, -- ISO-8601 UTC, e.g. 2026-01-10T04:00:00.000Z
  end_ts TEXT NOT NULL,   -- ISO-8601 UTC
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_start_ts ON reservations(start_ts);
CREATE INDEX IF NOT EXISTS idx_reservations_end_ts ON reservations(end_ts);

