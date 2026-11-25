const SIDE = 3;
const WINGS = 3;
const STEP = 15;
const WING_SPAN = STEP * SIDE;
const ARENA_X = WINGS * WING_SPAN + 3;
const MID_Y = STEP + 6;
export const WIDTH = ARENA_X + 21;
export const HEIGHT = (SIDE - 1) * STEP + 13;
export const DASH_COOLDOWN = 1.35;
export const SECRET_PANEL = 10;
const WING_NAMES = ["Затопленная пристань", "Пороховые склады", "Капитанские казематы"];
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
export const UPGRADES = [
  { name: "Чёрный порох", effect: "Урон огнестрельного оружия +10%", apply: p => { p.gunDamage *= 1.10; } },
  { name: "Взведённая пружина", effect: "Темп стрельбы +10%", apply: p => { p.gunCadence /= 1.10; } },
  { name: "Попутный ветер", effect: "Скорость ходьбы +10%", apply: p => { p.moveScale *= 1.10; } },
  { name: "Крепкий шов", effect: "Максимум здоровья +10%", apply: p => {
    const gained = Math.round(p.max * .10);
    p.max += gained;
    p.hp += gained;
  } },
  { name: "Дублёный бушлат", effect: "Получаемый урон −10%", apply: p => { p.damageTaken *= .90; } },
  { name: "Ловкие руки", effect: "Время перезарядки −10%", apply: p => { p.reloadScale *= .90; } },
  { name: "Печать прилива", effect: "Время восстановления рывка −10%", apply: p => { p.dashReset *= .90; } },
  { name: "Летучий якорь", effect: "Дальность рывка +10%", apply: p => { p.dashSpeed *= 1.10; } },
  { name: "Двойная камора", effect: "Мушкет вмещает на один заряд больше", apply: p => { p.capacityBonus.musket++; } },
  { name: "Запасная камора", effect: "Мушкетон вмещает на один заряд больше", apply: p => { p.capacityBonus.scatter++; } },
  { name: "Верный кремень", effect: "Пистолет вмещает на один заряд больше", apply: p => { p.capacityBonus.pistol++; } },
  { name: "Патронташ боцмана", effect: "Максимум запаса патронов +8", apply: p => { p.ammoLimit += 8; } },
  { name: "Клык барракуды", effect: "Урон саблей +15%", apply: p => { p.bladeDamage *= 1.15; } },
  { name: "Длинная гарда", effect: "Дальность удара саблей +10%", apply: p => { p.bladeReach *= 1.10; } },
  { name: "Полевой бальзам", effect: "Лечение из аптечек +25%", apply: p => { p.healScale *= 1.25; } },
];

const ENEMIES = {
  drowned: { hp: 44, speed: 1.55, reach: .82, wind: .34, cooldown: .61, damage: 14 },
  crab: { hp: 29, speed: 2.13, reach: .72, wind: .25, cooldown: .54, damage: 11 },
  sentinel: { hp: 58, speed: 1.12, reach: 1.02, wind: .48, cooldown: .90, damage: 19 },
  corsair: { hp: 44, speed: 1.22, reach: 7.6, wind: .55, cooldown: 1.05, damage: 16, ranged: true },
  captain: { hp: 600, speed: 1.48, reach: 14.2, ranged: true },
};
export const BOSS_ACTS = [
  { name: "Картечь", floor: 400, wind: .78, cooldown: .98, speed: 1.48, damage: 20 },
  { name: "Проклятая команда", floor: 200, wind: .69, cooldown: .83, speed: 1.76, damage: 22 },
  { name: "Последний абордаж", floor: 0, wind: .59, cooldown: .77, speed: 2.18, damage: 27 },
];
const RARE_DROP = .01;
const AMMO_BOX = 9;
const MEDICINE = 23;
const FLOOR_SOUNDS = ["stone", "wood", "damp", "stone", "flagstone"];
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

