export const SEA_WIDTH = 432;
export const SEA_HEIGHT = 244;
export const KRAKEN_HP = 360;
export const HELM = ["Лево руля", "Держать курс", "Право руля"];

const FORMATIONS = [
  [[75, 155, 0], [344, 169, 0]],
  [[332, 143, 1], [114, 172, 0]],
  [[66, 144, 1], [344, 171, 1], [118, 186, 0]],
  [[319, 136, 2], [61, 162, 1], [363, 183, 1]],
  [[94, 137, 1], [360, 167, 2], [130, 188, 1]],
  [[340, 136, 1], [82, 149, 2], [331, 178, 2], [120, 191, 0]],
  [[72, 135, 2], [338, 151, 2], [129, 177, 1], [367, 195, 1]],
  [[358, 138, 2], [61, 152, 2], [306, 174, 2], [101, 193, 2]],
];
export const FLEET_WAVES = FORMATIONS.length;
export const FLEET_TOTAL = FORMATIONS.reduce((total, wave) => total + wave.length, 0);
const CLASSES = [
  { hp: 2, reload: 5.6 },
  { hp: 3, reload: 5.0 },
  { hp: 4, reload: 4.4 },
];
const KRAKEN_PATTERNS = [
  ["surge", "helm"],
  ["ink", "surge", "helm"],
  ["vortex", "ink", "helm", "surge"],
];
const KRAKEN_ATTACKS = {
  surge: { span: 1.35, hit: 15, width: 17, hint: "Удар волны · выйди из полосы" },
  ink: { span: 1.04, hit: 9, hint: "Чернильный залп · смени курс" },
  vortex: { span: 1.83, hit: 22, radius: 55, hint: "Водоворот · уйди из круга" },
};
const INK_SPEED = 204;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function newVoyage(coinRandom = Math.random, driftRandom = Math.random) {
  const fromLeft = driftRandom() < .5;
  const rescue = { wave: 2 + Math.floor(driftRandom() * 5), delay: 1.4 + driftRandom() * 3.2,
    x: fromLeft ? 53 : SEA_WIDTH - 53, y: 118 + driftRandom() * 64,
    drift: fromLeft ? 11 : -11, readyAt: null, until: 0, saved: false };
  return {
    phase: "fleet", player: { x: 216, y: 172 }, hull: 100, time: 0,
    wave: 0, nextWave: .8, sunk: 0, coins: 0, coinRandom, ships: [], shots: [], ink: [], bursts: [],
    reload: [0, 0], flash: [0, 0], cues: [], qte: null, qteOrder: 0,
    notice: "Держи цель вдоль борта", noticeUntil: 5, damage: 0, rescue,
    boss: { x: 100, y: 142, hp: KRAKEN_HP, stage: 1, age: 0, cycle: 0, openness: 0, attack: null, move: 0, nextAttack: 0 },
  };
}

function notice(sea, message, span = 2.2) {
  sea.notice = message;
  sea.noticeUntil = sea.time + span;
}

function damage(sea, amount) {
  sea.hull = Math.max(0, sea.hull - amount);
  sea.damage = .34;
  sea.cues.push("ship-hit");
  if (!sea.hull) {
    sea.phase = "dead";
    sea.qte = null;
  }
}

function burst(sea, x, y, kind) {
  sea.bursts.push({ x, y, kind, age: 0 });
}

