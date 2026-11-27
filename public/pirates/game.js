import { ARMORY, advanceDream, cast, chooseSkill, compassObjective, createDream, createPort, createRun, dreamHint, learnRescueCode, location, nextLevel, portInteraction, rescueInteraction, secretAhead, seeded, stepRun, switchWeapon, unlockRescue, weaponCapacity } from "./world.js?v=19";
import { createRenderer, mapDraw } from "./render.js?v=19";
import { pirateSound } from "./sound.js?v=18";
import { FLEET_TOTAL, FLEET_WAVES, KRAKEN_HP, HELM, answerHelm, beginKraken, broadsideTarget, fireBroadside, newVoyage, stepVoyage } from "./sea.js?v=17";
import { TRADERS, offers, purchase } from "./trade.js?v=19";
import { seaRenderer } from "./sea-render.js?v=19";
import { SPEAKERS as speakers, sceneFor } from "./story.js?v=17";
import { RARITIES } from "./skills.js?v=17";
import { animateFortMenu } from "./menu-scene.js?v=13";

const $ = id => document.getElementById(id);
const cabinet = $("cabinet");
const scene = $("scene");
const paint = createRenderer(scene);
const paintMenu = animateFortMenu($("title-art"));
const seaView = $("sea-view");
const paintSea = seaRenderer(seaView);
const broadsides = [$("port-cannon"), $("starboard-cannon")];
const reloadMeters = broadsides.map(button => button.querySelector("progress"));
const touch = matchMedia("(pointer: coarse)").matches;
cabinet.toggleAttribute("data-touch", touch);
const touchCannons = [$("touch-port"), $("touch-starboard")];
const touchReloads = touchCannons.map(button => button.querySelector("progress"));
const useButton = $("touch-interact");
const fireButton = $("touch-fire");
const seaFireButton = $("touch-cannons");
const keys = new Set();
const relicMarks = [...document.querySelectorAll(".compass-gems i")];
const activeSkills = $("active-skills");
const skillKeys = new Set(["KeyQ", "KeyF", "KeyC", "KeyX", "KeyZ", "KeyV"]);
let displayedSkills = [];
let skillButtons = [];
const roundMarks = [...document.querySelectorAll(".chambers i")];
const titleChoices = [...document.querySelectorAll(".title-choice")];
const screens = ["menu", "chapters", "pause", "result", "chart", "cinematic", "skills", "sea-briefing", "shop", "rescue-lock"];
const traderVoices = { skills: "runa", arms: "brann", chests: "shkiv" };
const storageKey = "fortune-volumes";
const dreamKey = "fortune-dream";
const volumeChannels = ["music", "effects"];
const volumes = { music: 1, effects: 1 };
let dreamed = false;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const channel of volumeChannels) {
    const value = saved?.[channel];
    if (Number.isFinite(value)) volumes[channel] = Math.max(0, Math.min(1, value));
    else if (localStorage.getItem("fortune-sound") === "off") volumes[channel] = 0;
  }
} catch { /* Use the default. */ }
try { dreamed = localStorage.getItem(dreamKey) === "done"; } catch { /* Keep the default. */ }
const sound = pirateSound(volumes);
let mode = "menu";
let run = createRun(1249);
let voyage = null;
let endingAt = null;
let vendor = null;
let sales = {};
let previous = performance.now();
let look = 0;
let tilt = 0;
let dashPressed = false;
let reloadPressed = false;
let interactPressed = false;
let skillPressed;
let cinematic = null;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let firing = false;
let firePressed = false;
let lockedBefore = false;
let drag = null;

function pointerControl(element, modes, onStart, onMove, onStop) {
  let activeId = null;
  function reset() {
    if (activeId === null) return;
    const id = activeId;
    activeId = null;
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    onStop?.();
    element.removeAttribute("data-active");
  }
  element.addEventListener("pointerdown", event => {
    if (!modes.includes(mode)) return;
    if (event.button !== 0 || activeId !== null) return;
    event.preventDefault();
    activeId = event.pointerId;
    element.setPointerCapture(activeId);
    element.setAttribute("data-active", "");
    onStart(event);
  });
  element.addEventListener("pointermove", event => {
    if (activeId === event.pointerId) onMove?.(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    element.addEventListener(type, event => {
      if (activeId === event.pointerId) reset();
    });
  }
  return { get active() { return activeId !== null; }, reset };
}

function tapAction(button, action) {
  let pressed;
  let touchAt = -Infinity;
  button.addEventListener("click", event => {
    const handledTouch = event.pointerType === "touch"
      || (!event.pointerType && event.detail && performance.now() - touchAt < 350);
    if (!touch || !handledTouch) action();
  });
  if (!touch) return;
  button.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") pressed = event;
  });
  button.addEventListener("pointercancel", () => { pressed = null; });
  button.addEventListener("pointerup", event => {
    if (event.pointerId !== pressed?.pointerId) return;
    const distance = Math.hypot(event.clientX - pressed.clientX, event.clientY - pressed.clientY);
    pressed = null;
    if (distance > 14 || button.disabled) return;
    touchAt = performance.now();
    action();
  });
}

const stick = $("touch-stick");
const knob = $("stick-knob");
const movement = { x: 0, y: 0 };
let stickArea;

