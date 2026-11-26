import { CAPTAIN_SKILLS, UPGRADES, skillAtRank, skillPower } from "./skills.js?v=12";
export { UPGRADES };

const SIDE = 3;
export const WIDTH = 159;
export const HEIGHT = 43;
export const DASH_COOLDOWN = 1.35;
export const SECRET_PANEL = 10;
export const ISLAND_TERRAIN = { jungle: 11, basalt: 12, root: 13, sand: 14, shrine: 15 };

const FORT = {
  key: "fort", title: "Форт проклятых", step: 15, origin: 6, arenaRadius: 7, arenaLength: 18,
  wings: ["Затопленная пристань", "Пороховые склады", "Капитанские казематы"],
};
const ISLAND = {
  key: "island", title: "Остров обезьян", step: 16, origin: 7, arenaRadius: 10, arenaLength: 23,
  wings: ["Берег разбитых мачт", "Мангровые тропы", "Бамбуковое ущелье", "Каменные идолы", "Коронные руины"],
};
const DREAM = {
  key: "dream", title: "Сон о старом трюме", step: 7, origin: 3, arenaLength: 12,
  wings: ["Трюм из сна"],
};
export const TAU = Math.PI * 2;

export const ARMORY = {
  pistol: { name: "Кремнёвый пистолет", damage: 22, cadence: .33, capacity: 4, reload: 1.24, pellets: 1, range: 17 },
  scatter: { name: "Мушкетон", damage: 11, cadence: .53, capacity: 2, reload: 1.77, spread: .17, pellets: 5, range: 9 },
  blade: { name: "Абордажная сабля", damage: 31, cadence: .43, pellets: 1, range: 1.75 },
  musket: { name: "Длинный мушкет", damage: 61, cadence: .56, capacity: 1, reload: 1.48, pellets: 1, range: 26 },
};
const BOONS = [
  { name: "Янтарная искра · рывок заряжается на 0,08 с быстрее", apply: p => { p.dashReset -= .08; } },
  { name: "Шов под парусом · +8 к максимуму здоровья", apply: p => { p.max += 8; p.hp += 8; } },
  { name: "Сухое огниво · перезарядка на 8% быстрее", apply: p => { p.reloadScale *= .92; } },
];
const ENEMIES = {
  drowned: { hp: 44, speed: 1.55, reach: .82, wind: .34, cooldown: .61, damage: 14 },
  crab: { hp: 29, speed: 2.13, reach: .72, wind: .25, cooldown: .54, damage: 11 },
  sentinel: { hp: 58, speed: 1.12, reach: 1.02, wind: .48, cooldown: .90, damage: 19 },
  corsair: { hp: 44, speed: 1.22, reach: 7.6, wind: .55, cooldown: 1.05, damage: 16, ranged: true },
  captain: { hp: 600, speed: 1.48, reach: 14.2, ranged: true },
  macaque: { hp: 36, speed: 2.16, reach: .9, wind: .29, cooldown: .69, damage: 12, agile: true },
  slinger: { hp: 48, speed: 1.32, reach: 8.3, wind: .62, cooldown: 1.24, damage: 16, ranged: true },
  viper: { hp: 28, speed: 1.75, reach: 1.16, wind: .44, cooldown: .88, damage: 17, agile: true, low: true },
  mask: { hp: 59, speed: 1.15, reach: 8.3, wind: .79, cooldown: 1.32, damage: 13, ranged: true },
  gorilla: { hp: 78, speed: 1.23, reach: 1.18, wind: .65, cooldown: 1, damage: 23 },
  king: { hp: 795 },
};
export const BOSS_ACTS = [
  { name: "Картечь", floor: 400, wind: .78, cooldown: .98, speed: 1.48, damage: 20 },
  { name: "Проклятая команда", floor: 200, wind: .69, cooldown: .83, speed: 1.76, damage: 22 },
  { name: "Последний абордаж", floor: 0, wind: .59, cooldown: .77, speed: 2.18, damage: 27 },
];
export const KING_ACTS = [
  { name: "Прыжок хищника", floor: 530, wind: .88, cooldown: 1.28, damage: 22 },
  { name: "Печать идолов", floor: 265, wind: 1.04, cooldown: 1.4, damage: 24 },
  { name: "Раскол трона", floor: 0, wind: .75, cooldown: .92, damage: 27 },
];
const ISLAND_ENEMIES = ["macaque", "slinger", "viper", "mask", "gorilla"];
const RARE_DROP = .01;
const AMMO_BOX = 9;
const MEDICINE = 23;
const FLOOR_SOUNDS = ["stone", "wood", "damp", "stone", "flagstone", "sand", "leaves", "forest-stone"];
const STEP_SPACING = .95;
const ENEMY_STEP_SPACING = .82;

export function shieldRaised(enemy) {
  return enemy.kind === "sentinel" && !enemy.attack && enemy.wait <= .35;
}

export function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const ix = (world, x, y) => y * world.width + x;
const startRoom = 3;
const endRoom = 5;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function roomNeighbors(id) {
  return [id % SIDE ? id - 1 : -1, id % SIDE < SIDE - 1 ? id + 1 : -1,
    id >= SIDE ? id - SIDE : -1, id + SIDE < SIDE * SIDE ? id + SIDE : -1].filter(i => i >= 0);
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return 1;
  return world.tiles[ix(world, x, y)];
}

function roomDistances(links, start) {
  const distance = Array(links.length).fill(Infinity);
  const queue = [start];
  distance[start] = 0;
  for (const id of queue) for (const next of links[id]) {
    if (distance[next] < Infinity) continue;
    distance[next] = distance[id] + 1;
    queue.push(next);
  }
  return distance;
}

function topology(rooms, rand, extraLinks) {
  const visited = new Set([startRoom]);
  const stack = [startRoom];
  const links = rooms.map(() => []);
  const connect = (a, b) => { links[a].push(b); links[b].push(a); };
  while (stack.length) {
    const last = stack.at(-1);
    const next = shuffled(roomNeighbors(last), rand).find(id => !visited.has(id));
    if (next === undefined) stack.pop();
    else { connect(last, next); visited.add(next); stack.push(next); }
  }
  const extras = rooms.flatMap(({ id }) =>
    roomNeighbors(id).filter(next => id < next && !links[id].includes(next)).map(next => [id, next]));
  let spare = extras.filter(pair => !pair.includes(startRoom)).length;
  for (const [a, b] of shuffled(extras, rand)) {
    if (!extraLinks) break;
    const interior = a !== startRoom && b !== startRoom;
    if (interior && spare === 1) continue;
    if (interior) spare--;
    connect(a, b);
    extraLinks--;
  }

  return { links, distance: roomDistances(links, startRoom) };
}

function planSecret(world, rooms, links, wing) {
  const candidates = [];
  const distance = roomDistances(links, startRoom);
  for (const { id } of rooms) {
    if (id === startRoom) continue;
    for (const next of roomNeighbors(id)) {
      if (next <= id || next === startRoom || links[id].includes(next)) continue;
      candidates.push({ id, next });
    }
  }
  const interiors = candidates.filter(({ id, next }) => Math.min(distance[id], distance[next]) > 1);
  const pool = interiors.length ? interiors : candidates;
  if (!pool.length) return;
  const { id, next } = pool[Math.floor(world.layoutRandom() * pool.length)];
  const a = rooms[id], b = rooms[next];
  const horizontal = a.y === b.y;
  const from = horizontal ? { x: a.x + a.w + 1, y: a.y } : { x: a.x, y: a.y + a.h + 1 };
  const to = horizontal ? { x: b.x - b.w - 1, y: b.y } : { x: b.x, y: b.y - b.h - 1 };
  const style = world.map.key === "island" ? 6 : wing === 0 ? 1 : 3;
  const centerX = Math.floor((from.x + to.x) / 2), centerY = Math.floor((from.y + to.y) / 2);
  const x = centerX + .5, y = centerY + .5;
  const dx = horizontal ? 0 : .86, dy = horizontal ? .86 : 0;
  const supplies = { kind: wing === 1 ? "heal" : "ammo", x: x - dx, y: y - dy };
  const prize = { kind: "upgrade", x: x + dx, y: y + dy };
  world.secrets.push({ panels: [from, to], x, y, style, supplies, prize, open: false });
}