const ix = (x, y) => y * WIDTH + x;
const startRoom = 3;
const endRoom = 5;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function roomNeighbors(id) {
  return [id % SIDE ? id - 1 : -1, id % SIDE < SIDE - 1 ? id + 1 : -1,
    id >= SIDE ? id - SIDE : -1, id + SIDE < SIDE * SIDE ? id + SIDE : -1].filter(i => i >= 0);
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return 1;
  return world.tiles[ix(x, y)];
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

function topology(rooms, rand) {
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
  for (const [a, b] of shuffled(extras, rand).slice(0, 1)) connect(a, b);

  return { links, distance: roomDistances(links, startRoom) };
}

function planSecret(world, rooms, links, wing) {
  const candidates = [];
  for (const { id } of rooms) {
    const distances = roomDistances(links, id);
    for (const next of roomNeighbors(id)) {
      if (next <= id || links[id].includes(next)) continue;
      const nearEntrance = wing === 0 && (id === startRoom || next === startRoom);
      candidates.push({ id, next, rank: distances[next] + (nearEntrance ? 3 : 0) });
    }
  }
  candidates.sort((a, b) => b.rank - a.rank);
  const { id, next } = candidates[0];
  const a = rooms[id], b = rooms[next];
  const horizontal = a.y === b.y;
  const from = horizontal ? { x: a.x + a.w + 1, y: a.y } : { x: a.x, y: a.y + a.h + 1 };
  const to = horizontal ? { x: b.x - b.w - 1, y: b.y } : { x: b.x, y: b.y - b.h - 1 };
  const style = wing === 0 ? 1 : 3;
  const centerX = Math.floor((from.x + to.x) / 2), centerY = Math.floor((from.y + to.y) / 2);
  const x = centerX + .5, y = centerY + .5;
  const dx = horizontal ? 0 : .86, dy = horizontal ? .86 : 0;
  const supplies = { kind: wing === 1 ? "heal" : "ammo", x: x - dx, y: y - dy };
  const prize = { kind: "upgrade", upgrade: world.upgradeDeck.pop(), x: x + dx, y: y + dy };
  world.secrets.push({ panels: [from, to], x, y, style, supplies, prize, open: false });
}

function addEnemy(world, kind, x, y) {
  const spec = ENEMIES[kind];
  world.enemies.push({ kind, x, y, hp: spec.hp, max: spec.hp, awake: false, attack: 0, wait: .35,
    hurt: 0, down: 0, attackSpan: 0, recover: 0, gait: 0, moving: false, phase: world.rand() * TAU, facing: 0, guardPing: 0 });
}

function buildWing(world, wing, carve) {
  const { rand } = world;
  const rooms = Array.from({ length: SIDE * SIDE }, (_, id) => ({
    id, x: 6 + wing * WING_SPAN + id % SIDE * STEP, y: 6 + Math.floor(id / SIDE) * STEP,
    w: 3 + Number(rand() > .46), h: 3 + Number(rand() > .46), floor: 1 + (wing + id) % 3,
  }));
  const { links, distance } = topology(rooms, rand);
  const order = shuffled(rooms.filter(r => r.id !== startRoom), rand).sort((a, b) => distance[a.id] - distance[b.id]);
  const shrine = order.at(-1);
  for (const room of rooms) {
    carve(room.x - room.w, room.y - room.h, room.x + room.w, room.y + room.h, room.floor);
    for (const id of links[room.id].filter(id => id > room.id)) {
      const next = rooms[id];
      if (next.y === room.y) carve(room.x, room.y, next.x, room.y + 1, 0);
      else carve(room.x, room.y, room.x + 1, next.y, 0);
    }
  }

  planSecret(world, rooms, links, wing);

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

  const exit = rooms[endRoom];
  const gateX = (wing + 1) * WING_SPAN;
  const nextX = wing < WINGS - 1 ? gateX + 6 : ARENA_X + 2;
  carve(exit.x, MID_Y, nextX, MID_Y + 1, 0);
  world.seals.push({ x: gateX + .5, y: MID_Y + 1, wing });
}

export function createRun(seed) {
  const rand = seeded(seed);
  const lootRandom = seeded(seed ^ 0x62c8f1d5);
  const upgradeDeck = shuffled(UPGRADES, lootRandom);
  const tiles = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const floor = new Uint8Array(tiles.length);
  const player = { x: 3.65, y: MID_Y + .5, angle: 0, pitch: 0, hp: 100, max: 100, ammo: 20, weapon: "pistol",
    arsenal: new Set(["pistol", "blade"]), chambers: { pistol: ARMORY.pistol.capacity, scatter: 0, musket: 0 },
    capacityBonus: { pistol: 0, scatter: 0, musket: 0 }, ammoLimit: 64,
    gunDamage: 1, gunCadence: 1, moveScale: 1, damageTaken: 1, bladeDamage: 1, bladeReach: 1, healScale: 1, dashSpeed: 10.5,
    relics: 0, reloadScale: 1, reloadLeft: 0, reloadSpan: 0, cooldown: 0, dashReset: DASH_COOLDOWN,
    hurt: 0, recoil: 0, bob: 0, moving: 0, stride: 0, kills: 0, perks: [], dash: 0, dashCooldown: 0, dashX: 0, dashY: 0 };
  const arena = { entrance: ARENA_X - 1, left: ARENA_X, active: false, cleared: false, stage: 0, next: 0 };
  const world = { seed, rand, lootRandom, upgradeDeck, tiles, floor, player, arena, discovery: new Uint8Array(tiles.length),
    enemies: [], items: [], props: [], bolts: [], hazards: [], flashes: [], events: [], cues: [], seals: [], secrets: [], pressure: 0, nextAmbience: 2.4, nextImpact: 0,
    gate: { x: ARENA_X + 17.5, y: MID_Y + .5 }, flow: null, nextFlow: -1,
    start: { x: player.x, y: player.y }, time: 0, status: "play", hint: "", hintUntil: 0 };
  const carve = (x1, y1, x2, y2, style) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      tiles[ix(x, y)] = 0;
      floor[ix(x, y)] = style;
    }
  };
  for (let wing = 0; wing < WINGS; wing++) buildWing(world, wing, carve);
  carve(ARENA_X, MID_Y - 7, ARENA_X + 18, MID_Y + 7, 4);
  for (const x of [ARENA_X + 5, ARENA_X + 12]) for (const y of [MID_Y - 4, MID_Y + 3]) {
    for (let dy = 0; dy < 2; dy++) tiles[ix(x, y + dy)] = 2;
    world.props.push({ kind: "torch", x: x + 1.5, y: y + .8 });
  }
  world.items.push(
    { kind: "ammo", x: ARENA_X + 2.5, y: MID_Y - 2.1 },
    { kind: "heal", x: ARENA_X + 14.4, y: MID_Y - 5.3 },
  );
  addEnemy(world, "captain", ARENA_X + 11.5, MID_Y + .5);
  world.boss = world.enemies.at(-1);
  world.boss.pattern = 0;
  world.boss.charge = 0;

  for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
    if (!tiles[ix(x, y)] || (tiles[ix(x - 1, y)] && tiles[ix(x + 1, y)] && tiles[ix(x, y - 1)] && tiles[ix(x, y + 1)])) continue;
    const chance = rand();
    tiles[ix(x, y)] = chance < (x >= ARENA_X ? .27 : .13) ? 4 : chance < .32 ? 3 : chance < .52 ? 2 : 1;
  }
  for (const seal of world.seals) setBarrier(world, Math.floor(seal.x), 8);
  for (const { panels, x, y, style } of world.secrets) {
    const [from, to] = panels;
    const cx = Math.floor(x), cy = Math.floor(y);
    carve(from.x, from.y, to.x, to.y, style);
    carve(cx - 1, cy - 1, cx + 1, cy + 1, style);
    for (const panel of panels) world.tiles[ix(panel.x, panel.y)] = SECRET_PANEL;
  }
  reveal(world);
  return world;
}

