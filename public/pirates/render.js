import { HEIGHT, WIDTH, cast, seeded, tileAt } from "./world.js";

export const VIEW_W = 432;
export const VIEW_H = 244;
const SCALE = .75;
const T = 32;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rgb = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;

function pixelCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")];
}

function poly(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function wallPixels(kind) {
  const rand = seeded(89 + kind * 825);
  const source = new Uint32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const variation = Math.floor(rand() * 21) - 10;
    let color;
    if (kind === 2 || kind === 7) {
      const rail = x % 8;
      const seam = rail === 0 || (kind === 7 && y % 16 === 0);
      const knots = Math.sin(x * 2 + Math.cos(y / 6)) * 6;
      const shade = 13 * Math.sin(Math.floor(x / 8) * 7) + knots;
      color = seam ? [31, 31, 30] : [89 + shade, 62 + shade, 43 + shade];
      if (kind === 2 && ((y > 4 && y < 8) || (y > 24 && y < 28))) color = [42, 66, 68];
    } else if (kind === 4) {
      color = [68, 74, 76];
      if (x > 6 && x < 24 && y < 26) {
        color = [37, 83, 88];
        if ((x === 8 || x === 22) && y > 2) color = [157, 115, 63];
        if (y > 6 && y < 19 && Math.abs(x - 15) < (y < 13 ? 3 : 4)) color = [201, 182, 129];
        if (y > 9 && y < 12 && (x === 13 || x === 17)) color = [54, 67, 67];
      }
    } else if (kind === 3) {
      const ridge = Math.sin(x * Math.PI / 4) * 12;
      color = [67 + ridge, 91 + ridge, 100 + ridge];
      if (y % 15 === 0) color = [42, 65, 70];
    } else {
      const w = kind >= 5 ? 10 : 15;
      const h = kind >= 5 ? 9 : 8;
      const offset = (Math.floor(y / h) % 2) * Math.floor(w / 2);
      const side = (x + offset) % w;
      const row = y % h;
      const grain = Math.sin(Math.floor((x + offset) / w) + Math.floor(y / h) * 7) * 15;
      if (!row || !side) color = kind >= 5 ? [39, 49, 49] : [46, 62, 65];
      else {
        let light = grain + (row === 1 ? 13 : row === h - 1 ? -10 : 0);
        if (kind === 6) light -= 18;
        color = [84 + light, 102 + light, 107 + light];
        if ((x * 7 + y * 13) % 29 < 3) color = [65 + light, 90 + light, 92 + light];
      }
    }
    source[y * T + x] = rgb(...color.map(component => clamp(Math.floor(component + variation), 0, 255)));
  }
  return source;
}

function shaded(pixel, light, sea = 5) {
  const r = Math.min(255, ((pixel & 255) * light) | 0);
  const g = Math.min(255, ((((pixel >> 8) & 255) * light) | 0) + sea);
  const b = Math.min(255, ((((pixel >> 16) & 255) * light) | 0) + sea + 3);
  return rgb(r, g, b);
}

