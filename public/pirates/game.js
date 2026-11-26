import { ARMORY, advanceDream, cast, chooseSkill, compassObjective, createDream, createRun, dreamHint, location, nextLevel, secretAhead, stepRun, switchWeapon, weaponCapacity } from "./world.js?v=13";
import { createRenderer, mapDraw } from "./render.js?v=13";
import { pirateSound } from "./sound.js?v=13";
import { FLEET_TOTAL, FLEET_WAVES, KRAKEN_HP, HELM, answerHelm, beginKraken, broadsideTarget, fireBroadside, newVoyage, stepVoyage } from "./sea.js?v=13";
import { seaRenderer } from "./sea-render.js?v=13";
import { animateFortMenu } from "./menu-scene.js?v=13";

const $ = id => document.getElementById(id);
const scene = $("scene");
const paint = createRenderer(scene);
const paintMenu = animateFortMenu($("title-art"));
const seaView = $("sea-view");
const paintSea = seaRenderer(seaView);
const broadsides = [$("port-cannon"), $("starboard-cannon")];
const reloadMeters = broadsides.map(button => button.querySelector("progress"));
const touch = matchMedia("(any-pointer: coarse)").matches;
const keys = new Set();
const held = new Set();
const relicMarks = [...document.querySelectorAll(".compass-gems i")];
const roundMarks = [...document.querySelectorAll(".chambers i")];
const titleChoices = [...document.querySelectorAll(".title-choice")];
const screens = ["menu", "pause", "result", "chart", "cinematic", "skills", "sea-briefing"];
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
let previous = performance.now();
let look = 0;
let tilt = 0;
let dashPressed = false;
let reloadPressed = false;
let interactPressed = false;
let cinematic = null;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let firing = false;
let firePressed = false;
let lockedBefore = false;
let drag = null;

