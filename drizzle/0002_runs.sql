CREATE TABLE IF NOT EXISTS run_rooms (
  code TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS run_rooms_expires ON run_rooms (expires_at);

CREATE TABLE IF NOT EXISTS run_ghosts (
  room TEXT NOT NULL REFERENCES run_rooms(code) ON DELETE CASCADE,
  match INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  at INTEGER NOT NULL,
  packet TEXT NOT NULL,
  PRIMARY KEY (room, match, slot)
);
