import { COLORS, FIELD, WALLS } from "./physics.js";

const W = FIELD.width, H = FIELD.height;
const TAU = Math.PI * 2;
const OCCULT = "#191d32";

function disc(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function arc(ctx, x, y, r, color, width = 1, start = 0, end = TAU) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, start, end);
  ctx.stroke();
}

function line(ctx, x, y, toX, toY, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function rect(ctx, x, y, w, h, r, fill, stroke = null) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 1.25; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function paintMap() {
  const board = document.createElement("canvas");
  board.width = W;
  board.height = H;
  const ctx = board.getContext("2d");
  const light = ctx.createRadialGradient(480, 270, 36, 480, 300, 585);
  light.addColorStop(0, "#252644");
  light.addColorStop(.53, "#171c31");
  light.addColorStop(1, "#0b1121");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  for (let x = 20; x < W; x += 40) line(ctx, x, 12, x, H - 12, x % 80 < 22 ? "#31344a" : "#262b3f");
  for (let y = 20; y < H; y += 40) line(ctx, 12, y, W - 12, y, y % 80 < 22 ? "#31344a" : "#262b3f");
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#57516f";
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#685875";
  ctx.strokeRect(15, 15, W - 30, H - 30);

  const gates = [[118, 106], [842, 106], [480, 530]];
  gates.forEach(([x, y], i) => {
    const tint = COLORS[i];
    disc(ctx, x, y, 50, tint + "0e");
    arc(ctx, x, y, 41, tint + "4b", 1.3);
    arc(ctx, x, y, 48, tint + "92", 2, 0.1, 0.82);
    arc(ctx, x, y, 48, tint + "92", 2, Math.PI + .1, Math.PI + .82);
    for (let d = -13; d <= 13; d += 13) line(ctx, x + d - 4, y + 31, x + d + 2, y + 35, tint + "af", 2);
  });

  for (const { x, y, w, h } of WALLS) {
    rect(ctx, x + 3, y + 7, w + 3, h + 3, 5, "#090c19");
    rect(ctx, x, y, w, h, 5, "#302946", "#8d6685");
    rect(ctx, x + 3, y + 3, w - 6, h - 6, 3, "#403650");
    line(ctx, x + 7, y + 5, x + w - 7, y + 5, "#a16f87", 1.8);
    const vertical = h > w;
    const full = vertical ? h : w;
    for (let pos = 13; pos < full - 9; pos += 14) {
      const cx = x + (vertical ? w / 2 : pos);
      const cy = y + (vertical ? pos : h / 2);
      line(ctx, cx - 3, cy + 4, cx + 3, cy - 4, "#9a697f", 1.8);
    }
    disc(ctx, x + 6, y + h - 6, 2, "#dba385");
    disc(ctx, x + w - 6, y + h - 6, 2, "#dba385");
  }

  disc(ctx, 480, 298, 99, "#503f702e");
  arc(ctx, 480, 298, 98, "#716294", 2);
  ctx.setLineDash([3, 6]);
  arc(ctx, 480, 298, 86, "#8869a1", 1.3);
  ctx.setLineDash([]);
  arc(ctx, 480, 298, 51, "#6b5d92", 2);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    line(ctx, 480 + Math.cos(a) * 102, 298 + Math.sin(a) * 102,
      480 + Math.cos(a) * 109, 298 + Math.sin(a) * 109, "#705e8a", 1.6);
  }
  disc(ctx, 480, 298, 34, "#272640");
  arc(ctx, 480, 298, 28, "#9172ad", 2);
  arc(ctx, 480, 298, 16, "#be94d8", 2, 0, 1.75 * Math.PI);
  for (const a of [0, 2.094, 4.188]) line(ctx, 480, 298, 480 + 17 * Math.cos(a), 298 + 17 * Math.sin(a), "#a780c5", 3);
  disc(ctx, 480, 298, 4, "#e1bbf0");
  return board;
}

function drawCrystal(ctx, crystal, t) {
  const { x, y } = crystal;
  const size = 10 + 1.6 * Math.sin(t * .009 + crystal.id);
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#9affdc";
  ctx.fillStyle = "#92ffd2";
  ctx.beginPath();
  ctx.moveTo(x, y - size - 3);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size + 3);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  line(ctx, x - size, y, x + size, y, "#24796e", 1.5);
  line(ctx, x, y - size, x, y + size, "#f1ffda", 1.5);
}

