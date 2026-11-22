import { act, addPlayer, cleanName, GameError, newRoom, ROOM_EXPIRY, roomCode, tick, view } from "./game.js";
import { assets } from "./assets.js";

function json(value, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function body(request) {
  const input = await request.text();
  if (input.length > 4096) throw new GameError("Слишком большой запрос.", 413);
  try {
    const data = JSON.parse(input);
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
  } catch {
    // The error below also covers valid JSON that isn't an object.
  }
  throw new GameError("Неверный формат запроса.", 400);
}

async function create(db, name, now) {
  await db.prepare("DELETE FROM rooms WHERE expires_at <= ?").bind(now).run();
  for (let attempt = 0; attempt < 5; attempt++) {
    const room = newRoom(roomCode());
    const player = addPlayer(room, name);
    const saved = await db.prepare("INSERT OR IGNORE INTO rooms (code, expires_at, state) VALUES (?, ?, ?)")
      .bind(room.code, now + ROOM_EXPIRY, JSON.stringify(room)).run();
    if (saved.meta.changes === 1) return json({ token: player.token, state: view(room, player, now) }, 201);
  }
  throw new GameError("Попробуй создать комнату ещё раз.", 503);
}

async function useRoom(db, code, operation, input, token) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now();
    const row = await db.prepare("SELECT revision, state FROM rooms WHERE code = ? AND expires_at > ?")
      .bind(code, now).first();
    if (!row) throw new GameError("Комната не найдена или уже закрылась.", 404);
    const room = JSON.parse(row.state);
    let changed = false;
    let player;
    if (operation === "join") {
      player = addPlayer(room, cleanName(input.name));
      changed = true;
    } else {
      player = room.players.find(member => member.token === token);
      if (!player) throw new GameError("Войди в комнату заново.", 401);
      changed = tick(room, now);
      if (operation === "action") {
        act(room, player, input, now);
        changed = true;
      }
    }

    if (changed) {
      const saved = await db.prepare("UPDATE rooms SET state = ?, expires_at = ?, revision = revision + 1 WHERE code = ? AND revision = ?")
        .bind(JSON.stringify(room), now + ROOM_EXPIRY, code, row.revision).run();
      if (saved.meta.changes !== 1) continue;
    }

    if (operation === "join") return json({ token: player.token, state: view(room, player, now) });
    if (operation === "action" && input.action === "leave") return json({ left: true });
    return json({ state: view(room, player, now) });
  }
  throw new GameError("Комната занята. Попробуй ещё раз.", 503);
}

async function api(request, pathname, db) {
  if (pathname === "/api/rooms" && request.method === "POST") {
    const input = await body(request);
    return create(db, cleanName(input.name), Date.now());
  }
  const route = /^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|action))?$/.exec(pathname);
  if (route) {
    const [, code, operation = "state"] = route;
    if (request.method === (operation === "state" ? "GET" : "POST")) {
      const input = request.method === "POST" ? await body(request) : {};
      const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
      return useRoom(db, code, operation, input, token);
    }
  }
  return json({ error: "Страница не найдена." }, 404);
}

async function roomResponse(request, url, env) {
  const origin = request.headers.get("Origin");
  const pagesOrigin = origin && origin !== "null" && origin === env.HEIST_PAGES_ORIGIN ? origin : null;
  if (origin && origin !== url.origin && !pagesOrigin) {
    return json({ error: "Открой игру по прямой ссылке." }, 403);
  }

  let response;
  if (request.method === "OPTIONS" && pagesOrigin) {
    response = new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
      },
    });
  } else {
    try {
      const handler = url.pathname.startsWith("/api/arena") ? arenaApi : api;
      response = await handler(request, url.pathname, env.DB);
    } catch (error) {
      if (error instanceof GameError) response = json({ error: error.message }, error.status);
      else {
        console.error("Room operation failed", error);
        response = json({ error: "Сервер игры временно недоступен. Попробуй ещё раз." }, 500);
      }
    }
  }

  if (pagesOrigin) response.headers.set("Access-Control-Allow-Origin", pagesOrigin);
  response.headers.append("Vary", "Origin");
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname.startsWith("/api/")) return roomResponse(request, url, env);
    if (pathname === "/arena") {
      url.pathname = "/arena/";
      return Response.redirect(url, 308);
    }
    const asset = Object.hasOwn(assets, pathname) ? assets[pathname] : null;
    if (!asset) return new Response("Страница не найдена", { status: 404 });
    const [type, data] = asset;
    const headers = {
      "Content-Type": type,
      "Cache-Control": pathname === "/" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
    };
    const content = !type.includes("charset") ? Uint8Array.from(atob(data), character => character.charCodeAt(0)) : data;
    return new Response(request.method === "HEAD" ? null : content, { headers });
  },
};