function sailor(kind, flare) {
  const [image, c] = pixelCanvas(48, 58);
  const leader = kind === "captain";
  const shooter = kind === "corsair";
  const coat = leader ? "#983e38" : shooter ? "#84472d" : "#23767b";
  const shade = leader ? "#542d31" : shooter ? "#58362b" : "#194049";
  const rim = leader ? "#ffc885" : shooter ? "#e4a567" : "#5cc1b0";
  const bone = flare ? "#fff3ae" : "#e5dcb1";
  poly(c, "#0c171c", [[5,56],[7,38],[4,27],[12,18],[13,11],[19,9],[25,8],[31,9],[36,17],[38,24],[43,28],[44,48],[40,56]]);
  poly(c, coat, [[12,24],[21,21],[32,22],[40,26],[43,47],[38,56],[31,53],[24,56],[20,51],[13,56],[7,51]]);
  poly(c, shade, [[11,23],[16,23],[19,34],[15,52],[7,51],[9,38]]);
  poly(c, shade, [[31,25],[40,26],[42,47],[37,50],[32,40]]);
  poly(c, rim, [[12,22],[22,23],[18,31],[12,37],[13,28]]);
  poly(c, rim, [[27,22],[34,23],[34,34],[26,29]]);
  rect(c, "#34444a", 15, 40, 23, 5);
  rect(c, "#d7ae73", 24, 40, 6, 5);
  rect(c, "#513d48", 12, 53, 9, 5);
  rect(c, "#513d48", 29, 53, 9, 5);
  for (const y of [32,35,46]) rect(c, rim, 26, y, 2, 2);
  poly(c, bone, [[15,13],[18,10],[30,10],[34,14],[33,21],[29,24],[20,24],[16,20]]);
  rect(c, "#3f3c3e", 17, 15, 6, 4);
  rect(c, "#3f3c3e", 27, 15, 5, 4);
  rect(c, flare ? "#ffc77d" : leader ? "#ff8a5f" : "#8bf3bc", 18, 16, 2, 1);
  rect(c, flare ? "#ffc77d" : leader ? "#ff8a5f" : "#8bf3bc", 29, 16, 2, 1);
  rect(c, "#68605d", 24, 18, 2, 3);
  rect(c, "#665451", 20, 22, 11, 2);
  for (const x of [21,24,27]) rect(c, bone, x, 22, 1, 2);
  const hat = leader ? "#503343" : "#183843";
  poly(c, hat, [[6,15],[12,11],[18,10],[17,5],[22,3],[26,2],[31,6],[32,10],[42,13],[39,17],[33,15],[15,16],[8,18]]);
  poly(c, rim, [[7,15],[16,13],[28,12],[39,14],[36,15],[26,13],[14,15]]);
  if (leader) {
    poly(c, "#fc7d64", [[30,7],[35,1],[42,1],[38,5],[34,9]]);
    rect(c, "#f8b87d", 24, 6, 4, 4);
  }
  if (shooter || leader) {
    poly(c, "#cbb07c", [[7,35],[7,31],[12,28],[15,34],[12,41],[7,42]]);
    poly(c, "#574654", [[6,33],[12,32],[15,35],[19,35],[19,40],[10,41],[6,40]]);
    rect(c, flare ? "#ffce74" : "#d0a16b", 6, 35, 6, 2);
  } else {
    poly(c, bone, [[6,32],[11,32],[13,41],[10,45],[5,42]]);
    poly(c, bone, [[36,30],[41,30],[45,42],[39,44],[35,37]]);
  }
  return image;
}