function drawPlayer(ctx, p, time, me) {
  if (p.wake) return;
  const tint = COLORS[p.id];
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.id === me) arc(ctx, 0, 0, 24, "#fff6dfb3", 1.6);
  if (p.protect > time || p.slip > time) {
    disc(ctx, 0, 0, 25 + Math.sin(time * .015) * 2, tint + "23");
    arc(ctx, 0, 0, 26, tint + "a9", 2, .35, 5.7);
  }
  ctx.rotate(p.a);
  ctx.shadowColor = tint;
  ctx.shadowBlur = 16;
  rect(ctx, 3, -5, 27, 10, 3, tint);
  disc(ctx, 0, 0, 16, tint);
  ctx.shadowBlur = 0;
  disc(ctx, 0, 0, 11, OCCULT);
  rect(ctx, -5, -6.3, 12, 12.6, 3, tint);
  line(ctx, 4, -3, 4, 3, "#f9f1ff", 2.2);
  ctx.restore();
  for (let i = 0; i < 3; i++) rect(ctx, p.x - 14 + i * 10, p.y + 26, 8, 3, 1.5, i < p.hp ? tint : "#534962");
}

function particles(ctx, effects, now) {
  for (const [birth, event] of effects) {
    const age = (now - birth) / 610;
    if (age >= 1) continue;
    const [, kind, x, y, slot] = event;
    const tint = kind === "crystal" || kind === "drop" ? "#9affdb" : COLORS[slot] ?? "#ddbdff";
    const extent = kind === "burst" ? 67 : kind === "shot" ? 22 : 38;
    ctx.globalAlpha = (1 - age) * .8;
    arc(ctx, x, y, 7 + age * extent, tint, kind === "burst" ? 2.7 : 1.5);
    if (kind === "shot") continue;
    const seed = event[0] * 3.817;
    for (let i = 0; i < 7; i++) {
      const a = seed + i * 2.39;
      const r = 7 + age * extent * (.7 + (i % 4) * .15);
      disc(ctx, x + r * Math.cos(a), y + r * Math.sin(a), 2.7 * (1 - age), tint);
    }
  }
  ctx.globalAlpha = 1;
}

export function renderer(canvas) {
  const ctx = canvas.getContext("2d");
  const map = paintMap();
  const displayed = new Map();
  return (s, me, now, effects = [], aim = null) => {
    ctx.drawImage(map, 0, 0);
    if (!s) return;
    for (const item of s.crystals) drawCrystal(ctx, item, now);
    for (const bolt of s.bullets) {
      const hint = COLORS[bolt.owner];
      ctx.shadowBlur = 13;
      ctx.shadowColor = hint;
      line(ctx, bolt.x - bolt.dx * .022, bolt.y - bolt.dy * .022, bolt.x, bolt.y, hint, 5);
      line(ctx, bolt.x - bolt.dx * .013, bolt.y - bolt.dy * .013, bolt.x, bolt.y, "#fff4e2", 2.2);
      ctx.shadowBlur = 0;
    }
    for (const original of s.players) {
      let old = displayed.get(original.id);
      if (!old || Math.hypot(old.x - original.x, old.y - original.y) > 118) old = { x: original.x, y: original.y };
      old.x += (original.x - old.x) * .39;
      old.y += (original.y - old.y) * .39;
      displayed.set(original.id, old);
      drawPlayer(ctx, { ...original, ...old, a: original.id === me && aim !== null ? aim : original.a }, s.time, me);
    }
    particles(ctx, effects, now);
    if (s.time < s.count) {
      ctx.fillStyle = "#08101b75";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 98px Oswald, sans-serif";
      ctx.fillStyle = "#fff0dd";
      ctx.fillText(String(Math.ceil((s.count - s.time) / 1000)), W / 2, H / 2 - 8);
    }
  };
}

export function previewState(t) {
  const wobble = Math.sin(t / 650) * 9;
  const a = 220 + (t / 5) % 490;
  const players = [
    { id: 0, x: 312 + wobble, y: 325, a: -.53, hp: 3 },
    { id: 1, x: 651, y: 162 + wobble, a: 2.55, hp: 3 },
    { id: 2, x: 545 - wobble, y: 430, a: -2.16, hp: 3 },
  ];
  return {
    players, bullets: [{ x: a, y: 222, dx: 690, dy: 0, owner: 1 }, { x: 600 - a * .39, y: 397 - a * .29, dx: -370, dy: -550, owner: 2 }],
    crystals: [{ x: 480, y: 296, id: 1 }, { x: 519, y: 347, id: 2 }], time: t, count: 0,
  };
}