function addEnemy(world, kind, x, y) {
  const spec = ENEMIES[kind];
  world.enemies.push({ kind, x, y, hp: spec.hp, max: spec.hp, awake: false, attack: 0, wait: .35,
    hurt: 0, down: 0, attackSpan: 0, recover: 0, gait: 0, moving: false, phase: world.rand() * TAU, facing: 0, guardPing: 0 });
}

function buildWing(world, wing, carve) {
  const { rand, map, wingSpan, midY } = world;
  const island = map.key === "island";
  const rooms = Array.from({ length: SIDE * SIDE }, (_, id) => ({
    id, x: map.origin + wing * wingSpan + id % SIDE * map.step, y: map.origin + Math.floor(id / SIDE) * map.step,
    w: (island ? 4 : 3) + Number(rand() > .46), h: (island ? 4 : 3) + Number(rand() > .46),
    floor: (island ? 5 : 1) + (wing + id) % 3,
  }));
  const { links, distance } = topology(rooms, rand, island ? 2 : 1);
  const order = shuffled(rooms.filter(r => r.id !== startRoom), rand).sort((a, b) => distance[a.id] - distance[b.id]);
  const shrine = order.at(-1);
  for (const room of rooms) {
    carve(room.x - room.w, room.y - room.h, room.x + room.w, room.y + room.h, room.floor);
    for (const id of links[room.id].filter(id => id > room.id)) {
      const next = rooms[id];
      if (next.y === room.y) carve(room.x, room.y, next.x, room.y + 1, island ? 6 : 0);
      else carve(room.x, room.y, room.x + 1, next.y, island ? 6 : 0);
    }
  }

  planSecret(world, rooms, links, wing);
  if (island) fillIslandWing(world, rooms, order, shrine, wing);
  else fillFortWing(world, rooms, order, shrine, wing);

  const exit = rooms[endRoom];
  const gateX = (wing + 1) * wingSpan;
  const nextX = wing < map.wings.length - 1 ? gateX + map.origin : world.arena.left + 2;
  carve(exit.x, midY, nextX, midY + 1, island ? 6 : 0);
  world.seals.push({ x: gateX + .5, y: midY + 1, wing });
}

function fillFortWing(world, rooms, order, shrine, wing) {
  const { rand } = world;
  const enemyTypes = ["drowned", "crab", "corsair", "sentinel"];
  const pickup = (kind, room, dx, dy) => world.items.push({ kind, x: room.x + dx, y: room.y + dy });
  for (const room of rooms) {
    world.props.push({ kind: "torch", x: room.x - room.w + .45, y: room.y - room.h + .45 });
    if (room.id === startRoom) {
      addEnemy(world, "drowned", room.x + 2.8, room.y + .7);
      if (wing > 0) addEnemy(world, "crab", room.x + 1.2, room.y - 2.1);
      continue;
    }
    const rank = order.indexOf(room);
    const primary = enemyTypes[(rank + wing) % enemyTypes.length];
    addEnemy(world, primary, room.x + 2.25, room.y + .95);
    addEnemy(world, rank % 2 ? "drowned" : "crab", room.x - 1.7, room.y + 1.8);
    addEnemy(world, rank === 0 && wing === 0 ? "drowned" : "corsair", room.x + .8, room.y - 2.35);
    if (rank >= 3 || wing > 0) {
      addEnemy(world, rank % 3 === 0 ? "sentinel" : "crab", room.x - 2.1, room.y - 1.8);
    }
    if (room === shrine && wing > 0) addEnemy(world, "drowned", room.x + 2.45, room.y - 2.2);
    if ([0, 2, 4, 6, 7].includes(rank)) pickup("ammo", room, 1.55, -1.45);
    if (rank === 2 || room === shrine) pickup("heal", room, -1.55, -.45);
    if (rank === 2 && wing < 2) pickup(wing === 0 ? "scatter" : "musket", room, .5, 2.55);
    if (rand() < .72) world.props.push({ kind: "barrel", x: room.x + room.w + .3, y: room.y - room.h + .5 });
  }
  world.items.push({ kind: "relic", x: shrine.x + .5, y: shrine.y + .5, boon: BOONS[wing], wing,
    guards: world.enemies.filter(e => Math.abs(e.x - shrine.x) < 4 && Math.abs(e.y - shrine.y) < 4) });

}

function fillIslandWing(world, rooms, order, shrine, wing) {
  const { rand } = world;
  const spawn = (kind, room, dx, dy) => addEnemy(world, kind, room.x + dx, room.y + dy);
  const pickup = (kind, room, dx, dy) => world.items.push({ kind, x: room.x + dx, y: room.y + dy, amount: 11 });
  const backupRooms = order.filter(room => room !== shrine);
  for (const [i, kind] of ["scatter", "musket"].entries()) {
    if (world.player.arsenal.has(kind) || world.items.some(item => item.kind === kind)) continue;
    if (world.layoutRandom() < .14) {
      const room = backupRooms[Math.floor(world.layoutRandom() * backupRooms.length)];
      pickup(kind, room, 2.35, 2.8 - i * 1.35);
    }
  }
  for (const room of rooms) {
    const rank = order.indexOf(room);
    world.props.push(
      { kind: "fern", x: room.x - room.w + .55, y: room.y - room.h + .62 },
      { kind: "palm", x: room.x + room.w - .42, y: room.y + room.h - .30 },
      { kind: room === shrine ? "idol" : "fern", x: room.x + room.w - .30, y: room.y - room.h + .46 },
      { kind: "fern", x: room.x - room.w + .75, y: room.y + room.h - .52 },
    );
    if (room.id === startRoom) {
      pickup("ammo", room, .48, -1.75);
      pickup("heal", room, -.95, .66);
      if (wing > 0) spawn(ISLAND_ENEMIES[wing % 5], room, 3.16, -2.62);
      continue;
    }
    spawn(ISLAND_ENEMIES[(rank + wing) % 5], room, 2.61, .89);
    spawn(rank % 2 ? "macaque" : "viper", room, -2.44, 2.01);
    if ([0, 2, 3, 6, 7].includes(rank)) spawn(rank % 3 ? "slinger" : "mask", room, .87, -2.81);
    if ((wing >= 2 && rank >= 4) || room === shrine) spawn("gorilla", room, -2.77, -2.36);
    if (room === shrine) spawn("mask", room, 2.75, -2.45);
    if (room === shrine || rank % 2 === 0) pickup("ammo", room, 1.87, -1.65);
    if (room === shrine || rank === 2 || rank === 5) pickup("heal", room, -1.68, -.71);
    if (rank === 4) pickup("upgrade", room, .6, 2.86);
    if (rand() < .42) world.props.push({ kind: "barrel", x: room.x + room.w - .35, y: room.y + 1.31 });
  }
  world.items.push({ kind: "relic", x: shrine.x + .5, y: shrine.y + .5, wing,
    guards: world.enemies.filter(e => Math.abs(e.x - shrine.x) < 4 && Math.abs(e.y - shrine.y) < 4) });
}

export function createRun(seed) {
  return createLevel(seed, FORT);
}

export function createDream(seed) {
  return createLevel(seed, DREAM);
}

export function nextLevel(world) {
  if (world.map.key !== "fort" || world.status !== "won") return null;
  return createLevel((world.seed ^ 0x3aef9219) >>> 0, ISLAND, world);
}