function moveStick(event) {
  const { x, y, width, height } = stickArea;
  const dx = event.clientX - x - width / 2;
  const dy = event.clientY - y - height / 2;
  const reach = width * .32;
  const distance = Math.hypot(dx, dy);
  const raw = Math.min(1, distance / reach);
  const power = Math.max(0, (raw - .12) / .88);
  movement.x = distance ? dx / distance * power : 0;
  movement.y = distance ? dy / distance * power : 0;
  const travel = raw * reach / (distance || 1);
  knob.style.transform = "translate(" + dx * travel + "px," + dy * travel + "px)";
}

const stickInput = pointerControl(stick, ["play", "sea"], event => {
  stickArea = stick.getBoundingClientRect();
  moveStick(event);
}, moveStick, () => {
  movement.x = movement.y = 0;
  knob.style.transform = "";
});

let fireAim;
const touchGun = pointerControl(fireButton, ["play"], event => {
  firePressed = true;
  fireAim = event;
}, event => {
  if (!drag) {
    look += (event.clientX - fireAim.clientX) * .009;
    tilt -= (event.clientY - fireAim.clientY) * .009;
  }
  fireAim = event;
}, () => { fireAim = null; });

function fireAtBroadside() {
  for (const side of [-1, 1]) {
    if (broadsideTarget(voyage, side)) fireBroadside(voyage, side);
  }
}

const touchBroadside = pointerControl(seaFireButton, ["sea"], fireAtBroadside);

function clearInput() {
  keys.clear();
  stickInput.reset();
  touchGun.reset();
  touchBroadside.reset();
  firing = false;
  firePressed = false;
  look = 0;
  tilt = 0;
  dashPressed = false;
  reloadPressed = false;
  interactPressed = false;
  skillPressed = undefined;
  drag = null;
}

for (const channel of volumeChannels) {
  const slider = $(channel + "-volume");
  const output = $(channel + "-percent");
  slider.value = Math.round(volumes[channel] * 100);
  output.value = slider.value + "%";
  slider.addEventListener("input", () => {
    volumes[channel] = slider.valueAsNumber / 100;
    output.value = slider.value + "%";
    sound.volume(channel, volumes[channel]);
    sound.unlock();
    try { localStorage.setItem(storageKey, JSON.stringify(volumes)); } catch { /* Keep the settings for this session. */ }
  });
}
document.addEventListener("pointerdown", () => sound.unlock(), { passive: true });
document.addEventListener("keydown", () => sound.unlock(), { once: true });

function text(id, value) {
  const element = $(id);
  value = String(value);
  if (element.textContent !== value) element.textContent = value;
}

const sceneThemes = {
  "dream-start": "film-shore", "dream-guard": "film-dream-guard", "dream-end": "film-dream-end",
  arrival: "film-fort", "runa-code": "film-rescue", "runa-free": "film-runa-free", watcher: "film-watcher",
  crossing: "film-island", "brann-code": "film-brann-code", "brann-free": "film-brann-free", king: "film-king",
  ending: "film-sea", kraken: "film-kraken",
  "port-arrival": "film-port", "port-market": "film-market",
  "vault-arrival": "film-vault", rust: "film-rust", "vault-end": "film-vault-end",
};
const seaThemes = { fleet: "sea", kraken: "kraken", dead: "silence", victory: "film-port" };
const arenaThemes = { fort: "watcher", island: "king", vault: "rust" };

function miniBoss() {
  const guard = run.rescue?.guard;
  if (guard?.hp > 0 && guard.awake && Math.hypot(guard.x - run.player.x, guard.y - run.player.y) < 10) return guard;
  return null;
}

function updateScore() {
  if (mode === "menu" || mode === "chapters") sound.track("menu");
  else if (mode === "cinematic") sound.track(sceneThemes[cinematic.kind]);
  else if (mode === "sea-briefing") sound.track("film-helm");
  else if (voyage) sound.track(seaThemes[voyage.phase] ?? "film-kraken");
  else if (run.status === "dead") sound.track("silence");
  else if (run.arena.active && !run.arena.cleared && arenaThemes[run.map.key]) sound.track(arenaThemes[run.map.key]);
  else if (miniBoss()) sound.track(run.map.key === "fort" ? "jailer-fort" : "jailer-island");
  else sound.track(run.map.key);
}