function prop(kind, phase = 0) {
  const [image, c] = pixelCanvas(32, 36);
  if (kind === "torch") {
    rect(c, "#493b3d", 13, 16, 6, 19);
    rect(c, "#97725d", 14, 19, 2, 13);
    poly(c, "#7c503e", [[9,16],[24,16],[21,22],[11,22]]);
    poly(c, "#fe844c", [[10,15],[9,11],[13,6+phase],[17,10],[20,3+phase],[23,10],[25,13],[21,18],[13,18]]);
    poly(c, "#ffce62", [[13,15],[14,10],[16,13],[20,8+phase],[22,14],[19,17],[15,18]]);
    rect(c, "#fff2ab", 16, 14, 4, 3);
  } else if (kind === "barrel") {
    poly(c, "#121c22", [[5,29],[3,15],[7,8],[23,8],[27,13],[26,28],[23,34],[9,34]]);
    poly(c, "#815b46", [[6,14],[9,10],[22,10],[24,14],[24,29],[21,32],[10,32],[7,28]]);
    for (const x of [10,15,20]) rect(c, "#573d35", x, 13, 1, 17);
    rect(c, "#3e5358", 6, 15, 19, 4);
    rect(c, "#3e5358", 7, 26, 17, 4);
    rect(c, "#c38d62", 9, 9, 13, 2);
  } else if (kind === "relic") {
    poly(c, "#234c52", [[7,15],[14,6],[20,8],[25,17],[17,29],[9,25]]);
    poly(c, "#5fe3cd", [[9,15],[15,8],[21,10],[23,17],[17,27],[10,24]]);
    poly(c, "#dbfff0", [[15,9],[17,19],[11,17]]);
    poly(c, "#369d94", [[17,21],[22,17],[17,27],[12,23]]);
    rect(c, "#cfffe3", 21, 8, 2, 4);
    rect(c, "#cfffe3", 20, 9, 4, 2);
  } else if (kind === "heal" || kind === "ammo") {
    rect(c, "#171d27", 5, 19, 23, 13);
    rect(c, kind === "heal" ? "#8f483b" : "#6a6849", 6, 19, 20, 11);
    rect(c, kind === "heal" ? "#d28761" : "#a5a064", 7, 20, 18, 3);
    if (kind === "heal") { rect(c, "#ffe7b8", 14, 22, 4, 7); rect(c, "#ffe7b8", 12, 24, 8, 3); }
    else for (const x of [10,15,20]) { rect(c, "#e4c077", x, 21, 3, 9); rect(c, "#865937", x, 25, 3, 5); }
  } else if (kind === "scatter") {
    poly(c, "#6e4439", [[3,25],[7,22],[22,16],[27,16],[27,19],[15,25],[8,30],[4,30]]);
    poly(c, "#cba987", [[10,22],[20,17],[28,15],[30,16],[28,19],[16,24]]);
    rect(c, "#f3bb75", 8, 24, 8, 3);
  } else if (kind === "gate" || kind === "closed") {
    const color = kind === "gate" ? "#7ce6c6" : "#e0aa69";
    poly(c, "#18262b", [[3,34],[3,14],[6,8],[11,4],[21,4],[26,8],[29,14],[29,34]]);
    poly(c, "#445456", [[4,33],[4,14],[9,6],[23,6],[27,14],[27,33],[24,33],[24,14],[20,10],[12,10],[8,14],[8,33]]);
    rect(c, color, 5, 21, 2, 7);
    rect(c, color, 25, 21, 2, 7);
    if (kind === "gate") {
      rect(c, "#274950", 9, 14, 14, 18);
      for (let i = 0; i < 5; i++) rect(c, i % 2 ? "#6dafac" : color, 9, 14 + (i * 4 + phase * 2) % 18, 14, 1);
    } else {
      for (const x of [10,15,20]) rect(c, "#786751", x, 13, 2, 18);
      rect(c, color, 14, 22, 4, 5);
    }
  } else if (kind === "bolt" || kind === "spark") {
    poly(c, "#fa6544", [[4,18],[11,11],[15,2],[20,10],[27,17],[22,22],[16,31],[10,22]]);
    poly(c, "#ffb969", [[9,18],[15,9],[19,13],[23,17],[17,24],[12,21]]);
    rect(c, "#fff1ba", 14, 15, 6, 5);
  } else {
    poly(c, "#2f4c53", [[2,28],[12,25],[23,27],[30,29],[27,33],[6,33]]);
    rect(c, "#dfc7a5", 20, 25, 6, 5);
  }
  return image;
}

