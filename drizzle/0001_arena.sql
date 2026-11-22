CREATE TABLE IF NOT EXISTS arena_rooms (
  code TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS arena_rooms_expires ON arena_rooms (expires_at);

CREATE TABLE IF NOT EXISTS arena_relay (
  room TEXT NOT NULL REFERENCES arena_rooms(code) ON DELETE CASCADE,
  match INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  at INTEGER NOT NULL,
  packet TEXT NOT NULL,
  PRIMARY KEY (room, match, slot)
);
