import { FIELD, COLORS, EMPTY, inputPacket, startMatch, step } from "./physics.js";
import { Connection, codeFrom, request, roomUrl, validCode } from "./network.js";
import { Soundtrack } from "./audio.js";
import { previewState, renderer } from "./render.js";

const $ = id => document.getElementById(id);
const canvas = $("arena");
const draw = renderer(canvas);
const demo = renderer($("preview"));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchControls = matchMedia("(any-pointer: coarse)").matches;
const music = $("music");
const effects = $("effects");
let session = read(sessionStorage, "laser-room");
let connection;
let room;
let state;
let lastPacket = 0;
let relayTimer;
let lastSequence = 0;
let recent = [];
let scoreKey = "";
let waitingOnForm = false;
let timerMark = performance.now();
let lastBroadcast = 0;
let lastHeartbeat = 0;
let dash = 0;
let aim = 0;
let pointer = null;
let firing = false;
let touchMove = { x: 0, y: 0 };
let touchFire = false;
let snapshotsFromDirect = 0;
let inputSequence = Date.now();
const keys = new Set();
const remote = new Map();
const audio = new Soundtrack(.32, .68);

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

function write(storage, key, data) {
  try { storage.setItem(key, JSON.stringify(data)); } catch { /* The current session still works. */ }
}

function mixer(save) {
  const musicVolume = Number(music.value);
  const effectsVolume = Number(effects.value);
  $("music-value").textContent = musicVolume + "%";
  $("effects-value").textContent = effectsVolume + "%";
  audio.setVolumes(musicVolume / 100, effectsVolume / 100);
  if (save) write(localStorage, "laser-volume", { music: musicVolume, effects: effectsVolume });
}

const volumes = read(localStorage, "laser-volume");
if (volumes) {
  music.value = volumes.music;
  effects.value = volumes.effects;
}
mixer(false);
for (const slide of [music, effects]) slide.addEventListener("input", () => {
  audio.unlock();
  mixer(true);
});
document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
document.addEventListener("keydown", () => audio.unlock(), { once: true });
effects.addEventListener("change", () => audio.effect("hit"));
$("rules-button").addEventListener("click", () => $("rules").showModal());
$("close-rules").addEventListener("click", () => $("rules").close());

function message(id, text, error = false) {
  const element = $(id);
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle("error", error);
}

function card(kind, index) {
  const element = document.createElement("div");
  element.className = kind;
  element.style.setProperty("--crew", COLORS[index]);
  return element;
}

function setRoster() {
  const host = room.me === 0;
  const cards = [0, 1, 2].map(slot => {
    const person = room.players.find(p => p.slot === slot);
    const box = card("slot", slot);
    box.textContent = person ? person.name + (room.me === slot ? " (ты)" : "") : "Свободно";
    const status = document.createElement("small");
    status.textContent = person ? (slot === 0 ? "Создатель" : "В комнате") : "Ждём игрока";
    box.append(status);
    return box;
  });
  $("roster").replaceChildren(...cards);
  $("start").hidden = !host;
  $("start").disabled = room.players.length !== 3;
  $("waiting").hidden = host;
}

function clearControls() {
  keys.clear();
  firing = false;
  touchFire = false;
  touchMove = { x: 0, y: 0 };
}
window.addEventListener("blur", clearControls);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearControls(); });

function localInput() {
  const player = state?.players?.[room?.me];
  if (pointer && player) aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  const held = (...codes) => codes.some(code => keys.has(code));
  return inputPacket({
    x: Number(held("KeyD", "ArrowRight")) - Number(held("KeyA", "ArrowLeft")) + touchMove.x,
    y: Number(held("KeyS", "ArrowDown")) - Number(held("KeyW", "ArrowUp")) + touchMove.y,
    a: aim, fire: firing || touchFire || held("KeyF"), dash,
  });
}

function outgoingInput() {
  return { ...localInput(), seq: ++inputSequence };
}

function stashResume() {
  $("resume").hidden = !session;
  if (session) $("resume").textContent = "Вернуться в комнату " + session.code;
}

function showJoin(show) {
  $("join-fields").hidden = !show;
  $("show-join").setAttribute("aria-expanded", String(show));
}

function goHome(dropSession = false) {
  connection?.close();
  clearTimeout(relayTimer);
  connection = null;
  room = null;
  state = null;
  clearControls();
  audio.inMatch = false;
  message("status", "");
  if (dropSession) {
    session = null;
    write(sessionStorage, "laser-room", null);
  }
  history.replaceState(null, "", roomUrl());
  $("home").hidden = false;
  $("room").hidden = true;
  stashResume();
}