function createLevel(seed, map, previous) {
  const island = map.key === "island";
  const rand = seeded(seed);
  const wingSpan = SIDE * map.step;
  const midY = map.step + map.origin;
  const total = map.wings.length;
  const arenaX = total * wingSpan + 3;
  const width = arenaX + map.arenaLength + 3;
  const height = 2 * map.step + map.origin * 2 + 1;
  const lootRandom = seeded(seed ^ 0x62c8f1d5);
  const tiles = new Uint8Array(width * height).fill(1);
  const floor = new Uint8Array(tiles.length);
  const newPlayer = { hp: 100, max: 100, ammo: 20, weapon: "pistol",
    arsenal: new Set(["pistol", "blade"]), chambers: { pistol: ARMORY.pistol.capacity, scatter: 0, musket: 0 },
    capacityBonus: { pistol: 0, scatter: 0, musket: 0 }, ammoLimit: 64,
    gunDamage: 1, gunCadence: 1, moveScale: 1, damageTaken: 1, bladeDamage: 1, bladeReach: 1, healScale: 1, dashSpeed: 10.5,
    reloadScale: 1, dashReset: DASH_COOLDOWN, perks: [], skills: [], traits: new Set(), reviveUsed: false, firearmKills: 0 };
  const inherited = previous?.player ?? newPlayer;
  const player = { ...inherited, arsenal: new Set(inherited.arsenal), traits: new Set(inherited.traits),
    chambers: { ...inherited.chambers }, capacityBonus: { ...inherited.capacityBonus },
    perks: [...inherited.perks], skills: [...inherited.skills], x: island ? 3.95 : 3.65, y: midY + .5, angle: 0, pitch: 0,
    relics: 0, reloadLeft: 0, reloadSpan: 0, cooldown: 0, hurt: 0, recoil: 0, bob: 0, moving: 0, stride: 0,
    kills: 0, dash: 0, dashCooldown: 0, dashX: 0, dashY: 0, dashShot: 0, riposte: 0, slowed: 0, charged: false,
    usedWards: new Set(), dashHits: new Set() };
  const arena = { entrance: arenaX - 1, left: arenaX, active: false, cleared: false, exitReady: false, stage: 0, next: 0 };
  const world = { seed, map, width, height, wingSpan, midY, total, rand, lootRandom, tiles, floor, player, arena,
    layoutRandom: seeded(seed ^ 0xa1463f3d), secretWalls: new Uint8Array(tiles.length),
    bossName: island ? "Король обезьян" : "Смотритель", acts: island ? KING_ACTS : BOSS_ACTS,
    discovery: new Uint8Array(tiles.length), history: previous ? {
      time: previous.time, kills: previous.player.kills, relics: previous.player.relics,
      secrets: previous.secrets.filter(secret => secret.open).length, totalSecrets: previous.secrets.length,
    } : { time: 0, kills: 0, relics: 0, secrets: 0, totalSecrets: 0 },
    enemies: [], items: [], props: [], bolts: [], hazards: [], flashes: [], events: [], cues: [], seals: [], secrets: [],
    skillChoices: [], pressure: 0, nextAmbience: 2.4, nextImpact: 0,
    gate: { x: arenaX + map.arenaLength - .5, y: midY + .5 }, flow: null, nextFlow: -1,
    start: { x: player.x, y: player.y }, time: 0, status: "play", hint: "", hintUntil: 0 };
  const carve = (x1, y1, x2, y2, style) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      tiles[ix(world, x, y)] = 0;
      floor[ix(world, x, y)] = style;
    }
  };
  if (map === DREAM) {
    buildDream(world, carve);
    reveal(world);
    return world;
  }
  for (let wing = 0; wing < total; wing++) buildWing(world, wing, carve);
  carve(arenaX, midY - map.arenaRadius, arenaX + map.arenaLength, midY + map.arenaRadius, 4);
  for (const x of [arenaX + 5, arenaX + (island ? 16 : 12)]) for (const y of [midY - 4, midY + 3]) {
    for (let dy = 0; dy < 2; dy++) tiles[ix(world, x, y + dy)] = island ? ISLAND_TERRAIN.shrine : 2;
    world.props.push({ kind: island ? "idol" : "torch", x: x + 1.5, y: y + .8 });
  }
  world.items.push(
    { kind: "ammo", x: arenaX + 2.5, y: midY - 2.1 },
    { kind: "heal", x: arenaX + 14.4, y: midY - 5.3 },
  );
  if (island) world.items.push({ kind: "ammo", x: arenaX + 3.7, y: midY + 5.6 }, { kind: "heal", x: arenaX + 20.5, y: midY + 6.5 });
  addEnemy(world, island ? "king" : "captain", arenaX + (island ? 14.5 : 11.5), midY + .5);
  world.boss = world.enemies.at(-1);
  world.boss.pattern = 0;
  world.boss.charge = 0;

  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (!tiles[ix(world, x, y)] || (tiles[ix(world, x - 1, y)] && tiles[ix(world, x + 1, y)] && tiles[ix(world, x, y - 1)] && tiles[ix(world, x, y + 1)])) continue;
    const chance = rand();
    if (island) tiles[ix(world, x, y)] = x >= arenaX ? ISLAND_TERRAIN.shrine
      : chance < .18 ? ISLAND_TERRAIN.root : chance < .44 ? ISLAND_TERRAIN.basalt : ISLAND_TERRAIN.jungle;
    else tiles[ix(world, x, y)] = chance < (x >= arenaX ? .27 : .13) ? 4 : chance < .32 ? 3 : chance < .52 ? 2 : 1;
  }
  for (const seal of world.seals) setBarrier(world, Math.floor(seal.x), 8);
  for (const { panels, x, y, style } of world.secrets) {
    const [from, to] = panels;
    const cx = Math.floor(x), cy = Math.floor(y);
    for (const panel of panels) {
      const i = ix(world, panel.x, panel.y);
      world.secretWalls[i] = tiles[i] || (island ? ISLAND_TERRAIN.jungle : 1);
    }
    carve(from.x, from.y, to.x, to.y, style);
    carve(cx - 1, cy - 1, cx + 1, cy + 1, style);
    for (const panel of panels) world.tiles[ix(world, panel.x, panel.y)] = SECRET_PANEL;
  }
  reveal(world);
  return world;
}

function buildDream(world, carve) {
  carve(2, 7, 9, 14, 1);
  carve(9, 10, 12, 11, 0);
  carve(12, 6, 21, 14, 1);
  carve(16, 2, 19, 4, 3);
  carve(21, 10, 24, 11, 0);
  carve(24, 5, 36, 15, 4);
  world.training = { step: 0, objective: world.start, chart: false, target: null };
  world.player.hp = 77;
  world.arena.entrance = 23;
  setBarrier(world, 10, 8);
  setBarrier(world, 22, 8);
  const panel = { x: 17, y: 5 };
  world.tiles[ix(world, panel.x, panel.y)] = SECRET_PANEL;
  world.secretWalls[ix(world, panel.x, panel.y)] = 2;
  world.secrets.push({ panels: [panel], x: 17.5, y: 4.5, open: false,
    prize: { kind: "upgrade", x: 17.5, y: 4.5 }, supplies: { kind: "ammo", x: 16.5, y: 3.5 } });
  world.seals.push({ x: 22.5, y: 11, wing: 0 });
  for (const [x, y] of [[5.5,7.6],[8.6,9.1],[13.2,13.5],[17.5,6.5],[20.4,13.9],[26.7,6.5],[32.1,14.5]]) {
    world.props.push({ kind: "torch", x, y });
  }
  addEnemy(world, "captain", 31.5, 10.5);
  world.boss = world.enemies.at(-1);
  Object.assign(world.boss, { hp: 88, max: 88, pattern: 0, charge: 0 });
  world.bossName = "Тень боцмана";
  world.acts = [{ ...BOSS_ACTS[0], name: "Учебный залп", floor: 0, wind: 1.25, cooldown: 1.4, damage: 9 }];
}