function fleet(sea, dt) {
  if (!sea.ships.length && sea.nextWave <= sea.time) {
    const plan = FORMATIONS[sea.wave];
    if (!plan) {
      sea.hull = Math.min(100, sea.hull + 24);
      sea.phase = "reveal";
      sea.qte = null;
      sea.shots.length = 0;
      return;
    }
    sea.wave++;
    if (sea.wave === sea.rescue.wave) sea.rescue.readyAt = sea.time + sea.rescue.delay;
    if (sea.wave > 1) {
      sea.hull = Math.min(100, sea.hull + 19);
      notice(sea, "Корпус залатан · новые паруса");
    }
    sea.ships = plan.map(([x, approach, tier], i) => ({
      x, lane: x, y: 48 - i * 21, approach, tier, hp: CLASSES[tier].hp,
      reload: 3.6 + i * 1.6, aim: null, sunk: 0, index: i,
    }));
    sea.volley = sea.time + (sea.wave === 1 ? 6.2 : 3.8);
  }

  for (const ship of sea.ships) {
    if (!ship.hp) {
      ship.sunk += dt;
      continue;
    }
    const arrived = ship.y >= ship.approach - .5;
    ship.y = Math.min(ship.approach, ship.y + dt * (33 - ship.tier * 4));
    ship.x = ship.lane + Math.sin(sea.time * .94 + ship.index * 1.6) * (8 + ship.tier * 4);
    if (!arrived) continue;
    ship.reload -= dt;
    if (ship.reload <= .88 && !ship.aim) {
      ship.aim = { ...sea.player };
      sea.cues.push("ship-warn");
    }
    if (ship.reload <= 0) {
      sea.shots.push({ x: ship.x, y: ship.y, ...destination(ship.aim), hostile: true, age: 0, span: .58 });
      sea.cues.push("sea-enemy-cannon");
      ship.aim = null;
      ship.reload = CLASSES[ship.tier].reload;
    }
  }

  const live = sea.ships.some(ship => ship.hp > 0);
  if (live && sea.time >= sea.volley && !sea.qte) {
    challenge(sea, "Вражеский залп", 2.45, 16);
    sea.volley = sea.time + 11;
  }
  if (!live && sea.ships.length && sea.ships.every(ship => ship.sunk > 1.2)) {
    sea.ships = [];
    sea.nextWave = sea.time + 1.3;
    sea.qte = null;
  }
}

function driftingShkiv(sea, dt) {
  const r = sea.rescue;
  if (r.saved || r.readyAt === null || sea.time < r.readyAt) return;
  if (!r.until) {
    r.until = sea.time + 15;
    notice(sea, "Шкив за бортом! Подведи корабль к спасательному кругу", 6);
    sea.cues.push("sea-rescue");
  }
  if (sea.time >= r.until) return;
  r.x += r.drift * dt;
  if (Math.hypot(sea.player.x - r.x, sea.player.y - r.y) > 22) return;
  r.saved = true;
  notice(sea, "Шкив на борту", 4);
  burst(sea, r.x, r.y, "water");
  sea.cues.push("shkiv");
}

const destination = target => ({ tx: target.x, ty: target.y });

function challenge(sea, label, span, hit) {
  const key = [0, 2, 1, 2, 0, 1, 0, 2][sea.qteOrder++ % 8];
  sea.qte = { key, label, left: span, span, hit };
  sea.cues.push("sea-signal");
}

export function answerHelm(sea, key) {
  if (!sea?.qte) return;
  const task = sea.qte;
  sea.qte = null;
  if (key === task.key) {
    notice(sea, "Манёвр удался");
    sea.cues.push("sea-evade");
    if (sea.phase === "kraken") sea.boss.age = Math.max(1.4, sea.boss.age - 1);
    const dx = (key - 1) * 24;
    sea.player.x = clamp(sea.player.x + dx, 45, SEA_WIDTH - 45);
    burst(sea, sea.player.x, sea.player.y + 8, "water");
  } else {
    notice(sea, key < 0 ? "Не успел повернуть" : "Неверная команда");
    damage(sea, task.hit);
    burst(sea, sea.player.x, sea.player.y, "impact");
  }
}

export function beginKraken(sea) {
  if (sea.phase !== "reveal") return;
  sea.phase = "kraken";
  sea.boss.nextAttack = sea.time + 1.65;
  notice(sea, "Целься в Кракена, когда он всплывает", 5);
  sea.cues.push("kraken-rise");
}

