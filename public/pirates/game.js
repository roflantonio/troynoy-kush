import { ARMORY, DASH_COOLDOWN, createRun, location, stepRun, switchWeapon } from "./world.js?v=3";
import { createRenderer, mapDraw } from "./render.js?v=3";
import { pirateSound } from "./sound.js?v=3";

const $ = id => document.getElementById(id);
const scene = $("scene");
const paint = createRenderer(scene);
const touch = matchMedia("(any-pointer: coarse)").matches;
const keys = new Set();
const held = new Set();
const screens = ["menu", "pause", "result", "chart", "cinematic"];
const storageKey = "fortune-sound";
let soundOn = true;
try { soundOn = localStorage.getItem(storageKey) !== "off"; } catch { /* Use the default. */ }
const sound = pirateSound(soundOn);
let mode = "menu";
let run = createRun(1249);
let previous = performance.now();
let look = 0;
let tilt = 0;
let dashPressed = false;
let cinematic = null;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let firing = false;
let lockedBefore = false;
let drag = null;

function clearInput() {
  keys.clear();
  held.clear();
  firing = false;
  look = 0;
  tilt = 0;
  dashPressed = false;
  drag = null;
}

function setSound(on) {
  soundOn = on;
  $("audio").setAttribute("aria-pressed", String(on));
  $("audio").setAttribute("aria-label", on ? "Выключить звук" : "Включить звук");
  sound.active(on);
}
setSound(soundOn);
$("audio").addEventListener("click", () => {
  setSound(!soundOn);
  if (soundOn) sound.unlock();
  try { localStorage.setItem(storageKey, soundOn ? "on" : "off"); } catch { /* Keep the in-game setting. */ }
});
document.addEventListener("pointerdown", event => { if (!$("audio").contains(event.target)) sound.unlock(); }, { passive: true });
document.addEventListener("keydown", () => sound.unlock(), { once: true });

function text(id, value) {
  const element = $(id);
  value = String(value);
  if (element.textContent !== value) element.textContent = value;
}

function updateScore() {
  if (mode === "menu" || (mode === "cinematic" && cinematic.kind === "arrival")) sound.track("dock");
  else if (run.status === "won" || run.arena.cleared) sound.track("dock");
  else if (run.status === "dead") sound.track("silence");
  else sound.track(run.arena.active ? "watcher" : "fort");
}

function show(next) {
  mode = next;
  $("cabinet").dataset.mode = next;
  clearInput();
  for (const screen of screens) $(screen).hidden = next !== screen;
  $("deck").hidden = !["play", "pause", "chart"].includes(next);
  $("boss-hud").hidden = next !== "play" || !run.arena.active || run.arena.cleared;
  $("crosshair").hidden = next !== "play";
  $("signal").hidden = next !== "play" || run.hintUntil < run.time || !run.hint;
  $("touch").hidden = !touch || next !== "play";
  $("map-toggle").hidden = next !== "play";
  $("pause-toggle").hidden = next !== "play";
  updateScore();
  if (next !== "play" && document.pointerLockElement === scene) {
    lockedBefore = false;
    document.exitPointerLock?.();
  }
  if (next === "play") scene.focus({ preventScroll: true });
  if (next === "chart") {
    text("chart-location", location(run));
    const position = mapDraw($("map"), run);
    const paper = $("chart-scroll");
    paper.scrollLeft = paper.scrollWidth * position - paper.clientWidth / 2;
    $("chart-close").focus({ preventScroll: true });
  }
}

const scenes = {
  arrival: {
    title: "Форт проклятых", length: 8400,
    lines: ["В полночь отлив открыл дорогу к форту. Ты сошёл на берег за компасом утонувшего капитана.",
      "Три крыла, три осколка. Забери их и найди выход, пока море не вернулось."],
  },
  watcher: {
    title: "Смотритель", length: 6600,
    lines: ["Решётка падает за спиной. Из мрака выходят зелёные огни.",
      "«Море забрало мою команду. А теперь я заберу твой компас»."],
  },
};

