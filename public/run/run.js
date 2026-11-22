import { COLORS, LEVELS } from "./levels.js";
import { runner, STEP, tickRunner } from "./physics.js";
import { renderTo, scenePreview } from "./draw.js?v=2";
import { RemoteRunner } from "./ghosts.js";
import { Soundtrack } from "../arena/audio.js";
import { codeFrom, roomUrl, validCode } from "../arena/network.js";

const $ = id => document.getElementById(id);
const board = $("course");
const paint = renderTo(board);
const demo = renderTo($("preview"));
const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const touch = matchMedia("(any-pointer: coarse)").matches;
const apiOrigin = document.querySelector('meta[name="game-api-origin"]')?.content || location.origin;
const audio = new Soundtrack(.28, .65);
let session = read(sessionStorage, "turbo-room");
let room;
let player;
let atLevel = 0;
const ghosts = new Map();
let offset = 0;
let timer;
let polling = 0;
let queue = [];
let clockAnchor = 0;
let generation = 0;
let entering = false;
let shownRoster = "";
let standingsKey = "";
let resultKey = "";
let previous = performance.now();
let lag = 0;
let lastStep = 0;
let jumpQueued = false;
const held = new Set();
const touchHeld = new Set();

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}
function save(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* Current game continues without storage. */ }
}
function message(id, text = "", error = false) {
  const target = $(id);
  target.textContent = text;
  target.hidden = !text;
  target.classList.toggle("error", error);
}

function soundPreference(saveIt = false) {
  const music = Number($("music").value);
  const effects = Number($("effects").value);
  $("music-value").textContent = music + "%";
  $("effects-value").textContent = effects + "%";
  audio.setVolumes(music / 100, effects / 100);
  if (saveIt) save(localStorage, "turbo-volume", { music, effects });
}

const savedVolume = read(localStorage, "turbo-volume");
if (savedVolume) {
  $("music").value = savedVolume.music;
  $("effects").value = savedVolume.effects;
}
soundPreference();
for (const id of ["music", "effects"]) $(id).addEventListener("input", () => {
  audio.unlock();
  soundPreference(true);
});
$("effects").addEventListener("change", () => audio.effect("crystal"));
document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
document.addEventListener("keydown", () => audio.unlock(), { once: true });

async function request(path, body, token = session?.token) {
  const started = Date.now();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  let response;
  try {
    response = await fetch(new URL("/api/run" + path, apiOrigin), {
      method: body === undefined ? "GET" : "POST", headers, cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5500),
    });
  } catch { throw new Error("Связь с сервером прервалась."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.room) {
    const error = new Error(data.error || "Сервер гонки временно недоступен.");
    error.status = response.status;
    throw error;
  }
  data.offset = data.room.now - (started + Date.now()) / 2;
  return data;
}

function clearKeys() {
  held.clear();
  touchHeld.clear();
  jumpQueued = false;
}
window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearKeys(); });

function formatTime(ms) {
  const tenths = Math.max(0, Math.floor(ms / 100));
  return Math.floor(tenths / 600) + ":" + String(Math.floor(tenths % 600 / 10)).padStart(2, "0") + "." + tenths % 10;
}

function setJoin(show) {
  $("join-fields").hidden = !show;
  $("join-expand").setAttribute("aria-expanded", String(show));
}

function showResume() {
  $("resume").hidden = !session;
  if (session) $("resume").textContent = "Вернуться в комнату " + session.code;
}

function mainMenu(forget = false) {
  generation++;
  clearTimeout(timer);
  room = null;
  player = null;
  queue = [];
  ghosts.clear();
  shownRoster = "";
  clearKeys();
  audio.inMatch = false;
  if (forget) {
    session = null;
    save(sessionStorage, "turbo-room", null);
  }
  history.replaceState(null, "", roomUrl());
  $("home").hidden = false;
  $("race-room").hidden = true;
  message("notice");
  showResume();
}

function lobbyView() {
  const key = room.players.map(p => p.name).join("|") + ":" + room.me;
  if (key === shownRoster) return;
  shownRoster = key;
  const cards = [0, 1, 2, 3].map(slot => {
    const member = room.players.find(p => p.slot === slot);
    const card = document.createElement("div");
    card.className = "slot";
    card.style.setProperty("--crew", member ? COLORS[slot] : "#6b8392");
    card.textContent = member ? member.name + (room.me === slot ? " (ты)" : "") : "Свободно";
    const status = document.createElement("small");
    status.textContent = member ? (slot === 0 ? "Создатель" : "Готов к старту") : "Место для друга";
    card.append(status);
    return card;
  });
  $("roster").replaceChildren(...cards);
  $("start").hidden = room.me !== 0;
  $("start").disabled = room.players.length < 2;
  $("lobby-wait").hidden = room.me === 0;
}