function snapshotValid(data) {
  return data && Number.isFinite(data.time) && Number.isFinite(data.limit) && Number.isFinite(data.count)
    && data.players?.length === 3 && data.players.every((p, id) => p.id === id && Number.isFinite(p.x) && Number.isFinite(p.y))
    && Array.isArray(data.bullets) && Array.isArray(data.crystals) && Array.isArray(data.events);
}

function useSnapshot(next, direct = false) {
  if (!snapshotValid(next) || (state && next.time < state.time)) return;
  state = next;
  lastPacket = performance.now();
  if (direct) snapshotsFromDirect = lastPacket;
  $("connection").hidden = true;
  if (state.over) result();
}

function onPacket(slot, data, direct = true) {
  if (!room || !data || typeof data !== "object") return;
  if (room.me === 0 && slot > 0 && slot < 3) {
    const prior = remote.get(slot);
    if (!Number.isFinite(data.seq) || (prior && data.seq <= prior.seq)) return;
    if (direct || !prior || performance.now() - prior.direct > 400) {
      const at = performance.now();
      remote.set(slot, { input: inputPacket(data), at, seq: data.seq, direct: direct ? at : (prior?.direct ?? 0) });
    }
  } else if (slot === 0 && room.me > 0) useSnapshot(data, direct);
}

async function recoverHost(conn, match) {
  try {
    const { packets } = await conn.relay(null);
    if (connection !== conn || room.match !== match || state) return;
    const previous = packets.find(entry => entry.slot === 0)?.packet;
    if (snapshotValid(previous)) useSnapshot(previous);
    else state = startMatch();
  } catch {
    if (connection === conn && room.match === match && !state) state = startMatch();
  }
  timerMark = performance.now();
}

function roomChanged(next) {
  const newBattle = !room || room.match !== next.match;
  const entering = room?.phase === "lobby" && next.phase === "play";
  room = next;
  $("room-code").textContent = room.code;
  $("home").hidden = true;
  $("room").hidden = false;
  $("lobby").hidden = room.phase !== "lobby";
  $("match").hidden = room.phase === "lobby";
  if (room.phase === "lobby") { setRoster(); return; }
  audio.inMatch = room.phase === "play";

  if (newBattle) {
    state = null;
    lastSequence = 0;
    lastPacket = 0;
    lastHeartbeat = 0;
    snapshotsFromDirect = 0;
    recent = [];
    scoreKey = "";
    remote.clear();
    clearControls();
    $("result").hidden = true;
    $("connection").hidden = false;
    $("connection").textContent = "Подключаемся…";
    if (room.me === 0) recoverHost(connection, room.match);
    if (entering) audio.effect("spawn");
    if (!touchControls) canvas.focus({ preventScroll: true });
  }
  $("touch-controls").hidden = !touchControls || room.phase !== "play";
  if (state?.over) result();
}

async function enter(mode) {
  if (waitingOnForm) return;
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
  waitingOnForm = true;
  const controls = ["create", "join", "resume", "show-join"].map($);
  controls.forEach(button => button.disabled = true);
  message("entry-error", "");
  audio.unlock();
  try {
    const returning = mode === "resume";
    const { room: joined, token } = returning
      ? await request("/" + session.code, undefined, session.token)
      : await request(mode === "join" ? "/" + code + "/join" : "", { name });
    session = { token: token ?? session.token, code: joined.code };
    write(sessionStorage, "laser-room", session);
    if (!returning) write(sessionStorage, "laser-name", name);
    history.replaceState(null, "", roomUrl(joined.code));

    connection?.close();
    clearTimeout(relayTimer);
    const conn = new Connection(session, {
      room: roomChanged, packet: onPacket,
      status(text, status) {
        if (status === 401 || status === 404) {
          goHome(true);
          message("entry-error", text, true);
        } else if (text || $("status").classList.contains("error")) message("status", text, Boolean(text));
      },
    });
    connection = conn;
    conn.accept(joined);
    conn.poll();
    handleRelay(conn);
    audio.effect("join");
  } catch (error) {
    if (mode === "resume" && [401, 404].includes(error.status)) goHome(true);
    message("entry-error", error.message, true);
  } finally {
    waitingOnForm = false;
    controls.forEach(button => button.disabled = false);
  }
}