function arm(kind) {
  const [image, c] = pixelCanvas(136, 77);
  if (kind === "blade") {
    poly(c, "#23222c", [[71,77],[75,61],[80,52],[69,44],[76,37],[91,49],[94,34],[97,10],[104,0],[108,7],[110,42],[102,55],[107,67],[112,77]]);
    poly(c, "#a0a7a1", [[90,48],[93,32],[98,9],[104,3],[106,11],[107,42],[101,52]]);
    poly(c, "#e4ece0", [[100,10],[104,5],[105,12],[104,42],[100,48]]);
    poly(c, "#ac714e", [[74,42],[81,38],[106,53],[103,60],[96,57],[94,54],[87,52]]);
    poly(c, "#855449", [[70,77],[74,61],[84,53],[97,56],[104,64],[108,77]]);
    poly(c, "#cf996f", [[73,67],[85,55],[95,57],[100,62],[83,62],[77,73]]);
  } else {
    const big = kind === "scatter";
    poly(c, "#191c26", [[38,77],[45,62],[51,55],[56,45],[56,33],[60,18],[64,15],[67,2],[85,2],[89,14],[91,34],[94,48],[105,61],[108,77]]);
    poly(c, "#513531", [[49,77],[50,60],[57,47],[60,28],[68,11],[83,11],[87,24],[89,49],[101,68],[101,77]]);
    poly(c, "#8a5840", [[58,69],[56,56],[62,44],[66,25],[70,15],[80,15],[86,37],[87,56],[97,74]]);
    poly(c, big ? "#806e57" : "#465f66", [[61,42],[62,22],[64,11],[66,7],[69,3],[83,3],[88,11],[90,23],[88,42],[81,50],[68,50]]);
    poly(c, big ? "#b7a285" : "#88a9ab", [[66,42],[68,24],[71,10],[74,6],[79,6],[81,12],[83,25],[83,43],[79,49],[71,49]]);
    rect(c, "#27383b", 71, 4, 9, 4);
    rect(c, "#eeeecc", 73, big ? 15 : 12, 5, 2);
    rect(c, "#d0af7b", 67, 37, 17, 4);
    poly(c, "#875745", [[43,77],[49,66],[59,63],[63,57],[68,58],[72,64],[80,59],[89,61],[97,64],[102,77]]);
    poly(c, "#d39a73", [[46,77],[50,68],[59,66],[66,61],[69,66],[75,67],[78,64],[87,63],[97,68],[98,77]]);
    rect(c, "#edb58b", 53, 70, 11, 5);
    rect(c, "#edb58b", 79, 65, 12, 4);
  }
  return image;
}

function spriteBook() {
  const sprites = {};
  for (const kind of ["drowned", "corsair", "captain"]) {
    sprites[kind] = sailor(kind, false);
    sprites[kind + "-lit"] = sailor(kind, true);
  }
  for (const kind of ["torch","barrel","heal","ammo","relic","scatter","gate","closed","bolt","spark","body"]) {
    sprites[kind] = prop(kind);
    if (kind === "torch" || kind === "gate") sprites[kind + "-lit"] = prop(kind, 2);
  }
  return sprites;
}