const DREAM_LESSONS = [
  ["Мышь или стрелки · оглянись в трюме", "Проведи по экрану, чтобы оглядеться"],
  ["WASD · пройдись по трюму", "Кнопки ↑ и ↓ · пройдись по трюму"],
  ["1 · пистолет. ЛКМ или пробел · выстрели в тень", "Возьми пистолет и выстрели в тень кнопкой «Огонь»"],
  ["R · пополни магазин из запаса", "Нажми значок патрона, чтобы перезарядить"],
  ["Shift · сделай рывок, чтобы уйти от удара", "Кнопка ⇢ · сделай рывок, чтобы уйти от удара"],
  ["Подойди к ящику с патронами и аптечке у решётки"],
  ["3 · достань саблю, подойди к тени и ударь", "Смени оружие на саблю и ударь тень вблизи"],
  ["У среднего фонаря есть шов. Подойди и нажми E", "Найди шов за средним фонарём и открой тайник"],
  ["Возьми жетон в тайнике и выбери капитанское умение"],
  ["Подбери второй жетон и попробуй повысить ранг умения"],
  ["Tab · раскрой карту и посмотри свои умения", "Нажми значок карты, чтобы увидеть свои умения"],
  ["Подбери мушкетон и длинный мушкет · 2 и 4", "Подбери мушкетон и длинный мушкет в соседнем зале"],
  ["Синяя стрелка ведёт к осколку. Сначала одолей стража"],
  ["Осколок снял печать. Войди на арену"],
  ["Уходи с линии залпа и атакуй, пока тень перезаряжается"],
  ["Ворота открыты. Войди в них, чтобы проснуться"],
];

export function dreamHint(world, touch) {
  const lesson = DREAM_LESSONS[world.training.step];
  return lesson?.[touch ? 1 : 0] ?? lesson?.[0];
}

function dreamTarget(world, kind, x, y, weapon) {
  addEnemy(world, kind, x, y);
  const enemy = world.enemies.at(-1);
  if (weapon) Object.assign(enemy, { practice: weapon, hp: ARMORY[weapon].damage, max: ARMORY[weapon].damage });
  world.training.target = enemy;
  world.training.objective = enemy;
}

export function advanceDream(world, events) {
  const { training, player: p } = world;
  if (!training) return;
  let done = false;
  switch (training.step) {
    case 0:
      done = Math.abs(Math.sin(p.angle)) > .12 || Math.abs(p.pitch) > .12 || Math.cos(p.angle) < 0;
      break;
    case 1:
      done = Math.hypot(p.x - world.start.x, p.y - world.start.y) > 1.3;
      if (done) dreamTarget(world, "drowned", 8.5, 10.5, "pistol");
      break;
    case 2:
      done = training.target.hp === 0;
      if (!p.ammo && p.chambers.pistol === 0) p.ammo = 8;
      break;
    case 3: done = events.includes("reload-ready"); break;
    case 4:
      done = events.includes("dash");
      if (done) {
        setBarrier(world, 10, 0);
        training.objective = { x: 12.5, y: 10.5 };
        world.items.push({ kind: "ammo", ...training.objective }, { kind: "heal", x: 14.1, y: 10.5 });
      }
      break;
    case 5:
      done = !world.items.some(item => item.kind === "ammo" || item.kind === "heal");
      if (done) dreamTarget(world, "drowned", 16.9, 11.5, "blade");
      break;
    case 6:
      done = training.target.hp === 0;
      if (done) training.objective = { x: 17.5, y: 5.5 };
      break;
    case 7:
      done = world.secrets[0].open;
      if (done) training.objective = world.secrets[0].prize;
      break;
    case 8:
      done = p.skills.length > 0;
      if (done) {
        training.objective = { x: 18.7, y: 3.2 };
        world.items.push({ kind: "upgrade", ...training.objective });
      }
      break;
    case 9: done = p.skills.some(skill => skill.rank > 1); break;
    case 10:
      done = training.chart;
      if (done) {
        training.objective = { x: 19.5, y: 8.5 };
        world.items.push({ kind: "scatter", ...training.objective }, { kind: "musket", x: 19.5, y: 12.5 });
      }
      break;
    case 11:
      done = p.arsenal.has("scatter") && p.arsenal.has("musket");
      if (!done && p.arsenal.has("scatter")) training.objective = { x: 19.5, y: 12.5 };
      if (done) {
        dreamTarget(world, "sentinel", 20.5, 9.15);
        world.items.push({ kind: "relic", x: 20.5, y: 10.5, wing: 0, boon: BOONS[0], guards: [training.target] });
      }
      break;
    case 12: done = p.relics === 1; break;
    case 13: done = world.arena.active; break;
    case 14: done = world.arena.cleared; break;
  }
  if (done) training.step++;
}

function setBarrier(world, x, kind) {
  world.tiles[ix(world, x, world.midY)] = kind;
  world.tiles[ix(world, x, world.midY + 1)] = kind;
  world.nextFlow = -1;
  world.lastReveal = -1;
}

export function location(world) {
  if (world.training) return world.map.title;
  if (world.arena.active) return world.map.key === "island" ? "Трон обезьян" : "Зал Смотрителя";
  return world.map.wings[sector(world)];
}

function sector(world) {
  return Math.min(world.total - 1, Math.floor(world.player.x / world.wingSpan));
}

export function compassObjective(world) {
  const relic = world.items.find(item => item.kind === "relic" && item.wing === world.player.relics);
  if (relic) return { point: relic, label: "Осколок" };
  if (world.arena.cleared) return { point: world.gate, label: "Выход" };
  if (world.arena.active) return { point: world.boss, label: world.bossName };
  if (world.training && world.player.relics === 0) return { point: world.training.objective, label: "Сон" };
  return { point: { x: world.arena.left + 2, y: world.gate.y }, label: "Арена" };
}

export function secretAhead(world) {
  const p = world.player;
  const range = 1.85;
  const hit = cast(world, p.x, p.y, Math.cos(p.angle), Math.sin(p.angle), range);
  if (hit.wall !== SECRET_PANEL || hit.distance >= range) return null;
  return world.secrets.find(secret => !secret.open && secret.panels.some(panel => panel.x === hit.x && panel.y === hit.y)) ?? null;
}

function openSecret(world) {
  const secret = secretAhead(world);
  if (!secret) return;
  secret.open = true;
  for (const { x, y } of secret.panels) world.tiles[ix(world, x, y)] = 0;
  world.nextFlow = -1;
  world.lastReveal = -1;
  world.items.push(secret.supplies, secret.prize);
  const found = world.secrets.filter(path => path.open).length;
  prompt(world, "Тайный ход открыт · " + found + " / " + world.secrets.length);
  cue(world, "secret-open");
}

export function discovered(world, x, y) {
  return Boolean(world.discovery[ix(world, Math.floor(x), Math.floor(y))]);
}

function reveal(world) {
  const p = world.player;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  if (world.lastReveal === ix(world, x, y)) return;
  world.lastReveal = ix(world, x, y);
  const radius = Math.round(7 * (1 + skillPower(p, "survey")));
  for (let ty = Math.max(0, y - radius); ty < Math.min(world.height, y + radius + 1); ty++) {
    for (let tx = Math.max(0, x - radius); tx < Math.min(world.width, x + radius + 1); tx++) {
      if (world.discovery[ix(world, tx, ty)]) continue;
      if (visible(world, p.x, p.y, { x: tx + .5, y: ty + .5 }, radius + .5)) world.discovery[ix(world, tx, ty)] = 1;
    }
  }
}

export function cast(world, x, y, dx, dy, maximum = 30) {
  let cx = Math.floor(x);
  let cy = Math.floor(y);
  const ax = Math.abs(1 / dx);
  const ay = Math.abs(1 / dy);
  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;
  let distX = (dx < 0 ? x - cx : cx + 1 - x) * ax;
  let distY = (dy < 0 ? y - cy : cy + 1 - y) * ay;
  if (!Number.isFinite(distX)) distX = Infinity;
  if (!Number.isFinite(distY)) distY = Infinity;
  let length = 0;
  let side = 0;
  let wall = 0;
  while (length < maximum) {
    if (distX < distY) { length = distX; distX += ax; cx += sx; side = 0; }
    else { length = distY; distY += ay; cy += sy; side = 1; }
    wall = tileAt(world, cx, cy);
    if (wall) break;
  }
  const place = side === 0 ? y + dy * length : x + dx * length;
  let u = place - Math.floor(place);
  if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) u = 1 - u;
  return { distance: Math.min(length, maximum), wall, side, x: cx, y: cy, u: Number.isFinite(u) ? u : 0 };
}