function clearInput() {
  keys.clear();
  held.clear();
  firing = false;
  firePressed = false;
  look = 0;
  tilt = 0;
  dashPressed = false;
  reloadPressed = false;
  interactPressed = false;
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

function updateScore() {
  const calmScene = mode === "cinematic" && ["arrival", "ending"].includes(cinematic.kind);
  if (mode === "menu" || calmScene || run.training) sound.track("dock");
  else if (voyage) sound.track(voyage.phase === "fleet" ? "sea"
    : ["reveal", "kraken"].includes(voyage.phase) ? "kraken" : voyage.phase === "dead" ? "silence" : "dock");
  else if (run.status === "won" || run.arena.cleared) sound.track("dock");
  else if (run.status === "dead") sound.track("silence");
  else if (run.map.key === "island") sound.track(run.arena.active ? "king" : "island");
  else sound.track(run.arena.active ? "watcher" : "fort");
}

function skillIcon(skill) {
  const icon = document.createElement("span");
  icon.className = "skill-icon";
  icon.style.backgroundPosition = skill.icon % 6 * 20 + "% " + Math.floor(skill.icon / 6) * 25 + "%";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function skillDetails(skill) {
  const details = document.createElement("span");
  const name = document.createElement("strong");
  const effect = document.createElement("span");
  name.textContent = skill.name + (skill.maxRank > 1 ? " · " + ["I","II","III"][skill.rank - 1] : "");
  effect.textContent = skill.effect;
  details.append(name, effect);
  return details;
}

function showSkills() {
  const choices = run.skillChoices.map((skill, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-card";
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
    entry.append(skillIcon(skill), skillDetails(skill));
    return entry;
  });
  $("learned-skills").replaceChildren(...entries);
  $("skills-empty").hidden = entries.length > 0;
}

function show(next) {
  mode = next;
  $("cabinet").dataset.mode = next;
  $("cabinet").toggleAttribute("data-dream", !!run.training);
  clearInput();
  for (const screen of screens) $(screen).hidden = next !== screen;
  const seaVisible = !!voyage && (["sea", "pause", "sea-briefing"].includes(next) || (next === "cinematic" && cinematic.kind === "kraken"));
  $("sea").hidden = !seaVisible;
  $("sea-hud").hidden = $("sea-controls").hidden = next !== "sea";
  if (next !== "sea") {
    for (const id of ["sea-notice", "sea-qte", "kraken-meter"]) $(id).hidden = true;
  }
  $("deck").hidden = seaVisible || !["play", "pause", "chart"].includes(next);
  $("boss-hud").hidden = next !== "play" || !run.arena.active || run.arena.cleared;
  $("crosshair").hidden = next !== "play";
  $("signal").hidden = next !== "play" || run.hintUntil < run.time || !run.hint;
  $("interaction").hidden = next !== "play" || !secretAhead(run);
  $("touch").hidden = !touch || next !== "play";
  $("map-toggle").hidden = next !== "play";
  $("pause-toggle").hidden = next !== "play" && next !== "sea";
  $("skip-dream").hidden = !run.training || next !== "pause";
  $("dream-replay").hidden = next !== "menu";
  updateScore();
  if (next !== "play") sound.combat(0);
  if (next !== "play" && document.pointerLockElement === scene) {
    lockedBefore = false;
    document.exitPointerLock?.();
  }
  if (next === "play") scene.focus({ preventScroll: true });
  if (next === "sea") seaView.focus({ preventScroll: true });
  if (next === "chart") {
    if (run.training?.step === 10) run.training.chart = true;
    text("chart-title", run.training ? "Карта сна" : run.map.key === "island" ? "Карта острова" : "Карта форта");
    text("chart-location", location(run));
    text("chart-secrets", "Тайные ходы " + run.secrets.filter(secret => secret.open).length + " / " + run.secrets.length);
    showLearnedSkills();
    const map = $("map");
    map.width = 28 + run.width * 6;
    map.height = 28 + run.height * 6;
    map.style.minWidth = run.map.key === "island" ? Math.round(run.width * 4.1) + "px" : "";
    const position = mapDraw(map, run);
    const paper = $("chart-scroll");
    paper.scrollLeft = paper.scrollWidth * position - paper.clientWidth / 2;
    $("chart-close").focus({ preventScroll: true });
  }
}

const speakers = {
  pirate: { name: "Моряк", pace: 32 },
  watcher: { name: "Смотритель", pace: 43 },
  king: { name: "Король обезьян", pace: 38 },
};

const scenes = {
  "dream-start": {
    title: "До шторма",
    next: "Встать с лежанки",
    lines: [
      { speaker: "pirate", shot: "dark", text: "Опять снится старый трюм. Боцман будил меня до рассвета, чтобы я повторил всё, что может спасти жизнь в походе." },
      { speaker: "pirate", shot: "dream", text: "Кажется, я ещё помню его уроки. Сначала надо оглядеться. Прервать сон можно через паузу." },
    ],
  },
  "dream-guard": {
    title: "Последний урок",
    next: "На арену",
    lines: [
      { speaker: "pirate", shot: "dream", text: "Боцман всегда говорил: следи за замахом, уходи с линии залпа и отвечай, пока враг не готов атаковать снова." },
      { speaker: "pirate", shot: "dream", text: "У разных противников свои слабости. Щит опускается во время замаха, а отмеченные круги и полосы опасны, пока не минует удар. После победы войду в ворота." },
    ],
  },
  "dream-end": {
    title: "Перед пробуждением",
    next: "Проснуться",
    lines: [
      { speaker: "pirate", shot: "dream", text: "Мушкетон хорош вблизи, а длинный мушкет — на расстоянии. Патроны кончатся, если стрелять без разбора. Сабля всегда со мной." },
      { speaker: "pirate", shot: "dark", text: "В настоящем походе карта заполнится по мере разведки, а капитанские умения останутся со мной на следующем острове. Кажется, это уже шум настоящих волн…" },
    ],
  },
  arrival: {
    title: "Форт проклятых",
    lines: [
      { speaker: "pirate", shot: "dark", text: "В ушах шумит. Воды полный рот… Я ещё жив?" },
      { speaker: "pirate", shot: "fort", text: "Форт проклятых. Течение выбросило меня прямо к воротам." },
      { speaker: "pirate", shot: "fort", text: "Мой корабль разбит. Найду три осколка, открою дальние врата и выберусь отсюда." },
    ],
  },
  watcher: {
    title: "Зал Смотрителя",
    lines: [
      { speaker: "pirate", shot: "arena", text: "Решётка захлопнулась. Ты держишь здесь выход?" },
      { speaker: "watcher", shot: "arena", text: "Море забрало мою команду. Теперь ты займёшь её место." },
      { speaker: "pirate", shot: "arena", text: "Море уже пыталось. Теперь открой ворота." },
    ],
  },
  crossing: {
    title: "Остров обезьян",
    next: "Сойти на берег",
    lines: [
      { speaker: "pirate", shot: "island", text: "Паром проклятых вышел из тумана, едва я покинул форт. На его палубе не было ни души." },
      { speaker: "pirate", shot: "island", text: "Вон берег. Компас дрожит так, будто чует ещё пять осколков. Придётся пойти за стрелкой." },
    ],
  },
  king: {
    title: "Трон обезьян",
    next: "В бой",
    lines: [
      { speaker: "pirate", shot: "arena", text: "Пять печатей пали. Почему же джунгли вдруг замолчали?" },
      { speaker: "king", shot: "arena", text: "Я слышал каждый твой шаг, капитан. Оставь компас у трона, и остров отпустит тебя." },
      { speaker: "pirate", shot: "arena", text: "За мной уже закрывалась одна решётка. Я больше не оставляю своё спасение в чужих руках." },
    ],
  },
  ending: {
    title: "Берег на рассвете",
    next: "Выйти в море",
    lines: [
      { speaker: "pirate", shot: "ending", text: "Король пал. Лианы разошлись, и за руинами показалась бухта. У берега ещё ждёт судно." },
      { speaker: "pirate", shot: "ending", text: "Компас собран. Он больше не тянет меня к берегу. Впервые стрелка смотрит в открытое море." },
    ],
  },
  kraken: {
    title: "Кракен",
    next: "К пушкам",
    lines: [
      { speaker: "pirate", shot: "kraken", text: "Кракен… Так вот почему флот не смог уйти из этой воды. К пушкам, пока он не утащил нас на дно." },
    ],
  },
};

function setLine(index, now) {
  const line = cinematic.act.lines[index];
  const delay = line.shot === "kraken" ? 2050 : line.shot === "dark" ? 580 : 200;
  Object.assign(cinematic, { index, letters: Array.from(line.text), shown: 0, nextLetter: now + delay });
  $("cinematic").dataset.shot = line.shot;
  $("cinematic").dataset.speaker = line.speaker;
  text("speaker-name", speakers[line.speaker].name);
  text("cinematic-line", "");
  text("accessible-line", speakers[line.speaker].name + ". " + line.text);
  text("scene-next", "Показать текст");
}

function beginScene(kind) {
  const act = scenes[kind];
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
  if (kind === "watcher" || kind === "king") {
    const pan = reducedMotion.matches ? 0 : Math.min(1, (now - started) / 8000);
    paint(run, { x: run.arena.left + 2.9 + pan * 4.4, y: run.boss.y + (1 - pan) * 1.75,
      angle: -.23 + pan * .22, pitch: .028, bob: 0, moving: 0, time: run.time + (now - started) / 1000 });
  }
  if (kind === "kraken") paintSea(voyage, (now - started) / 1000, reducedMotion.matches);
  if (run.training && act.lines[index].shot === "dream") paint(run, { ...run.player });
}

function leaveScene(interactive) {
  const kind = cinematic.kind;
  cinematic = null;
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
  sound.bossPhase(0);
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
  text("result-title", win ? "Конец демо" : "ТЫ ПОГИБ");
  text("retry", win ? "Новый поход" : voyage ? "Повторить морской бой" : "Меня не остановить");
  text("result-menu", win ? "В меню игры" : "Мне нужен покой");
  $("win-note").hidden = !win;
  text("result-location", voyage ? "Открытое море" : run.map.title);
  const secrets = run.history.secrets + run.secrets.filter(secret => secret.open).length;
  const relics = run.history.relics + run.player.relics;
  text("summary", "Осколки " + relics + " / " + (run.history.relics + run.total) + " · Тайники " + secrets
    + " / " + (run.history.totalSecrets + run.secrets.length) + " · Победы " + (run.history.kills + run.player.kills)
    + (voyage ? " · Потоплено " + voyage.sunk + " / " + FLEET_TOTAL : "") + " · " + minute + ":" + seconds);
  show("result");
  $("retry").focus({ preventScroll: true });
}

function prepareVoyage() {
  voyage = newVoyage();
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
    cannon.dataset.aimed = String(!!broadsideTarget(voyage, i * 2 - 1));
    reloadMeters[i].value = 1 - voyage.reload[i] / .83;
  }
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
    if (endingAt > 2.6) finish();
    return;
  }
  const axis = (key, arrow) => Number(keys.has(key) || keys.has(arrow));
  const x = axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft");
  const y = axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp");
  const magnitude = Math.max(1, Math.hypot(x, y));
  if (keys.has("KeyQ")) fireBroadside(voyage, -1);
  if (keys.has("KeyE")) fireBroadside(voyage, 1);
  stepVoyage(voyage, { x: x / magnitude, y: y / magnitude }, dt);
  for (const cue of voyage.cues.splice(0)) sound.effect(cue);
  if (voyage.phase === "reveal") {
    sound.effect("kraken-rise");
    beginScene("kraken");
    return;
  }
  if (voyage.phase === "victory") updateScore();
  updateSeaHud();
  paintSea(voyage, 0, reducedMotion.matches);
}

