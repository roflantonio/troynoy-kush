import { WIDTH, HEIGHT, FLOOR, LEVELS, COLORS } from "./levels.js";
import { SIZE, liftsAt, trapsAt } from "./physics.js";

const TAU = Math.PI * 2;
const limit = (v, min, max) => Math.max(min, Math.min(max, v));
const seed = n => (Math.sin(n * 91.173 + 5.37) * 2303.853) % 1 + 1;

function tile(ctx, x, y, w, h, color, round = 0) {
  ctx.fillStyle = color;
  if (!round) { ctx.fillRect(x, y, w, h); return; }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, round);
  ctx.fill();
}

function dot(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function ray(ctx, x, y, toX, toY, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function backdrop(ctx, level, camera, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, level.sky[0]);
  grad.addColorStop(1, level.sky[1]);
  tile(ctx, 0, 0, WIDTH, HEIGHT, grad);
  const sun = 720 - camera * .033;
  const bloom = ctx.createRadialGradient(sun, 125, 14, sun, 125, 123);
  bloom.addColorStop(0, level.light + "55");
  bloom.addColorStop(1, level.light + "00");
  tile(ctx, sun - 125, 0, 250, 255, bloom);
  dot(ctx, sun, 125, 64, level.light + "a5");
  for (let i = 0; i < 5; i++) tile(ctx, sun - 64, 138 + i * 9, 128, 3.5, level.sky[1] + "9a");
  for (let i = 0; i < 30; i++) {
    const x = (i * 169.3 - camera * .08 + 2500) % 975;
    const y = 20 + (i * 37.3) % 195;
    dot(ctx, x, y, 1.2 + i % 3 * .34, "#fbecc3" + (Math.sin(i + t * 1.3) > 0 ? "80" : "44"));
  }

  for (let layer = 0; layer < 2; layer++) {
    const width = layer ? 58 : 83;
    const slide = camera * (layer ? .32 : .14);
    const start = Math.floor(slide / width);
    const color = layer ? level.shade : level.shade + "aa";
    for (let i = start - 1; i < start + Math.ceil(WIDTH / width) + 2; i++) {
      const base = i * width - slide;
      const height = 53 + seed(i + 17 * layer) * (layer ? 68 : 57);
      const y = HEIGHT - 7 - height;
      if (level.decoration === "garden") {
        dot(ctx, base + 34, y + 54, width * .67, color);
        dot(ctx, base + 53, y + 35, width * .45, color);
        tile(ctx, base + 17, y + 60, width, HEIGHT - y, color);
        continue;
      }
      if (level.decoration === "canal") {
        tile(ctx, base + 11, y + 28, width - 20, HEIGHT - y, color, 8);
        if (layer && i % 2 === 0) ray(ctx, base + 31, y + 74, base + 31, y + 35, "#5b9eb089", 3);
        continue;
      }
      tile(ctx, base + 2, y, width - 7, HEIGHT - y, color, 3);
      tile(ctx, base + 14, y - 12, width - 30, 19, color, 3);
      if (i % 3 === 1) ray(ctx, base + 28, y - 12, base + 28, y - 37, color, 3);
      if (layer) for (let v = 0; v < 5; v++) {
        if (seed(i * 13 + v) > .8) tile(ctx, base + 11 + (v % 3) * 14, y + 16 + Math.floor(v / 3) * 13, 6, 4, level.light + "4c");
      }
    }
  }
}

function block(ctx, solid, level, camera, t) {
  const x = solid.x - camera;
  if (x > WIDTH || x + solid.w < 0) return;
  const { y, w, h, kind } = solid;
  tile(ctx, x + 3, y + 5, w, h, "#142033", 3);
  tile(ctx, x, y, w, h, level.block, 4);
  tile(ctx, x, y, w, 4, kind === "spring" ? level.light : level.rim, 2);
  tile(ctx, x + 2, y + 6, w - 4, 3, "#1b263c68");
  const low = Math.max(0, Math.floor((-x - 26) / 31)) * 31;
  for (let i = low + 8; i < w - 7 && x + i < WIDTH + 16; i += 31) {
    if (kind === "spring") {
      ray(ctx, x + i, y + 13, x + i + 7, y + 6, level.light, 2);
      ray(ctx, x + i + 7, y + 6, x + i + 14, y + 13, level.light, 2);
    } else if (kind === "forward" || kind === "reverse") {
      const d = kind === "forward" ? 1 : -1;
      const mark = x + i + ((t * 38) % 11) * d;
      ray(ctx, mark, y + 9, mark + d * 6, y + 14, d === 1 ? "#80fff3" : "#ffc2e0", 2);
      ray(ctx, mark + d * 6, y + 14, mark, y + 19, d === 1 ? "#80fff3" : "#ffc2e0", 2);
    } else if (h > 60) {
      tile(ctx, x + i, y + 16, 19, 3, "#afced013", 1);
      ray(ctx, x + i - 3, y + 23, x + i - 3, Math.min(HEIGHT, y + h), "#1e2d4466");
    } else dot(ctx, x + i, y + 11, 2, "#152034");
  }
}

function gate(ctx, x, y, t, level, last) {
  if (x < -110 || x > WIDTH + 110) return;
  tile(ctx, x - 25, y - 117, 50, 111, level.light + "35", 19);
  tile(ctx, x - 17, y - 92, 34, 87, "#16284c", 12);
  ctx.strokeStyle = level.rim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 24, y - 115, 48, 110, 18);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const yy = y - 17 - (i * 21 + t * 23) % 82;
    tile(ctx, x - 14, yy, 28, 3, level.light + "c0", 1.5);
  }
  ctx.font = "700 15px Oswald, system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = level.light;
  ctx.fillText(last ? "ФИНИШ" : "ПОРТАЛ", x, y - 126);
}