function openAt(world, x, y, radius) {
  return !tileAt(world, Math.floor(x - radius), Math.floor(y - radius))
    && !tileAt(world, Math.floor(x + radius), Math.floor(y - radius))
    && !tileAt(world, Math.floor(x - radius), Math.floor(y + radius))
    && !tileAt(world, Math.floor(x + radius), Math.floor(y + radius));
}

function moveBody(world, body, dx, dy, radius) {
  if (openAt(world, body.x + dx, body.y, radius)) body.x += dx;
  if (openAt(world, body.x, body.y + dy, radius)) body.y += dy;
}

function visible(world, x, y, target, range) {
  const dx = target.x - x;
  const dy = target.y - y;
  const d = Math.hypot(dx, dy);
  return d < .08 || (d <= range && cast(world, x, y, dx / d, dy / d, d + .05).distance >= d - .07);
}

function prompt(world, text) {
  world.hint = text;
  world.hintUntil = world.time + 3.7;
}

function cue(world, kind, source, color) {
  world.cues.push({ kind, x: source?.x, y: source?.y, color });
}

function emit(world, kind, source, color) {
  world.events.push(kind);
  cue(world, kind, source, color);
}

function wake(world, enemy) {
  if (enemy.awake) return;
  enemy.awake = true;
  cue(world, "enemy-alert", enemy, enemy.kind);
}

function damage(world, points) {
  const p = world.player;
  if (p.dash > 0 || p.hurt > .19 || p.hp <= 0) return false;
  let amount = points * p.damageTaken;
  const area = world.arena.active ? world.total : sector(world);
  if (p.traits.has("ward") && !p.usedWards.has(area)) {
    p.usedWards.add(area);
    amount *= 1 - skillPower(p, "ward");
    cue(world, "shield");
  }
  if (p.hp < p.max / 3) amount *= 1 - skillPower(p, "thick-hide");
  p.hp = Math.max(world.training ? 1 : 0, p.hp - Math.max(1, Math.round(amount)));
  p.hurt = .36;
  p.riposte = world.time + 2;
  emit(world, "hurt");
  if (!p.hp && p.traits.has("revive") && !p.reviveUsed) {
    p.reviveUsed = true;
    p.hp = 24;
    prompt(world, "Долг перед морем · 24 здоровья");
    cue(world, "upgrade");
  }
  if (!p.hp) { world.status = "dead"; emit(world, "dead"); }
  return true;
}

function draftSkill(world) {
  const owned = new Map(world.player.skills.map(skill => [skill.id, skill.rank]));
  const pool = world.training ? UPGRADES.filter(skill => skill.steps && (!owned.size || owned.has(skill.id)))
    : world.map.key === "island" ? CAPTAIN_SKILLS : UPGRADES;
  const rest = shuffled(pool.map(skill => skillAtRank(skill, (owned.get(skill.id) ?? 0) + 1)).filter(Boolean), world.lootRandom);
  if (!rest.length) return;
  world.skillChoices = rest.slice(0, 3);
  if (world.map.key === "island" && world.skillChoices.every(skill => skill.id.startsWith("gear-"))) {
    const fresh = rest.find(skill => !skill.id.startsWith("gear-"));
    if (fresh) world.skillChoices[2] = fresh;
  }
  if (world.skillChoices.every(skill => skill.rank === 1)) {
    const upgrade = rest.find(skill => skill.rank > 1);
    if (upgrade) {
      const index = world.skillChoices.findIndex(skill => skill.id.startsWith("gear-"));
      world.skillChoices[Math.max(index, 0)] = upgrade;
    }
  }
  emit(world, "skill");
}

export function chooseSkill(world, id) {
  if (world.status !== "play") return false;
  const skill = world.skillChoices.find(option => option.id === id);
  if (!skill) return false;
  world.skillChoices = [];
  skill.apply(world.player);
  const learned = world.player.skills.findIndex(entry => entry.id === id);
  if (learned < 0) world.player.skills.push(skill);
  else world.player.skills[learned] = skill;
  world.lastReveal = -1;
  prompt(world, skill.name + " · " + skill.effect);
  cue(world, "upgrade");
  return true;
}

function gather(world) {
  const p = world.player;
  world.items = world.items.filter(item => {
    if (Math.hypot(p.x - item.x, p.y - item.y) > .59) return true;
    if (item.kind === "ammo") {
      const gained = Math.min(item.amount ?? AMMO_BOX, p.ammoLimit - p.ammo);
      if (!gained) return true;
      p.ammo += gained;
      prompt(world, "+" + gained + " патронов");
    } else if (item.kind === "heal") {
      const gained = Math.min(Math.round(MEDICINE * p.healScale), p.max - p.hp);
      if (!gained) return true;
      p.hp += gained;
      prompt(world, "+" + gained + " здоровья");
    } else if (item.kind === "upgrade") {
      if (world.skillChoices.length) return true;
      draftSkill(world);
      return false;
    } else if (item.kind === "relic") {
      if (item.guards.some(enemy => enemy.hp > 0)) {
        prompt(world, "Осколок охраняют. Одолей стражу");
        return true;
      }
      p.relics++;
      if (item.boon) {
        item.boon.apply(p);
        p.perks.push(item.boon.name);
      }
      if (p.traits.has("relic-heal")) p.hp = Math.min(p.max, p.hp + 9);
      setBarrier(world, Math.floor(world.seals[item.wing].x), 0);
      const message = p.relics === world.total ? "Путь на арену открыт" : "Печать снята";
      prompt(world, item.boon ? message + " · " + item.boon.name : message + " · " + p.relics + " / " + world.total);
      emit(world, "relic");
      cue(world, "seal-open", world.seals[item.wing]);
      return false;
    } else {
      if (p.arsenal.has(item.kind)) return false;
      p.arsenal.add(item.kind);
      p.chambers[item.kind] = weaponCapacity(p, item.kind);
      switchWeapon(world, item.kind);
      prompt(world, ARMORY[item.kind].name + " · " + (item.kind === "scatter" ? "2" : "4"));
    }
    emit(world, "pickup", null, item.kind);
    return false;
  });
  if (world.skillChoices.length) return;

  if (p.relics === world.total && p.x >= world.arena.left + 1.25 && !world.arena.active) {
    world.arena.active = true;
    setBarrier(world, world.arena.entrance, 8);
    world.bolts.length = 0;
    emit(world, "arena");
    return;
  }
  if (world.arena.active && world.arena.stage < world.acts.length - 1 && world.boss.hp === world.acts[world.arena.stage].floor) {
    const { arena, boss } = world;
    arena.stage++;
    arena.next = world.time + 1.15;
    boss.pattern = 0;
    boss.attack = 0;
    boss.charge = 0;
    boss.leap = null;
    boss.lift = 0;
    boss.mark = null;
    boss.wait = .32;
    world.bolts.length = 0;
    world.hazards.length = 0;
    if (arena.stage === 1) {
      const island = world.map.key === "island";
      if (island) {
        addEnemy(world, "mask", arena.left + 8.5, world.midY - 6.3);
        addEnemy(world, "mask", arena.left + 18.5, world.midY + 6.5);
        boss.wards = world.enemies.slice(-2);
        for (const ward of boss.wards) ward.kingWard = true;
      } else {
        addEnemy(world, "crab", arena.left + 9.3, world.midY - 4.9);
        addEnemy(world, "corsair", arena.left + 14.8, world.midY + 4.9);
      }
    }
    prompt(world, boss.wards?.some(ward => ward.hp > 0) ? "Идолы защищают Короля. Разбей их!" : world.acts[arena.stage].name);
    emit(world, arena.stage === 1 ? "arena-rage" : "arena-fury");
  }
  const { arena, gate } = world;
  const atGate = Math.hypot(p.x - gate.x, p.y - gate.y) < .78;
  if (arena.active && !arena.cleared && world.boss.hp <= 0) {
    arena.cleared = true;
    arena.exitReady = world.map.key === "fort" || !atGate;
    world.bolts.length = 0;
    world.hazards.length = 0;
    prompt(world, arena.exitReady ? world.bossName + " пал. Войди в ворота." : "Ворота открыты. Отойди и войди снова.");
    emit(world, "victory");
  }
  if (arena.cleared) {
    if (!atGate) arena.exitReady = true;
    else if (arena.exitReady) {
      world.status = "won";
      emit(world, "win");
    }
  }
  const seal = world.seals[p.relics];
  if (seal && Math.hypot(p.x - seal.x, p.y - seal.y) < 1.3) prompt(world, "Печать закрыта. Найди осколок в этом крыле");
}