function updateHud() {
  const player = run.player;
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
  text("weapon", weapon.name);
  text("relics", player.relics + " / " + run.total);
  const dash = $("dash-meter");
  dash.max = player.dashReset;
  dash.value = player.dashReset - player.dashCooldown;
  dash.parentElement.dataset.ready = String(player.dashCooldown === 0);
  $("boss-meter").max = run.boss.max;
  $("boss-meter").value = run.boss.hp;
  $("boss-hud").dataset.stage = run.arena.stage + 1;
  text("boss-name", run.bossName);
  $("boss-meter").setAttribute("aria-label", "Здоровье · " + run.bossName);
  text("boss-phase", run.acts[run.arena.stage].name);
  $("boss-hud").hidden = mode !== "play" || !run.arena.active || run.arena.cleared;
  const hint = run.training ? dreamHint(run, touch) : run.hintUntil >= run.time && run.hint;
  $("signal").hidden = mode !== "play" || !hint;
  if (hint) text("signal", hint);
  $("interaction").hidden = mode !== "play" || !secretAhead(run);
}

function control(dt) {
  const value = (code, touchKey) => keys.has(code) || held.has(touchKey);
  const up = value("KeyW", "forward") || keys.has("ArrowUp");
  const down = value("KeyS", "back") || keys.has("ArrowDown");
  const right = value("ArrowRight", "right");
  const left = value("ArrowLeft", "left");
  const input = {
    forward: Number(up) - Number(down), strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    turn: Number(right) - Number(left), look, fire: firePressed || firing || value("Space", "fire"),
    tilt: tilt + (Number(keys.has("PageUp")) - Number(keys.has("PageDown"))) * dt * 1.5,
    dash: dashPressed, reload: reloadPressed, interact: interactPressed,
  };
  look = 0;
  tilt = 0;
  dashPressed = false;
  reloadPressed = false;
  interactPressed = false;
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
    sound.combat(Math.min(1, run.pressure / 3));
    sound.bossPhase(run.arena.stage);
    const events = run.events.splice(0);
    advanceDream(run, events);
    for (const event of events) {
      if (event === "arena") beginScene(run.training ? "dream-guard" : run.map.key === "island" ? "king" : "watcher");
      if (event === "skill") showSkills();
      if (event === "victory") updateScore();
    }
    updateHud();
    if (mode === "play") paint(run);
    if (run.status === "dead") finish();
    if (run.status === "won") {
      const upcoming = nextLevel(run);
      if (upcoming) {
        run = upcoming;
        run.hint = touch ? "Пять осколков · умения на карте" : "Пять осколков · карта и умения на Tab";
        run.hintUntil = 4.2;
        sound.bossPhase(0);
        beginScene("crossing");
      } else beginScene(run.training ? "dream-end" : "ending");
    }
  } else if (mode === "menu" && !reducedMotion.matches) paintMenu(now);
  else if (mode === "sea") seaFrame(elapsed);
  else if (mode === "cinematic") film(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const moves = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","PageUp","PageDown","KeyR","KeyE","ShiftLeft","ShiftRight"]);
document.addEventListener("keydown", event => {
  if ($("help").open || $("settings").open) return;
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
  if (mode !== "play" || event.button !== 0) return;
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
window.addEventListener("blur", () => { if (mode === "play" || mode === "sea") show("pause"); else clearInput(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && (mode === "play" || mode === "sea")) show("pause"); });
for (const button of document.querySelectorAll(".touch-key")) {
  const action = button.dataset.key;
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (mode !== "play") return;
    button.setPointerCapture?.(event.pointerId);
    if (action === "dash") dashPressed = true;
    else if (action === "reload") reloadPressed = true;
    else {
      if (action === "fire") firePressed = true;
      held.add(action);
    }
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(type, () => held.delete(action));
}
$("touch-weapon").addEventListener("click", () => {
  const list = [...run.player.arsenal];
  switchWeapon(run, list[(list.indexOf(run.player.weapon) + 1) % list.length]);
});
$("start").addEventListener("click", () => start());
$("retry").addEventListener("click", () => {
  if (voyage?.phase === "dead") {
    prepareVoyage();
    embark();
  } else start();
});
$("raise-anchor").addEventListener("click", embark);
$("skip-dream").addEventListener("click", wakeDream);
$("dream-replay").addEventListener("click", () => {
  $("help").close();
  start(true);
});
if (touch) {
  text("brief-course", "Кнопки со стрелками ведут корабль. Держи цели вдоль борта.");
  text("brief-fire", "Нажимай «Левый борт» или «Правый борт», когда цель отмечена.");
  text("brief-orders", "При тревоге нажми кнопку с указанным номером, пока идёт отсчёт.");
}
for (const [i, button] of broadsides.entries()) button.addEventListener("click", () => {
  if (mode === "sea") fireBroadside(voyage, i * 2 - 1);
});
for (const button of document.querySelectorAll("[data-helm]")) button.addEventListener("click", () => {
  if (mode === "sea") {
    answerHelm(voyage, Number(button.dataset.helm));
    seaView.focus({ preventScroll: true });
  }
});
for (const button of document.querySelectorAll("[data-course]")) {
  const code = button.dataset.course;
  button.addEventListener("pointerdown", event => {
    if (mode !== "sea") return;
    button.setPointerCapture?.(event.pointerId);
    keys.add(code);
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(type, () => keys.delete(code));
}
$("skip-scene").addEventListener("click", () => leaveScene(true));
$("scene-next").addEventListener("click", advanceScene);
$("continue").addEventListener("click", resumePlay);
$("menu-return").addEventListener("click", () => show("menu"));
$("result-menu").addEventListener("click", () => show("menu"));
$("pause-toggle").addEventListener("click", () => show("pause"));
$("map-toggle").addEventListener("click", () => show("chart"));
$("chart-close").addEventListener("click", resumePlay);
$("interact-hint").hidden = touch;
$("touch-interact").hidden = !touch;
$("touch-interact").addEventListener("click", () => {
  if (mode === "play") {
    interactPressed = true;
    scene.focus({ preventScroll: true });
  }
});
for (const id of ["guide","pause-guide"]) $(id).addEventListener("click", () => $("help").showModal());
$("help-close").addEventListener("click", () => $("help").close());
for (const id of ["menu-settings", "pause-settings"]) $(id).addEventListener("click", () => $("settings").showModal());
$("settings-close").addEventListener("click", () => $("settings").close());
show("menu");
$("start").disabled = false;
