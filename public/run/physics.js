import { HEIGHT, LEVELS } from "./levels.js";

export const SIZE = { w: 27, h: 38 };
const ACCEL = 2180, TOP_SPEED = 336, JUMP = -620;
export const STEP = 1 / 120;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const move = (from, to, amount) => from < to ? Math.min(from + amount, to) : Math.max(from - amount, to);

export function runner(index, checkpoint = false) {
  const level = LEVELS[index];
  const [x, floor] = checkpoint ? level.check : [72, level.solids[0].y];
  return { x, y: floor - SIZE.h, vx: 0, vy: 0, face: 1, ground: false,
    coyote: 0, buffer: 0, respawn: 0, shield: .55, falls: 0, checkpoint, done: false };
}

export function liftsAt(level, time) {
  return level.lifts.map(lift => ({ ...lift, kind: "lift", y: lift.y + lift.range * Math.sin(time * lift.rate) }));
}

export function trapsAt(level, time) {
  return level.traps.map(trap => ({ x: trap.x + trap.range * Math.sin(time * trap.rate), y: trap.y, r: 14 }));
}

function overlaps(state, solid) {
  return state.x < solid.x + solid.w && state.x + SIZE.w > solid.x
    && state.y < solid.y + solid.h && state.y + SIZE.h > solid.y;
}

function hit(state) {
  state.falls++;
  state.respawn = .47;
  state.vx = 0;
  state.vy = 0;
  return "fall";
}

export function tickRunner(state, index, control, dt, time) {
  const level = LEVELS[index];
  if (state.done) return "";
  if (state.respawn > 0) {
    state.respawn -= dt;
    if (state.respawn > 0) return "";
    const falls = state.falls;
    Object.assign(state, runner(index, state.checkpoint), { falls });
  }

  state.shield = Math.max(0, state.shield - dt);
  state.buffer = control.jump ? .12 : Math.max(0, state.buffer - dt);
  state.coyote = state.ground ? .095 : Math.max(0, state.coyote - dt);
  const wasGrounded = state.ground;
  let event = "";
  if (state.buffer && state.coyote) {
    state.vy = JUMP;
    state.coyote = 0;
    state.buffer = 0;
    state.ground = false;
    event = "jump";
  }

  if (control.dir) {
    state.face = control.dir;
    state.vx = move(state.vx, TOP_SPEED * control.dir, ACCEL * dt);
  } else state.vx = move(state.vx, 0, (wasGrounded ? 2510 : 1420) * dt);

  const soles = state.y + SIZE.h;
  const belts = level.solids.find(solid => Math.abs(solid.y - soles) < 1.4
    && state.x + SIZE.w > solid.x && state.x < solid.x + solid.w);
  const drift = state.ground ? (belts?.kind === "forward" ? 102 : belts?.kind === "reverse" ? -77 : 0) : 0;
  const dx = (state.vx + drift) * dt;
  state.x = clamp(state.x + dx, 0, level.length - SIZE.w);
  for (const solid of level.solids) {
    if (overlaps(state, solid) && dx) {
      state.x = dx > 0 ? solid.x - SIZE.w : solid.x + solid.w;
      state.vx = 0;
    }
  }
  state.x = clamp(state.x, 0, level.length - SIZE.w);
  state.vy = Math.min(state.vy + 1560 * dt, 1130);
  state.y += state.vy * dt;
  state.ground = false;
  const moving = liftsAt(level, time);
  const oldLifts = liftsAt(level, time - dt);
  for (const solid of [...level.solids, ...moving]) {
    if (state.x + SIZE.w <= solid.x || state.x >= solid.x + solid.w) continue;
    if (solid.kind === "lift") {
      const oldY = oldLifts[moving.indexOf(solid)].y;
      if (state.vy < 0 || soles > oldY + 1.5 || state.y + SIZE.h < solid.y - 3) continue;
    } else if (!overlaps(state, solid)) continue;
    if (state.vy < 0) {
      state.y = solid.y + solid.h;
      state.vy = 0;
      continue;
    }
    state.y = solid.y - SIZE.h;
    if (solid.kind === "spring") {
      state.vy = -875;
      event = "spring";
    } else { state.vy = 0; state.ground = true; }
    break;
  }

  if (state.y > HEIGHT + 85) return hit(state);
  if (!state.shield && trapsAt(level, time).some(trap => {
    const x = clamp(trap.x, state.x + 3, state.x + SIZE.w - 3);
    const y = clamp(trap.y, state.y + 3, state.y + SIZE.h);
    return Math.hypot(trap.x - x, trap.y - y) < trap.r;
  })) return hit(state);
  if (!state.checkpoint && state.x + SIZE.w > level.check[0] && state.x < level.check[0] + 86 && state.ground) {
    state.checkpoint = true;
    event = "checkpoint";
  }
  if (state.x + SIZE.w / 2 >= level.flag && state.y + SIZE.h >= 115 && state.y < HEIGHT - 67) {
    state.done = true;
    return "gate";
  }
  return event;
}
