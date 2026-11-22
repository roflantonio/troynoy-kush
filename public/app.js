const $ = id => document.getElementById(id);
const gameUrl = new URL("./", window.location.href);
const apiOrigin = document.querySelector('meta[name="game-api-origin"]')?.content || gameUrl.origin;
const icon = {
  coins: ["🪙", "Монеты"], watch: ["⌚", "Часы"], gem: ["💎", "Бриллиант"],
  painting: ["🖼️", "Картина"], gold: ["🟨", "Слиток"], crown: ["👑", "Корона"], ring: ["💍", "Перстень"],
};
const gadgetName = { double: "Удвоение", shield: "Щит" };
const colors = ["orange", "violet", "green"];
let session = readStorage("heist-session");
let state = null;
let stateKey = "";
let choice = null;
let gadget = null;
let lockedRequest = false;
let entryPending = false;
let requestEpoch = 0;
let pollTimer;
let clockSkew = 0;
let sound = readStorage("heist-sound") === true;
let audio;
let offline = false;
let noticeTimer;

function readStorage(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

function saveStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* The current tab remains usable. */ }
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
}

async function request(path, input, token) {
  const headers = {};
  if (input !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  let response;
  try {
    response = await fetch(new URL("/api/rooms" + path, apiOrigin), {
      method: input === undefined ? "GET" : "POST",
      headers,
      body: input === undefined ? undefined : JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(9500),
    });
  } catch {
    throw new Error("Связь с сервером прервалась.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (!data.state && !data.left)) {
    const error = new Error(data.error || "Сервер игры временно недоступен.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function entryError(message = "") {
  $("entry-error").textContent = message;
  $("entry-error").hidden = !message;
}

function notice(message = "", isError = false, temporary = false) {
  clearTimeout(noticeTimer);
  $("room-notice").textContent = message;
  $("room-notice").hidden = !message;
  $("room-notice").dataset.error = isError;
  if (temporary) noticeTimer = setTimeout(() => notice(), 3000);
}

function showJoin(show) {
  $("join-fields").hidden = !show;
  $("show-join").setAttribute("aria-expanded", String(show));
}

function enableSound() {
  $("sound").setAttribute("aria-label", sound ? "Выключить звук" : "Включить звук");
  $("sound").setAttribute("aria-pressed", String(sound));
}

function chime(type) {
  if (!sound || !audio) return;
  try {
    const notes = type === "alarm" ? [248, 207] : type === "reveal" ? [436, 580, 698] : [484];
    notes.forEach((frequency, index) => {
      const start = audio.currentTime + index * 0.095;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type === "alarm" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.105, start + 0.026);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
  } catch { /* Audio stays optional. */ }
}

function wakeAudio() {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch { /* Audio stays optional. */ }
}

function setResume() {
  $("resume").hidden = !session;
  $("resume").textContent = session ? "Вернуться в комнату " + session.code : "";
}

function showHome(clear = false) {
  ++requestEpoch;
  clearTimeout(pollTimer);
  if (clear) {
    session = null;
    saveStorage("heist-session", null);
  }
  state = null;
  stateKey = "";
  choice = null;
  gadget = null;
  offline = false;
  $("room").hidden = true;
  $("home").hidden = false;
  notice();
  history.replaceState(null, "", gameUrl);
  setResume();
  $("nickname").focus({ preventScroll: true });
}

function inviteUrl(code) {
  const url = new URL(gameUrl);
  url.searchParams.set("room", code);
  return url.href;
}

function rememberRoom(token, next) {
  session = { code: next.code, token };
  saveStorage("heist-session", session);
  history.replaceState(null, "", inviteUrl(next.code));
  accept(next);
  document.querySelector(".room h1")?.focus({ preventScroll: true });
  queuePoll();
}

function accept(next) {
  const changedPhase = state && (next.phase !== state.phase || next.round !== state.round);
  if (!state || next.round !== state.round || next.phase !== state.phase) {
    choice = null;
    gadget = null;
  }
  clockSkew = next.now - Date.now();
  const key = JSON.stringify({ ...next, now: 0 });
  state = next;
  if (offline) {
    offline = false;
    notice();
  }
  if (stateKey !== key) {
    stateKey = key;
    render();
  }
  if (changedPhase && next.phase === "reveal") {
    const results = next.history.at(-1)?.results ?? [];
    chime(results.some(result => result.collision) ? "alarm" : "reveal");
  }
  updateClock();
}

function queuePoll() {
  clearTimeout(pollTimer);
  if (!session || !state) return;
  pollTimer = setTimeout(sync, document.hidden ? 2800 : 1000);
}

async function sync() {
  if (!state || !session) return;
  if (lockedRequest) { queuePoll(); return; }
  const epoch = requestEpoch;
  const { code, token } = session;
  try {
    const data = await request("/" + code, undefined, token);
    if (epoch === requestEpoch) accept(data.state);
  } catch (error) {
    if (epoch !== requestEpoch) return;
    if (error.status === 401 || error.status === 404) {
      showHome(true);
      entryError(error.message);
      return;
    }
    offline = true;
    notice(error.message + " Переподключаемся…", true);
  } finally {
    queuePoll();
  }
}

async function enter(mode) {
  if (entryPending) return;
  const name = $("nickname").value.trim();
  const code = normalizeCode($("room-code").value);
  if (mode !== "resume" && (![...name].length || [...name].length > 18)) {
    entryError("Введи имя длиной от 1 до 18 символов.");
    $("nickname").focus();
    return;
  }
  if (mode === "join" && code.length !== 6) {
    entryError("Введи шестизначный код комнаты.");
    $("room-code").focus();
    return;
  }
  entryPending = true;
  const controls = ["create", "join", "resume", "show-join"].map($);
  controls.forEach(button => button.disabled = true);
  entryError();
  wakeAudio();
  try {
    let data;
    if (mode === "resume" && session) {
      data = await request("/" + session.code, undefined, session.token);
      data.token = session.token;
    } else {
      data = await request(mode === "join" ? "/" + code + "/join" : "", { name });
      saveStorage("heist-nickname", name);
    }
    rememberRoom(data.token, data.state);
    chime("join");
  } catch (error) {
    if (mode === "resume" && (error.status === 401 || error.status === 404)) showHome(true);
    entryError(error.message);
  } finally {
    controls.forEach(button => button.disabled = false);
    entryPending = false;
  }
}

async function move(action, details = {}) {
  if (!state || lockedRequest) return;
  lockedRequest = true;
  const epoch = ++requestEpoch;
  notice();
  wakeAudio();
  try {
    const data = await request("/" + state.code + "/action", { action, round: state.round, ...details }, session.token);
    if (epoch !== requestEpoch) return;
    if (data.left) showHome(true);
    else accept(data.state);
  } catch (error) {
    if (epoch === requestEpoch) notice(error.message, true);
  } finally {
    lockedRequest = false;
    queuePoll();
  }
}

function roster(lobby = false) {
  const slots = [...state.players];
  while (slots.length < 3) slots.push(null);
  return '<div class="roster">' + slots.map(player => {
    if (!player) return '<div class="player empty"><span class="avatar violet" aria-hidden="true">+</span><div class="player-name"><b>Свободно</b><small>Ждём игрока</small></div></div>';
    const me = player.id === state.me;
    const status = lobby ? (player.id === state.host ? "Создатель" : "В комнате")
      : state.phase === "choose" ? (player.locked ? "Выбор принят" : "Выбирает")
      : (me ? "Ты" : "");
    const name = escape(player.name) + (me && status !== "Ты" ? " (ты)" : "");
    return '<div class="player"><span class="avatar ' + colors[player.color] + '" aria-hidden="true">' + escape([...player.name][0].toUpperCase()) + '</span>'
      + '<div class="player-name"><b>' + name + '</b>' + (status ? '<small>' + status + '</small>' : "") + '</div>'
      + (lobby ? "" : '<strong class="score" aria-label="' + player.score + ' очков">' + player.score + '</strong>') + '</div>';
  }).join("") + '</div>';
}

function lobby() {
  const host = state.me === state.host;
  const count = state.players.length;
  return '<div class="kicker">КОМНАТА ' + state.code + '</div><div class="room-head"><div><h1 tabindex="-1">Собираем команду</h1>'
    + '<p class="room-sub">Пригласи двух друзей или передай им код комнаты.</p></div></div>'
    + '<div class="lobby-panel">' + roster(true) + '<div class="lobby-actions"><p>Игроков ' + count + ' из 3'
    + (!host && count === 3 ? ' · ждём старта' : '') + '</p>'
    + (host ? '<button class="button hot" data-action="start"' + (count === 3 ? '' : ' disabled') + '>Начать налёт</button>' : '')
    + '</div></div>';
}

function title(text, description, timer, label) {
  return '<div class="kicker">' + label + '</div><div class="room-head"><div><h1 tabindex="-1">' + text + '</h1><p class="room-sub">' + description + '</p></div>'
    + (timer ? '<time class="timer" id="timer" aria-label="Осталось секунд"></time>' : '') + '</div>'
    + (timer ? '<div class="clock-track" aria-hidden="true"><div class="clock-fill" id="clock-fill"></div></div>' : '');
}

function choosing() {
  const locked = Boolean(state.selection);
  const me = state.players.find(player => player.id === state.me);
  const picked = state.selection?.item ?? choice;
  const pickedGadget = state.selection?.gadget ?? gadget;
  const cards = state.scene.items.map(([key, value], index) => {
    const [emoji, name] = icon[key];
    const marks = state.players.filter(player => player.bluff === index)
      .map(player => '<span class="pill ' + colors[player.color] + '" title="Метка ' + escape(player.name) + '">' + escape(player.name) + '</span>').join("");
    return '<button type="button" class="loot" data-item="' + index + '" aria-pressed="' + (picked === index) + '"' + (locked ? ' disabled' : '') + '>'
      + '<span class="emoji" aria-hidden="true">' + emoji + '</span><b>' + name + '</b><strong>+' + value + '</strong><span class="labels">' + marks + '</span></button>';
  }).join("");
  return title(state.scene.title, locked ? "Выбор принят. Ждём остальных." : "Выбери предмет. Если кто-то выберет тот же, сработает сигнализация.",
    true, 'РАУНД ' + (state.round + 1) + ' ИЗ ' + state.total)
    + '<div class="loot-list">' + cards + '</div>'
    + '<div class="move-tools">' + Object.entries(gadgetName).map(([key, label]) =>
      '<button type="button" class="top-button tool" data-gadget="' + key + '" aria-pressed="' + (key === pickedGadget) + '"'
      + (locked || !state.gadgets.includes(key) ? ' disabled' : '') + '>' + (key === "double" ? "×2 " : "⛨ ") + label
      + (!state.gadgets.includes(key) ? ' ✓' : '') + '</button>').join('') + '</div>'
    + '<div class="move-footer">'
    + '<button class="button ghost bluff" data-action="bluff"' + (locked || (choice === null && me.bluff === null) ? ' disabled' : '') + '>'
    + (me.bluff !== null && (choice === null || me.bluff === choice) ? 'Снять метку' : 'Поставить метку') + '</button>'
    + '<button class="button hot confirm" data-action="pick"' + (locked || choice === null ? ' disabled' : '') + '>'
    + (locked ? 'Выбор принят' : 'Подтвердить выбор') + '</button></div>'
    + roster();
}

function reveal() {
  const { results } = state.history.at(-1);
  const alarm = results.some(result => result.collision);
  const final = state.round + 1 === state.total;
  const rows = results.map(result => {
    const player = state.players.find(member => member.id === result.player);
    const loot = result.item === null ? "Пропустил ход" : icon[state.scene.items[result.item][0]].join(" ");
    const extra = (result.collision ? " · сигнализация" : "") + (result.gadget ? " · " + gadgetName[result.gadget] : "");
    return '<li><div><b>' + escape(player.name) + '</b><span>' + loot + extra + '</span></div><strong'
      + (result.collision ? ' class="alarm"' : '') + '>+' + result.points + '</strong></li>';
  }).join("");
  return title(alarm ? "Сигнализация!" : "Добыча поделена", "Выборы раскрыты. Очки уже на счёте.", true,
    'РАУНД ' + (state.round + 1) + ' ИЗ ' + state.total)
    + roster() + '<ul class="round-results">' + rows + '</ul>'
    + (state.host === state.me ? '<button class="button hot" data-action="advance">' + (final ? 'Итоги игры' : 'Следующий раунд') + '</button>' : '');
}

function finished() {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const leaders = sorted.filter(player => player.score === sorted[0].score);
  const headline = leaders.length === 1 ? escape(leaders[0].name) + ' забирает куш!' : 'Куш поделён!';
  const summary = leaders.length === 1 ? "Итоговый счёт за 7 раундов." : 'Победители: ' + leaders.map(player => escape(player.name)).join(', ') + '.';
  const rows = sorted.map((player) =>
    '<li><div><b>' + (player.score === sorted[0].score ? '👑 ' : '') + escape(player.name) + '</b></div><strong>' + player.score + '</strong></li>').join("");
  return title(headline, summary, false, 'ФИНАЛ')
    + '<ul class="round-results">' + rows + '</ul>'
    + (state.host === state.me ? '<button class="button hot" data-action="replay">Сыграть реванш</button>'
      : '<p class="room-sub">Создатель комнаты может запустить реванш.</p>');
}

function render() {
  const active = document.activeElement;
  const focusKey = active?.dataset?.action ? '[data-action="' + active.dataset.action + '"]'
    : active?.dataset?.item ? '[data-item="' + active.dataset.item + '"]'
    : active?.dataset?.gadget ? '[data-gadget="' + active.dataset.gadget + '"]' : null;
  $("home").hidden = true;
  $("room").hidden = false;
  $("room-toolbar").innerHTML = '<div><span class="room-code">' + state.code + '</span><button class="button ghost small" data-action="invite">Скопировать приглашение</button></div>'
    + '<button class="top-button" data-action="leave">Выйти</button>';
  $("room-content").innerHTML = { lobby, choose: choosing, reveal, finished }[state.phase]();
  if (focusKey) document.querySelector(focusKey)?.focus({ preventScroll: true });
  updateClock();
}

function updateClock() {
  const timer = $("timer");
  if (!timer || !state?.deadline) return;
  const remaining = Math.max(0, state.deadline - (Date.now() + clockSkew));
  const seconds = Math.ceil(remaining / 1000);
  timer.textContent = "0:" + String(seconds).padStart(2, "0");
  timer.classList.toggle("urgent", seconds <= 5);
  $("clock-fill").style.transform = "scaleX(" + Math.min(1, remaining / (state.phase === "choose" ? 25_000 : 9_000)) + ")";
}

async function copyInvite() {
  const url = inviteUrl(state.code);
  try {
    await navigator.clipboard.writeText(url);
    notice("Ссылка скопирована. Отправь её друзьям!", false, true);
  } catch {
    const field = document.createElement("input");
    field.value = url;
    field.readOnly = true;
    field.setAttribute("aria-label", "Ссылка для друзей");
    field.style.width = "100%";
    notice();
    $("room-notice").hidden = false;
    $("room-notice").append(field);
    field.select();
  }
}

$("room").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || !state || button.disabled) return;
  wakeAudio();
  const { action, item, gadget: selectedGadget } = button.dataset;
  if (item !== undefined) {
    choice = Number(item);
    chime("pick");
    render();
    return;
  }
  if (selectedGadget) {
    gadget = gadget === selectedGadget ? null : selectedGadget;
    render();
    return;
  }
  if (action === "invite") { copyInvite(); return; }
  if (action === "leave" && ["choose", "reveal"].includes(state.phase)) { showHome(); return; }
  if (action === "pick" && choice !== null) { move(action, { item: choice, gadget }); return; }
  if (action === "bluff") {
    const current = state.players.find(player => player.id === state.me).bluff;
    move(action, { item: current === choice ? null : choice });
    return;
  }
  if (action) move(action);
});

$("entry-form").addEventListener("submit", event => {
  event.preventDefault();
  const join = event.submitter === $("join") || document.activeElement === $("room-code");
  enter(join ? "join" : "create");
});
$("show-join").addEventListener("click", () => {
  const toggle = $("join-fields").hidden;
  showJoin(toggle);
  if (toggle) $("room-code").focus();
});
$("room-code").addEventListener("input", event => { event.target.value = normalizeCode(event.target.value); });
$("resume").addEventListener("click", () => enter("resume"));
$("sound").addEventListener("click", () => {
  sound = !sound;
  saveStorage("heist-sound", sound);
  enableSound();
  wakeAudio();
  chime("pick");
});
$("open-rules").addEventListener("click", () => $("rules").showModal());
$("close-rules").addEventListener("click", () => $("rules").close());
$("rules-ok").addEventListener("click", () => $("rules").close());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state) {
    clearTimeout(pollTimer);
    queuePoll();
  }
});

const invited = normalizeCode(new URLSearchParams(location.search).get("room") ?? "");
$("nickname").value = readStorage("heist-nickname") ?? "";
enableSound();
setResume();
if (invited.length === 6) {
  $("room-code").value = invited;
  showJoin(true);
  if (session?.code === invited) enter("resume");
}
setInterval(updateClock, 200);