function setBarrier(world, x, kind) {
  world.tiles[ix(x, MID_Y)] = kind;
  world.tiles[ix(x, MID_Y + 1)] = kind;
  world.nextFlow = -1;
  world.lastReveal = -1;
}

export function location(world) {
  if (world.arena.active) return "Зал Смотрителя";
  return WING_NAMES[Math.min(WINGS - 1, Math.floor(world.player.x / WING_SPAN))];
}

export function compassObjective(world) {
  const relic = world.items.find(item => item.kind === "relic" && item.wing === world.player.relics);
  if (relic) return { point: relic, label: "Осколок" };
  if (world.arena.cleared) return { point: world.gate, label: "Выход" };
  if (world.arena.active) return { point: world.boss, label: "Смотритель" };
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
  for (const { x, y } of secret.panels) world.tiles[ix(x, y)] = 0;
  world.nextFlow = -1;
  world.lastReveal = -1;
  world.items.push(secret.supplies, secret.prize);
  const found = world.secrets.filter(path => path.open).length;
  prompt(world, "Тайный ход открыт · " + found + " / " + world.secrets.length);
  cue(world, "secret-open");
}

export function discovered(world, x, y) {
  return Boolean(world.discovery[ix(Math.floor(x), Math.floor(y))]);
}

function reveal(world) {
  const p = world.player;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  if (world.lastReveal === ix(x, y)) return;
  world.lastReveal = ix(x, y);
  for (let ty = Math.max(0, y - 7); ty < Math.min(HEIGHT, y + 8); ty++) {
    for (let tx = Math.max(0, x - 7); tx < Math.min(WIDTH, x + 8); tx++) {
      if (world.discovery[ix(tx, ty)]) continue;
      if (visible(world, p.x, p.y, { x: tx + .5, y: ty + .5 }, 7.5)) world.discovery[ix(tx, ty)] = 1;
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
  if (p.dash > 0 || p.hurt > .19 || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - Math.max(1, Math.round(points * p.damageTaken)));
  p.hurt = .36;
  emit(world, "hurt");
  if (!p.hp) { world.status = "dead"; emit(world, "dead"); }
}

function gather(world) {
  const p = world.player;
  world.items = world.items.filter(item => {
    if (Math.hypot(p.x - item.x, p.y - item.y) > .59) return true;
    if (item.kind === "ammo") {
      const gained = Math.min(AMMO_BOX, p.ammoLimit - p.ammo);
      if (!gained) return true;
      p.ammo += gained;
      prompt(world, "+" + gained + " патронов");
    } else if (item.kind === "heal") {
      const gained = Math.min(Math.round(MEDICINE * p.healScale), p.max - p.hp);
      if (!gained) return true;
      p.hp += gained;
      prompt(world, "+" + gained + " здоровья");
    } else if (item.kind === "upgrade") {
      item.upgrade.apply(p);
      p.perks.push(item.upgrade.name);
      prompt(world, item.upgrade.name + " · " + item.upgrade.effect);
      cue(world, "upgrade");
      return false;
    } else if (item.kind === "relic") {
      if (item.guards.some(enemy => enemy.hp > 0)) {
        prompt(world, "Осколок охраняют. Одолей стражу");
        return true;
      }
      p.relics++;
      item.boon.apply(p);
      p.perks.push(item.boon.name);
      setBarrier(world, Math.floor(world.seals[item.wing].x), 0);
      prompt(world, (p.relics === 3 ? "Путь к Смотрителю открыт" : "Печать снята") + " · " + item.boon.name);
      emit(world, "relic");
      cue(world, "seal-open", world.seals[item.wing]);
      return false;
    } else {
      p.arsenal.add(item.kind);
      p.chambers[item.kind] = weaponCapacity(p, item.kind);
      switchWeapon(world, item.kind);
      prompt(world, ARMORY[item.kind].name + " · " + (item.kind === "scatter" ? "2" : "4"));
    }
    emit(world, "pickup", null, item.kind);
    return false;
  });

  if (p.relics === WINGS && p.x >= world.arena.left + 1.25 && !world.arena.active) {
    world.arena.active = true;
    setBarrier(world, world.arena.entrance, 8);
    world.bolts.length = 0;
    emit(world, "arena");
    return;
  }
  if (world.arena.active && world.arena.stage < BOSS_ACTS.length - 1 && world.boss.hp === BOSS_ACTS[world.arena.stage].floor) {
    const { arena, boss } = world;
    arena.stage++;
    arena.next = world.time + 1.15;
    boss.pattern = 0;
    boss.attack = 0;
    boss.charge = 0;
    boss.wait = .32;
    world.bolts.length = 0;
    world.hazards.length = 0;
    if (arena.stage === 1) {
      addEnemy(world, "crab", arena.left + 9.3, MID_Y - 4.9);
      addEnemy(world, "corsair", arena.left + 14.8, MID_Y + 4.9);
    }
    prompt(world, BOSS_ACTS[arena.stage].name);
    emit(world, arena.stage === 1 ? "arena-rage" : "arena-fury");
  }
  if (world.arena.active && !world.arena.cleared && world.boss.hp <= 0) {
    world.arena.cleared = true;
    world.bolts.length = 0;
    world.hazards.length = 0;
    prompt(world, "Смотритель пал. Выход открыт!");
    emit(world, "victory");
  }
  if (world.arena.cleared && Math.hypot(p.x - world.gate.x, p.y - world.gate.y) < .78) {
    world.status = "won";
    emit(world, "win");
  }
  const seal = world.seals[p.relics];
  if (seal && Math.hypot(p.x - seal.x, p.y - seal.y) < 1.3) prompt(world, "Печать закрыта. Найди осколок в этом крыле");
}

export function switchWeapon(world, kind) {
  if (!world.player.arsenal.has(kind)) return false;
  if (world.player.weapon === kind) return false;
  world.player.weapon = kind;
  world.player.reloadLeft = 0;
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
  const damage = spec.damage * (blade ? p.bladeDamage : p.gunDamage);
  const range = spec.range * (blade ? p.bladeReach : 1);
  p.cooldown = spec.cadence * (blade ? 1 : p.gunCadence);
  p.recoil = weapon === "scatter" || weapon === "musket" ? .29 : .195;
  emit(world, weapon);
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
      if (enemy.hp <= 0 || (enemy === world.boss && !world.arena.active)) continue;
      const x = enemy.x - p.x;
      const y = enemy.y - p.y;
      if (x * x + y * y < 42) wake(world, enemy);
      const depth = x * cx + y * cy;
      const width = Math.abs(-x * cy + y * cx);
      const aimHeight = .5 + p.pitch * depth * .5;
      const height = enemy.kind === "crab" ? .44 : enemy === world.boss ? 1.17 : .93;
      if (depth > .05 && depth < best && aimHeight >= -.10 && aimHeight <= height + .13 && width < (enemy.kind === "captain" ? .40 : enemy.kind === "crab" ? .26 : .30) + (weapon === "blade" ? .17 : 0)) {
        best = depth;
        target = enemy;
      }
    }
    if (!target) continue;
    hit = true;
    const front = Math.cos(Math.atan2(p.y - target.y, p.x - target.x) - target.facing);
    const parry = weapon !== "blade" && shieldRaised(target) && front > .37;
    if (target === world.boss && world.time < world.arena.next) continue;
    const floor = target === world.boss ? BOSS_ACTS[world.arena.stage].floor : 0;
    const canCry = target.hurt < .07;
    target.hp = Math.max(floor, target.hp - damage * (parry ? .23 : 1));
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
      continue;
    }
    target.down = world.time;
    p.kills++;
    if (target !== world.boss && world.upgradeDeck.length && world.lootRandom() < RARE_DROP) {
      world.items.push({ kind: "upgrade", upgrade: world.upgradeDeck.pop(), x: target.x, y: target.y });
    }
    emit(world, "defeat", target, target.kind);
  }
  if (!hit && impact) cue(world, "wall-hit", impact, weapon);
}