export function switchWeapon(world, kind) {
  if (!world.player.arsenal.has(kind)) return false;
  if (world.player.weapon === kind) return false;
  world.player.weapon = kind;
  world.player.reloadLeft = 0;
  world.player.recoil = 0;
  world.player.cooldown = Math.max(world.player.cooldown, .12);
  cue(world, "equip", null, kind);
  return true;
}

export function weaponCapacity(player, kind = player.weapon) {
  return (ARMORY[kind].capacity ?? 0) + (player.capacityBonus[kind] ?? 0);
}

export function reloadWeapon(world) {
  const p = world.player;
  const spec = ARMORY[p.weapon];
  const capacity = weaponCapacity(p);
  if (world.status !== "play" || !capacity || p.reloadLeft || !p.ammo || p.chambers[p.weapon] === capacity) return false;
  p.reloadLeft = p.reloadSpan = spec.reload * p.reloadScale;
  emit(world, "reload");
  return true;
}

function reloadTick(world, dt) {
  const p = world.player;
  if (!p.reloadLeft) return;
  p.reloadLeft = Math.max(0, p.reloadLeft - dt);
  if (p.reloadLeft) return;
  const amount = Math.min(p.ammo, weaponCapacity(p) - p.chambers[p.weapon]);
  p.ammo -= amount;
  p.chambers[p.weapon] += amount;
  p.charged = true;
  emit(world, "reload-ready");
}

export function shoot(world) {
  const p = world.player;
  if (world.status !== "play" || p.cooldown > 0 || p.reloadLeft > 0) return;
  const weapon = p.weapon;
  const spec = ARMORY[weapon];
  if (spec.capacity) {
    if (p.chambers[weapon] === 0) {
      if (!reloadWeapon(world)) {
        p.cooldown = .44;
        emit(world, "empty");
        prompt(world, "Патроны кончились · 3 — сабля");
      }
      return;
    }
    p.chambers[weapon]--;
  }
  const blade = weapon === "blade";
  let damage = spec.damage * (blade ? p.bladeDamage : p.gunDamage);
  if (p.dashShot > world.time) damage *= 1 + skillPower(p, "dash-shot");
  p.dashShot = 0;
  if (blade && p.riposte > world.time) damage *= 1 + skillPower(p, "riposte");
  if (!blade) {
    if (p.chambers[weapon] === 0) damage *= 1 + skillPower(p, "last-round");
    if (p.charged) damage *= 1 + skillPower(p, "reload-shot");
    p.charged = false;
  }
  const range = spec.range * (blade ? p.bladeReach : 1);
  p.cooldown = spec.cadence * (blade ? 1 : p.gunCadence);
  p.recoil = weapon === "scatter" || weapon === "musket" ? .29 : .195;
  emit(world, weapon);
  if (blade && p.traits.has("parry")) deflect(world);
  let hit = false;
  let impact;
  for (let shot = 0; shot < spec.pellets; shot++) {
    const tilt = spec.pellets === 1 ? 0 : (shot / (spec.pellets - 1) - .5) * spec.spread * 2.1;
    const a = p.angle + tilt;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const wall = cast(world, p.x, p.y, cx, cy, range).distance;
    if (!tilt && wall < range) impact = { x: p.x + cx * (wall - .025), y: p.y + cy * (wall - .025) };
    let best = wall;
    let target;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0 || (enemy === world.boss && !world.arena.active) || enemy.leap) continue;
      const x = enemy.x - p.x;
      const y = enemy.y - p.y;
      if (x * x + y * y < 42) wake(world, enemy);
      const depth = x * cx + y * cy;
      const width = Math.abs(-x * cy + y * cx);
      const aimHeight = .5 + p.pitch * depth * .5;
      const low = enemy.kind === "crab" || ENEMIES[enemy.kind].low;
      const height = low ? .44 : enemy === world.boss ? 1.33 : enemy.kind === "gorilla" ? 1.16 : .93;
      if (depth > .05 && depth < best && aimHeight >= -.10 && aimHeight <= height + .13 && width < (enemy === world.boss || enemy.kind === "gorilla" ? .41 : low ? .26 : .30) + (weapon === "blade" ? .17 : 0)) {
        best = depth;
        target = enemy;
      }
    }
    if (!target) continue;
    hit = true;
    const front = Math.cos(Math.atan2(p.y - target.y, p.x - target.x) - target.facing);
    const parry = weapon !== "blade" && shieldRaised(target) && front > .37;
    hurtEnemy(world, target, damage, weapon, parry);
  }
  if (!hit && impact) cue(world, "wall-hit", impact, weapon);
}

function hurtEnemy(world, target, amount, weapon, parry = false) {
  const p = world.player;
  const boss = target === world.boss;
  if (!target.hp || (boss && (!world.arena.active || world.time < world.arena.next))) return;
  if (target.practice && weapon !== target.practice) return;
  if (target.leap || target.wards?.some(ward => ward.hp > 0)) {
    if (target.guardPing < world.time) {
      target.guardPing = world.time + .65;
      cue(world, "shield", target);
      prompt(world, target.leap ? "Король в воздухе" : "Идолы отражают удары");
    }
    return;
  }
  const floor = boss ? world.acts[world.arena.stage].floor : 0;
  const canCry = target.hurt < .07;
  if (target.hp <= target.max / 4) amount *= 1 + skillPower(p, "execute");
  target.hp = Math.max(floor, target.hp - amount * (parry ? .23 : 1));
  target.hurt = .19;
  if (parry && target.guardPing < world.time) {
    target.guardPing = world.time + .24;
    emit(world, "shield", target);
    prompt(world, "Щитоносец открыт после замаха");
  }
  wake(world, target);
  world.flashes.push({ x: target.x, y: target.y, end: world.time + .19 });
  if (target.hp > 0) {
    if (!parry && canCry) cue(world, "enemy-hit", target, target.kind);
    return;
  }
  target.down = world.time;
  if (target.kingWard && !world.boss.wards.some(ward => ward.hp > 0)) {
    prompt(world, "Печать разбита. Король открыт!");
    cue(world, "seal-open", target);
  }
  p.kills++;
  if (p.traits.has("leech")) p.hp = Math.min(p.max, p.hp + 2);
  if (p.traits.has("dash-reset")) p.dashCooldown = Math.max(0, p.dashCooldown - .35);
  if (ARMORY[weapon]?.capacity) {
    p.firearmKills++;
    if (p.traits.has("salvage") && p.firearmKills % 4 === 0) p.ammo = Math.min(p.ammoLimit, p.ammo + 1);
  }
  if (!boss && !world.training && world.lootRandom() < RARE_DROP) world.items.push({ kind: "upgrade", x: target.x, y: target.y });
  emit(world, "defeat", target, target.kind);
}

function deflect(world) {
  const p = world.player;
  const before = world.bolts.length;
  world.bolts = world.bolts.filter(bolt => {
    const dx = bolt.x - p.x, dy = bolt.y - p.y;
    const d = Math.hypot(dx, dy);
    return d > 1.6 || Math.cos(Math.atan2(dy, dx) - p.angle) < .55 || !visible(world, p.x, p.y, bolt, 1.6);
  });
  if (world.bolts.length !== before) cue(world, "shield");
}

function dashWake(world) {
  const p = world.player;
  if (!p.traits.has("dash-wave")) return;
  for (const enemy of world.enemies) {
    if (!enemy.hp || p.dashHits.has(enemy) || !visible(world, p.x, p.y, enemy, .81)) continue;
    p.dashHits.add(enemy);
    hurtEnemy(world, enemy, 12, "dash");
  }
}