function checkpoint(ctx, x, y, lit, t) {
  tile(ctx, x - 13, y - 4, 26, 6, "#142337", 2);
  ray(ctx, x, y - 3, x, y - 52, lit ? "#9bffce" : "#a99dcb", 3);
  const color = lit ? "#9bffce" : "#bdb5de";
  ctx.save();
  ctx.translate(x, y - 56);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = color;
  ctx.shadowBlur = lit ? 18 + 4 * Math.sin(t * 6) : 3;
  tile(ctx, -6, -6, 12, 12, color, 2);
  ctx.restore();
}

function hazards(ctx, level, camera, t) {
  for (const trap of trapsAt(level, t)) {
    const x = trap.x - camera;
    if (x < -50 || x > WIDTH + 50) continue;
    ctx.save();
    ctx.translate(x, trap.y);
    ctx.rotate(t * 6.3);
    dot(ctx, 0, 0, 14, "#ff92ad");
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      tile(ctx, -2.2, -17.5, 4.4, 8, "#ffced2", 1);
    }
    dot(ctx, 0, 0, 8, "#562b51");
    tile(ctx, -3, -3, 6, 6, "#ffc4c0", 1.5);
    ctx.restore();
  }
}

function drawRunner(ctx, p, slot, camera, t, tint, name = "", ghost = false) {
  if (!p || p.down || p.respawn > 0) return;
  const x = p.x - camera, y = p.y, color = tint ?? COLORS[slot];
  if (x < -100 || x > WIDTH + 100) return;
  ctx.save();
  ctx.globalAlpha = ghost ? .65 : p.shield > 0 && Math.sin(t * 31) < 0 ? .54 : 1;
  const stride = (p.moved || Math.abs(p.vx ?? 0) > 55) ? 3.8 * Math.sin(t * 24 + slot) : 0;
  ctx.translate(x + SIZE.w / 2, y);
  ctx.scale(p.face ?? 1, 1);
  // Teardrop helmet, visor and parcel satchel.
  ctx.shadowColor = color;
  ctx.shadowBlur = !ghost && p.flash ? 13 : 0;
  tile(ctx, -12, 0, 23, 17, color, 6);
  tile(ctx, -6, 4, 17, 8, "#1c2d49", 3.5);
  tile(ctx, 0, 5, 7, 2, "#bffbed", 1);
  tile(ctx, -11, 17, 20, 14, color, 4);
  tile(ctx, -15, 13, 8, 15, "#7972a6", 4);
  tile(ctx, -16, 17, 5, 3, "#f6d7ff", 1);
  tile(ctx, -9 + stride, 29, 7, 8, color, 2);
  tile(ctx, 1 - stride, 29, 8, 8, color, 2);
  tile(ctx, 7, 19, 6, 5, "#fff2cc", 2);
  ctx.restore();
  if (name) {
    ctx.textAlign = "center";
    ctx.font = "700 14px Manrope, system-ui";
    const w = Math.min(162, ctx.measureText(name).width + 13);
    tile(ctx, x + SIZE.w / 2 - w / 2, y - 24, w, 19, "#11182ba8", 5);
    ctx.fillStyle = color;
    ctx.fillText(name, x + SIZE.w / 2, y - 10, w - 10);
  }
}

export function renderTo(canvas) {
  const ctx = canvas.getContext("2d");
  let cam = 0;
  let previous;
  return (index, runner, slot, rivals, time, preview = false) => {
    const level = LEVELS[index];
    const at = limit((runner?.x ?? 0) - (preview ? 410 : 305), 0, level.length - WIDTH);
    if (previous !== index || Math.abs(cam - at) > 360) cam = at;
    else cam += (at - cam) * .18;
    previous = index;
    backdrop(ctx, level, cam, time);
    for (const solid of level.solids) block(ctx, solid, level, cam, time);
    for (const solid of liftsAt(level, time)) block(ctx, solid, level, cam, time);
    checkpoint(ctx, level.check[0] - cam, level.check[1], runner?.checkpoint, time);
    const floor = level.solids.find(solid => level.flag >= solid.x && level.flag < solid.x + solid.w)?.y ?? FLOOR;
    gate(ctx, level.flag - cam, floor, time, level, index === LEVELS.length - 1);
    hazards(ctx, level, cam, time);
    for (const ghost of rivals) drawRunner(ctx, ghost, ghost.slot, cam, time, null, ghost.name, !preview);
    drawRunner(ctx, runner, slot, cam, time, null, "", false);
  };
}

export function scenePreview(t) {
  const motion = Math.sin(t * 2.2);
  return {
    runner: { x: 337 + motion * 18, y: 272 - 58 * Math.abs(motion), vx: 150, face: 1 },
    rivals: [
      { x: 189 + 14 * Math.sin(t * 2), y: 355, slot: 1, moved: true, face: 1 },
      { x: 592 + 32 * Math.sin(t * 1.7), y: 322 - 30 * Math.abs(Math.sin(t * 2.7)), slot: 2, moved: true, face: 1 },
    ],
  };
}
