const COLS = 4;
const ROWS = 3;
const STEP = 8;
export const WIDTH = 35;
export const HEIGHT = 27;
export const TAU = Math.PI * 2;

export const ARMORY = {
  pistol: { name: "Кремнёвый пистолет", damage: 24, reload: .37, spread: .022, pellets: 1, range: 17 },
  scatter: { name: "Мушкетон", damage: 14, reload: .71, spread: .17, pellets: 5, range: 9 },
  blade: { name: "Кортик", damage: 22, reload: .31, spread: .18, pellets: 1, range: 1.65 },
};
const CURSES = [
  { name: "Огниво", desc: "быстрее перезарядка", apply: p => { p.reload *= .77; } },
  { name: "Мёртвый порох", desc: "выше урон и запас пороха", apply: p => { p.power += .28; p.ammo = Math.min(99, p.ammo + 8); } },
  { name: "Печать живучести", desc: "больше здоровья", apply: p => { p.max += 24; p.hp = Math.min(p.max, p.hp + 42); } },
  { name: "Пиявка", desc: "победы восстанавливают здоровье", apply: p => { p.leech = 6; } },
];
const ENEMIES = {
  drowned: { hp: 38, speed: 1.37, reach: .74, wind: .37, cooldown: .74, damage: 10 },
  corsair: { hp: 52, speed: 1.03, reach: 6.2, wind: .56, cooldown: 1.47, damage: 12 },
  captain: { hp: 150, speed: 1.19, reach: 6.9, wind: .59, cooldown: .93, damage: 17 },
};

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
const center = id => [5 + id % COLS * STEP, 5 + Math.floor(id / COLS) * STEP];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function roomNeighbors(id) {
  return [id % COLS ? id - 1 : -1, id % COLS < COLS - 1 ? id + 1 : -1,
    id >= COLS ? id - COLS : -1, id + COLS < COLS * ROWS ? id + COLS : -1].filter(i => i >= 0);
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return 1;
  return world.tiles[ix(x, y)];
}

function topology(rooms, rand) {
  const visited = new Set([0]);
  const stack = [0];
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
  for (const [a, b] of shuffled(extras, rand).slice(0, 4)) connect(a, b);

  const distance = Array(rooms.length).fill(Infinity);
  const queue = [0];
  distance[0] = 0;
  for (const id of queue) for (const next of links[id]) {
    if (distance[next] < Infinity) continue;
    distance[next] = distance[id] + 1;
    queue.push(next);
  }
  return { links, distance };
}

function addEnemy(world, kind, x, y) {
  const spec = ENEMIES[kind];
  world.enemies.push({ kind, x, y, hp: spec.hp, max: spec.hp, awake: false, attack: 0, wait: .35,
    hurt: 0, down: 0, phase: world.rand() * TAU, basis: 0 });
}