function buildFlow(world) {
  const distance = new Int16Array(world.tiles.length).fill(-1);
  const x = Math.floor(world.player.x);
  const y = Math.floor(world.player.y);
  const todo = [ix(world, x, y)];
  distance[todo[0]] = 0;
  for (const id of todo) {
    const x = id % world.width;
    const y = Math.floor(id / world.width);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const next = ix(world, x + dx, y + dy);
      if (tileAt(world, x + dx, y + dy) || distance[next] >= 0) continue;
      distance[next] = distance[id] + 1;
      todo.push(next);
    }
  }
  return distance;
}

function enemyTarget(world, enemy, clear) {
  if (clear) return world.player;
  const x = Math.floor(enemy.x);
  const y = Math.floor(enemy.y);
  let best = world.flow[ix(world, x, y)];
  let point = { x: x + .5, y: y + .5 };
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const candidate = world.flow[ix(world, x + dx, y + dy)];
    if (candidate < 0 || candidate >= best) continue;
    best = candidate;
    point = { x: x + dx + .5, y: y + dy + .5 };
  }
  return openAt(world, (point.x + enemy.x) / 2, (point.y + enemy.y) / 2, .23)
    ? point : { x: x + .5, y: y + .5 };
}

function volley(world, enemy, angles, speed, force) {
  const boss = enemy === world.boss;
  const kind = boss ? "boss-bolt" :
    enemy.kind === "mask" ? "curse-bolt" : enemy.kind === "slinger" ? "stone-bolt" : "bolt";
  for (const angle of angles) {
    world.bolts.push({
      kind, x: enemy.x, y: enemy.y,
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, hurt: force, end: world.time + 4,
    });
  }
  emit(world, kind, enemy);
}

function captainAttack(world, boss, act, clear) {
  const { arena, time } = world;
  const move = boss.pattern++;
  const facing = boss.facing;
  if (arena.stage === 1 && move % 2 === 0) {
    const { x, y } = boss.mark;
    for (const drift of [-2.3, 0, 2.3]) {
      const cx = x - Math.sin(facing) * drift;
      const cy = y + Math.cos(facing) * drift;
      if (cx < arena.left || tileAt(world, Math.floor(cx), Math.floor(cy))) continue;
      world.hazards.push({ x: cx, y: cy, radius: 1.44, strike: time + .85, end: time + 1.19 });
    }
    emit(world, "powder-mark", boss.mark);
  } else if (arena.stage === 2 && move % 2 === 0) {
    boss.charge = .68;
    boss.hitCharge = false;
    emit(world, "boss-charge", boss);
  } else if (arena.stage === 2) {
    const radial = Array.from({ length: 14 }, (_, i) => facing + (i + .5) * TAU / 14);
    volley(world, boss, radial, 6.4, act.damage);
  } else if (clear) {
    const quick = move % 2 !== 0;
    const angles = quick ? [-.105, 0, .105] : [-.55, -.37, -.18, 0, .18, .37, .55];
    volley(world, boss, angles.map(turn => facing + turn), quick ? 8.0 : 5.1, act.damage);
  }
}

const LEAP_SPAN = .57;

function kingHazard(world, x, y, radius, delay, hurt, tone) {
  if (x <= world.arena.left || tileAt(world, Math.floor(x), Math.floor(y))) return;
  const strike = world.time + delay;
  world.hazards.push({ x, y, radius, strike, end: strike + .34, hurt, tone });
}

function kingLanding(world, king) {
  const { player, arena, gate, midY } = world;
  const x = clamp(player.x, arena.left + 1.8, gate.x - .6);
  const y = clamp(player.y, midY - 9.3, midY + 9.3);
  for (const [dx, dy] of [[0,0], [.8,0], [-.8,0], [0,.9], [0,-.9]]) {
    if (!tileAt(world, Math.floor(x + dx), Math.floor(y + dy))) return { x: x + dx, y: y + dy };
  }
  return { x: king.x, y: king.y };
}

function kingFault(world, king, act, cross) {
  const { player, arena, gate, midY } = world;
  const vertical = king.pattern % 2 === 0;
  const axes = cross ? [vertical, !vertical] : [vertical];
  for (const [wave, column] of axes.entries()) {
    const start = column ? midY - 9 : arena.left + 1;
    const end = column ? midY + 10 : gate.x;
    const line = column ? Math.max(arena.left + .5, player.x) : player.y;
    const gap = column ? midY + (king.pattern % 3 - 1) * 5 : arena.left + 5 + king.pattern % 3 * 6;
    for (let at = start; at <= end; at += 1.37) {
      if (Math.abs(at - gap) < 1.8) continue;
      kingHazard(world, column ? line : at, column ? at : line, 1.0,
        act.wind + (at - start) * .018 + wave * .35, act.damage, "fault");
    }
  }
  cue(world, "king-stomp", king);
  prompt(world, cross ? "Трон раскалывается · уйди с отмеченных полос" : "Корни под ногами · шагни с полосы");
}

function updateKing(world, king, dt) {
  const { arena, player } = world;
  const act = world.acts[arena.stage];
  if (!arena.active || world.time < arena.next) return;
  world.pressure += 2;
  king.facing = Math.atan2(player.y - king.y, player.x - king.x);
  if (king.leap) {
    const action = king.leap;
    action.age = Math.min(LEAP_SPAN, action.age + dt);
    const t = action.age / LEAP_SPAN;
    king.x = action.fromX + (action.x - action.fromX) * t;
    king.y = action.fromY + (action.y - action.fromY) * t;
    king.lift = 6.6 * t * (1 - t);
    if (t === 1) {
      king.leap = null;
      king.lift = 0;
      king.wait = king.recover = act.cooldown;
      cue(world, "king-stomp", king);
    }
    return;
  }
  if (king.attack > 0) {
    king.attack = Math.max(0, king.attack - dt);
    if (king.attack) return;
    if (king.mark) {
      king.leap = { ...king.mark, fromX: king.x, fromY: king.y, age: 0 };
      king.mark = null;
      cue(world, "king-charge", king);
    } else king.wait = king.recover = act.cooldown;
    return;
  }
  king.wait -= dt;
  if (king.wait > 0) return;
  king.pattern++;
  king.attack = king.attackSpan = act.wind;
  const leap = arena.stage === 0 || (arena.stage === 2 && king.pattern % 3 !== 0);
  if (!leap) {
    kingFault(world, king, act, arena.stage === 2);
    return;
  }
  king.mark = kingLanding(world, king);
  const { x, y } = king.mark;
  kingHazard(world, x, y, arena.stage ? 2.7 : 2.15, act.wind + LEAP_SPAN, act.damage, "root");
  if (arena.stage === 2) {
    for (let i = 0; i < 6; i++) {
      const angle = (i + (king.pattern % 2) * .5) * TAU / 6;
      kingHazard(world, x + Math.cos(angle) * 3.8, y + Math.sin(angle) * 3.8, 1.45,
        act.wind + LEAP_SPAN + .27, act.damage, "fault");
    }
  }
  cue(world, "enemy-windup", king, "king");
  if (king.pattern === 1) prompt(world, "Король готовится прыгнуть · покинь круг");
}

function updateHazards(world) {
  world.hazards = world.hazards.filter(hazard => {
    if (hazard.end <= world.time) return false;
    if (!hazard.burst && hazard.strike <= world.time) {
      hazard.burst = true;
      if (Math.hypot(world.player.x - hazard.x, world.player.y - hazard.y) < hazard.radius) {
        damage(world, hazard.hurt ?? BOSS_ACTS[1].damage + 4);
      }
      if (hazard.tone !== "fault") emit(world, hazard.tone === "root" ? "king-root" : "powder-burst", hazard);
    }
    return true;
  });
}

