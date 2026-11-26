// The points mark the roots and loose ends of the hair, sash, and coat in fort.webp.
const FABRIC = [
  { root: [835, 168], tip: [753, 263], radius: 38, wander: [10, 6], speed: 1.83 },
  { root: [899, 153], tip: [1013, 197], radius: 31, wander: [10, 7], speed: 1.63 },
  { root: [837, 368], tip: [820, 558], radius: 37, wander: [15, 6], speed: 1.45 },
  { root: [1017, 334], tip: [1024, 415], radius: 38, wander: [12, 8], speed: 1.71 },
];
const EYES = [[844.5, 142.3], [871, 132.5]];

function makePatch(ctx, { root, tip, radius, wander, speed }) {
  const x = Math.floor(Math.min(root[0], tip[0]) - radius);
  const y = Math.floor(Math.min(root[1], tip[1]) - radius);
  const width = Math.ceil(Math.max(root[0], tip[0]) + radius) - x;
  const height = Math.ceil(Math.max(root[1], tip[1]) + radius) - y;
  const frame = ctx.createImageData(width, height);
  const alpha = new Float32Array(width * height);
  const dx = tip[0] - root[0], dy = tip[1] - root[1];
  const length2 = dx * dx + dy * dy;
  for (let row = 0; row < height; row++) {
    const py = y + row - root[1];
    for (let col = 0; col < width; col++) {
      const px = x + col - root[0];
      const along = Math.max(0, Math.min(1, (px * dx + py * dy) / length2));
      const distance2 = (px - dx * along) ** 2 + (py - dy * along) ** 2;
      const edge = Math.max(0, 1 - distance2 / (radius * radius));
      alpha[row * width + col] = along * edge ** 2;
    }
  }
  return { x, y, width, height, frame, alpha, wander, speed, pixels: new Uint32Array(frame.data.buffer) };
}

function ripple(ctx, source, stride, patch, time) {
  const { x, y, width, height, pixels, frame, alpha, wander, speed } = patch;
  for (let row = 0; row < height; row++) {
    const phase = time * speed - row * .028;
    const dx = Math.sin(phase) * wander[0] + Math.sin(phase * 1.7) * (wander[0] * .18);
    const dy = Math.cos(phase) * wander[1];
    const start = row * width;
    for (let col = 0; col < width; col++) {
      const i = start + col;
      const strength = alpha[i];
      const sx = Math.round(col - dx * strength);
      const sy = Math.round(row - dy * strength);
      pixels[i] = source[(sy + y) * stride + x + sx];
    }
  }
  ctx.putImageData(frame, x, y);
}

function eyeGlow(ctx, art, time) {
  for (const [x, y] of EYES) {
    const left = Math.floor(x) - 22, top = Math.floor(y) - 22;
    ctx.drawImage(art, left, top, 44, 44, left, top, 44, 44);
  }
  for (const [i, [x, y]] of EYES.entries()) {
    const strength = .52 + Math.sin(time * 2.62 - i * .35) * .29 + Math.sin(time * 4.1 + i * .2) * .14;
    const left = Math.floor(x) - 22, top = Math.floor(y) - 22;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
    glow.addColorStop(0, `rgba(255,241,188,${.47 + strength * .46})`);
    glow.addColorStop(.28, `rgba(244,142,45,${strength * .64})`);
    glow.addColorStop(1, "rgba(229,90,22,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(left, top, 44, 44);
    ctx.fillStyle = `rgba(255,246,202,${Math.max(0, strength - .62) * 1.85})`;
    ctx.fillRect(Math.round(x) - 6, Math.round(y), 13, 1);
    ctx.fillRect(Math.round(x), Math.round(y) - 4, 1, 9);
  }
}

export function animateFortMenu(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  const art = new Image();
  let source;
  let patches;
  let previous = -Infinity;
  art.addEventListener("load", () => {
    canvas.width = art.naturalWidth;
    canvas.height = art.naturalHeight;
    ctx.drawImage(art, 0, 0);
    source = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    patches = FABRIC.map(part => makePatch(ctx, part));
    canvas.hidden = false;
  });
  art.src = new URL("./fort.webp", import.meta.url).href;
  return now => {
    if (!source || now - previous < 1000 / 24) return;
    previous = now;
    const time = now / 1000;
    for (const patch of patches) ripple(ctx, source, canvas.width, patch, time);
    eyeGlow(ctx, art, time);
  };
}