export function createRun(seed) {
  const rand = seeded(seed);
  const tiles = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const floor = new Uint8Array(tiles.length);
  const filled = new Uint8Array(tiles.length);
  const rooms = Array.from({ length: COLS * ROWS }, (_, id) => {
    const [x, y] = center(id);
    const broad = id === 0 || rand() > .44;
    return { id, x, y, left: broad ? 3 : 2, right: broad || rand() > .4 ? 3 : 2,
      top: id === 0 || rand() > .64 ? 3 : 2, bottom: rand() > .61 ? 3 : 2, floor: id === 0 ? 1 : Math.floor(rand() * 3) };
  });
  const { links, distance } = topology(rooms, rand);
  const open = (x, y, style) => { tiles[ix(x, y)] = 0; floor[ix(x, y)] = style; filled[ix(x, y)] = 1; };
  for (const room of rooms) {
    for (let y = room.y - room.top; y <= room.y + room.bottom; y++) {
      for (let x = room.x - room.left; x <= room.x + room.right; x++) open(x, y, room.floor);
    }
  }
  for (const a of rooms) for (const id of links[a.id].filter(id => id > a.id)) {
    const b = rooms[id];
    const shift = rand() < .5 ? -1 : 0;
    if (a.y === b.y) {
      for (let x = a.x + a.right + 1; x < b.x - b.left; x++) {
        open(x, a.y + shift, 0); open(x, a.y + shift + 1, 0);
      }
    } else {
      for (let y = a.y + a.bottom + 1; y < b.y - b.top; y++) {
        open(a.x + shift, y, 0); open(a.x + shift + 1, y, 0);
      }
    }
  }
  for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
    if (!tiles[ix(x, y)] || (!filled[ix(x + 1, y)] && !filled[ix(x - 1, y)] && !filled[ix(x, y + 1)] && !filled[ix(x, y - 1)])) continue;
    const chance = rand();
    tiles[ix(x, y)] = chance < .13 ? 4 : chance < .32 ? 3 : chance < .52 ? 2 : 1;
  }

  const order = shuffled(rooms.slice(1), rand).sort((a, b) => distance[a.id] - distance[b.id]);
  const final = order.at(-1);
  const relicRooms = [order[2], order[5], order[8]];
  const blessings = shuffled(CURSES, rand);
  const player = { x: 2.65, y: 5.5, angle: 0, hp: 100, max: 100, ammo: 28, weapon: "pistol", scatter: false,
    relics: 0, power: 1, reload: 1, leech: 0, cooldown: 0, hurt: 0, recoil: 0, bob: 0, moving: 0, kills: 0, perks: [] };
  const world = {
    seed, rand, tiles, floor, links, rooms, player, enemies: [], items: [], props: [], bolts: [], flashes: [], events: [],
    gate: { x: final.x + .5, y: final.y + .5 }, flow: null, nextFlow: -1,
    start: { x: player.x, y: player.y }, time: 0, status: "play", hint: "", hintUntil: 0,
  };
  const pickup = (kind, x, y, extra = {}) => world.items.push({ kind, x, y, ...extra });
  addEnemy(world, "drowned", 7.05, 5.5);
  world.props.push({ kind: "torch", x: 6.8, y: 3.25 }, { kind: "barrel", x: 4.05, y: 6.85 }, { kind: "torch", x: 7.25, y: 7.02 });
  for (const room of order) {
    const hasRelic = relicRooms.indexOf(room);
    world.props.push({ kind: "torch", x: room.x - 1.35, y: room.y - 1.25 });
    if (room === final) {
      addEnemy(world, "captain", room.x + 1.65, room.y + 1.25);
      pickup("ammo", room.x - 1.48, room.y + .4);
      continue;
    }
    const advanced = distance[room.id] >= 3;
    addEnemy(world, hasRelic >= 0 || (advanced && rand() < .48) ? "corsair" : "drowned",
      room.x + 1.65, room.y + .5 + (rand() < .5 ? -.5 : .62));
    if (advanced && rand() < .56) addEnemy(world, "drowned", room.x - 1.15, room.y + 1.24);
    if (hasRelic >= 0) pickup("relic", room.x + .5, room.y + .5, { blessing: blessings[hasRelic] });
    pickup(room === order[1] ? "scatter" : rand() < .61 ? "ammo" : "heal", room.x + .35, room.y - 1.05);
    if (rand() < .65) world.props.push({ kind: "barrel", x: room.x + 1.85, y: room.y - 1.25 });
  }
  return world;
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
  return { distance: Math.min(length, maximum), wall, side, u: Number.isFinite(u) ? u : 0 };
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

function damage(world, points) {
  const p = world.player;
  if (p.hurt > .19 || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - points);
  p.hurt = .36;
  world.events.push("hurt");
  if (!p.hp) { world.status = "dead"; world.events.push("dead"); }
}

function gather(world) {
  const p = world.player;
  world.items = world.items.filter(item => {
    if (Math.hypot(p.x - item.x, p.y - item.y) > .59) return true;
    if (item.kind === "ammo") {
      if (p.ammo >= 99) return true;
      p.ammo = Math.min(99, p.ammo + 11);
      prompt(world, "+11 пороха");
    } else if (item.kind === "heal") {
      if (p.hp >= p.max) return true;
      p.hp = Math.min(p.max, p.hp + 32);
      prompt(world, "+32 здоровья");
    } else if (item.kind === "scatter") {
      p.scatter = true;
      p.weapon = "scatter";
      p.ammo = Math.min(99, p.ammo + 11);
      prompt(world, "Мушкетон найден");
    } else {
      p.relics++;
      item.blessing.apply(p);
      p.perks.push(item.blessing.name);
      prompt(world, item.blessing.name + " · " + item.blessing.desc);
      world.events.push("relic");
      return false;
    }
    world.events.push("pickup");
    return false;
  });

  if (Math.hypot(p.x - world.gate.x, p.y - world.gate.y) < .66) {
    if (p.relics !== 3) prompt(world, "Врата ждут три осколка компаса");
    else if (world.enemies.some(e => e.kind === "captain" && e.hp > 0)) prompt(world, "Смотритель всё ещё держит врата");
    else { world.status = "won"; world.events.push("win"); }
  }
}

export function switchWeapon(world, kind) {
  if (kind === "scatter" && !world.player.scatter) return false;
  if (world.player.weapon === kind) return false;
  world.player.weapon = kind;
  world.player.cooldown = Math.max(world.player.cooldown, .12);
  return true;
}

