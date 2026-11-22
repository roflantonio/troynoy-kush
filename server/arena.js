const ARENA_TTL = 3_600_000;
const ARENA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function arenaView(room, you, revision = 0) {
  return {
    code: room.code, revision, phase: room.phase, match: room.match, me: you.slot, host: 0,
    players: room.players.map(({ name, slot }) => ({ name, slot })),
    links: you.slot === 0 ? room.links : { [you.slot]: room.links[you.slot] ?? null },
  };
}

function arenaPlayer(name, slot) {
  return { name: cleanName(name), slot, token: crypto.randomUUID() };
}

async function arenaCreate(db, input, now) {
  // Occasionally trim abandoned rooms and their transient relay packets.
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 16) {
    await db.prepare("DELETE FROM arena_relay WHERE at < ?").bind(now - ARENA_TTL).run();
    await db.prepare("DELETE FROM arena_rooms WHERE expires_at < ?").bind(now).run();
  }
  const player = arenaPlayer(input.name, 0);
  for (let i = 0; i < 5; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => ARENA_ALPHABET[n % ARENA_ALPHABET.length]).join("");
    const room = { code, phase: "lobby", match: 0, players: [player], links: {} };
    const result = await db.prepare("INSERT OR IGNORE INTO arena_rooms(code, expires_at, data) VALUES(?, ?, ?)")
      .bind(code, now + ARENA_TTL, JSON.stringify(room)).run();
    if (result.meta.changes === 1) return json({ room: arenaView(room, player), token: player.token }, 201);
  }
  throw new GameError("Не удалось создать комнату. Попробуй ещё раз.", 503);
}

function arenaChange(room, player, input) {
  switch (input.action) {
    case "start":
      if (player.slot !== 0 || room.players.length !== 3 || room.phase === "play") {
        throw new GameError("Создатель может начать бой, когда в комнате трое.");
      }
      room.match++;
      room.phase = "play";
      break;
    case "finish":
      if (player.slot !== 0 || room.match !== input.match || room.phase !== "play") {
        throw new GameError("Этот бой уже завершён.");
      }
      room.phase = "finished";
      break;
    case "offer":
    case "answer": {
      const offer = input.action === "offer";
      const slot = offer ? input.slot : player.slot;
      const sdp = input.sdp;
      const nonce = input.nonce;
      if ((offer && player.slot !== 0) || slot === 0 || !room.players.some(member => member.slot === slot)
        || typeof sdp !== "string" || sdp.length > 20000 || !sdp.startsWith("v=0")
        || typeof nonce !== "string" || !/^[a-f\d-]{36}$/.test(nonce)) {
        throw new GameError("Неверные параметры соединения.", 400);
      }
      if (offer) room.links[slot] = { nonce, offer: sdp, answer: null };
      else {
        const link = room.links[slot];
        if (link?.nonce !== nonce) throw new GameError("Соединение уже обновлено.");
        link.answer = sdp;
      }
      break;
    }
    default:
      throw new GameError("Неизвестное действие.", 400);
  }
}

async function arenaRelay(db, room, player, input, now) {
  if (input.match !== room.match || room.phase === "lobby") throw new GameError("Бой ещё не начался.");
  const packet = input.packet;
  if (packet && typeof packet === "object" && !Array.isArray(packet) && room.phase === "play") {
    const encoded = JSON.stringify(packet);
    if (encoded.length > (player.slot === 0 ? 14000 : 400)) throw new GameError("Слишком большой кадр.", 413);
    await db.prepare(`INSERT INTO arena_relay (room, match, slot, at, packet) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(room, match, slot) DO UPDATE SET at = excluded.at, packet = excluded.packet`)
      .bind(room.code, room.match, player.slot, now, encoded).run();
  }
  const selection = player.slot === 0 && packet ? "slot > 0" : "slot = 0";
  const cutoff = player.slot === 0 && packet ? now - 520 : now - ARENA_TTL;
  const rows = await db.prepare(`SELECT slot, packet FROM arena_relay WHERE room = ? AND match = ? AND ${selection} AND at > ?`)
    .bind(room.code, room.match, cutoff).all();
  return json({ packets: rows.results.map(({ slot, packet: stored }) => ({ slot, packet: JSON.parse(stored) })) });
}

async function arenaApi(request, pathname, db) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 24576) throw new GameError("Слишком большой запрос.", 413);
  const input = request.method === "POST" ? await readArenaInput(request) : {};
  const now = Date.now();
  if (pathname === "/api/arena" && request.method === "POST") return arenaCreate(db, input, now);
  const route = /^\/api\/arena\/([A-HJ-NP-Z2-9]{6})(?:\/(join|action|relay))?$/.exec(pathname);
  if (!route || request.method !== (route[2] ? "POST" : "GET")) return json({ error: "Комната не найдена." }, 404);

  const [, code, method = "state"] = route;
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  for (let attempt = 0; attempt < 7; attempt++) {
    const row = await db.prepare("SELECT revision, data FROM arena_rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
    if (!row) throw new GameError("Комната не найдена или уже закрылась.", 404);
    const room = JSON.parse(row.data);
    let player;
    if (method === "join") {
      if (room.players.length >= 3 || room.phase !== "lobby") throw new GameError("В этой комнате уже собралось трое.");
      player = arenaPlayer(input.name, room.players.length);
      if (room.players.some(member => member.name.toLowerCase() === player.name.toLowerCase())) {
        throw new GameError("Это имя уже занято в комнате.");
      }
      room.players.push(player);
    } else {
      player = room.players.find(member => member.token === token);
      if (!player) throw new GameError("Войди в комнату заново.", 401);
      if (method === "state") return json({ room: arenaView(room, player, row.revision) });
      if (method === "relay") return arenaRelay(db, room, player, input, now);
      arenaChange(room, player, input);
    }
    const saved = await db.prepare("UPDATE arena_rooms SET data = ?, revision = revision + 1, expires_at = ? WHERE code = ? AND revision = ?")
      .bind(JSON.stringify(room), now + ARENA_TTL, code, row.revision).run();
    if (saved.meta.changes === 1) return json({ room: arenaView(room, player, row.revision + 1), ...(method === "join" && { token: player.token }) });
  }
  throw new GameError("Комната занята. Попробуй ещё раз.", 503);
}

async function readArenaInput(request) {
  const body = await request.text();
  if (body.length > 24576) throw new GameError("Слишком большой запрос.", 413);
  let input;
  try { input = JSON.parse(body); } catch { /* The error below covers invalid JSON. */ }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new GameError("Неверный формат запроса.", 400);
  return input;
}