function updateGhosts(incoming, serverNow) {
  const receivedAt = performance.now();
  for (const packet of incoming) {
    if (packet.slot === room.me) continue;
    const old = ghosts.get(packet.slot);
    const track = old?.latest?.level === packet.level ? old : new RemoteRunner();
    track.receive(packet, receivedAt, serverNow);
    ghosts.set(packet.slot, track);
  }
  for (const member of room.players) {
    if (ghosts.has(member.slot) && ghosts.get(member.slot).latest.level !== member.level) ghosts.delete(member.slot);
  }
}

function setLevel(level, checkpoint = false, falls = 0) {
  atLevel = Math.min(level, LEVELS.length - 1);
  player = runner(atLevel, checkpoint);
  player.falls = falls;
  if (level === LEVELS.length) player.done = true;
  lag = 0;
  jumpQueued = false;
  standingsKey = "";
  $("level-number").textContent = "Трасса " + (atLevel + 1) + " из " + LEVELS.length;
  $("level-name").textContent = LEVELS[atLevel].name;
  $("level-hint").textContent = LEVELS[atLevel].hint;
  $("checkpoint").hidden = !checkpoint;
  if (!touch) board.focus({ preventScroll: true });
}

function saveProgress() {
  save(sessionStorage, "turbo-progress", { code: room.code, match: room.match,
    level: player.done && atLevel === LEVELS.length - 1 ? LEVELS.length : atLevel,
    checkpoint: player.checkpoint, falls: player.falls, queue });
}

function restoreProgress(member) {
  const local = read(sessionStorage, "turbo-progress");
  const valid = local?.match === room.match && local?.code === room.code && local?.level >= member.level
    && local.level <= LEVELS.length && Array.isArray(local.queue);
  queue = valid ? local.queue.filter(report => report.level >= member.level) : [];
  setLevel(valid ? local.level : member.level, Boolean(valid && local.checkpoint), valid ? local.falls : 0);
}

function advanceImmediately() {
  queue.push({ action: "gate", match: room.match, level: atLevel, x: player.x + 13.5, falls: player.falls });
  if (atLevel + 1 < LEVELS.length) {
    setLevel(atLevel + 1);
    audio.effect("crystal");
  } else audio.effect("drop");
  saveProgress();
  if (polling !== generation) {
    clearTimeout(timer);
    poll(generation);
  }
}

function standings() {
  const data = room.players.map(p => {
    const sample = ghosts.get(p.slot)?.latest;
    const position = p.slot === room.me ? player?.x : sample?.level === p.level ? sample.x : undefined;
    const level = p.slot === room.me && player ? atLevel : p.level;
    const awaiting = p.slot === room.me && player?.done && !p.done;
    const pct = p.level >= LEVELS.length || awaiting ? 100 : Math.round((level
      + Math.min(.99, (position ?? 0) / LEVELS[level].flag)) * 25);
    return { ...p, level, pct, awaiting };
  }).sort((p, q) => (p.place ?? 10) - (q.place ?? 10) || q.pct - p.pct);
  const key = JSON.stringify(data);
  if (key === standingsKey) return;
  standingsKey = key;
  $("positions").replaceChildren(...data.map(p => {
    const box = document.createElement("div");
    box.className = "position";
    box.style.setProperty("--crew", COLORS[p.slot]);
    const name = document.createElement("b");
    name.textContent = p.name + (p.slot === room.me ? " (ты)" : "");
    const text = document.createElement("span");
    text.textContent = p.place ? p.place + "-е место · " + formatTime(p.done)
      : p.awaiting ? "Финиш · подтверждение" : LEVELS[p.level].name + " · " + p.pct + "%";
    const meter = document.createElement("progress");
    meter.max = 100;
    meter.value = p.pct;
    meter.setAttribute("aria-label", "Прогресс, " + p.name);
    box.append(name, text, meter);
    return box;
  }));
}

function showResult(member, previousMember) {
  const winner = room.players.find(p => p.place === 1);
  const waiting = player?.done && !member.done && room.phase === "race";
  const complete = Boolean(member.done) || waiting || room.phase === "finished";
  $("finish").hidden = !complete;
  $("touch").hidden = !touch || complete;
  if (!complete) return;
  if (member.done && previousMember && !previousMember.done) audio.effect("over");
  audio.inMatch = false;
  const host = room.me === 0;
  const key = [room.match, room.phase, member.place, winner?.place, host, waiting].join("/");
  if (key === resultKey) return;
  resultKey = key;
  $("finish-title").textContent = waiting ? "Финиш!" : member.place === 1 ? "Ты первый!" : member.place ? "Финиш!" : "Время вышло";
  $("finish-detail").textContent = waiting ? "Сверяем результат с сервером…" : member.place
    ? member.place + "-е место · " + formatTime(member.done) + (member.place > 1 ? " · победил " + winner.name : "")
    : winner ? "Победил " + winner.name + " · " + formatTime(winner.done) : "Заезд завершён.";
  $("rematch").hidden = !host || waiting;
  $("rematch").disabled = !(winner || room.phase === "finished");
  $("finish-wait").hidden = host || waiting;
}