export function shoot(world) {
  const p = world.player;
  if (world.status !== "play" || p.cooldown > 0) return;
  const weapon = p.weapon;
  const spec = ARMORY[weapon];
  p.cooldown = spec.reload * p.reload;
  if (weapon !== "blade" && p.ammo <= 0) {
    world.events.push("empty");
    prompt(world, "Порох кончился · 3 — кортик");
    return;
  }
  if (weapon !== "blade") p.ammo--;
  p.recoil = weapon === "scatter" ? .29 : .195;
  world.events.push(weapon);
  for (let shot = 0; shot < spec.pellets; shot++) {
    const tilt = spec.pellets === 1 ? 0 : (shot / (spec.pellets - 1) - .5) * spec.spread * 2.1;
    const a = p.angle + tilt;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const wall = cast(world, p.x, p.y, cx, cy, spec.range).distance;
    let best = wall;
    let target;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const x = enemy.x - p.x;
      const y = enemy.y - p.y;
      if (Math.hypot(x, y) < 6.2) enemy.awake = true;
      const depth = x * cx + y * cy;
      const width = Math.abs(-x * cy + y * cx);
      if (depth > .05 && depth < best && width < (enemy.kind === "captain" ? .40 : .30) + (weapon === "blade" ? .17 : 0)) {
        best = depth;
        target = enemy;
      }
    }
    if (!target) continue;
    target.hp = Math.max(0, target.hp - spec.damage * p.power);
    target.hurt = .19;
    target.awake = true;
    world.flashes.push({ x: target.x, y: target.y, end: world.time + .19 });
    if (target.hp > 0) continue;
    target.down = world.time;
    p.kills++;
    p.hp = Math.min(p.max, p.hp + p.leech);
    if (world.rand() < .46 && weapon !== "blade") {
      world.items.push({ kind: p.hp < 48 && world.rand() < .42 ? "heal" : "ammo", x: target.x, y: target.y });
    }
    world.events.push("defeat");
  }
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

function updateEnemy(world, enemy, dt) {
  if (!enemy.hp) return;
  const p = world.player;
  const spec = ENEMIES[enemy.kind];
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  const clear = visible(world, enemy.x, enemy.y, p, 9.4);
  enemy.awake ||= clear;
  enemy.hurt = Math.max(0, enemy.hurt - dt);
  if (!enemy.awake || distance > 18) return;

  if (enemy.attack > 0) {
    enemy.attack -= dt;
    if (enemy.attack > 0) return;
    enemy.attack = 0;
    enemy.wait = spec.cooldown;
    if (enemy.kind === "drowned") {
      if (clear && distance < 1.05) damage(world, spec.damage);
    } else if (clear) {
      const ang = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      const spread = enemy.kind === "captain" ? [-.16, 0, .16] : [0];
      for (const drift of spread) {
        const a = ang + drift;
        world.bolts.push({ kind: "bolt", x: enemy.x, y: enemy.y, dx: Math.cos(a) * 3.8, dy: Math.sin(a) * 3.8,
          hurt: spec.damage, end: world.time + 3.4 });
      }
      world.events.push("bolt");
    }
    return;
  }
  enemy.wait = Math.max(0, enemy.wait - dt);
  if (clear && distance <= spec.reach && enemy.wait <= 0) {
    enemy.attack = spec.wind;
    return;
  }
  if (distance < (enemy.kind === "drowned" ? .55 : 3.1) && clear) return;
  const target = enemyTarget(world, enemy, clear);
  let dx = target.x - enemy.x;
  let dy = target.y - enemy.y;
  for (const other of world.enemies) {
    if (other === enemy || !other.hp) continue;
    const ax = enemy.x - other.x;
    const ay = enemy.y - other.y;
    const near = Math.hypot(ax, ay);
    if (near < .57 && near > .02) { dx += .31 * ax / near; dy += .31 * ay / near; }
  }
  const length = Math.max(.001, Math.hypot(dx, dy));
  if (distance > .48) moveBody(world, enemy, dx / length * spec.speed * dt, dy / length * spec.speed * dt, .23);
}

export function stepRun(world, input, dt) {
  if (world.status !== "play") return;
  dt = clamp(dt, 0, .05);
  const p = world.player;
  world.time += dt;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.recoil = Math.max(0, p.recoil - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.angle = (p.angle + (input.turn || 0) * 2.45 * dt + (input.look || 0) + TAU) % TAU;
  const a = Math.cos(p.angle);
  const b = Math.sin(p.angle);
  const forward = input.forward || 0;
  const strafe = input.strafe || 0;
  const speed = (input.sprint ? 3.65 : 2.78) / Math.max(1, Math.hypot(forward, strafe));
  const beforeX = p.x;
  const beforeY = p.y;
  moveBody(world, p, (a * forward - b * strafe) * speed * dt, (b * forward + a * strafe) * speed * dt, .23);
  p.moving += (Number(Math.hypot(p.x - beforeX, p.y - beforeY) > .0001) - p.moving) * Math.min(1, dt * 13);
  p.bob += dt * (input.sprint ? 14 : 10) * p.moving;
  if (input.fire) shoot(world);
  gather(world);
  if (world.status !== "play") return;

  if (world.time > world.nextFlow) { world.flow = buildFlow(world); world.nextFlow = world.time + .22; }
  for (const enemy of world.enemies) updateEnemy(world, enemy, dt);
  world.bolts = world.bolts.filter(bolt => {
    if (bolt.end <= world.time) return false;
    bolt.x += bolt.dx * dt;
    bolt.y += bolt.dy * dt;
    if (tileAt(world, Math.floor(bolt.x), Math.floor(bolt.y))) return false;
    if (Math.hypot(p.x - bolt.x, p.y - bolt.y) < .31) { damage(world, bolt.hurt); return false; }
    return true;
  });
  world.flashes = world.flashes.filter(flash => flash.end > world.time);
}