function sceneSprites(world) {
  const flick = Math.floor(world.time * 8) % 3 === 1;
  const shocked = world.player.relics === 3 && !world.enemies.some(e => e.kind === "captain" && e.hp > 0);
  const gate = shocked ? (flick ? "gate-lit" : "gate") : "closed";
  return [
    ...world.props.map(p => ({ ...p, art: p.kind === "torch" && flick ? "torch-lit" : p.kind, h: p.kind === "torch" ? .63 : .52, lift: 0 })),
    ...world.items.map(p => ({ ...p, art: p.kind, h: .39, lift: p.kind === "relic" ? .13 + Math.sin(world.time * 4) * .035 : 0 })),
    ...world.enemies.map(e => ({
      x: e.x, y: e.y, art: e.hp <= 0 ? "body" : e.kind + (e.hurt || e.attack ? "-lit" : ""),
      h: e.hp <= 0 ? .28 : e.kind === "captain" ? 1.15 : .93,
      lift: e.hp > 0 && e.awake ? .016 * Math.sin(world.time * 9 + e.phase) : 0,
    })),
    ...world.bolts.map(b => ({ ...b, art: "bolt", h: .20, lift: .45 })),
    ...world.flashes.map(b => ({ ...b, art: "spark", h: .25, lift: .59 })),
    { ...world.gate, art: gate, h: 1.02, lift: 0 },
  ];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const id = ctx.createImageData(VIEW_W, VIEW_H);
  const pixels = new Uint32Array(id.data.buffer);
  const depth = new Float32Array(VIEW_W);
  const palette = Array.from({ length: 8 }, (_, kind) => {
    const base = wallPixels(kind);
    return Array.from({ length: 16 }, (_, i) => Uint32Array.from(base, c => shaded(c, .21 + i * .059)));
  });
  const sprites = spriteBook();
  const arms = Object.fromEntries(["pistol","scatter","blade"].map(kind => [kind, arm(kind)]));
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * .44, 44, VIEW_W / 2, VIEW_H * .44, VIEW_W * .66);
  vignette.addColorStop(0, "#05090b00");
  vignette.addColorStop(.78, "#020a1070");
  vignette.addColorStop(1, "#020810de");
  ctx.imageSmoothingEnabled = false;

  return world => {
    const p = world.player;
    const ux = Math.cos(p.angle), uy = Math.sin(p.angle);
    const vx = -uy * SCALE, vy = ux * SCALE;
    const horizon = Math.floor(VIEW_H / 2 + Math.sin(p.bob) * p.moving * 2.6);
    const rowLimit = Math.max(horizon + 1, VIEW_H - horizon);
    const sampleFloor = (fx, fy) => Math.floor(fy) * WIDTH + Math.floor(fx);

    pixels.fill(rgb(43, 51, 57));
    for (let row = 1; row <= rowLimit; row++) {
      const distance = VIEW_H * .49 / row;
      const dx = 2 * vx * distance / VIEW_W;
      const dy = 2 * vy * distance / VIEW_W;
      let fx = p.x + (ux - vx) * distance;
      let fy = p.y + (uy - vy) * distance;
      const light = clamp(Math.round(14.8 / (1 + distance * .195)), 1, 15);
      const floorY = horizon + row;
      const roofY = horizon - row;
      for (let x = 0; x < VIEW_W; x++, fx += dx, fy += dy) {
        const tx = Math.floor(fx * T) & (T - 1);
        const ty = Math.floor(fy * T) & (T - 1);
        if (floorY < VIEW_H) {
          const tile = world.floor[sampleFloor(fx, fy)];
          pixels[floorY * VIEW_W + x] = palette[tile === 1 ? 7 : tile === 2 ? 3 : 5][light][ty * T + tx];
        }
        if (roofY >= 0) pixels[roofY * VIEW_W + x] = palette[6][Math.max(0, light - 4)][ty * T + tx];
      }
    }

    for (let x = 0; x < VIEW_W; x++) {
      const cam = x / VIEW_W * 2 - 1;
      const hit = cast(world, p.x, p.y, ux + vx * cam, uy + vy * cam);
      const distance = Math.max(.04, hit.distance);
      depth[x] = distance;
      const tall = VIEW_H / distance;
      const top = horizon - tall / 2;
      const bottom = Math.min(VIEW_H, Math.ceil(top + tall));
      const shade = clamp(Math.round(15.2 / (1 + distance * .167)) - hit.side * 2, 0, 15);
      const slab = palette[hit.wall || 1][shade];
      const column = Math.min(T - 1, Math.max(0, Math.floor(hit.u * T)));
      for (let y = Math.max(0, Math.floor(top)); y < bottom; y++) {
        const tex = clamp(Math.floor((y - top) * T / tall), 0, T - 1) * T + column;
        pixels[y * VIEW_W + x] = slab[tex];
      }
    }
    ctx.putImageData(id, 0, 0);

    const view = sceneSprites(world).map(s => ({ ...s,
      z: (s.x - p.x) * ux + (s.y - p.y) * uy,
      q: -(s.x - p.x) * uy + (s.y - p.y) * ux,
    })).filter(s => s.z > .15 && s.z < 23).sort((a, b) => b.z - a.z);

    for (const s of view) {
      const image = sprites[s.art];
      const height = VIEW_H * s.h / s.z;
      const width = height * image.width / image.height;
      const center = VIEW_W * .5 * (1 + s.q / (SCALE * s.z));
      const left = center - width / 2;
      const top = horizon + VIEW_H * (.51 - s.h - s.lift) / s.z;
      if (left > VIEW_W || left + width < 0) continue;
      ctx.globalAlpha = clamp(1.10 - s.z * .053, .23, 1);
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(VIEW_W, Math.ceil(left + width)); x++) {
        if (depth[x] <= s.z) continue;
        const u = clamp(Math.floor((x - left) * image.width / width), 0, image.width - 1);
        ctx.drawImage(image, u, 0, 1, image.height, x, Math.round(top), 1, Math.ceil(height));
      }
      if ((s.art === "torch" || s.art === "torch-lit") && depth[clamp(Math.round(center), 0, VIEW_W - 1)] > s.z) {
        ctx.globalAlpha = .68;
        const glow = ctx.createRadialGradient(center, top + height * .25, 0, center, top + height * .25, Math.max(1, height * .67));
        glow.addColorStop(0, "#ef984b58");
        glow.addColorStop(1, "#e28a4b00");
        rect(ctx, glow, center - height, top - height / 2, height * 2, height * 1.6);
      }
    }
    ctx.globalAlpha = 1;
    rect(ctx, vignette, 0, 0, VIEW_W, VIEW_H);
    const flash = p.weapon !== "blade" && p.recoil > (p.weapon === "scatter" ? .235 : .14);
    const rise = p.recoil * 46;
    const handX = VIEW_W / 2 - 67 + Math.sin(p.bob * .61) * p.moving * 6;
    const handY = VIEW_H - 73 + Math.abs(Math.sin(p.bob)) * p.moving * 4 + rise;
    if (flash) {
      const cx = handX + 75;
      const cy = handY + 3;
      poly(ctx, "#ffd47c", [[cx-26,cy-10],[cx-10,cy-12],[cx-9,cy-30],[cx,cy-18],[cx+12,cy-29],[cx+12,cy-12],[cx+28,cy-7],[cx+13,cy+5],[cx,cy+14],[cx-13,cy+5]]);
      poly(ctx, "#fff5bf", [[cx-13,cy-5],[cx-2,cy-19],[cx+8,cy-10],[cx+16,cy-4],[cx,cy+4]]);
    }
    ctx.drawImage(arms[p.weapon], Math.round(handX), Math.round(handY));
    if (p.hurt) rect(ctx, "rgba(179,46,35," + Math.min(.31, p.hurt * .8) + ")", 0, 0, VIEW_W, VIEW_H);
  };
}

