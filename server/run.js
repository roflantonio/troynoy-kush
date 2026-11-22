const RUN_TTL = 3_600_000;
const RUN_DURATION = 480_000;
const RUN_GATES = [2675, 2910, 2890, 3125];

function runView(room, player, now, revision = 0) {
  return {
    code: room.code, match: room.match, revision, now, start: room.start, end: room.end, me: player.slot,
    phase: !room.start ? "lobby" : now >= room.end || room.players.every(p => p.done) ? "finished" : "race",
    players: room.players.map(({ name, slot, level, done, place, falls }) => ({ name, slot, level, done, place, falls })),
  };
}

function runPlayer(input, slot) {
  return { slot, name: cleanName(input.name), token: crypto.randomUUID(), level: 0, entered: 0, done: null, place: null, falls: 0 };
}

async function runCreate(db, input, now) {
  const player = runPlayer(input, 0);
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 24) {
    await db.prepare("DELETE FROM run_rooms WHERE expires_at <= ?").bind(now).run();
  }
  for (let i = 0; i < 5; i++) {
    const room = { code: roomCode(), match: 0, start: null, end: null, finishCount: 0, players: [player] };
    const row = await db.prepare("INSERT OR IGNORE INTO run_rooms(code, expires_at, data) VALUES(?, ?, ?)")
      .bind(room.code, now + RUN_TTL, JSON.stringify(room)).run();
    if (row.meta.changes) return json({ room: runView(room, player, now), token: player.token }, 201);
  }
  throw new GameError("Попробуй создать комнату ещё раз.", 503);
}

function runAction(room, player, input, now) {
  if (input.action === "start") {
    if (player.slot !== 0 || room.players.length < 2 || (room.start && now < room.end && !room.finishCount)) {
      throw new GameError("Для старта нужны хотя бы двое. Сейчас гонку может запустить создатель комнаты.");
    }
    room.match++;
    room.start = now + 2800;
    room.end = room.start + RUN_DURATION;
    room.finishCount = 0;
    for (const member of room.players) Object.assign(member, { level: 0, entered: room.start, done: null, place: null, falls: 0 });
    return;
  }

  if (input.action !== "gate") throw new GameError("Неизвестное действие.", 400);
  if (room.match !== input.match || now >= room.end || !room.start) throw new GameError("Этот заезд уже закончился.");
  if (Number.isInteger(input.level) && input.level < player.level) return;
  if (input.level !== player.level || player.done || now - player.entered < 3900
    || !Number.isFinite(input.x) || input.x < RUN_GATES[player.level] - 19) {
    throw new GameError("Сначала добеги до портала этой трассы.");
  }
  player.level++;
  player.entered = now;
  if (Number.isInteger(input.falls)) player.falls += Math.max(0, Math.min(1000, input.falls));
  if (player.level === RUN_GATES.length) {
    player.done = Math.max(1, now - room.start);
    player.place = ++room.finishCount;
  }
}

async function runGhosts(db, room, player, input, now, revision) {
  const body = input.ghost;
  if (input.match === room.match && room.start && now >= room.start && now < room.end && !player.done
    && body && body.level === player.level && Number.isFinite(body.x) && Number.isFinite(body.y)) {
    const ghost = {
      level: player.level, x: Math.round(Math.max(0, Math.min(RUN_GATES[player.level] + 20, body.x))),
      y: Math.round(Math.max(-90, Math.min(575, body.y))),
      face: body.face === -1 ? -1 : 1, down: body.down === true, flash: body.flash === true,
      moved: body.moved === true, checkpoint: body.checkpoint === true,
      vx: Number.isFinite(body.vx) ? Math.round(Math.max(-460, Math.min(460, body.vx))) : 0,
      vy: Number.isFinite(body.vy) ? Math.round(Math.max(-920, Math.min(1150, body.vy))) : 0,
      falls: Number.isInteger(body.falls) ? Math.max(0, Math.min(1000, body.falls)) : null,
    };
    await db.prepare(`INSERT INTO run_ghosts (room, match, slot, at, packet) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(room, match, slot) DO UPDATE SET at = excluded.at, packet = excluded.packet`)
      .bind(room.code, room.match, player.slot, now, JSON.stringify(ghost)).run();
  }
  const rows = await db.prepare("SELECT slot, at, packet FROM run_ghosts WHERE room = ? AND match = ? AND at >= ?")
    .bind(room.code, room.match, now - 4200).all();
  const ghosts = rows.results.map(({ slot, at, packet }) => ({ slot, at, ...JSON.parse(packet) }))
    .filter(ghost => room.players.some(member => member.slot === ghost.slot && member.level === ghost.level));
  return json({ room: runView(room, player, now, revision), ghosts });
}

async function runApi(request, path, db) {
  if (Number(request.headers.get("Content-Length") ?? 0) > 4096) throw new GameError("Слишком большой запрос.", 413);
  const input = request.method === "POST" ? await body(request) : {};
  if (path === "/api/run" && request.method === "POST") return runCreate(db, input, Date.now());
  const route = /^\/api\/run\/([A-HJ-NP-Z2-9]{6})(?:\/(join|action|ghost))?$/.exec(path);
  if (!route || request.method !== (route[2] ? "POST" : "GET")) return json({ error: "Комната не найдена." }, 404);
  const [, code, operation = "state"] = route;
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");

  for (let attempt = 0; attempt < 7; attempt++) {
    const now = Date.now();
    const row = await db.prepare("SELECT revision, data FROM run_rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
    if (!row) throw new GameError("Комната закрылась или код введён с ошибкой.", 404);
    const room = JSON.parse(row.data);
    let player;
    if (operation === "join") {
      if (room.start || room.players.length >= 4) throw new GameError("Гонка уже началась или комната заполнена.");
      player = runPlayer(input, room.players.length);
      if (room.players.some(member => member.name.toLowerCase() === player.name.toLowerCase())) {
        throw new GameError("Выбери другое имя. Такое уже есть в комнате.");
      }
      room.players.push(player);
    } else {
      player = room.players.find(member => member.token === token);
      if (!player) throw new GameError("Войди в комнату заново.", 401);
      if (operation === "state") return json({ room: runView(room, player, now, row.revision) });
      if (operation === "ghost") return runGhosts(db, room, player, input, now, row.revision);
      runAction(room, player, input, now);
    }
    const result = await db.prepare("UPDATE run_rooms SET data = ?, revision = revision + 1, expires_at = ? WHERE code = ? AND revision = ?")
      .bind(JSON.stringify(room), now + RUN_TTL, code, row.revision).run();
    if (result.meta.changes) return json({ room: runView(room, player, now, row.revision + 1),
      ...(operation === "join" && { token: player.token }) });
  }
  throw new GameError("Связь с комнатой занята. Попробуй ещё раз.", 503);
}