function kraken(sea, dt) {
  const boss = sea.boss;
  boss.age += dt;
  const length = 6.2 - (boss.stage - 1) * .45;
  if (boss.age >= length) {
    boss.age -= length;
    boss.cycle++;
  }
  const left = boss.cycle % 2 === 0;
  boss.x = (left ? 100 : 332) + Math.sin(sea.time * .78) * 13;
  boss.y = 151 + Math.sin(sea.time * .53 + boss.cycle) * 11;
  boss.openness = clamp(Math.min(boss.age * 2, (length - .64 - boss.age) * 2), 0, 1);
  if (boss.attack) {
    updateKrakenAttack(sea, dt);
  } else if (sea.time >= boss.nextAttack && !sea.qte) {
    const pattern = KRAKEN_PATTERNS[boss.stage - 1];
    const kind = pattern[boss.move++ % pattern.length];
    if (kind === "helm") {
      challenge(sea, "Удар щупальца", 2.6 - boss.stage * .23, 11 + 3 * boss.stage);
    } else {
      const spec = KRAKEN_ATTACKS[kind];
      const { x, y } = sea.player;
      boss.attack = { ...spec, kind, x, y, fromX: boss.x, fromY: boss.y - 8, left: spec.span };
      notice(sea, spec.hint, spec.span + .5);
      sea.cues.push("kraken-warn");
    }
    boss.nextAttack = sea.time + 3.9 - boss.stage * .25;
  }
}

function updateKrakenAttack(sea, dt) {
  const { boss, player } = sea;
  const attack = boss.attack;
  attack.left -= dt;
  const dx = attack.x - player.x;
  const dy = attack.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (attack.kind === "vortex" && distance > 1 && distance < attack.radius) {
    const pull = (1 - distance / attack.radius) * dt * 47 / distance;
    player.x += dx * pull;
    player.y += dy * pull;
  }
  if (attack.left > 0) return;

  boss.attack = null;
  if (attack.kind === "ink") {
    const angle = Math.atan2(attack.y - attack.fromY, attack.x - attack.fromX);
    for (const offset of [-.4, -.2, 0, .2, .4]) {
      sea.ink.push({ x: attack.fromX, y: attack.fromY, vx: Math.cos(angle + offset) * INK_SPEED,
        vy: Math.sin(angle + offset) * INK_SPEED, hit: attack.hit });
    }
    sea.cues.push("kraken-ink");
    return;
  }
  const inDanger = attack.kind === "surge" ? Math.abs(dy) < attack.width : distance < attack.radius;
  if (inDanger) damage(sea, attack.hit);
  burst(sea, attack.x, attack.y, attack.kind);
  sea.cues.push("kraken-splash");
}

function moveInk(sea, dt) {
  sea.ink = sea.ink.filter(glob => {
    glob.x += glob.vx * dt;
    glob.y += glob.vy * dt;
    const { x, y } = sea.player;
    if (Math.hypot(x - glob.x, y - glob.y) < 13) {
      if (!sea.damage) damage(sea, glob.hit);
      burst(sea, glob.x, glob.y, "ink");
      return false;
    }
    return glob.x > -16 && glob.x < SEA_WIDTH + 16 && glob.y > 35 && glob.y < SEA_HEIGHT + 16;
  });
}

export function broadsideTarget(sea, side) {
  const p = sea.player;
  const candidates = sea.phase === "kraken"
    ? (sea.boss.openness > .55 ? [sea.boss] : [])
    : sea.ships.filter(ship => ship.hp > 0 && ship.sunk === 0);
  let target = null;
  let best = Infinity;
  for (const ship of candidates) {
    const lateral = (ship.x - p.x) * side;
    const vertical = Math.abs(ship.y - p.y);
    const score = lateral + vertical * 2;
    if (lateral > 24 && vertical < (ship === sea.boss ? 33 : 24) && score < best) {
      target = ship;
      best = score;
    }
  }
  return target;
}