export function mapDraw(canvas, world) {
  const ctx = canvas.getContext("2d");
  const scale = Math.floor(Math.min(canvas.width / WIDTH, canvas.height / HEIGHT));
  const left = Math.floor((canvas.width - WIDTH * scale) / 2);
  const top = Math.floor((canvas.height - HEIGHT * scale) / 2);
  const cell = (color, x, y, inset = 0) => rect(ctx, color, left + x * scale + inset, top + y * scale + inset, scale - inset * 2, scale - inset * 2);
  rect(ctx, "#101f23", 0, 0, canvas.width, canvas.height);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (!tileAt(world, x, y)) cell("#355257", x, y, 0);
  }
  for (const item of world.items) {
    const color = item.kind === "relic" ? "#9cf4d4" : item.kind === "ammo" ? "#d1a579" : "#7d9f89";
    cell(color, Math.floor(item.x), Math.floor(item.y), item.kind === "relic" ? 1 : 2);
  }
  cell("#f0ca8b", Math.floor(world.gate.x), Math.floor(world.gate.y), 1);
  const p = world.player;
  const x = left + p.x * scale;
  const y = top + p.y * scale;
  rect(ctx, "#fff1bf", x - 2, y - 2, 5, 5);
  ctx.strokeStyle = "#fff1bf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.angle) * scale * 1.7, y + Math.sin(p.angle) * scale * 1.7);
  ctx.stroke();
}