function accept(data) {
  if (room && data.room.revision < room.revision) return;
  const last = room;
  const before = last?.players.find(p => p.slot === last.me);
  room = data.room;
  offset = !last ? data.offset : offset * .72 + data.offset * .28;
  $("room-code").textContent = room.code;
  $("home").hidden = true;
  $("race-room").hidden = false;
  $("lobby").hidden = room.phase !== "lobby";
  $("race").hidden = room.phase === "lobby";
  if (room.phase === "lobby") { lobbyView(); return; }
  const me = room.players.find(p => p.slot === room.me);
  const newRace = !last || last.match !== room.match;
  if (newRace) {
    ghosts.clear();
    resultKey = "";
    clearKeys();
    clockAnchor = performance.now() + room.start - (Date.now() + offset);
    restoreProgress(me);
  } else {
    const confirmed = queue.filter(report => report.level >= me.level);
    if (confirmed.length !== queue.length) {
      queue = confirmed;
      saveProgress();
    }
    if (!player || (me.level > atLevel && me.level < LEVELS.length)) setLevel(me.level);
  }
  if (data.ghosts) updateGhosts(data.ghosts, room.now);
  audio.inMatch = room.phase === "race" && !me.done;
  showResult(me, before?.level === undefined || last.match !== room.match ? null : before);
  standings();
}

async function enter(mode) {
  if (entering) return;
  const name = $("name").value.trim();
  const code = codeFrom($("code").value);
  if (mode !== "resume" && (!name || [...name].length > 18)) {
    message("entry-error", "Введи имя длиной от 1 до 18 символов.", true);
    $("name").focus();
    return;
  }
  if (mode === "join" && !validCode(code)) {
    message("entry-error", "Введи шестизначный код комнаты.", true);
    $("code").focus();
    return;
  }
  entering = true;
  const buttons = ["create", "join-expand", "join", "resume"].map($);
  buttons.forEach(button => button.disabled = true);
  audio.unlock();
  message("entry-error");
  try {
    const data = mode === "resume" ? await request("/" + session.code)
      : await request(mode === "join" ? "/" + code + "/join" : "", { name }, null);
    session = { code: data.room.code, token: data.token ?? session.token };
    save(sessionStorage, "turbo-room", session);
    if (mode !== "resume") save(sessionStorage, "turbo-name", name);
    history.replaceState(null, "", roomUrl(session.code));
    accept(data);
    poll(++generation);
    audio.effect("join");
  } catch (error) {
    if (mode === "resume" && [401, 404].includes(error.status)) mainMenu(true);
    message("entry-error", error.message, true);
  } finally {
    entering = false;
    buttons.forEach(button => button.disabled = false);
  }
}

function liveTime() { return performance.now() - clockAnchor; }

function myGhost() {
  if (room.phase !== "race" || !player || liveTime() < 0 || room.players.find(p => p.slot === room.me).done) return null;
  return { level: atLevel, x: player.x, y: player.y, face: player.face, down: player.respawn > 0,
    flash: player.shield > 0, moved: Math.abs(player.vx) > 55, checkpoint: player.checkpoint,
    vx: player.vx, vy: player.vy, falls: player.falls };
}

async function poll(expected) {
  if (expected !== generation || polling === expected) return;
  polling = expected;
  const base = "/" + session.code;
  const gate = room.phase === "race" && liveTime() < room.end - room.start ? queue[0] : null;
  let good = false;
  try {
    const data = room.phase === "lobby" ? await request(base)
      : gate ? await request(base + "/action", gate)
        : await request(base + "/ghost", { match: room.match, ghost: myGhost() });
    if (expected !== generation) return;
    accept(data);
    good = true;
    if ($("notice").classList.contains("error")) message("notice");
  } catch (error) {
    if (expected !== generation) return;
    if ([401, 404].includes(error.status)) {
      mainMenu(true);
      message("entry-error", error.message, true);
      return;
    }
    message("notice", error.message, true);
  } finally {
    if (polling === expected) polling = 0;
    if (expected === generation) timer = setTimeout(() => poll(expected),
      room.phase === "race" ? (good && queue.length ? 0 : document.hidden ? 700 : 200) : 870);
  }
}