function beginScene(kind) {
  const act = scenes[kind];
  cinematic = { kind, act, started: performance.now() };
  $("cinematic").dataset.act = kind;
  text("cinematic-title", act.title);
  text("cinematic-line", act.lines[0]);
  show("cinematic");
  $("skip-scene").focus({ preventScroll: true });
}

function film(now) {
  const { kind, act, started } = cinematic;
  const elapsed = now - started;
  if (elapsed >= act.length) {
    leaveScene(false);
    return;
  }
  text("cinematic-line", act.lines[Number(elapsed > act.length * .48)]);
  if (kind === "watcher") {
    const pan = reducedMotion.matches ? 0 : elapsed / act.length;
    paint(run, { x: run.arena.left + 2.9 + pan * 4.4, y: run.boss.y + (1 - pan) * 1.75,
      angle: -.23 + pan * .22, pitch: .028, bob: 0, moving: 0 });
  }
}

function leaveScene(interactive) {
  cinematic = null;
  show("play");
  paint(run);
  if (interactive) lock();
}

function lock() {
  if (touch || document.pointerLockElement === scene || typeof scene.requestPointerLock !== "function") return;
  try { scene.requestPointerLock()?.catch(() => {}); } catch { /* Arrows still turn the view. */ }
}

function start() {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  run = createRun(seed);
  run.hint = "В каждом крыле ищи осколок · Tab — карта";
  run.hintUntil = 5;
  updateHud();
  beginScene("arrival");
  sound.unlock();
}

function finish() {
  const win = run.status === "won";
  const minute = Math.floor(run.time / 60);
  const seconds = String(Math.floor(run.time) % 60).padStart(2, "0");
  text("result-title", win ? "Конец демо" : "Поход окончен");
  $("win-note").hidden = !win;
  text("summary", "Осколки " + run.player.relics + " / 3 · Победы " + run.player.kills + " · " + minute + ":" + seconds);
  show("result");
}

function updateHud() {
  const player = run.player;
  text("hp", player.hp);
  const health = $("health-meter");
  health.max = player.max;
  health.value = player.hp;
  $("compass").dataset.filled = String(player.relics);
  text("ammo", player.weapon === "blade" ? "—" : player.ammo);
  text("weapon", ARMORY[player.weapon].name);
  text("relics", player.relics + " / 3");
  const dash = $("dash-meter");
  dash.value = DASH_COOLDOWN - player.dashCooldown;
  dash.parentElement.dataset.ready = String(player.dashCooldown === 0);
  $("boss-meter").max = run.boss.max;
  $("boss-meter").value = run.boss.hp;
  $("boss-hud").hidden = mode !== "play" || !run.arena.active || run.arena.cleared;
  const signal = mode === "play" && run.hint && run.hintUntil >= run.time;
  $("signal").hidden = !signal;
  if (signal) text("signal", run.hint);
}

function control(dt) {
  const value = (code, touchKey) => keys.has(code) || held.has(touchKey);
  const up = value("KeyW", "forward") || keys.has("ArrowUp");
  const down = value("KeyS", "back") || keys.has("ArrowDown");
  const right = value("ArrowRight", "right");
  const left = value("ArrowLeft", "left");
  const input = {
    forward: Number(up) - Number(down), strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    turn: Number(right) - Number(left), look, fire: firing || value("Space", "fire"),
    tilt: tilt + (Number(keys.has("PageUp")) - Number(keys.has("PageDown"))) * dt * 1.5,
    dash: dashPressed,
  };
  look = 0;
  tilt = 0;
  dashPressed = false;
  return input;
}