async function handleRelay(conn) {
  if (connection !== conn) return;
  const playing = room.phase === "play";
  const host = room.me === 0;
  const active = playing || (room.phase === "finished" && !state?.over);
  const now = performance.now();
  const direct = conn.allDirect && (host || now - snapshotsFromDirect < 700);
  let delay = direct ? 1250 : 150;
  if (!active) delay = 500;
  else if (!host && direct) delay = 200;
  else if (host && !state) delay = 120;
  else {
    const match = room.match;
    const packet = host ? state : playing ? outgoingInput() : null;
    const final = host && packet?.over === true;
    try {
      const { packets } = await conn.relay(packet);
      if (connection !== conn) return;
      if (room.match === match) {
        lastHeartbeat = performance.now();
        for (const item of packets) onPacket(item.slot, item.packet, false);
        if (final && room.phase === "play") await conn.action("finish", { match });
      }
    } catch {
      if (connection === conn && !direct && performance.now() - lastHeartbeat > 2200) {
        $("connection").textContent = "Восстанавливаем связь…";
        $("connection").hidden = false;
      }
    }
  }
  if (connection === conn) relayTimer = setTimeout(() => handleRelay(conn), delay);
}

function result() {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const leaders = sorted.filter(p => p.score === sorted[0].score);
  const nameFor = id => room.players.find(p => p.slot === id)?.name ?? "Игрок";
  const key = room.match + "/" + room.phase;
  if ($("result").dataset.key === key) return;
  $("result").dataset.key = key;
  $("result").hidden = false;
  $("connection").hidden = true;
  $("winner").textContent = leaders.length === 1 ? nameFor(leaders[0].id) + " побеждает!" : "Ничья";
  $("rematch").hidden = room.me !== 0;
  $("rematch").disabled = room.phase !== "finished";
  $("rematch-wait").hidden = room.me === 0;
  $("touch-controls").hidden = true;
  const rank = sorted.map(p => {
    const row = document.createElement("div");
    row.className = "rank";
    const name = document.createElement("span");
    const value = document.createElement("b");
    name.textContent = nameFor(p.id);
    value.textContent = p.score;
    row.append(name, value);
    return row;
  });
  $("ranking").replaceChildren(...rank);
  audio.inMatch = false;
}

function renderHud() {
  if (!state) return;
  const p = state.players[room.me];
  const remaining = Math.max(0, Math.ceil((state.limit - Math.max(state.time, state.count)) / 1000));
  const time = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
  if ($("clock").textContent !== time) $("clock").textContent = time;
  const health = p.wake ? "Перезагрузка" : [0, 1, 2].map(i => i < p.hp ? "●" : "○").join(" ");
  const cooldown = Math.max(0, p.cooldown - state.time);
  const dashText = cooldown > 0 ? (cooldown / 1000).toFixed(1) + " с" : "Готов";
  if ($("health").textContent !== health) $("health").textContent = health;
  if ($("dash-status").textContent !== dashText) $("dash-status").textContent = dashText;
  const key = room.players.map(member => member.name + "/" + state.players[member.slot].score).join("|");
  if (key === scoreKey) return;
  scoreKey = key;
  $("scores").replaceChildren(...room.players.map(member => {
    const item = card("score", member.slot);
    const name = document.createElement("span");
    const value = document.createElement("b");
    name.textContent = member.name + (room.me === member.slot ? " (ты)" : "");
    value.textContent = state.players[member.slot].score;
    item.append(name, value);
    return item;
  }));
}

function tick() {
  const now = performance.now();
  let dt = Math.min(84, now - timerMark);
  timerMark = now;
  if (!room || room.phase !== "play") return;
  const control = localInput();
  if (room.me === 0 && state && !state.over) {
    const controls = [control, 1, 2].map(value => {
      if (typeof value !== "number") return value;
      const recentInput = remote.get(value);
      // Preserve the latest dash sequence when a connection briefly drops.
      return recentInput && now - recentInput.at < 650 ? recentInput.input
        : { ...EMPTY, a: state.players[value].a, dash: state.players[value].dash };
    });
    while (dt > 0 && !state.over) {
      const slice = Math.min(dt, 16.667);
      step(state, controls, slice);
      dt -= slice;
    }
    if (state.over) {
      result();
      connection.send(state);
    }
  }
  if (now - lastBroadcast >= 47 && (room.me !== 0 || state)) {
    lastBroadcast = now;
    connection.send(room.me === 0 ? state : { ...control, seq: ++inputSequence });
  }
}
setInterval(tick, 16);