function skillIcon(skill) {
  const icon = document.createElement("span");
  icon.className = "skill-icon";
  const columns = skill.atlas === "captain" ? 10 : 6;
  if (skill.atlas) icon.dataset.atlas = skill.atlas;
  icon.style.backgroundPosition = skill.icon % columns * 100 / (columns - 1) + "% " + Math.floor(skill.icon / columns) * 25 + "%";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function skillDetails(skill) {
  const details = document.createElement("span");
  const name = document.createElement("strong");
  const effect = document.createElement("span");
  name.textContent = skill.name + (skill.maxRank > 1 ? " · " + ["I","II","III"][skill.rank - 1] : "");
  effect.textContent = skill.effect;
  const rarity = document.createElement("small");
  rarity.className = "skill-rarity";
  rarity.textContent = RARITIES[skill.rarity][0];
  effect.textContent += skill.key ? " · " + skill.key + " · откат " + skill.cooldown + " с" : "";
  details.append(name, rarity, effect);
  return details;
}

function showSkills() {
  const choices = run.skillChoices.map((skill, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-card";
    button.dataset.rarity = skill.rarity;
    const key = document.createElement("kbd");
    key.textContent = index + 1;
    key.setAttribute("aria-hidden", "true");
    button.append(skillIcon(skill), skillDetails(skill), key);
    button.addEventListener("click", () => selectSkill(skill.id));
    return button;
  });
  $("skill-options").replaceChildren(...choices);
  text("skill-instructions", choices.length === 1 && run.training ? "Повысь ранг выбранного умения" : "Выбери одно умение");
  show("skills");
  choices[0]?.focus({ preventScroll: true });
}

function selectSkill(id) {
  if (mode !== "skills" || !chooseSkill(run, id)) return;
  resumePlay();
}

function showLearnedSkills() {
  const entries = run.player.skills.map(skill => {
    const entry = document.createElement("li");
    entry.dataset.rarity = skill.rarity;
    entry.append(skillIcon(skill), skillDetails(skill));
    return entry;
  });
  $("learned-skills").replaceChildren(...entries);
  $("skills-empty").hidden = entries.length > 0;
}

function renderShop(message = "", focusId = null) {
  const items = $("shop-catalog");
  const cards = offers(run.player, vendor).map(offer => {
    const row = document.createElement("li");
    const icon = offer.skill ? skillIcon(offer.skill) : document.createElement("span");
    if (offer.skill) row.dataset.rarity = offer.skill.rarity;
    if (!offer.skill) {
      icon.className = "trade-icon";
      icon.dataset.icon = offer.icon;
      icon.setAttribute("aria-hidden", "true");
    }
    const details = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const button = document.createElement("button");
    title.textContent = offer.title + (offer.price && offer.maxRank > 1 ? " · " + ["I", "II", "III"][offer.rank - 1] : "");
    if (offer.skill?.key) title.textContent += " · " + offer.skill.key;
    description.textContent = offer.price ? offer.detail : vendor === "chests" ? "Все умения уже освоены" : "Максимальный ранг";
    button.className = "button plain trade-buy";
    button.type = "button";
    button.dataset.offer = offer.id;
    button.textContent = offer.price ? (vendor === "chests" ? "Открыть за " : "Купить за ") + offer.price
      : vendor === "chests" ? "Пустая лавка" : "Улучшено";
    button.disabled = !offer.price || run.player.coins < offer.price;
    if (offer.price) button.setAttribute("aria-label", title.textContent + ". " + button.textContent + " дублонов");
    button.addEventListener("click", () => trade(offer.id));
    details.append(title, description);
    row.append(icon, details, button);
    return row;
  });
  if (!cards.length) {
    const empty = document.createElement("li");
    empty.className = "trade-empty";
    empty.textContent = "Доступные умения уже освоены.";
    cards.push(empty);
  }
  const scroll = items.scrollTop;
  items.replaceChildren(...cards);
  items.scrollTop = scroll;
  text("shop-coins", run.player.coins);
  text("shop-acquired", message);
  if (focusId) {
    const button = Array.from(items.querySelectorAll("button")).find(entry => entry.dataset.offer === focusId);
    (button && !button.disabled ? button : $("shop-close")).focus({ preventScroll: true });
  }
}

function openShop(id) {
  vendor = id;
  const trader = TRADERS[id];
  $("shop").dataset.vendor = id;
  $("shop-portrait").src = "./" + traderVoices[id] + "-shop.webp";
  $("shop-portrait").alt = trader.name + " в полный рост";
  text("shop-name", trader.name);
  text("shop-title", trader.title);
  text("shop-reaction", trader.greeting);
  show("shop");
  renderShop();
  $("shop-close").focus({ preventScroll: true });
  sound.voice(traderVoices[id], true);
}

function trade(id) {
  if (mode !== "shop") return;
  const reward = purchase(run, vendor, id);
  if (!reward) return;
  const replies = TRADERS[vendor].replies;
  const index = sales[vendor] ?? 0;
  sales[vendor] = index + 1;
  text("shop-reaction", replies[index % replies.length]);
  renderShop(reward.label + " · " + reward.detail, id);
  sound.effect("coin");
  sound.voice(traderVoices[vendor], true);
}

function updateInteraction() {
  if (mode !== "play") {
    $("interaction").hidden = useButton.hidden = true;
    return;
  }
  const target = portInteraction(run) ?? rescueInteraction(run);
  const label = target?.name ?? (secretAhead(run) ? "Открыть тайный ход" : "");
  $("interaction").hidden = !label;
  useButton.hidden = !touch || !label;
  if (label) {
    text("interact-hint", touch ? label : "E · " + label);
    useButton.setAttribute("aria-label", label);
  }
}

function updateRescueJournal() {
  const r = run.rescue;
  const journal = $("rescue-journal");
  journal.hidden = !r?.seen;
  if (journal.hidden) return;
  const progress = {
    cell: "поговори через решётку",
    key: "код " + r.code + " · победи стража и отопрись у рычага",
    opened: "рычаг сработал · вернись к темнице",
    saved: "на свободе",
  };
  journal.textContent = r.name + " · " + progress[r.stage];
}

function show(next) {
  mode = next;
  cabinet.dataset.mode = next;
  cabinet.toggleAttribute("data-dream", !!run.training);
  cabinet.toggleAttribute("data-port", run.map.key === "port");
  clearInput();
  for (const screen of screens) $(screen).hidden = next !== screen;
  const seaVisible = !!voyage && (["sea", "pause", "sea-briefing"].includes(next) || (next === "cinematic" && cinematic.kind === "kraken"));
  $("sea").hidden = !seaVisible;
  $("sea-hud").hidden = next !== "sea";
  $("sea-controls").hidden = next !== "sea" || touch;
  if (next !== "sea") {
    for (const id of ["sea-notice", "sea-qte", "kraken-meter"]) $(id).hidden = true;
  }
  $("deck").hidden = seaVisible || !["play", "pause", "chart"].includes(next);
  if (next !== "play") $("boss-hud").hidden = activeSkills.hidden = true;
  $("crosshair").hidden = next !== "play";
  $("signal").hidden = next !== "play" || run.hintUntil < run.time || !run.hint;
  updateInteraction();
  $("touch").hidden = !touch || (next !== "play" && next !== "sea");
  $("touch-land").hidden = next !== "play";
  $("touch-sea").hidden = next !== "sea";
  $("map-toggle").hidden = next !== "play";
  $("pause-toggle").hidden = next !== "play" && next !== "sea";
  $("skip-dream").hidden = !run.training || next !== "pause";
  $("dream-replay").hidden = next !== "menu";
  updateScore();
  if (next !== "play" && document.pointerLockElement === scene) {
    lockedBefore = false;
    document.exitPointerLock?.();
  }
  if (next === "play") scene.focus({ preventScroll: true });
  if (next === "sea") seaView.focus({ preventScroll: true });
  if (next === "chart") {
    if (run.training?.step === 10) run.training.chart = true;
    const chartTitles = { dream: "Карта сна", island: "Карта острова", port: "Карта порта", vault: "Карта сокровищницы" };
    text("chart-title", chartTitles[run.map.key] ?? "Карта форта");
    text("chart-location", location(run));
    text("chart-secrets", "Тайные ходы " + run.secrets.filter(secret => secret.open).length + " / " + run.secrets.length);
    updateRescueJournal();
    showLearnedSkills();
    const map = $("map");
    map.width = 28 + run.width * 6;
    map.height = 28 + run.height * 6;
    map.style.minWidth = ["island", "vault"].includes(run.map.key) ? Math.round(run.width * 4.1) + "px" : "";
    const position = mapDraw(map, run);
    const paper = $("chart-scroll");
    paper.scrollLeft = paper.scrollWidth * position - paper.clientWidth / 2;
    $("chart-close").focus({ preventScroll: true });
  }
}

function setLine(index, now) {
  const line = cinematic.act.lines[index];
  const delay = line.shot === "kraken" ? 2050 : line.shot === "dark" ? 580 : 200;
  Object.assign(cinematic, { index, letters: Array.from(line.text), shown: 0, nextLetter: now + delay });
  $("cinematic").dataset.shot = line.shot;
  $("cinematic").dataset.speaker = line.speaker;
  $("cinematic").dataset.emotion = line.emotion;
  text("speaker-name", speakers[line.speaker].name);
  text("cinematic-line", "");
  text("accessible-line", speakers[line.speaker].name + ". " + line.text);
  text("scene-next", "Показать текст");
}

function beginScene(kind) {
  const act = sceneFor(kind, run);
  const now = performance.now();
  cinematic = { kind, act, started: now };
  $("cinematic").dataset.act = kind;
  text("cinematic-title", act.title);
  setLine(0, now);
  show("cinematic");
  $("scene-next").focus({ preventScroll: true });
}

function dialogueLabel() {
  if (cinematic.index < cinematic.act.lines.length - 1) return "Далее";
  return cinematic.act.next ?? (cinematic.kind === "arrival" ? "Войти в форт" : "В бой");
}

function advanceScene() {
  if (cinematic.shown < cinematic.letters.length) {
    cinematic.shown = cinematic.letters.length;
    text("cinematic-line", cinematic.letters.join(""));
    text("scene-next", dialogueLabel());
  } else if (cinematic.index + 1 < cinematic.act.lines.length) {
    setLine(cinematic.index + 1, performance.now());
  } else leaveScene(true);
}

function film(now) {
  const { kind, act, index, started, letters } = cinematic;
  if (now >= cinematic.nextLetter && cinematic.shown < letters.length) {
    const glyph = letters[cinematic.shown++];
    text("cinematic-line", letters.slice(0, cinematic.shown).join(""));
    const speaker = act.lines[index].speaker;
    if (/\p{L}/u.test(glyph) && cinematic.shown % 2) sound.voice(speaker);
    cinematic.nextLetter = now + speakers[speaker].pace + (/[.!?…]/u.test(glyph) ? 155 : /[,«»]/u.test(glyph) ? 65 : 0);
    if (cinematic.shown === letters.length) text("scene-next", dialogueLabel());
  }
  if (["watcher", "king", "rust"].includes(kind)) {
    const pan = reducedMotion.matches ? 0 : Math.min(1, (now - started) / 7200);
    const ease = pan * pan * (3 - 2 * pan);
    const offset = kind === "king" ? 2.35 : kind === "rust" ? -1.75 : 1.15;
    paint(run, { x: run.arena.left + 3.2 + ease * 3.6, y: run.boss.y + (1 - ease) * offset,
      angle: -offset * .10 * (1 - ease), pitch: (1 - ease) * .08 - .018, bob: 0, moving: 0, time: run.time + (now - started) / 1000 });
  }
  if (kind === "kraken") paintSea(voyage, (now - started) / 1000, reducedMotion.matches);
  if (act.lines[index].shot === "vault") paint(run, { ...run.player });
  if (run.training && act.lines[index].shot === "dream") paint(run, { ...run.player });
  if (act.lines[index].shot === "cell") {
    const p = run.player, c = run.rescue.cell;
    paint(run, { ...p, angle: Math.atan2(c.y - p.y, c.x - p.x), pitch: .035, bob: 0, moving: 0 });
  }
}

function leaveScene(interactive) {
  const kind = cinematic.kind;
  cinematic = null;
  if (kind === "runa-code" || kind === "brann-code") learnRescueCode(run);
  if (kind === "port-arrival") {
    beginScene("port-market");
    return;
  }
  if (kind === "port-market") {
    run.hint = touch ? "Подойди к торговцу и нажми кнопку с ладонью" : "Подойди к торговцу · E откроет лавку";
    run.hintUntil = run.time + 7;
  }
  if (kind === "vault-end") {
    finish();
    return;
  }
  if (kind === "ending") {
    prepareVoyage();
    show("sea-briefing");
    paintSea(voyage, 0, reducedMotion.matches);
    $("raise-anchor").focus({ preventScroll: true });
    return;
  }
  if (kind === "dream-end") {
    wakeDream();
    return;
  }
  if (kind === "kraken") {
    beginKraken(voyage);
    show("sea");
    return;
  }
  show("play");
  updateHud();
  paint(run);
  if (interactive) lock();
}

function lock() {
  if (touch || document.pointerLockElement === scene || typeof scene.requestPointerLock !== "function") return;
  try { scene.requestPointerLock()?.catch(() => {}); } catch { /* Arrows still turn the view. */ }
}

function resumePlay() {
  if (voyage) {
    show("sea");
    return;
  }
  show("play");
  lock();
}

function start(forceDream = false) {
  voyage = null;
  endingAt = null;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (!dreamed || forceDream) {
    run = createDream(seed);
    updateHud();
    beginScene("dream-start");
    sound.unlock();
    return;
  }
  startFort(seed);
}

function startFort(seed) {
  run = createRun(seed);
  run.hint = touch ? "Синяя стрелка укажет путь к осколку" : "Синяя стрелка — к осколку. E — тайные ходы";
  run.hintUntil = 5;
  updateHud();
  beginScene("arrival");
  sound.unlock();
}

function wakeDream() {
  dreamed = true;
  try { localStorage.setItem(dreamKey, "done"); } catch { /* Remember within the session. */ }
  startFort(run.seed);
}

function finish() {
  const win = voyage ? voyage.phase === "victory" : run.status === "won";
  const duration = run.time + run.history.time + (voyage?.time ?? 0);
  const minute = Math.floor(duration / 60);
  const seconds = String(Math.floor(duration) % 60).padStart(2, "0");
  $("result").dataset.outcome = win ? "won" : "dead";
  $("death-skull").hidden = win;
  text("result-title", win ? "Глава I завершена" : "ТЫ ПОГИБ");
  text("retry", win ? "Новый поход" : voyage ? "Повторить морской бой" : "Меня не остановить");
  text("result-menu", win ? "В меню игры" : "Мне нужен покой");
  $("win-note").hidden = !win;
  text("result-location", voyage ? "Открытое море" : run.map.title);
  const secrets = run.history.secrets + run.secrets.filter(secret => secret.open).length;
  const relics = run.history.relics + run.player.relics;
  const sunk = run.history.sunk + (voyage?.sunk ?? 0);
  text("summary", "Осколки " + relics + " / " + (run.history.relics + run.total) + " · Тайники " + secrets
    + " / " + (run.history.totalSecrets + run.secrets.length) + " · Победы " + (run.history.kills + run.player.kills)
    + (sunk ? " · Потоплено " + sunk + " / " + FLEET_TOTAL : "") + " · Дублоны " + run.player.coins
    + " · Спасено " + Object.values(run.rescued).filter(Boolean).length + " / 3 · " + minute + ":" + seconds);
  show("result");
  $("retry").focus({ preventScroll: true });
}

function prepareVoyage() {
  voyage = newVoyage(seeded(run.seed ^ 0x3640baba), seeded(run.seed ^ 0xc5316477));
  endingAt = null;
  $("fleet-meter").max = FLEET_TOTAL;
  $("kraken-health").max = KRAKEN_HP;
}

function embark() {
  show("sea");
  updateSeaHud();
  paintSea(voyage, 0, reducedMotion.matches);
}

function updateSeaHud() {
  const { phase, sunk, hull, wave, boss, noticeUntil, time, qte } = voyage;
  text("sea-sunk", sunk + " / " + FLEET_TOTAL);
  text("sea-hull", hull + "%");
  text("sea-coins", "+" + voyage.coins + " дубл.");
  text("sea-wave", phase === "fleet" ? "Волна " + Math.max(1, wave) + " / " + FLEET_WAVES : "Кракен");
  $("hull-meter").value = hull;
  $("fleet-meter").value = sunk;
  $("kraken-meter").hidden = phase !== "kraken";
  $("kraken-health").value = boss.hp;
  text("kraken-stage", "Фаза " + boss.stage + " / 3");
  $("sea-qte").hidden = !qte;
  if (qte) {
    text("sea-threat", qte.label);
    text("sea-order", (qte.key + 1) + " · " + HELM[qte.key]);
    $("sea-timer").value = qte.left / qte.span;
  }
  $("sea-notice").hidden = !!qte || noticeUntil <= time || phase === "victory";
  text("sea-notice", voyage.notice);
  for (const [i, cannon] of broadsides.entries()) {
    const aimed = String(!!broadsideTarget(voyage, i * 2 - 1));
    const ready = 1 - voyage.reload[i] / .83;
    cannon.dataset.aimed = aimed;
    reloadMeters[i].value = ready;
    if (touch) {
      touchCannons[i].dataset.aimed = aimed;
      touchReloads[i].value = ready;
    }
  }
  if (touch) seaFireButton.dataset.aimed = String(touchCannons.some((button, i) =>
    button.dataset.aimed === "true" && !voyage.reload[i]));
}

function seaFrame(dt) {
  if (voyage.phase === "dead") {
    for (const cue of voyage.cues.splice(0)) sound.effect(cue);
    finish();
    return;
  }
  if (voyage.phase === "victory") {
    endingAt = (endingAt ?? 0) + dt;
    paintSea(voyage, endingAt, reducedMotion.matches);
    if (endingAt > 2.6) {
      run = createPort(run, voyage);
      voyage = null;
      sales = {};
      updateHud();
      beginScene("port-arrival");
    }
    return;
  }
  const axis = (key, arrow) => Number(keys.has(key) || keys.has(arrow));
  const x = axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft") + movement.x;
  const y = axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp") + movement.y;
  const magnitude = Math.max(1, Math.hypot(x, y));
  if (keys.has("KeyQ")) fireBroadside(voyage, -1);
  if (keys.has("KeyE")) fireBroadside(voyage, 1);
  if (touchBroadside.active) fireAtBroadside();
  stepVoyage(voyage, { x: x / magnitude, y: y / magnitude }, dt);
  for (const cue of voyage.cues.splice(0)) {
    if (cue === "shkiv" || cue === "sea-rescue") sound.voice("shkiv", true);
    else sound.effect(cue);
  }
  if (voyage.phase === "reveal") {
    sound.effect("kraken-rise");
    beginScene("kraken");
    return;
  }
  if (voyage.phase === "victory") updateScore();
  updateSeaHud();
  paintSea(voyage, 0, reducedMotion.matches);
}

function updateActiveSkills(player) {
  const skills = player.skills.filter(skill => skill.key);
  if (skills.length !== displayedSkills.length || skills.some((skill, index) => skill !== displayedSkills[index])) {
    displayedSkills = skills;
    skillButtons = skills.map(skill => {
      const button = document.createElement("button");
      const key = document.createElement("kbd");
      const cooldown = document.createElement("span");
      button.type = "button";
      button.dataset.rarity = skill.rarity;
      button.title = skill.name;
      button.setAttribute("aria-label", skill.name + " · " + skill.key);
      button.tabIndex = -1;
      key.textContent = skill.key;
      cooldown.className = "active-cooldown";
      button.append(skillIcon(skill), key, cooldown);
      button.addEventListener("pointerdown", event => { if (event.pointerType === "mouse") event.preventDefault(); });
      tapAction(button, () => { if (mode === "play") skillPressed = skill.key; });
      return { button, cooldown, skill };
    });
    activeSkills.replaceChildren(...skillButtons.map(entry => entry.button));
  }
  activeSkills.hidden = mode !== "play" || run.map.key === "port" || !skills.length;
  if (activeSkills.hidden) return;
  for (const { button, cooldown, skill } of skillButtons) {
    const left = Math.max(0, Math.ceil((player.skillTimers[skill.id] ?? 0) - run.time));
    button.disabled = left > 0;
    const label = left ? String(left) : "";
    if (cooldown.textContent !== label) cooldown.textContent = label;
  }
}

function updateHud() {
  const player = run.player;
  text("doubloons", player.coins);
  text("hp", player.hp);
  const health = $("health-meter");
  health.max = player.max;
  health.value = player.hp;
  $("compass").dataset.filled = String(player.relics);
  for (const [i, mark] of relicMarks.entries()) {
    mark.hidden = i >= run.total;
    mark.dataset.filled = String(i < player.relics);
  }
  const { point, label } = compassObjective(run);
  const bearing = Math.atan2(point.y - player.y, point.x - player.x) - player.angle;
  $("compass-needle").style.rotate = bearing + "rad";
  text("compass-target", label);
  const weapon = ARMORY[player.weapon];
  const capacity = weaponCapacity(player);
  const ready = player.chambers[player.weapon];
  if (touch) {
    $("touch-reload").disabled = !capacity || !!player.reloadLeft || ready >= capacity || !player.ammo;
    const blade = player.weapon === "blade";
    const caption = blade ? "Удар" : "Огонь";
    if (fireButton.lastElementChild.textContent !== caption) {
      fireButton.lastElementChild.textContent = caption;
      fireButton.setAttribute("aria-label", blade ? "Удар саблей" : "Огонь");
    }
    $("touch-dash").dataset.ready = String(!player.dashCooldown);
    $("touch-weapon").disabled = player.arsenal.size < 2;
  }
  $("weapon-hud").dataset.weapon = player.weapon;
  $("rounds").hidden = !capacity;
  if (capacity) {
    text("ammo", ready);
    text("ammo-reserve", player.ammo);
    for (const [index, mark] of roundMarks.entries()) {
      mark.hidden = index >= capacity;
      mark.dataset.loaded = String(index < ready);
    }
    const meter = $("reload-meter");
    meter.hidden = !player.reloadLeft;
    meter.value = player.reloadLeft ? 1 - player.reloadLeft / player.reloadSpan : 0;
    $("reload-label").hidden = !player.reloadLeft;
  }
  const level = player.weaponRanks[player.weapon];
  text("weapon", weapon.name + (level ? " · " + ["I", "II", "III"][level - 1] : ""));
  text("relics", player.relics + " / " + run.total);
  const dash = $("dash-meter");
  dash.max = player.dashReset;
  dash.value = player.dashReset - player.dashCooldown;
  dash.parentElement.dataset.ready = String(player.dashCooldown === 0);
  updateActiveSkills(player);
  const guard = miniBoss();
  const arenaBoss = run.arena.active && !run.arena.cleared ? run.boss : null;
  const boss = arenaBoss ?? guard;
  const bossHud = $("boss-hud");
  bossHud.hidden = mode !== "play" || !boss;
  if (boss) {
    const name = arenaBoss ? run.bossName : run.rescue.guardName;
    const meter = $("boss-meter");
    meter.max = boss.max;
    meter.value = boss.hp;
    meter.setAttribute("aria-label", "Здоровье · " + name);
    bossHud.dataset.stage = arenaBoss ? run.arena.stage + 1 : "guard";
    text("boss-name", name);
    text("boss-phase", arenaBoss ? run.acts[run.arena.stage].name : "Страж рычага");
  }
  const hint = run.training ? dreamHint(run, touch) : run.hintUntil >= run.time && run.hint;
  $("signal").hidden = mode !== "play" || !hint;
  if (hint) text("signal", hint);
  updateInteraction();
}

function control(dt) {
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const input = {
    forward: Number(up) - Number(down) - movement.y,
    strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + movement.x,
    turn: Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")), look,
    fire: firePressed || firing || touchGun.active || keys.has("Space"),
    tilt: tilt + (Number(keys.has("PageUp")) - Number(keys.has("PageDown"))) * dt * 1.5,
    dash: dashPressed, reload: reloadPressed, interact: interactPressed, skill: skillPressed,
  };
  look = 0;
  tilt = 0;
  dashPressed = false;
  reloadPressed = false;
  interactPressed = false;
  skillPressed = undefined;
  firePressed = false;
  return input;
}

function playCue({ kind, x, y, color }) {
  if (!volumes.effects) return;
  if (x === undefined) {
    sound.effect(kind, color);
    return;
  }
  const p = run.player;
  const dx = x - p.x;
  const dy = y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 16) return;
  const muffled = distance > .1 && cast(run, p.x, p.y, dx / distance, dy / distance, distance).distance < distance - .23;
  const pan = Math.sin(Math.atan2(dy, dx) - p.angle) * Math.min(.8, distance / 2);
  const level = (1 - distance / 16) ** 1.4 * (muffled ? .44 : 1);
  sound.effect(kind, color, { pan, level, muffled });
}