function buildFlow(world) {
  const distance = new Int16Array(WIDTH * HEIGHT).fill(-1);
  const x = Math.floor(world.player.x);
  const y = Math.floor(world.player.y);
  const todo = [ix(x, y)];
  distance[todo[0]] = 0;
  for (const id of todo) {
    const x = id % WIDTH;
    const y = Math.floor(id / WIDTH);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const next = ix(x + dx, y + dy);
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
  let best = world.flow[ix(x, y)];
  let point = { x: x + .5, y: y + .5 };
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const candidate = world.flow[ix(x + dx, y + dy)];
    if (candidate < 0 || candidate >= best) continue;
    best = candidate;
    point = { x: x + dx + .5, y: y + dy + .5 };
  }
  return openAt(world, (point.x + enemy.x) / 2, (point.y + enemy.y) / 2, .23)
    ? point : { x: x + .5, y: y + .5 };
}

function volley(world, enemy, angles, speed, force) {
  const boss = enemy === world.boss;
  for (const angle of angles) {
    world.bolts.push({
      kind: boss ? "boss-bolt" : "bolt", x: enemy.x, y: enemy.y,
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, hurt: force, end: world.time + 4,
    });
  }
  emit(world, boss ? "boss-bolt" : "bolt", enemy);
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

function updateHazards(world) {
  world.hazards = world.hazards.filter(hazard => {
    if (hazard.end <= world.time) return false;
    if (!hazard.burst && hazard.strike <= world.time) {
      hazard.burst = true;
      if (Math.hypot(world.player.x - hazard.x, world.player.y - hazard.y) < hazard.radius) {
        damage(world, BOSS_ACTS[1].damage + 4);
      }
      emit(world, "powder-burst", hazard);
    }
    return true;
  });
}

function updateEnemy(world, enemy, dt) {
  enemy.moving = false;
  if (!enemy.hp) return;
  const p = world.player;
  const spec = ENEMIES[enemy.kind];
  const boss = enemy === world.boss;
  if (boss && (!world.arena.active || world.time < world.arena.next)) return;
  const act = boss ? BOSS_ACTS[world.arena.stage] : spec;
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  enemy.hurt = Math.max(0, enemy.hurt - dt);
  enemy.recover = Math.max(0, enemy.recover - dt);
  if (distance > (boss ? 25 : 17)) return;
  const clear = visible(world, enemy.x, enemy.y, p, boss ? 22 : enemy.kind === "crab" ? 8.2 : 9);
  if (clear) wake(world, enemy);
  if (!enemy.awake) return;
  if (clear && distance < 10) world.pressure++;
  if (boss && enemy.charge > 0) {
    enemy.charge = Math.max(0, enemy.charge - dt);
    moveBody(world, enemy, Math.cos(enemy.facing) * 9.0 * dt, Math.sin(enemy.facing) * 9.0 * dt, .28);
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
      if (clear && distance < spec.reach + .31) damage(world, spec.damage);
    } else if (clear) volley(world, enemy, [enemy.facing], 4.9, spec.damage);
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
  if (distance < (spec.ranged ? 3.1 : .55) && clear) return;
  const target = enemyTarget(world, enemy, clear);
  let dx = target.x - enemy.x;
  let dy = target.y - enemy.y;
  if (enemy.kind === "crab" && clear && distance > 1.1) {
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
      const style = world.floor[ix(Math.floor(p.x), Math.floor(p.y))];
      cue(world, "player-step", null, FLOOR_SOUNDS[style]);
    }
  }
  if (world.time < world.nextAmbience || world.arena.active) return;
  const wing = Math.floor(p.x / WING_SPAN);
  cue(world, "ambience", null, wing === 0 ? "dock" : "underground");
  world.nextAmbience = world.time + 6 + Math.sin(world.time * 1.6) * 2;
}