function frame(now) {
  if (!room) demo(previewState(reduceMotion ? 510 : now), -1, now);
  else if (room.phase !== "lobby") {
    if (state) {
      for (const event of state.events) {
        if (event[0] <= lastSequence) continue;
        lastSequence = event[0];
        recent.push([now, event]);
        const [, kind, x, y, id] = event;
        const me = state.players[room.me];
        const strength = id === room.me || ["crystal", "over"].includes(kind) ? 1
          : Math.max(.19, 1 - Math.hypot(x - me.x, y - me.y) / 960);
        audio.effect(kind, (x - me.x) / 510, strength);
      }
    }
    recent = recent.filter(([at]) => now - at < 610);
    draw(state, room.me, now, recent, aim);
    renderHud();
    if (room.me > 0 && state && !state.over && now - lastPacket > 2100) {
      $("connection").textContent = "Восстанавливаем связь…";
      $("connection").hidden = false;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function matchInput() {
  return room?.phase === "play" && !state?.over && !$("rules").open;
}

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "KeyF"]);
window.addEventListener("keydown", event => {
  if (!matchInput() || !MOVE_KEYS.has(event.code) || event.target.matches?.("button,input,summary")) return;
  event.preventDefault();
  if (event.code === "Space") { if (!event.repeat) dash++; }
  else keys.add(event.code);
});
window.addEventListener("keyup", event => { keys.delete(event.code); });

function pointerAt(event) {
  const box = canvas.getBoundingClientRect();
  const scale = Math.min(box.width / FIELD.width, box.height / FIELD.height);
  return { x: (event.clientX - box.left - (box.width - FIELD.width * scale) / 2) / scale,
    y: (event.clientY - box.top - (box.height - FIELD.height * scale) / 2) / scale };
}
canvas.addEventListener("pointermove", event => { if (event.pointerType !== "touch") pointer = pointerAt(event); });
canvas.addEventListener("pointerdown", event => {
  if (!matchInput() || event.button !== 0 || event.pointerType === "touch") return;
  pointer = pointerAt(event);
  firing = true;
  canvas.setPointerCapture(event.pointerId);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, () => firing = false);

function stick(element, onChange) {
  let active;
  let start;
  const grip = element.querySelector("i");
  const move = event => {
    if (event.pointerId !== active || !matchInput()) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const size = Math.max(26, Math.hypot(dx, dy));
    grip.style.transform = "translate(" + (dx / size * 19) + "px," + (dy / size * 19) + "px)";
    onChange(dx / size, dy / size);
  };
  element.addEventListener("pointerdown", event => {
    if (!matchInput() || active !== undefined) return;
    event.preventDefault();
    active = event.pointerId;
    start = { x: event.clientX, y: event.clientY };
    element.setPointerCapture(active);
  });
  element.addEventListener("pointermove", move);
  const end = event => {
    if (event.pointerId !== active) return;
    grip.style.transform = "";
    active = undefined;
    onChange(0, 0);
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(e => element.addEventListener(e, end));
}
stick($("move-stick"), (x, y) => { touchMove = { x, y }; });
stick($("aim-stick"), (x, y) => {
  touchFire = Math.hypot(x, y) > .19;
  if (touchFire) { pointer = null; aim = Math.atan2(y, x); }
});
$("dash-touch").addEventListener("click", () => { if (matchInput()) dash++; });

async function launch(button) {
  button.disabled = true;
  try { await connection.action("start"); }
  catch (error) { message("status", error.message, true); button.disabled = false; }
}
$("start").addEventListener("click", () => launch($("start")));
$("rematch").addEventListener("click", () => launch($("rematch")));
$("invite").addEventListener("click", async () => {
  const url = roomUrl(room.code).href;
  try {
    await navigator.clipboard.writeText(url);
    message("status", "Ссылка скопирована.");
  } catch { message("status", url); }
});
$("exit").addEventListener("click", () => goHome());
$("resume").addEventListener("click", () => enter("resume"));
$("show-join").addEventListener("click", () => {
  showJoin($("join-fields").hidden);
  if (!$("join-fields").hidden) $("code").focus();
});
$("code").addEventListener("input", event => { event.target.value = codeFrom(event.target.value); });
$("entry").addEventListener("submit", event => {
  event.preventDefault();
  enter(event.submitter === $("join") || document.activeElement === $("code") ? "join" : "create");
});
$("name").value = read(sessionStorage, "laser-name") ?? "";
const invited = codeFrom(new URLSearchParams(location.search).get("room") ?? "");
stashResume();
if (validCode(invited)) {
  $("code").value = invited;
  showJoin(true);
  if (session?.code === invited) enter("resume");
}