function frame(now) {
  const elapsed = Math.min((now - previous) / 1000, .05);
  previous = now;
  if (mode === "play") {
    stepRun(run, control(elapsed), elapsed);
    for (const cue of run.cues.splice(0)) playCue(cue);
    updateScore();
    const events = run.events.splice(0);
    advanceDream(run, events);
    for (const event of events) {
      if (event === "arena") beginScene(run.training ? "dream-guard" : ({ island: "king", vault: "rust" })[run.map.key] ?? "watcher");
      if (event === "skill") showSkills();
      if (event === "victory") updateScore();
      if (event.startsWith("shop-")) openShop(event.slice(5));
      if (event === "rescue-code") beginScene(run.rescue.person + "-code");
      if (event === "rescue-free") beginScene(run.rescue.person + "-free");
      if (event === "rescue-lock") {
        $("rescue-form").reset();
        text("rescue-error", "");
        show("rescue-lock");
        $("rescue-code").focus({ preventScroll: true });
      }
    }
    updateHud();
    if (mode === "play") paint(run);
    if (run.status === "dead") finish();
    if (run.status === "won") {
      const upcoming = nextLevel(run);
      if (upcoming) {
        run = upcoming;
        run.hint = run.map.key === "vault" ? "Восемь осколков · следуй за синей стрелкой"
          : touch ? "Пять осколков · умения на карте" : "Пять осколков · карта и умения на Tab";
        run.hintUntil = 4.2;
        beginScene(run.map.key === "vault" ? "vault-arrival" : "crossing");
      } else beginScene(run.training ? "dream-end" : run.map.key === "vault" ? "vault-end" : "ending");
    }
  } else if (mode === "menu" && !reducedMotion.matches) paintMenu(now);
  else if (mode === "sea") seaFrame(elapsed);
  else if (mode === "cinematic") film(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const moves = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","PageUp","PageDown","KeyR","KeyE","ShiftLeft","ShiftRight"]);
document.addEventListener("keydown", event => {
  if ($("settings").open) return;
  if (!event.repeat && event.code === "Escape" && ["chapters", "rescue-lock"].includes(mode)) {
    event.preventDefault();
    if (mode === "chapters") $("chapters-close").click();
    else resumePlay();
    return;
  }
  if (mode === "shop" && event.code === "Escape" && !event.repeat) {
    event.preventDefault();
    resumePlay();
    return;
  }
  if (mode === "menu" && ["ArrowUp", "ArrowDown"].includes(event.code)) {
    event.preventDefault();
    const current = titleChoices.indexOf(document.activeElement);
    const offset = event.code === "ArrowUp" ? -1 : 1;
    const target = current === -1 ? 0 : (current + offset + titleChoices.length) % titleChoices.length;
    titleChoices[target].focus();
    return;
  }
  if (mode === "skills" && /^Digit[1-3]$/.test(event.code)) {
    event.preventDefault();
    const skill = run.skillChoices[Number(event.code.at(-1)) - 1];
    if (skill && !event.repeat) selectSkill(skill.id);
    return;
  }
  if (mode === "cinematic" && event.code === "Escape" && !event.repeat) {
    event.preventDefault();
    leaveScene(false);
    return;
  }
  if (mode === "cinematic" && event.code === "Space" && !event.repeat) {
    event.preventDefault();
    advanceScene();
    return;
  }
  if ((event.code === "Tab" || event.code === "KeyM") && ["play","chart"].includes(mode)) {
    event.preventDefault();
    if (!event.repeat) {
      if (mode === "chart") resumePlay();
      else show("chart");
    }
    return;
  }
  if (!event.repeat && event.code === "Escape" && ["play","sea","chart","pause"].includes(mode)) {
    event.preventDefault();
    if (mode === "play" || mode === "sea") show("pause");
    else resumePlay();
    return;
  }
  if (mode === "sea") {
    if (/^Digit[1-3]$/.test(event.code)) {
      event.preventDefault();
      if (!event.repeat) answerHelm(voyage, Number(event.code.at(-1)) - 1);
    } else if (["KeyQ","KeyE","KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      if (!event.repeat && (event.code === "KeyQ" || event.code === "KeyE")) {
        fireBroadside(voyage, event.code === "KeyQ" ? -1 : 1);
      }
    }
    return;
  }
  if (event.target.matches?.("button,a,input")) return;
  if (mode !== "play") return;
  if (skillKeys.has(event.code)) {
    event.preventDefault();
    if (!event.repeat) skillPressed = event.code.at(-1);
    return;
  }
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
  if (!event.repeat && event.code === "KeyR") reloadPressed = true;
  if (!event.repeat && event.code === "KeyE") interactPressed = true;
  if (!event.repeat && event.code === "Space") firePressed = true;
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
  if (mode !== "play" || event.button !== 0 || drag && event.pointerType === "touch") return;
  scene.focus({ preventScroll: true });
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.pointerType !== "touch") {
    firing = true;
    firePressed = true;
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
if (touch) window.addEventListener("resize", clearInput);
window.addEventListener("blur", () => { if (mode === "play" || mode === "sea") show("pause"); else clearInput(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && (mode === "play" || mode === "sea")) show("pause"); });
fireButton.addEventListener("click", event => {
  if (mode === "play" && !event.detail) firePressed = true;
});
seaFireButton.addEventListener("click", event => {
  if (mode === "sea" && !event.detail) fireAtBroadside();
});
tapAction($("touch-dash"), () => { if (mode === "play") dashPressed = true; });
tapAction($("touch-reload"), () => { if (mode === "play") reloadPressed = true; });
tapAction($("touch-weapon"), () => {
  if (mode !== "play") return;
  const list = [...run.player.arsenal];
  switchWeapon(run, list[(list.indexOf(run.player.weapon) + 1) % list.length]);
});
$("start").addEventListener("click", () => start());
$("chapter-select").addEventListener("click", () => {
  show("chapters");
  $("chapter-one").focus({ preventScroll: true });
});
$("chapter-one").addEventListener("click", () => start());
$("chapters-close").addEventListener("click", () => {
  show("menu");
  $("chapter-select").focus({ preventScroll: true });
});
$("rescue-close").addEventListener("click", resumePlay);
$("rescue-form").addEventListener("submit", event => {
  event.preventDefault();
  if (mode !== "rescue-lock") return;
  if (unlockRescue(run, $("rescue-code").value.trim())) resumePlay();
  else {
    text("rescue-error", "Замок не открылся. Проверь код в журнале карты.");
    $("rescue-code").select();
  }
});
$("retry").addEventListener("click", () => {
  if (voyage?.phase === "dead") {
    prepareVoyage();
    embark();
  } else start();
});
$("raise-anchor").addEventListener("click", embark);
$("skip-dream").addEventListener("click", wakeDream);
$("dream-replay").addEventListener("click", () => {
  $("settings").close();
  start(true);
});
if (touch) {
  $("map-toggle").setAttribute("aria-label", "Карта");
  $("pause-toggle").setAttribute("aria-label", "Пауза");
  text("brief-course", "Веди корабль джойстиком слева. Держи цели вдоль борта.");
  text("brief-fire", "«Огонь» стреляет по подсвеченным целям. Стрелки рядом стреляют с выбранного борта.");
  text("brief-orders", "При тревоге нажми кнопку с указанным номером, пока идёт отсчёт.");
}
for (const [i, button] of broadsides.entries()) button.addEventListener("click", () => {
  if (mode === "sea") fireBroadside(voyage, i * 2 - 1);
});
for (const button of document.querySelectorAll("[data-helm]")) tapAction(button, () => {
  if (mode === "sea") {
    answerHelm(voyage, Number(button.dataset.helm));
    seaView.focus({ preventScroll: true });
  }
});
for (const [i, button] of touchCannons.entries()) tapAction(button, () => {
  if (mode === "sea") fireBroadside(voyage, i * 2 - 1);
});
$("skip-scene").addEventListener("click", () => leaveScene(true));
$("scene-next").addEventListener("click", advanceScene);
$("continue").addEventListener("click", resumePlay);
$("shop-close").addEventListener("click", resumePlay);
$("menu-return").addEventListener("click", () => show("menu"));
$("result-menu").addEventListener("click", () => show("menu"));
tapAction($("pause-toggle"), () => { if (mode === "play" || mode === "sea") show("pause"); });
tapAction($("map-toggle"), () => { if (mode === "play") show("chart"); });
$("chart-close").addEventListener("click", resumePlay);
tapAction(useButton, () => {
  if (mode === "play") {
    interactPressed = true;
    scene.focus({ preventScroll: true });
  }
});
for (const id of ["menu-settings", "pause-settings"]) $(id).addEventListener("click", () => $("settings").showModal());
$("settings-close").addEventListener("click", () => $("settings").close());
show("menu");
$("start").disabled = false;