function frame(now) {
  const elapsed = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (mode === "play") {
    stepRun(run, control(elapsed), elapsed);
    for (const event of run.events.splice(0)) {
      sound.effect(event);
      if (event === "arena") beginScene("watcher");
      if (event === "victory") updateScore();
    }
    updateHud();
    if (mode === "play") paint(run);
    if (run.status !== "play") finish();
  } else if (mode === "cinematic") film(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const moves = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","PageUp","PageDown","ShiftLeft","ShiftRight"]);
document.addEventListener("keydown", event => {
  if ($("help").open) return;
  if (mode === "cinematic" && event.code === "Escape" && !event.repeat) {
    event.preventDefault();
    leaveScene(false);
    return;
  }
  if ((event.code === "Tab" || event.code === "KeyM") && ["play","chart"].includes(mode)) {
    event.preventDefault();
    if (!event.repeat) show(mode === "play" ? "chart" : "play");
    return;
  }
  if (!event.repeat && event.code === "Escape" && ["play","chart","pause"].includes(mode)) {
    event.preventDefault();
    show(mode === "play" ? "pause" : "play");
    return;
  }
  if (event.target.matches?.("button,a,input")) return;
  if (mode !== "play") return;
  const weapon = { Digit1: "pistol", Digit2: "scatter", Digit3: "blade", Digit4: "musket" }[event.code];
  if (weapon) {
    event.preventDefault();
    if (!run.player.arsenal.has(weapon)) {
      run.hint = "Это оружие ещё предстоит найти";
      run.hintUntil = run.time + 2.1;
    } else switchWeapon(run, weapon);
  }
  if (!moves.has(event.code)) return;
  event.preventDefault();
  if (!event.repeat && (event.code === "ShiftLeft" || event.code === "ShiftRight")) dashPressed = true;
  keys.add(event.code);
});
document.addEventListener("keyup", event => keys.delete(event.code));
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === scene) lockedBefore = true;
  else if (lockedBefore) {
    lockedBefore = false;
    if (mode === "play") show("pause");
  }
});
document.addEventListener("mousemove", event => {
  if (mode === "play" && document.pointerLockElement === scene) {
    look += event.movementX * .0027;
    tilt -= event.movementY * .0035;
  }
});
scene.addEventListener("pointerdown", event => {
  if (mode !== "play" || event.button !== 0) return;
  scene.focus({ preventScroll: true });
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.pointerType !== "touch") {
    firing = true;
    lock();
  }
});
document.addEventListener("pointermove", event => {
  if (mode !== "play" || document.pointerLockElement === scene || drag?.id !== event.pointerId) return;
  const sensitivity = event.pointerType === "touch" ? .009 : .0035;
  look += (event.clientX - drag.x) * sensitivity;
  tilt -= (event.clientY - drag.y) * sensitivity;
  drag.x = event.clientX;
  drag.y = event.clientY;
});
const release = event => {
  if (drag?.id === event.pointerId) drag = null;
  if (event.pointerType !== "touch") firing = false;
};
document.addEventListener("pointerup", release);
document.addEventListener("pointercancel", release);
window.addEventListener("blur", () => { if (mode === "play") show("pause"); else clearInput(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "play") show("pause"); });
for (const button of document.querySelectorAll(".touch-key")) {
  const action = button.dataset.key;
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (mode !== "play") return;
    button.setPointerCapture?.(event.pointerId);
    if (action === "dash") dashPressed = true;
    else held.add(action);
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(type, () => held.delete(action));
}
$("touch-weapon").addEventListener("click", () => {
  const list = [...run.player.arsenal];
  switchWeapon(run, list[(list.indexOf(run.player.weapon) + 1) % list.length]);
});
$("start").addEventListener("click", start);
$("retry").addEventListener("click", start);
$("skip-scene").addEventListener("click", () => leaveScene(true));
$("continue").addEventListener("click", () => { show("play"); lock(); });
$("menu-return").addEventListener("click", () => show("menu"));
$("result-menu").addEventListener("click", () => show("menu"));
$("pause-toggle").addEventListener("click", () => show("pause"));
$("map-toggle").addEventListener("click", () => show("chart"));
$("chart-close").addEventListener("click", () => { show("play"); lock(); });
for (const id of ["guide","pause-guide"]) $(id).addEventListener("click", () => $("help").showModal());
$("help-close").addEventListener("click", () => $("help").close());
show("menu");
$("start").disabled = false;
