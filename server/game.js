const rounds = [
  { title: "Первый налёт", items: [["coins", 2], ["watch", 4], ["gem", 7]] },
  { title: "Частная коллекция", items: [["painting", 5], ["gold", 7], ["coins", 3]] },
  { title: "Хранилище открыто", items: [["crown", 10], ["ring", 4], ["watch", 2]] },
  { title: "Ночной аукцион", items: [["watch", 5], ["gem", 8], ["painting", 3]] },
  { title: "Золотой запас", items: [["coins", 2], ["crown", 6], ["gold", 8]] },
  { title: "Этаж под охраной", items: [["ring", 4], ["gold", 6], ["gem", 9]] },
  { title: "Последний куш", items: [["crown", 11], ["painting", 5], ["ring", 7]] },
];

export const ROUND_COUNT = rounds.length;
export const ROOM_EXPIRY = 8 * 60 * 60 * 1000;
const PICK_TIME = 25_000;
const REVEAL_TIME = 9_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class GameError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export function roomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

export function cleanName(value) {
  const name = typeof value === "string" ? value.trim().replace(/[\s\u202a-\u202e\u2066-\u2069]+/gu, " ").trim() : "";
  if (!name || [...name].length > 18) throw new GameError("Введи имя длиной от 1 до 18 символов.", 400);
  return name;
}

export function addPlayer(room, name) {
  if (room.phase !== "lobby") throw new GameError("Партия уже началась.");
  if (room.players.length >= 3) throw new GameError("В этой комнате уже трое.");
  if (room.players.some(player => player.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError("Это имя уже занято в комнате.");
  }
  const availableColors = [0, 1, 2].filter(color => !room.players.some(player => player.color === color));
  const player = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name,
    color: availableColors[0],
    score: 0,
    gadgets: ["double", "shield"],
  };
  room.players.push(player);
  room.host ??= player.id;
  return player;
}

export function newRoom(code) {
  return { code, host: null, players: [], round: -1, phase: "lobby", deadline: null, history: [] };
}

function beginRound(room, now) {
  room.round += 1;
  room.phase = "choose";
  room.deadline = now + PICK_TIME;
  room.picks = {};
  room.bluffs = {};
}

function reveal(room, now) {
  const { items } = rounds[room.round];
  const choices = Object.values(room.picks);
  const results = room.players.map(player => {
    const pick = room.picks[player.id];
    if (!pick) return { player: player.id, item: null, gadget: null, points: 0, collision: false };
    const collision = choices.some(other => other !== pick && other.item === pick.item);
    const value = items[pick.item][1];
    const points = collision ? (pick.gadget === "shield" ? 3 : 0) : value * (pick.gadget === "double" ? 2 : 1);
    player.score += points;
    if (pick.gadget) player.gadgets = player.gadgets.filter(gadget => gadget !== pick.gadget);
    return { player: player.id, item: pick.item, gadget: pick.gadget, points, collision };
  });
  room.history.push({ round: room.round, results });
  room.phase = "reveal";
  room.deadline = now + REVEAL_TIME;
}

function advance(room, now) {
  if (room.round === ROUND_COUNT - 1) {
    room.phase = "finished";
    room.deadline = null;
  } else {
    beginRound(room, now);
  }
}

export function tick(room, now) {
  if (room.deadline === null || now < room.deadline) return false;
  if (room.phase === "choose") reveal(room, now);
  else if (room.phase === "reveal") advance(room, now);
  else return false;
  return true;
}

export function act(room, player, input, now) {
  const { action } = input;
  if (action === "start" || action === "replay") {
    if (room.host !== player.id) throw new GameError("Начать партию может создатель комнаты.");
    const expectedPhase = action === "start" ? "lobby" : "finished";
    if (room.phase !== expectedPhase) throw new GameError("Сейчас партия уже идёт.");
    if (room.players.length !== 3) throw new GameError("Для старта нужны трое игроков.");
    for (const member of room.players) {
      member.score = 0;
      member.gadgets = ["double", "shield"];
    }
    room.round = -1;
    room.history = [];
    beginRound(room, now);
    return;
  }

  if (action === "leave") {
    if (!["lobby", "finished"].includes(room.phase)) throw new GameError("Комната сохранится до конца партии.");
    room.players = room.players.filter(member => member.id !== player.id);
    if (room.host === player.id) room.host = room.players[0]?.id ?? null;
    if (room.phase === "finished") {
      room.phase = "lobby";
      room.round = -1;
      room.history = [];
      for (const member of room.players) member.score = 0;
    }
    return;
  }

  if (input.round !== room.round) throw new GameError("Раунд уже сменился.");
  if (action === "advance") {
    if (room.phase !== "reveal" || room.host !== player.id) throw new GameError("Следующий раунд уже начался.");
    advance(room, now);
    return;
  }

  if (action !== "bluff" && action !== "pick") throw new GameError("Неизвестное действие.", 400);
  if (room.phase !== "choose") throw new GameError("Время на выбор уже закончилось.");
  if (room.picks[player.id]) throw new GameError("Твой выбор уже принят.");
  const { item } = input;
  if (action === "bluff" && item === null) {
    delete room.bluffs[player.id];
    return;
  }
  if (!Number.isInteger(item) || item < 0 || item >= 3) throw new GameError("Выбери один из трёх предметов.", 400);
  if (action === "bluff") {
    room.bluffs[player.id] = item;
    return;
  }

  const gadget = input.gadget ?? null;
  if (gadget !== null && !player.gadgets.includes(gadget)) throw new GameError("Этот приём уже использован.");
  room.picks[player.id] = { item, gadget };
  if (room.players.every(member => room.picks[member.id])) reveal(room, now);
}

export function view(room, player, now) {
  const { code, host, phase, deadline, round, history } = room;
  return {
    code, host, phase, deadline, round, history,
    now,
    total: ROUND_COUNT,
    scene: round < 0 ? null : rounds[round],
    me: player.id,
    selection: phase === "choose" ? room.picks[player.id] ?? null : null,
    gadgets: player.gadgets,
    players: room.players.map(({ id, name, color, score }) => ({
      id, name, color, score,
      locked: phase === "choose" && Boolean(room.picks[id]),
      bluff: phase === "choose" ? room.bluffs[id] ?? null : null,
    })),
  };
}
