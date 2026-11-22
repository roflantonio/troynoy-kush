export const FIELD = { width: 960, height: 600, radius: 16 };
export const COLORS = ["#ffa460", "#c99bff", "#5df1cb"];
export const WALLS = [
  { x: 272, y: 126, w: 144, h: 30 }, { x: 544, y: 126, w: 144, h: 30 },
  { x: 162, y: 234, w: 34, h: 132 }, { x: 764, y: 234, w: 34, h: 132 },
  { x: 274, y: 412, w: 134, h: 32 }, { x: 552, y: 412, w: 134, h: 32 },
  { x: 345, y: 250, w: 37, h: 92 }, { x: 578, y: 250, w: 37, h: 92 },
];
const SPAWNS = [[118, 106], [842, 106], [480, 530], [118, 494], [842, 494], [480, 72]];
const TARGET = 12;
const DURATION = 110_000;
export const EMPTY = { x: 0, y: 0, a: 0, fire: false, dash: 0 };
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

function spawn(player, x, y, clock) {
  Object.assign(player, { x, y, hp: 3, wake: 0, protect: clock + 1550, dx: 0, dy: 0, slip: 0, cooldown: clock, shoot: clock });
}

export function startMatch() {
  const players = SPAWNS.slice(0, 3).map(([x, y], id) => {
    const player = { id, score: 0, a: Math.atan2(300 - y, 480 - x), dash: 0 };
    spawn(player, x, y, 2350);
    return player;
  });
  return {
    time: 0, limit: DURATION + 2500, count: 2500, nextDrop: 4400, dropCount: 0,
    eventId: 0, bulletId: 0, players, bullets: [], crystals: [], events: [], over: false,
  };
}

function event(s, kind, x, y, id = -1) {
  s.events.push([++s.eventId, kind, Math.round(x), Math.round(y), id]);
  if (s.events.length > 18) s.events.shift();
}

export function inputPacket(body) {
  const number = val => Number.isFinite(val) ? val : 0;
  return {
    x: clamp(number(body.x), -1, 1), y: clamp(number(body.y), -1, 1),
    a: clamp(number(body.a), -Math.PI, Math.PI),
    fire: body.fire === true, dash: Math.max(0, Math.trunc(number(body.dash))),
  };
}

function wallAt(x, y, radius) {
  if (x < radius + 6 || y < radius + 6 || x > FIELD.width - radius - 6 || y > FIELD.height - radius - 6) return true;
  return WALLS.some(wall =>
    x > wall.x - radius && x < wall.x + wall.w + radius
    && y > wall.y - radius && y < wall.y + wall.h + radius);
}

export function movePoint(p, dx, dy) {
  let { x, y } = p;
  if (!wallAt(x + dx, y, FIELD.radius)) x += dx;
  if (!wallAt(x, y + dy, FIELD.radius)) y += dy;
  return { x, y };
}

function closestRival(s, p, x, y) {
  return Math.min(...s.players.filter(other => other !== p && !other.wake).map(other => Math.hypot(other.x - x, other.y - y)));
}

function simulatePlayer(s, p, control, dt) {
  const now = s.time;
  if (p.wake) {
    if (now < p.wake) return;
    const [x, y] = SPAWNS.reduce((best, candidate) =>
      closestRival(s, p, ...candidate) > closestRival(s, p, ...best) ? candidate : best);
    spawn(p, x, y, now);
    event(s, "spawn", x, y, p.id);
  }
  p.a = control.a;
  const pressedDash = p.dash !== control.dash;
  p.dash = control.dash;
  let dx = control.x;
  let dy = control.y;
  const magnitude = Math.max(1, Math.hypot(dx, dy));
  dx /= magnitude;
  dy /= magnitude;
  if (pressedDash && p.cooldown <= now) {
    p.dx = Math.hypot(dx, dy) > 0.1 ? dx : Math.cos(p.a);
    p.dy = Math.hypot(dx, dy) > 0.1 ? dy : Math.sin(p.a);
    p.slip = now + 173;
    p.cooldown = now + 2380;
    event(s, "dash", p.x, p.y, p.id);
  }

  if (p.slip > now) Object.assign(p, movePoint(p, p.dx * 645 * dt, p.dy * 645 * dt));
  else Object.assign(p, movePoint(p, dx * 234 * dt, dy * 234 * dt));

  if (control.fire && p.shoot <= now) {
    p.shoot = now + 245;
    const cos = Math.cos(p.a), sin = Math.sin(p.a);
    s.bullets.push({ id: ++s.bulletId, owner: p.id, x: p.x + cos * 23, y: p.y + sin * 23,
      dx: cos * 690, dy: sin * 690, end: now + 980, bounce: 1 });
    event(s, "shot", p.x, p.y, p.id);
  }
}

function simulateBolt(s, b, dt) {
  if (s.time >= b.end) return false;
  const nx = b.x + b.dx * dt;
  const ny = b.y + b.dy * dt;
  if (wallAt(nx, ny, 3)) {
    if (!b.bounce) return false;
    b.bounce = 0;
    const hitX = wallAt(nx, b.y, 3);
    const hitY = wallAt(b.x, ny, 3);
    if (hitX || !hitY) b.dx *= -1;
    if (hitY || !hitX) b.dy *= -1;
    event(s, "bounce", b.x, b.y, b.owner);
    return true;
  }
  b.x = nx;
  b.y = ny;
  const target = s.players.find(p => p.id !== b.owner && !p.wake && p.protect <= s.time
    && p.slip <= s.time && Math.hypot(p.x - b.x, p.y - b.y) < FIELD.radius + 4);
  if (!target) return true;
  target.hp--;
  event(s, "hit", target.x, target.y, target.id);
  if (target.hp < 1) {
    target.wake = s.time + 1650;
    s.players[b.owner].score += 2;
    event(s, "burst", target.x, target.y, target.id);
  }
  return false;
}

function collectCrystals(s) {
  if (s.nextDrop <= s.time) {
    const theta = s.dropCount++ * 2.399963;
    const x = 480 + Math.cos(theta) * 67;
    const y = 298 + Math.sin(theta) * 74;
    s.crystals.push({ x, y, id: s.dropCount });
    if (s.crystals.length > 3) s.crystals.shift();
    s.nextDrop = s.time + 7600;
    event(s, "drop", x, y);
  }
  s.crystals = s.crystals.filter(crystal => {
    const chosen = s.players.filter(p => !p.wake && Math.hypot(p.x - crystal.x, p.y - crystal.y) < 26)
      .sort((a, b) => Math.hypot(a.x - crystal.x, a.y - crystal.y) - Math.hypot(b.x - crystal.x, b.y - crystal.y))[0];
    if (!chosen) return true;
    chosen.score++;
    chosen.hp = Math.min(3, chosen.hp + 1);
    event(s, "crystal", crystal.x, crystal.y, chosen.id);
    return false;
  });
}

export function step(s, controls, milliseconds) {
  if (s.over) return;
  const dt = clamp(milliseconds, 0, 20);
  s.time += dt;
  if (s.time < s.count) {
    for (const p of s.players) p.dash = controls[p.id].dash;
    return;
  }
  for (const p of s.players) simulatePlayer(s, p, controls[p.id], dt / 1000);
  s.bullets = s.bullets.filter(bolt => simulateBolt(s, bolt, dt / 1000));
  collectCrystals(s);
  s.over = s.time >= s.limit || s.players.some(p => p.score >= TARGET);
  if (s.over) event(s, "over", 480, 300);
}