function playing() {
  return room?.phase === "race" && player && !$("rules").open && !player.done && liveTime() >= 0 && liveTime() < room.end - room.start
    && !room.players.find(p => p.slot === room.me).done;
}

const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];
window.addEventListener("keydown", event => {
  if (!room || room.phase !== "race" || event.target.matches?.("input,button,summary") || $("rules").open) return;
  if (JUMP_KEYS.has(event.code)) {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
  } else if (LEFT.includes(event.code) || RIGHT.includes(event.code)) {
    event.preventDefault();
    held.add(event.code);
  }
});
window.addEventListener("keyup", event => held.delete(event.code));

function bindTouch(id) {
  const button = $(id);
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (!playing()) return;
    button.setPointerCapture(event.pointerId);
    if (id === "jump") jumpQueued = true;
    else touchHeld.add(id);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(event, () => touchHeld.delete(id));
}
["left", "right", "jump"].forEach(bindTouch);

function updatePhysics(now) {
  const seconds = Math.min(.08, (now - previous) / 1000);
  previous = now;
  if (!playing()) { lag = 0; return; }
  const a = LEFT.some(key => held.has(key)) || touchHeld.has("left");
  const d = RIGHT.some(key => held.has(key)) || touchHeld.has("right");
  const dir = Number(d) - Number(a);
  lag += seconds;
  while (lag >= STEP) {
    const event = tickRunner(player, atLevel, { dir, jump: jumpQueued }, STEP, liveTime() / 1000 - lag + STEP);
    jumpQueued = false;
    lag -= STEP;
    if (event) {
      if (event === "fall" || event === "checkpoint") {
        saveProgress();
        $("checkpoint").hidden = !player.checkpoint;
      }
      if (event === "gate") {
        advanceImmediately();
        showResult(room.players.find(p => p.slot === room.me), null);
        standings();
        break;
      }
      audio.effect({ fall: "hit", jump: "bounce", spring: "dash", checkpoint: "crystal" }[event]);
    }
  }
}

function frame(now) {
  updatePhysics(now);
  if (!room) {
    if (motion || !lastStep) {
      const t = motion ? now / 1000 : 1.8;
      const state = scenePreview(t);
      demo(0, state.runner, 0, state.rivals, t, true);
      lastStep = now;
    }
  } else if (room.phase !== "lobby" && player) {
    const ms = liveTime();
    const me = room.players.find(p => p.slot === room.me);
    const time = formatTime(me.done ?? Math.min(ms, room.end - room.start));
    if ($("race-time").textContent !== time) $("race-time").textContent = time;
    $("countdown").hidden = ms >= 0;
    if (ms < 0 && $("countdown").textContent !== String(Math.ceil(-ms / 1000))) {
      $("countdown").textContent = String(Math.ceil(-ms / 1000));
      audio.effect("join");
    }
    const rivals = [];
    for (const member of room.players) {
      const track = ghosts.get(member.slot);
      if (track?.latest.level !== atLevel) continue;
      const frame = track.drawAt(now);
      if (frame) rivals.push({ ...frame, name: member.name });
    }
    paint(atLevel, player, room.me, rivals, Math.max(0, ms / 1000));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function start(button) {
  if (!room) return;
  const expected = generation;
  button.disabled = true;
  try {
    const data = await request("/" + room.code + "/action", { action: "start" });
    if (expected === generation) accept(data);
  } catch (error) {
    if (expected === generation) {
      message("notice", error.message, true);
      button.disabled = false;
    }
  }
}
$("start").addEventListener("click", () => start($("start")));
$("rematch").addEventListener("click", () => start($("rematch")));
$("invite").addEventListener("click", async () => {
  const link = roomUrl(room.code).href;
  try { await navigator.clipboard.writeText(link); message("notice", "Ссылка скопирована."); }
  catch { message("notice", link); }
});
$("exit").addEventListener("click", () => mainMenu());
$("resume").addEventListener("click", () => enter("resume"));
$("join-expand").addEventListener("click", () => {
  setJoin($("join-fields").hidden);
  if (!$("join-fields").hidden) $("code").focus();
});
$("code").addEventListener("input", event => { event.target.value = codeFrom(event.target.value); });
$("entry").addEventListener("submit", event => {
  event.preventDefault();
  enter(event.submitter === $("join") || document.activeElement === $("code") ? "join" : "create");
});
$("rules-open").addEventListener("click", () => { clearKeys(); $("rules").showModal(); });
$("rules-close").addEventListener("click", () => $("rules").close());
$("name").value = read(sessionStorage, "turbo-name") ?? "";
const invited = codeFrom(new URLSearchParams(location.search).get("room") ?? "");
showResume();
if (validCode(invited)) {
  $("code").value = invited;
  setJoin(true);
  if (session?.code === invited) enter("resume");
}