export function stepRun(world, input, dt) {
  if (world.status !== "play") return;
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
  const speed = 2.65 * p.moveScale / Math.max(1, Math.hypot(forward, strafe));
  let vx = (a * forward - b * strafe) * speed;
  let vy = (b * forward + a * strafe) * speed;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (input.dash && !p.dashCooldown) {
    const magnitude = Math.hypot(vx, vy);
    p.dashX = magnitude > 0 ? vx / magnitude : a;
    p.dashY = magnitude > 0 ? vy / magnitude : b;
    p.dash = .21;
    p.dashCooldown = p.dashReset;
    emit(world, "dash");
  }
  const beforeX = p.x;
  const beforeY = p.y;
  if (p.dash > 0) {
    vx = p.dashX * p.dashSpeed;
    vy = p.dashY * p.dashSpeed;
  }
  moveBody(world, p, vx * dt, vy * dt, .23);
  const travelled = Math.hypot(p.x - beforeX, p.y - beforeY);
  p.moving += (Number(travelled > .0001) - p.moving) * Math.min(1, dt * 13);
  moveSounds(world, travelled);
  p.bob += dt * (p.dash > 0 ? 16 : 10) * p.moving;
  if (input.interact) openSecret(world);
  reveal(world);
  const wasInArena = world.arena.active;
  if (input.fire) shoot(world);
  gather(world);
  if (world.status !== "play" || (!wasInArena && world.arena.active)) return;

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
