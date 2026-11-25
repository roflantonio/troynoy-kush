import { ARMORY, createRun, stepRun, switchWeapon } from "./world.js";
import { createRenderer, mapDraw } from "./render.js";
import { pirateSound } from "./sound.js";

const $ = id => document.getElementById(id);
const scene = $("scene");
const paint = createRenderer(scene);
const touch = matchMedia("(any-pointer: coarse)").matches;
const keys = new Set();
const held = new Set();
const screens = ["menu","pause","result","chart"];
const storageKey = "fortune-sound";
let soundOn = true;
try { soundOn = localStorage.getItem(storageKey) !== "off"; } catch { /* Use the default. */ }
const sound = pirateSound(soundOn);
let mode = "menu";
let run = createRun(1249);
let previous = performance.now();
let look = 0;
let firing = false;
let lockedBefore = false;
let drag = null;

function clearInput() {
  keys.clear();
  held.clear();
  firing = false;
  look = 0;
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

function show(next) {
  mode = next;
  $("cabinet").dataset.mode = next;
  clearInput();
  for (const screen of screens) $(screen).hidden = next !== screen;
  $("deck").hidden = next === "menu";
  $("crosshair").hidden = next !== "play";
  $("signal").hidden = next !== "play" || run.hintUntil < run.time || !run.hint;
  $("touch").hidden = !touch || next !== "play";
  $("map-toggle").hidden = next !== "play";
  $("pause-toggle").hidden = next !== "play";
  sound.battle(next === "play");
  if (next !== "play" && document.pointerLockElement === scene) document.exitPointerLock?.();
  if (next === "play") scene.focus({ preventScroll: true });
  if (next === "chart") mapDraw($("map"), run);
}

function lock() {
  if (touch || document.pointerLockElement === scene || typeof scene.requestPointerLock !== "function") return;
  try { scene.requestPointerLock()?.catch(() => {}); } catch { /* Arrows still turn the view. */ }
}

function start() {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  run = createRun(seed);
  run.hint = "Три осколка компаса · M — карта";
  run.hintUntil = 3.3;
  updateHud();
  show("play");
  sound.unlock();
  lock();
}

function finish() {
  const win = run.status === "won";
  const minute = Math.floor(run.time / 60);
  const seconds = String(Math.floor(run.time) % 60).padStart(2, "0");
  text("result-title", win ? "Форт позади" : "Поход окончен");
  text("summary", "Осколки " + run.player.relics + " / 3 · Победы " + run.player.kills + " · " + minute + ":" + seconds);
  show("result");
}

function updateHud() {
  const player = run.player;
  text("hp", player.hp);
  text("ammo", player.weapon === "blade" ? "—" : player.ammo);
  text("weapon", ARMORY[player.weapon].name);
  text("relics", player.relics + " / 3");
  const signal = mode === "play" && run.hint && run.hintUntil >= run.time;
  $("signal").hidden = !signal;
  if (signal) text("signal", run.hint);
}

function control() {
  const value = (code, touchKey) => keys.has(code) || held.has(touchKey);
  const up = value("KeyW", "forward") || keys.has("ArrowUp");
  const down = value("KeyS", "back") || keys.has("ArrowDown");
  const right = value("ArrowRight", "right");
  const left = value("ArrowLeft", "left");
  const input = {
    forward: Number(up) - Number(down), strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    turn: Number(right) - Number(left), look, fire: firing || value("Space", "fire"),
    sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
  };
  look = 0;
  return input;
}

function frame(now) {
  const elapsed = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (mode === "play") {
    stepRun(run, control(), elapsed);
    for (const event of run.events.splice(0)) sound.effect(event);
    updateHud();
    paint(run);
    if (run.status !== "play") finish();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const moves = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","ShiftLeft","ShiftRight"]);
document.addEventListener("keydown", event => {
  if ($("help").open || event.target.matches?.("button,a,input")) return;
  if (!event.repeat && event.code === "Escape" && ["play","chart","pause"].includes(mode)) {
    event.preventDefault();
    show(mode === "play" ? "pause" : "play");
    return;
  }
  if (!event.repeat && event.code === "KeyM" && ["play","chart"].includes(mode)) {
    event.preventDefault();
    show(mode === "play" ? "chart" : "play");
    return;
  }
  if (mode !== "play") return;
  const weapon = { Digit1: "pistol", Digit2: "scatter", Digit3: "blade" }[event.code];
  if (weapon) {
    event.preventDefault();
    if (weapon === "scatter" && !run.player.scatter) {
      run.hint = "Мушкетон можно найти в форте";
      run.hintUntil = run.time + 2.1;
    } else switchWeapon(run, weapon);
  }
  if (!moves.has(event.code)) return;
  event.preventDefault();
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
  if (mode === "play" && document.pointerLockElement === scene) look += event.movementX * .0027;
});
scene.addEventListener("pointerdown", event => {
  if (mode !== "play" || event.button !== 0) return;
  if (event.pointerType === "touch") {
    drag = { id: event.pointerId, x: event.clientX };
    scene.setPointerCapture?.(event.pointerId);
    return;
  }
  firing = true;
  lock();
});
scene.addEventListener("pointermove", event => {
  if (mode !== "play" || drag?.id !== event.pointerId) return;
  look += (event.clientX - drag.x) * .009;
  drag.x = event.clientX;
});
const release = event => {
  if (event.pointerType === "touch") {
    if (drag?.id === event.pointerId) drag = null;
  } else firing = false;
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
    held.add(action);
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(type, () => held.delete(action));
}
$("touch-weapon").addEventListener("click", () => {
  const list = run.player.scatter ? ["pistol","scatter","blade"] : ["pistol","blade"];
  switchWeapon(run, list[(list.indexOf(run.player.weapon) + 1) % list.length]);
});
$("start").addEventListener("click", start);
$("retry").addEventListener("click", start);
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