export function fireBroadside(sea, side) {
  if (!sea || !["fleet", "kraken"].includes(sea.phase)) return;
  const slot = (side + 1) / 2;
  if (sea.reload[slot] > 0) return;
  const p = sea.player;
  const target = broadsideTarget(sea, side);
  const x = p.x + side * 11;
  const end = target || { x: side === -1 ? -8 : SEA_WIDTH + 8, y: p.y - 2 };
  sea.shots.push({ x, y: p.y - 2, ...destination(end), target, age: 0, span: .16 + Math.abs(end.x - x) / 680 });
  sea.reload[slot] = .83;
  sea.flash[slot] = .17;
  sea.cues.push("sea-cannon");
}

function hitTarget(sea, target) {
  if (!target?.hp) return;
  if (target === sea.boss) {
    target.hp = Math.max(0, target.hp - 18);
    const stage = target.hp > KRAKEN_HP * 2 / 3 ? 1 : target.hp > KRAKEN_HP / 3 ? 2 : 3;
    if (stage > target.stage) {
      target.stage = stage;
      target.move = 0;
      target.nextAttack = Math.min(target.nextAttack, sea.time + 1.15);
    }
    if (target.hp === 0) {
      sea.phase = "victory";
      sea.qte = null;
      target.attack = null;
      sea.ink.length = 0;
      sea.cues.push("kraken-fall");
    } else sea.cues.push("kraken-hit");
  } else {
    target.hp--;
    if (!target.hp) {
      sea.sunk++;
      if (sea.coinRandom() < .34) {
        sea.coins += 3 + Math.floor(sea.coinRandom() * 4);
        sea.cues.push("coin");
      }
      target.aim = null;
      sea.cues.push("ship-sink");
      return;
    }
    sea.cues.push("ship-hit");
  }
}

export function stepVoyage(sea, input, dt) {
  if (sea.phase !== "fleet" && sea.phase !== "kraken") return;
  const p = sea.player;
  sea.time += dt;
  p.x = clamp(p.x + input.x * dt * 100, 45, SEA_WIDTH - 45);
  p.y = clamp(p.y + input.y * dt * 70, 104, SEA_HEIGHT - 35);
  sea.damage = Math.max(0, sea.damage - dt);
  for (const mark of sea.bursts) mark.age += dt;
  sea.bursts = sea.bursts.filter(mark => mark.age < .72);
  for (let i = 0; i < 2; i++) {
    sea.reload[i] = Math.max(0, sea.reload[i] - dt);
    sea.flash[i] = Math.max(0, sea.flash[i] - dt);
  }
  if (sea.phase === "fleet") {
    fleet(sea, dt);
    if (sea.phase === "fleet") driftingShkiv(sea, dt);
  }
  else {
    kraken(sea, dt);
    if (sea.phase === "kraken") moveInk(sea, dt);
  }
  if (sea.phase === "reveal" || sea.phase === "dead") return;

  if (sea.qte) {
    sea.qte.left -= dt;
    if (sea.qte.left <= 0) answerHelm(sea, -1);
  }
  for (const shot of sea.shots) {
    shot.age += dt;
    if (shot.age < shot.span || sea.phase === "dead" || sea.phase === "victory") continue;
    if (shot.hostile) {
      const hit = Math.abs(p.x - shot.tx) < 15 && Math.abs(p.y - shot.ty) < 19;
      if (hit) damage(sea, 8);
      burst(sea, shot.tx, shot.ty, hit ? "impact" : "water");
    } else {
      hitTarget(sea, shot.target);
      burst(sea, shot.tx, shot.ty, shot.target ? "impact" : "water");
    }
  }
  sea.shots = sea.phase === "victory" ? [] : sea.shots.filter(shot => shot.age < shot.span);
}