function updateEnemy(world, enemy, dt) {
  enemy.moving = false;
  if (!enemy.hp) return;
  enemy.hurt = Math.max(0, enemy.hurt - dt);
  enemy.recover = Math.max(0, enemy.recover - dt);
  if (enemy.practice) return;
  if (enemy.kind === "king") {
    updateKing(world, enemy, dt);
    return;
  }
  const p = world.player;
  const spec = ENEMIES[enemy.kind];
  const boss = enemy === world.boss;
  if (boss && (!world.arena.active || world.time < world.arena.next)) return;
  const act = boss ? world.acts[world.arena.stage] : spec;
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  if (distance > (boss ? 25 : 17)) return;
  const clear = visible(world, enemy.x, enemy.y, p, boss ? 22 : enemy.kind === "crab" ? 8.2 : 9);
  if (clear) wake(world, enemy);
  if (!enemy.awake) return;
  if (clear && distance < 10) world.pressure++;
  if (boss && enemy.charge > 0) {
    enemy.charge = Math.max(0, enemy.charge - dt);
    const speed = 9;
    moveBody(world, enemy, Math.cos(enemy.facing) * speed * dt, Math.sin(enemy.facing) * speed * dt, .28);
    if (!enemy.hitCharge && Math.hypot(p.x - enemy.x, p.y - enemy.y) < 1.1 && visible(world, enemy.x, enemy.y, p, 1.15)) {
      enemy.hitCharge = true;
      damage(world, act.damage + 5);
    }
    return;
  }
  if (clear && enemy.attack <= 0) enemy.facing = Math.atan2(p.y - enemy.y, p.x - enemy.x);
  if (enemy.attack > 0) {
    enemy.attack = Math.max(0, enemy.attack - dt);
    if (enemy.attack > 0) return;
    enemy.recover = .23;
    enemy.wait = act.cooldown;
    if (boss) captainAttack(world, enemy, act, clear);
    else if (!spec.ranged) {
      cue(world, "enemy-strike", enemy, enemy.kind);
      if (clear && distance < spec.reach + .31 && damage(world, spec.damage) && enemy.kind === "viper") {
        p.slowed = world.time + 1.25;
      }
    } else if (clear) {
      const angles = enemy.kind === "mask" ? [-.27, 0, .27].map(a => a + enemy.facing) : [enemy.facing];
      volley(world, enemy, angles, enemy.kind === "mask" ? 4.65 : enemy.kind === "slinger" ? 6.1 : 4.9, spec.damage);
    }
    return;
  }
  enemy.wait = Math.max(0, enemy.wait - dt);
  const charge = boss && world.arena.stage === 2 && enemy.pattern % 2 === 0;
  if (clear && distance <= (charge ? 8.3 : spec.reach) && enemy.wait <= 0) {
    enemy.attackSpan = enemy.attack = act.wind;
    if (boss) enemy.mark = { x: p.x, y: p.y };
    const powder = boss && world.arena.stage === 1 && enemy.pattern % 2 === 0;
    cue(world, "enemy-windup", enemy, charge ? "charge" : powder ? "powder" : enemy.kind);
    return;
  }
  if (enemy.kingWard || (distance < (spec.ranged ? 3.1 : .55) && clear)) return;
  const target = enemyTarget(world, enemy, clear);
  let dx = target.x - enemy.x;
  let dy = target.y - enemy.y;
  if ((enemy.kind === "crab" || spec.agile) && clear && distance > 1.1) {
    const sidestep = Math.sin(world.time * 7 + enemy.phase) * .67;
    dx -= Math.sin(enemy.facing) * sidestep;
    dy += Math.cos(enemy.facing) * sidestep;
  }
  for (const other of world.enemies) {
    if (other === enemy || !other.hp) continue;
    const ax = enemy.x - other.x;
    const ay = enemy.y - other.y;
    const near = Math.hypot(ax, ay);
    if (near < .57 && near > .02) { dx += .31 * ax / near; dy += .31 * ay / near; }
  }
  const length = Math.max(.001, Math.hypot(dx, dy));
  if (distance > .48) {
    const x = enemy.x, y = enemy.y;
    moveBody(world, enemy, dx / length * act.speed * dt, dy / length * act.speed * dt, .23);
    const stride = Math.hypot(enemy.x - x, enemy.y - y);
    enemy.moving = stride > .0001;
    const previousStep = Math.floor(enemy.gait / ENEMY_STEP_SPACING);
    enemy.gait += stride;
    if (distance < 9 && Math.floor(enemy.gait / ENEMY_STEP_SPACING) > previousStep) {
      cue(world, "enemy-step", enemy, enemy.kind);
    }
  }
}

function moveSounds(world, distance) {
  const p = world.player;
  if (p.dash > 0) p.stride = 0;
  else {
    p.stride += distance;
    if (p.stride >= STEP_SPACING) {
      p.stride -= STEP_SPACING;
      const style = world.floor[ix(world, Math.floor(p.x), Math.floor(p.y))];
      cue(world, "player-step", null, FLOOR_SOUNDS[style]);
    }
  }
  if (world.time < world.nextAmbience || world.arena.active) return;
  const wing = sector(world);
  cue(world, "ambience", null, world.map.key === "island" ? "jungle" : wing === 0 ? "dock" : "underground");
  world.nextAmbience = world.time + 6 + Math.sin(world.time * 1.6) * 2;
}

export function stepRun(world, input, dt) {
  if (world.status !== "play" || world.skillChoices.length) return;
  dt = clamp(dt, 0, .05);
  const p = world.player;
  world.time += dt;
  reloadTick(world, dt);
  if (input.reload) reloadWeapon(world);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.recoil = Math.max(0, p.recoil - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.angle = (p.angle + (input.turn || 0) * 2.45 * dt + (input.look || 0) + TAU) % TAU;
  const a = Math.cos(p.angle);
  const b = Math.sin(p.angle);
  const forward = input.forward || 0;
  const strafe = input.strafe || 0;
  p.pitch = clamp(p.pitch + (input.tilt || 0), -1.7, 1.7);
  const speed = 2.65 * p.moveScale * (p.slowed > world.time ? .8 : 1) / Math.max(1, Math.hypot(forward, strafe));
  let vx = (a * forward - b * strafe) * speed;
  let vy = (b * forward + a * strafe) * speed;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (input.dash && !p.dashCooldown) {
    const magnitude = Math.hypot(vx, vy);
    p.dashX = magnitude > 0 ? vx / magnitude : a;
    p.dashY = magnitude > 0 ? vy / magnitude : b;
    p.dash = .21;
    p.dashCooldown = p.dashReset;
    p.dashShot = world.time + 2;
    p.dashHits.clear();
    emit(world, "dash");
  }
  const beforeX = p.x;
  const beforeY = p.y;
  if (p.dash > 0) {
    vx = p.dashX * p.dashSpeed;
    vy = p.dashY * p.dashSpeed;
  }
  moveBody(world, p, vx * dt, vy * dt, .23);
  if (p.dash > 0) dashWake(world);
  const travelled = Math.hypot(p.x - beforeX, p.y - beforeY);
  p.moving += (Number(travelled > .0001) - p.moving) * Math.min(1, dt * 13);
  moveSounds(world, travelled);
  p.bob += dt * (p.dash > 0 ? 16 : 10) * p.moving;
  if (input.interact) openSecret(world);
  reveal(world);
  const wasInArena = world.arena.active;
  if (input.fire) shoot(world);
  gather(world);
  if (world.status !== "play" || world.skillChoices.length || (!wasInArena && world.arena.active)) return;

  if (world.time > world.nextFlow) { world.flow = buildFlow(world); world.nextFlow = world.time + .22; }
  world.pressure = 0;
  for (const enemy of world.enemies) updateEnemy(world, enemy, dt);
  world.bolts = world.bolts.filter(bolt => {
    if (bolt.end <= world.time) return false;
    bolt.x += bolt.dx * dt;
    bolt.y += bolt.dy * dt;
    if (tileAt(world, Math.floor(bolt.x), Math.floor(bolt.y))) {
      if (world.time >= world.nextImpact && Math.hypot(p.x - bolt.x, p.y - bolt.y) < 8) {
        world.nextImpact = world.time + .12;
        cue(world, "bolt-impact", bolt);
      }
      return false;
    }
    if (Math.hypot(p.x - bolt.x, p.y - bolt.y) < .31) { damage(world, bolt.hurt); return false; }
    return true;
  });
  updateHazards(world);
  p.dash = Math.max(0, p.dash - dt);
  world.flashes = world.flashes.filter(flash => flash.end > world.time);
}
