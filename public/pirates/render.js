import { ISLAND_TERRAIN, SECRET_PANEL, VAULT_MOSAIC, VAULT_WALL, cast, discovered, seeded, shieldRaised, tileAt } from "./world.js?v=20";

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

function wallPixels(kind, panel = false) {
  const rand = seeded(89 + kind * 825);
  const source = new Uint32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const variation = Math.floor(rand() * 21) - 10;
    let color;
    if (kind === VAULT_MOSAIC) {
      const seam = x % 8 === 0 || y % 8 === 0;
      const tile = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
      color = seam ? [110, 94, 64] : tile ? [161, 141, 94] : [102, 142, 134];
      if (x % 8 === 2 || y % 8 === 2) color = tile ? [194, 168, 113] : [125, 162, 149];
    } else if (kind === VAULT_WALL) {
      const joint = y % 8 < 1 || (x + Math.floor(y / 8) * 7) % 16 === 0;
      const patina = Math.sin(x * .4 + y) * 8;
      color = joint ? [77, 69, 59] : [151 + patina, 126 + patina, 91 + patina];
      if ((y === 4 || y === 27) && x > 1 && x < 30) color = [191, 148, 83];
    } else if (kind >= ISLAND_TERRAIN.jungle) {
      const { jungle, basalt, root, sand, shrine } = ISLAND_TERRAIN;
      const vein = Math.sin(x / 2 + y * .26) * 12;
      if (kind === jungle) {
        const leaf = (x * 7 + y * 9 + Math.floor(x / 6) * 11) % 23;
        color = leaf < 8 ? [73 + vein, 103 + vein, 54] : [43 + vein, 73 + vein, 42];
        if (leaf === 2 || leaf === 3) color = [117 + vein, 123 + vein, 54];
      } else if (kind === root) {
        const width = (x + Math.round(2 * Math.sin(y / 8))) % 9;
        color = width < 2 ? [44, 52, 38] : y % 10 < 2 ? [92, 86, 45] : [74 + vein, 107 + vein, 53];
      } else if (kind === sand) {
        const pebble = (x * 17 + y * 7) % 37 < 2;
        color = pebble ? [130, 120, 83] : [154 + vein * .4, 137 + vein * .4, 90];
      } else {
        const edge = y % 8 === 0 || (x + (y >= 16 ? 7 : 0)) % 16 === 0;
        color = edge ? [42, 47, 39] : [103 + vein, 111 + vein, 83 + vein];
        if (kind === basalt && (x * 3 + y * 11) % 19 < 4) color = [63, 93, 50];
        if (kind === shrine) {
          const mark = Math.abs(x - 15.5) + Math.abs(y - 15.5);
          if ((mark > 7 && mark < 10) || (y > 9 && y < 12 && (x % 8 < 3))) color = [146, 118, 62];
          if (mark < 4) color = [111, 142, 65];
        }
      }
    } else if (kind === 2 || kind === 7) {
      const rail = x % 8;
      const seam = rail === 0 || (kind === 7 && y % 16 === 0);
      const knots = Math.sin(x * 2 + Math.cos(y / 6)) * 6;
      const shade = 13 * Math.sin(Math.floor(x / 8) * 7) + knots;
      color = seam ? [31, 31, 30] : [89 + shade, 62 + shade, 43 + shade];
      if (kind === 2 && ((y > 4 && y < 8) || (y > 24 && y < 28))) color = [42, 66, 68];
    } else if (kind === 9) {
      const grout = x % 16 < 1 || y % 16 < 1;
      const inlay = (y === 3 && x > 1 && x < 14) || (x === 13 && y > 2 && y < 13);
      color = grout ? [32, 33, 35] : inlay ? [113, 87, 53] : [60, 69, 73];
    } else if (kind === 8) {
      const iron = x % 8 < 3 || y % 16 < 3;
      color = iron ? [105, 87, 67] : [37, 30, 33];
      if (x % 8 === 1 && y % 16 === 1) color = [173, 140, 91];
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
    const seam = panel && (x === 7 + (y > 18 ? -1 : y > 9 ? 1 : 0) || (x > 21 && x < 26 && y === 17));
    const relief = seam ? -23 : 0;
    source[y * T + x] = rgb(...color.map(component => clamp(Math.floor(component + variation + relief), 0, 255)));
  }
  return source;
}

const SKY_W = 1024;
const SKY_H = 128;

function islandSky() {
  const sky = new Uint32Array(SKY_W * SKY_H);
  const rand = seeded(4967);
  for (let x = 0; x < SKY_W; x++) {
    const crown = 95 + Math.sin(x * .031) * 5 + Math.sin(x * .087) * 3 + Math.sin(x * .23) * 2;
    const sunrise = Math.max(0, 1 - Math.abs(x - 587) / 167);
    for (let y = 0; y < SKY_H; y++) {
      const grain = rand() * 5;
      if (y > crown) sky[y * SKY_W + x] = rgb(28 + grain | 0, 61 + grain | 0, 54 + grain | 0);
      else {
        const mist = y * .40 + sunrise * 21;
        const cloud = Math.max(0, Math.sin(x * .037 + y * .10) + Math.sin(x * .0061 - y * .078) - 1.03);
        sky[y * SKY_W + x] = rgb(66 + mist + cloud * 38 + grain | 0,
          105 + mist + cloud * 37 + grain | 0, 110 + mist * .63 + cloud * 24 | 0);
      }
    }
  }
  return sky;
}

function shaded(pixel, light, sea = 5) {
  const r = Math.min(255, ((pixel & 255) * light) | 0);
  const g = Math.min(255, ((((pixel >> 8) & 255) * light) | 0) + sea);
  const b = Math.min(255, ((((pixel >> 16) & 255) * light) | 0) + sea + 3);
  return rgb(r, g, b);
}

const STANCES = ["idle", "breathe", "step-a", "pass-a", "step-b", "pass-b", "wind", "strike", "hurt", "fall", "down"];
const STRIDE = { "step-a": -3, "pass-a": -1, "step-b": 3, "pass-b": 1 };

function crabSprite(pose) {
  const [image, c] = pixelCanvas(52, 34);
  const shell = pose === "hurt" ? "#f6ba64" : "#be653b";
  const stride = STRIDE[pose] || 0;
  if (pose === "fall" || pose === "down") {
    c.translate(0, pose === "fall" ? 6 : 16);
    c.scale(1, pose === "fall" ? .8 : .5);
  }
  for (const [x, sign] of [[13, -1], [39, 1]]) {
    for (let leg = 0; leg < 3; leg++) {
      const stretch = leg % 2 ? -stride : stride;
      const endX = x + sign * (6 + leg * 2) + stretch;
      const endY = 33 - leg * 2 - (stretch > 1 ? 2 : 0);
      poly(c, "#472d30", [[x, 21 + leg], [endX, endY - 4], [endX, endY], [x + 3, 26]]);
      rect(c, "#986044", endX, endY - 1, 3, 2);
    }
  }
  if (pose === "breathe" || Math.abs(stride) === 1) c.translate(0, -1);
  poly(c, "#191e2a", [[7,27],[9,21],[13,17],[18,11],[24,9],[29,8],[37,12],
    [40,17],[46,22],[44,29],[39,29],[34,32],[15,32],[10,29]]);
  poly(c, shell, [[8,25],[15,15],[23,11],[30,10],[39,16],[44,25],[35,30],[16,29]]);
  poly(c, "#773d33", [[14,24],[21,20],[26,23],[30,21],[39,24],[35,29],[17,28]]);
  poly(c, "#fad08b", [[18,15],[25,11],[33,12],[38,15],[29,15],[22,17]]);
  for (const [hand, dir] of [[8, -1], [44, 1]]) {
    c.save();
    c.translate(hand, 21 + (pose === "wind" ? -8 : pose === "strike" ? -4 : dir * stride));
    c.scale(dir, 1);
    poly(c, "#612e2d", [[-4,3],[-5,-3],[0,-6],[6,-7],[8,-4],[4,0],[8,1],[7,4],[1,6]]);
    poly(c, shell, [[-4,2],[-2,-3],[2,-5],[7,-6],[6,-4],[2,0],[7,1],[6,3],[1,5]]);
    c.restore();
  }
  rect(c, "#eddec2", 18, 20, 5, 4);
  rect(c, "#eddec2", 30, 20, 5, 4);
  rect(c, "#713631", 20, 21, 2, 3);
  rect(c, "#713631", 31, 21, 2, 3);
  return image;
}

function sailor(kind, pose, guard = false) {
  const [image, c] = pixelCanvas(48, 58);
  const rust = kind === "rust-hook";
  const jailer = kind === "fort-jailer";
  const leader = kind === "captain" || rust || jailer;
  const human = rust || kind.startsWith("vault-");
  const flare = pose === "hurt" || pose === "strike";
  const stride = STRIDE[pose] || 0;
  const raised = pose === "wind" || pose === "charge";
  if (pose === "fall" || pose === "down") {
    c.translate(pose === "fall" ? -6 : -10, pose === "fall" ? 11 : 31);
    c.transform(1, .19, .29, pose === "fall" ? .72 : .38, 0, 0);
  }
  for (const [base, sign] of [[16,-1],[33,1]]) {
    const motion = sign * stride;
    const endX = base + motion;
    const endY = 57 - Math.max(0, motion);
    poly(c, "#2d2834", [[base-4,46],[base+4,46],[endX+4,endY],[endX-5,endY]]);
    rect(c, "#695044", endX - 5, endY - 2, 10, 3);
    rect(c, "#25222d", endX - 6, endY + 1, 12, 1);
  }
  c.translate(pose === "hurt" ? 2 : pose === "strike" ? -1 : 0, pose === "breathe" || Math.abs(stride) === 1 ? 1 : 0);
  const shooter = ["corsair", "vault-gunner", "vault-sniper", "vault-boatswain"].includes(kind);
  const sentinel = kind === "sentinel" || kind === "vault-shield";
  const accent = { "vault-powder": "#bd6b35", "vault-sniper": "#365563", "vault-boatswain": "#8a3858" };
  const coat = accent[kind] ?? (jailer ? "#8d7251" : leader ? "#983e38" : shooter ? "#84472d" : sentinel ? "#556653" : "#23767b");
  const shade = leader ? "#542d31" : shooter ? "#58362b" : sentinel ? "#363b33" : "#194049";
  const rim = leader ? "#ffc885" : shooter ? "#e4a567" : sentinel ? "#b8ae72" : "#5cc1b0";
  const bone = human ? (flare ? "#e7ae87" : "#bd7c5e") : flare ? "#fff3ae" : "#e5dcb1";
  poly(c, "#0c171c", [[6,49],[7,38],[4,27],[12,18],[13,11],[19,9],[25,8],[31,9],[36,17],[38,24],[43,28],[44,47],[40,51]]);
  poly(c, coat, [[12,24],[21,21],[32,22],[40,26],[43,44],[38+stride,51],[31,48],[24,51],[20,46],[13-stride,51],[7,47]]);
  poly(c, shade, [[11,23],[16,23],[19,34],[15,52],[7,51],[9,38]]);
  poly(c, shade, [[31,25],[40,26],[42,47],[37,50],[32,40]]);
  poly(c, rim, [[12,22],[22,23],[18,31],[12,37],[13,28]]);
  poly(c, rim, [[27,22],[34,23],[34,34],[26,29]]);
  rect(c, "#34444a", 15, 40, 23, 5);
  rect(c, "#d7ae73", 24, 40, 6, 5);

  for (const y of [32,35,46]) rect(c, rim, 26, y, 2, 2);
  poly(c, bone, [[15,13],[18,10],[30,10],[34,14],[33,21],[29,24],[20,24],[16,20]]);
  rect(c, "#3f3c3e", 17, 15, 6, 4);
  rect(c, "#3f3c3e", 27, 15, 5, 4);
  rect(c, flare ? "#ffc77d" : leader ? "#ff8a5f" : "#8bf3bc", 18, 16, 2, 1);
  rect(c, flare ? "#ffc77d" : leader ? "#ff8a5f" : "#8bf3bc", 29, 16, 2, 1);
  rect(c, "#68605d", 24, 18, 2, 3);
  rect(c, "#665451", 20, 22, 11, 2);
  for (const x of [21,24,27]) rect(c, bone, x, 22, 1, 2);
  if (human) {
    poly(c, bone, [[16,12],[31,11],[34,15],[32,21],[29,25],[21,25],[17,22]]);
    rect(c, "#6f463c", 18, 15, 6, 2);
    rect(c, "#634338", 27, 14, 5, 2);
    rect(c, "#262328", 19, 17, 2, 1);
    rect(c, "#262328", 29, 16, 2, 1);
    rect(c, "#8a4e3f", 24, 18, 2, 3);
    rect(c, "#5f352e", 21, 22, 8, 1);
    if (rust) {
      poly(c, "#804126", [[16,17],[20,20],[24,21],[30,19],[34,17],[32,26],[28,31],[22,30],[17,26]]);
      poly(c, "#c66b35", [[18,17],[21,20],[23,22],[30,20],[32,18],[30,26],[25,29],[23,25],[20,26]]);
      rect(c, "#e99952", 21, 21, 6, 1);
    }
  }
  const hat = leader ? "#503343" : "#183843";
  poly(c, hat, [[6,15],[12,11],[18,10],[17,5],[22,3],[26,2],[31,6],[32,10],[42,13],[39,17],[33,15],[15,16],[8,18]]);
  poly(c, rim, [[7,15],[16,13],[28,12],[39,14],[36,15],[26,13],[14,15]]);
  if (leader) {
    poly(c, "#fc7d64", [[30,7],[35,1],[42,1],[38,5],[34,9]]);
    rect(c, "#f8b87d", 24, 6, 4, 4);
  }
  const reach = pose === "strike" || pose === "charge";
  if (shooter || leader) {
    const x = reach ? 2 : 7;
    const y = raised ? 22 : reach ? 28 : 33 + stride;
    poly(c, shade, [[10,24],[16,26],[x+9,y+4],[x+1,y+8],[x-2,y+5]]);
    rect(c, "#cbb07c", x, y, 6, 5);
    poly(c, "#574654", [[x-1,y],[x+4,y-3],[x+10,y-1],[x+15,y-1],[x+15,y+4],[x+3,y+5],[x-1,y+4]]);
    rect(c, raised ? "#e48cf0" : "#c9a473", x, y, 6, 2);
    if (reach) poly(c, leader ? "#e3a3ff" : "#ffca75", [[x,y-2],[x-2,y-6],[x-1,y-2],[x-3,y+1],[x-1,y+4],[x+2,y+2]]);
    if (leader && raised) poly(c, "#b980cc", [[36,25],[41,19],[39,11],[45,16],[46,23],[40,30]]);
  } else {
    const l = raised ? 19 : reach ? 26 : 34 + stride;
    const r = raised ? 18 : reach ? 23 : 33 - stride;
    poly(c, shade, [[10,24],[15,28],[7,l+6],[2,l+4],[5,30]]);
    poly(c, shade, [[35,24],[42,28],[46,r+5],[39,r+7],[34,34]]);
    poly(c, bone, [[3,l],[7,l-2],[11,l+3],[8,l+7],[2,l+5]]);
    poly(c, bone, [[40,r-2],[45,r-1],[47,r+5],[42,r+7],[38,r+2]]);
  }
  if (sentinel) {
    const x = guard ? 19 : 33;
    const y = guard ? 30 : 33 + stride;
    poly(c, "#252c32", [[x-8,y-4],[x-5,y-9],[x+6,y-9],[x+10,y-4],[x+8,y+14],[x+2,y+20],[x-6,y+14]]);
    poly(c, "#b69359", [[x-6,y-4],[x-3,y-7],[x+5,y-7],[x+8,y-4],[x+6,y+13],[x+1,y+17],[x-4,y+13]]);
    poly(c, "#60543b", [[x-4,y-2],[x+6,y-2],[x+4,y+11],[x+1,y+14],[x-3,y+11]]);
    rect(c, flare ? "#ffeeaa" : "#8aaba4", x-1, y+3, 5, 5);
    rect(c, "#d5ba7c", x-1, y-4, 2, 17);
    if (raised || reach) {
      poly(c, "#bcc1ae", [[5,22],[4,8],[7,4],[10,9],[9,19],[12,27],[8,29]]);
      rect(c, "#c58c52", 4, 26, 10, 3);
    }
  }
  if (human && !shooter && !sentinel && !rust) {
    const y = raised ? 16 : reach ? 29 : 41;
    poly(c, "#2b2a2a", [[39,y],[45,y-7],[47,y-16],[48,y-14],[48,y-4],[44,y+3]]);
    poly(c, "#c6bab0", [[41,y],[46,y-8],[47,y-14],[47,y-4],[44,y+1]]);
    rect(c, "#b28a51", 39, y, 7, 2);
  }
  if (rust) {
    const y = raised ? 16 : reach ? 22 : 35;
    poly(c, "#6b4a3c", [[40,y+9],[39,y+2],[41,y-3],[45,y-5],[47,y-4],[43,y],[42,y+5],[45,y+8],[45,y+11]]);
    poly(c, "#d3a781", [[41,y+8],[40,y+2],[42,y-2],[45,y-4],[46,y-4],[43,y-1],[42,y+3],[43,y+7]]);
  }
  if (kind === "vault-powder") {
    const y = raised ? 18 : 37;
    poly(c, "#593935", [[33,y],[40,y-4],[46,y],[48,y+8],[43,y+12],[35,y+10]]);
    rect(c, "#bd8552", 37, y + 2, 8, 4);
    rect(c, raised ? "#ffe284" : "#d09b55", 42, y - 5, 4, 4);
  }
  return image;
}

const ISLAND_MOBS = ["macaque", "slinger", "viper", "mask", "gorilla", "king"];

function vendorSprite(kind, sway) {
  const [image, c] = pixelCanvas(48, 64);
  c.translate(0, sway);
  const brass = "#b99a58", leather = "#634631", dark = "#282028", skin = "#bf8464";
  if (kind === "skills") {
    poly(c, dark, [[20,5],[30,4],[36,10],[36,22],[30,29],[36,42],[41,58],[33,61],[17,58],[9,60],[16,38],[18,27],[10,29],[12,18],[15,9]]);
    poly(c, "#924629", [[20,6],[29,5],[34,11],[33,22],[29,28],[28,16],[18,17],[17,27],[12,29],[13,18],[16,9]]);
    poly(c, "#d38a45", [[16,10],[22,6],[28,6],[29,9],[21,12],[18,18],[17,23],[15,25]]);
    poly(c, "#d99d76", [[19,12],[30,11],[33,15],[30,22],[24,24],[19,19]]);
    rect(c, "#85ae79", 26, 15, 3, 1);
    poly(c, "#b8a483", [[17,23],[26,24],[32,22],[37,26],[39,32],[34,37],[30,34],[28,29],[18,33],[15,39],[11,37],[11,29]]);
    poly(c, "#295247", [[17,27],[26,27],[31,29],[29,37],[33,45],[38,56],[32,58],[23,56],[12,58],[15,47],[20,37]]);
    poly(c, "#436e58", [[21,28],[28,28],[26,37],[20,51],[20,57],[15,58],[17,47]]);
    rect(c, brass, 19, 37, 12, 2);
    rect(c, brass, 24, 28, 2, 9);
    rect(c, leather, 16, 57, 9, 4);
    rect(c, leather, 31, 58, 7, 3);
    rect(c, skin, 33, 32, 5, 3);
  } else if (kind === "arms") {
    poly(c, dark, [[17,5],[28,3],[35,8],[38,17],[34,23],[44,28],[47,42],[37,47],[35,60],[25,61],[23,47],[20,61],[10,62],[10,45],[3,42],[5,27],[14,22],[12,13]]);
    poly(c, skin, [[18,9],[28,7],[33,12],[32,19],[27,25],[20,22],[16,15]]);
    poly(c, "#403236", [[15,11],[16,6],[23,4],[31,6],[33,11],[25,8],[19,12]]);
    rect(c, "#774a3d", 20, 14, 4, 2);
    rect(c, "#4f3835", 27, 14, 4, 1);
    poly(c, "#37534f", [[14,22],[24,26],[34,22],[43,28],[42,36],[36,38],[34,53],[25,61],[22,49],[17,60],[11,59],[12,37],[5,35],[6,28]]);
    poly(c, "#835943", [[17,23],[20,26],[28,25],[34,25],[33,37],[37,51],[14,51],[16,34]]);
    rect(c, brass, 18, 27, 2, 3);
    rect(c, brass, 30, 26, 2, 3);
    rect(c, "#9d6d4b", 19, 42, 10, 6);
    poly(c, skin, [[5,33],[11,34],[13,40],[10,46],[4,43]]);
    poly(c, skin, [[37,35],[43,33],[45,40],[38,45],[35,43]]);
    rect(c, "#54404a", 27, 43, 18, 8);
    rect(c, "#8a8a79", 31, 43, 13, 2);
    rect(c, leather, 9, 59, 11, 3);
    rect(c, leather, 24, 59, 12, 3);
  } else {
    poly(c, dark, [[15,12],[29,8],[40,19],[38,25],[42,31],[35,40],[38,51],[31,61],[23,58],[20,62],[12,59],[15,49],[10,43],[12,34],[5,24]]);
    poly(c, "#315453", [[7,22],[13,16],[17,11],[26,10],[29,16],[37,20],[35,25],[24,23],[13,26]]);
    poly(c, brass, [[9,22],[16,19],[22,17],[29,18],[35,21],[34,22],[27,20],[19,21],[12,24]]);
    poly(c, "#9c7c68", [[14,25],[19,22],[31,22],[37,28],[33,36],[23,40],[15,36],[11,29]]);
    poly(c, "#bc7956", [[18,26],[25,24],[32,26],[34,31],[29,34],[26,31],[23,35],[18,33]]);
    rect(c, dark, 22, 28, 2, 2);
    rect(c, dark, 29, 27, 2, 2);
    rect(c, "#663f32", 24, 34, 7, 2);
    poly(c, "#92764a", [[16,38],[22,37],[31,38],[35,43],[33,55],[31,59],[24,55],[20,60],[15,58],[14,45]]);
    rect(c, "#c0a159", 16, 40, 3, 12);
    rect(c, "#c0a159", 29, 40, 3, 13);
    rect(c, "#56372a", 18, 39, 16, 10);
    rect(c, brass, 19, 40, 14, 2);
    rect(c, brass, 25, 43, 3, 4);
    rect(c, skin, 14, 58, 8, 3);
    rect(c, skin, 27, 58, 8, 3);
  }
  return image;
}

function stallSprite(kind) {
  const [image, c] = pixelCanvas(72, 62);
  const roof = { skills: "#41776a", arms: "#865344", chests: "#73624b" }[kind];
  for (const x of [6, 61]) {
    rect(c, "#41343a", x, 17, 5, 45);
    rect(c, "#90704f", x + 1, 18, 1, 43);
  }
  poly(c, "#29313a", [[0,20],[15,4],[57,4],[72,20],[70,27],[0,27]]);
  poly(c, roof, [[2,20],[16,6],[56,6],[70,20],[68,24],[2,24]]);
  for (const x of [7, 22, 37, 52]) rect(c, "#b78c56", x, 23, 3, 4);
  rect(c, "#5c3e32", 8, 46, 56, 12);
  rect(c, "#9f7a53", 6, 46, 60, 3);
  return image;
}

function islandFighter(kind, pose) {
  const [image, c] = pixelCanvas(60, 64);
  const stride = STRIDE[pose] || 0;
  const wind = pose === "wind";
  const strike = pose === "strike" || pose === "charge";
  const flash = pose === "hurt";
  if (pose === "fall" || pose === "down") {
    c.translate(pose === "fall" ? 2 : -2, pose === "fall" ? 21 : 36);
    c.transform(1, .13, .14, pose === "fall" ? .58 : .35, 0, 0);
  } else if (pose === "breathe") c.translate(0, 1);
  if (kind === "viper") {
    const noseX = 41 + stride * 2 + (strike ? 10 : 0);
    const noseY = (wind ? 18 : strike ? 37 : 30) + stride;
    poly(c, "#22322b", [[6,56],[8,47],[22,43],[39,48],[32,41],[noseX-8,noseY+5],[noseX-9,noseY-5],
      [noseX+4,noseY-4],[noseX+7,noseY+2],[noseX+2,noseY+8],[45,43],[48,51],[45,61],[12,63]]);
    poly(c, flash ? "#b7db72" : "#638a49", [[9,51],[24,47],[37,52],[43,48],[36,43],
      [noseX-5,noseY+2],[noseX-5,noseY-3],[noseX+2,noseY-3],[noseX+5,noseY+2],[noseX,noseY+6],[43,44],[46,53],[40,60],[13,60]]);
    for (const x of [15,24,33,39]) rect(c, "#bba052", x, 51 + (x % 3), 4, 4);
    rect(c, "#f6ad56", noseX - 1, noseY, 3, 2);
    if (strike) rect(c, "#f5dfae", noseX + 1, noseY + 6, 2, 6);
    return image;
  }
  if (kind === "mask") {
    const drift = stride + (wind ? -4 : strike ? 3 : 0);
    c.translate(drift, pose === "breathe" ? 2 : 0);
    poly(c, "#24372b", [[30,2],[40,14],[52,8],[48,29],[55,42],[42,44],[30,59],[20,45],[5,45],[11,29],[7,10],[23,14]]);
    poly(c, "#596d3f", [[29,5],[32,22],[40,17],[50,12],[43,33],[50,40],[36,40],[30,55],[24,40],[11,40],[17,30],[10,14],[23,21]]);
    poly(c, flash ? "#e2c784" : "#ac7352", [[23,15],[37,15],[43,29],[40,40],[30,51],[19,40],[17,29]]);
    poly(c, "#724439", [[29,17],[35,29],[37,39],[30,46],[25,39],[22,29]]);
    rect(c, "#192f2b", 21, 27, 18, 6);
    rect(c, wind || strike ? "#f6efa1" : "#addc7b", 22, 29, 5, 2);
    rect(c, wind || strike ? "#f6efa1" : "#addc7b", 33, 29, 5, 2);
    rect(c, "#d2ab76", 27, 38, 6, 2);
    return image;
  }

  const king = kind === "king", heavy = king || kind === "gorilla", slinger = kind === "slinger";
  const fur = flash ? "#c59271" : king ? "#7f443c" : heavy ? "#584444" : slinger ? "#805337" : "#935943";
  const dark = king ? "#3c292e" : "#332b2a";
  const gold = king ? "#e8b664" : "#ae8a55";
  const shoulder = heavy ? 11 : 16;
  const foot = (x, shift) => {
    poly(c, dark, [[x-5,49],[x+4,49],[x+5+shift,60],[x-5+shift,62],[x-8+shift,59]]);
    rect(c, fur, x - 6 + shift, 57, 8, 4);
  };
  foot(21, stride);
  foot(39, -stride);
  if (!heavy) {
    poly(c, dark, [[25,44],[17,46],[6,44],[2,39],[5,27],[9,25],[12,32],[7,35],[9,40],[25,39]]);
    poly(c, fur, [[6,30],[8,27],[9,32],[6,36],[9,41],[22,43],[23,45],[8,45],[4,40]]);
  }
  poly(c, dark, [[30,15],[49,23],[50,45],[42,55],[19,56],[11,45],[11,25]]);
  poly(c, fur, [[shoulder,25],[30,20],[60-shoulder,25],[46,43],[41,54],[21,53],[13,41]]);
  poly(c, king ? "#a76249" : "#ab7654", [[20,28],[39,27],[44,39],[37,47],[23,45],[17,36]]);
  if (slinger || king) {
    poly(c, king ? "#a24a43" : "#65734b", [[16,25],[22,22],[26,30],[43,46],[36,51],[22,38]]);
    rect(c, gold, king ? 27 : 26, 44, 9, 5);
  }
  for (const [x, side] of [[shoulder, -1], [60 - shoulder, 1]]) {
    const clenched = wind ? 21 : strike ? 33 : 45 + side * stride;
    const endX = x + side * (strike ? 9 : heavy ? 5 : 4);
    poly(c, dark, [[x-5,23],[x+4,25],[endX+5,clenched+6],[endX+3,clenched+10],[endX-5,clenched+7],[endX-6,clenched]]);
    poly(c, fur, [[x-4,26],[x+2,26],[endX+4,clenched+5],[endX+2,clenched+8],[endX-4,clenched+6]]);
    if (king) rect(c, gold, endX - 4, clenched + 1, 8, 3);
  }
  poly(c, dark, [[16,13],[21,10],[25,7],[37,7],[43,12],[48,13],[45,24],[39,28],[24,28],[18,24]]);
  poly(c, fur, [[20,13],[28,8],[38,10],[43,15],[40,23],[36,26],[25,26],[21,21]]);
  poly(c, heavy ? "#b78662" : "#c48f65", [[23,17],[37,17],[41,21],[38,28],[24,28],[19,23]]);
  rect(c, "#271f24", 22, 15, 17, 5);
  rect(c, king ? "#f0d57b" : "#e8af63", 24, 17, 3, 2);
  rect(c, king ? "#f0d57b" : "#e8af63", 35, 17, 3, 2);
  rect(c, "#623c33", 27, 22, 7, 3);
  if (wind || strike) rect(c, "#f2dbb4", 25, 26, 11, 2);
  if (king) {
    poly(c, "#683d32", [[19,12],[16,3],[24,6],[29,0],[34,6],[44,3],[41,13]]);
    poly(c, gold, [[19,10],[18,4],[24,7],[29,1],[34,8],[42,5],[40,11]]);
    rect(c, "#a8d493", 28, 6, 4, 4);
  } else if (slinger) {
    rect(c, "#d69556", 20, 10, 23, 4);
    const y = wind ? 15 : strike ? 25 : 39;
    poly(c, "#d9af72", [[47,y],[51,y-8],[56,y-9],[57,y-5],[52,y+2],[48,y+7],[46,y+5]]);
    rect(c, "#9b9990", 53, y - 9, 4, 4);
  } else if (heavy) {
    rect(c, "#7b735b", 22, 32, 17, 7);
    rect(c, "#b5a069", 28, 33, 5, 4);
  }
  return image;
}

function prop(kind, phase = 0) {
  const [image, c] = pixelCanvas(32, 36);
  if (kind === "coin-heap") {
    poly(c, "#67432c", [[1,29],[7,23],[12,23],[16,17],[23,18],[26,24],[31,27],[28,34],[3,34]]);
    for (const [x, y, w] of [[3,30,9],[6,26,12],[13,23,11],[17,19,7],[18,27,11],[9,32,13],[22,30,7]]) {
      rect(c, "#d29c4c", x, y, w, 3);
      rect(c, "#f8cf6c", x + 1, y, Math.max(2, w - 4), 1);
    }
  } else if (kind === "rescue-lever") {
    poly(c, "#34424a", [[6,32],[8,24],[25,24],[29,32]]);
    rect(c, "#8a7961", 7, 27, 19, 4);
    poly(c, "#a49778", phase ? [[14,26],[16,8],[20,8],[18,26]] : [[14,26],[21,9],[24,10],[18,26]]);
    rect(c, phase ? "#83be92" : "#cb7960", phase ? 14 : 19, 6, 7, 5);
    for (const x of [10,15,20]) rect(c, "#e6b36a", x, 28, 2, 1);
  } else if (kind === "coin") {
    poly(c, "#704227", [[7,21],[12,13],[24,13],[29,19],[27,26],[18,31],[10,27]]);
    poly(c, "#dfaa53", [[8,20],[13,14],[23,14],[27,19],[24,25],[14,27],[9,24]]);
    poly(c, "#a96937", [[12,21],[16,16],[22,17],[24,20],[21,24],[15,24]]);
    rect(c, "#ffe39d", 16, 17, 2, 6);
    rect(c, "#f3c373", 13, 19, 8, 2);
  } else if (kind === "chest") {
    poly(c, "#292029", [[2,14],[7,7],[25,7],[30,14],[30,31],[3,31]]);
    poly(c, "#805039", [[4,14],[9,9],[24,9],[28,14],[28,29],[5,29]]);
    rect(c, "#3e2927", 4, 15, 24, 4);
    rect(c, "#c19958", 7, 10, 3, 20);
    rect(c, "#ad814c", 23, 10, 3, 20);
    rect(c, "#dfb675", 14, 15, 6, 7);
    rect(c, "#473129", 17, 17, 1, 3);
  } else if (kind === "chain-hook") {
    poly(c, "#b6937d", [[5,23],[18,14],[26,13],[30,17],[30,23],[27,27],[22,27],[18,24],
      [21,22],[24,24],[27,22],[27,18],[23,17],[17,19],[7,28]]);
    rect(c, "#f0cb9e", 22, 13, 5, 2);
  } else if (kind === "palm" || kind === "fern") {
    if (kind === "palm") {
      poly(c, "#564330", [[14,35],[15,25],[14,16],[12,11],[16,9],[19,16],[19,26],[18,35]]);
      for (const y of [17,22,27,32]) rect(c, "#896847", 15, y, 4, 1);
    }
    const y = kind === "palm" ? 9 : 27;
    poly(c, "#2a4d38", [[16,y-3],[12,y-8],[4,y-7],[0,y-2],[8,y-3],[2,y+4],[12,y+2],[9,y+8],
      [17,y+4],[25,y+8],[24,y+2],[32,y+3],[26,y-3],[31,y-4],[24,y-8],[18,y-6]]);
    poly(c, "#6b914e", [[16,y],[23,y-7],[29,y-5],[22,y-4],[30,y+1],[23,y],[24,y+5],[16,y+2],
      [10,y+4],[6,y+3],[12,y],[3,y-2],[9,y-5],[14,y-4]]);
  } else if (kind === "idol") {
    poly(c, "#374c42", [[6,35],[7,14],[12,5],[22,5],[27,15],[27,35]]);
    poly(c, "#7b7d59", [[10,15],[13,7],[22,7],[25,16],[25,31],[10,31]]);
    rect(c, "#3b5148", 11, 14, 13, 5);
    rect(c, "#b9bd72", 13, 16, 3, 2);
    rect(c, "#b9bd72", 20, 16, 3, 2);
    rect(c, "#aa9060", 15, 25, 8, 2);
  } else if (kind === "stone-bolt" || kind === "curse-bolt") {
    const color = kind === "stone-bolt" ? "#bf9d75" : "#b1d782";
    poly(c, "#354738", [[8,23],[7,14],[15,9],[21,11],[25,18],[20,25],[13,27]]);
    poly(c, color, [[10,21],[11,15],[17,11],[22,15],[22,21],[17,24]]);
    rect(c, "#fbebac", 14, 15, 5, 3);
  } else if (kind === "torch") {
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
  } else if (kind === "upgrade") {
    poly(c, "#28222c", [[7,24],[5,15],[9,8],[16,5],[23,8],[27,15],[25,24],[19,30],[12,30]]);
    poly(c, "#ab764b", [[9,24],[7,15],[10,10],[16,7],[22,10],[25,15],[23,24],[18,28],[13,28]]);
    poly(c, "#f3c88b", [[10,12],[15,8],[20,10],[19,13],[15,12],[11,15]]);
    poly(c, "#434c61", [[12,23],[10,17],[13,13],[19,13],[22,17],[20,23],[16,25]]);
    poly(c, "#a8dcfd", [[16,12],[21,18],[16,24],[11,18]]);
    rect(c, "#fff3c9", 23, 8, 2, 4);
    rect(c, "#fff3c9", 22, 9, 4, 2);
  } else if (kind === "heal" || kind === "ammo") {
    rect(c, "#171d27", 5, 19, 23, 13);
    rect(c, kind === "heal" ? "#8f483b" : "#6a6849", 6, 19, 20, 11);
    rect(c, kind === "heal" ? "#d28761" : "#a5a064", 7, 20, 18, 3);
    if (kind === "heal") { rect(c, "#ffe7b8", 14, 22, 4, 7); rect(c, "#ffe7b8", 12, 24, 8, 3); }
    else for (const x of [10,15,20]) { rect(c, "#e4c077", x, 21, 3, 9); rect(c, "#865937", x, 25, 3, 5); }
  } else if (kind === "scatter") {
    poly(c, "#744338", [[2,27],[3,23],[11,21],[20,17],[26,17],[27,21],[16,25],[8,30],[3,30]]);
    poly(c, "#697882", [[12,21],[18,17],[25,15],[27,17],[24,21],[14,24]]);
    poly(c, "#bd8951", [[21,16],[26,15],[30,12],[32,12],[32,19],[28,20],[25,19],[22,20]]);
    poly(c, "#f0c784", [[23,16],[28,14],[31,13],[31,15],[26,17],[23,17]]);
  } else if (kind === "musket") {
    poly(c, "#7c4e38", [[1,29],[2,24],[7,22],[15,21],[30,12],[31,15],[16,24],[8,28],[3,32]]);
    poly(c, "#839da5", [[8,22],[17,18],[31,10],[32,12],[17,21],[9,24]]);
    rect(c, "#c08c52", 16, 18, 2, 4);
    rect(c, "#e3b371", 24, 13, 2, 3);
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
  } else if (kind === "boss-bolt") {
    poly(c, "#7739ba", [[16,0],[21,11],[31,16],[22,22],[16,35],[11,23],[1,17],[11,11]]);
    poly(c, "#dda5fa", [[16,5],[19,13],[25,17],[19,22],[16,28],[13,21],[8,17],[13,13]]);
    rect(c, "#fff3d7", 14, 14, 5, 6);
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

const HAND_W = 144;
const HAND_H = 110;
const VIEW_MODELS = {
  pistol: { cell: [0, 0], wrist: [84, 103], muzzleY: 41, kick: 7, dip: 23, tilt: -.34 },
  scatter: { cell: [1, 0], wrist: [90, 106], muzzleY: 29, kick: 13, dip: 30, tilt: -.23 },
  musket: { cell: [0, 1], wrist: [89, 106], muzzleY: 18, kick: 10, dip: 32, tilt: -.17 },
  blade: { cell: [1, 1], wrist: [87, 102] },
};

function muzzleFlash(ctx, x, y, age, heavy) {
  ctx.save();
  ctx.translate(x, y);
  if (age < .073) {
    const reach = (heavy ? 1.28 : 1) * (1 - age * 4);
    ctx.scale(reach, reach);
    poly(ctx, "#d77644", [[0,-22],[4,-11],[11,-15],[9,-6],[17,-3],[9,1],[8,7],[2,4],[-4,8],[-7,4],[-12,3],[-8,-4],[-14,-10],[-5,-9]]);
    poly(ctx, "#f6ad5d", [[0,-18],[4,-8],[9,-10],[7,-4],[12,-2],[5,0],[4,5],[0,3],[-5,3],[-4,-4],[-9,-7],[-3,-7]]);
    poly(ctx, "#fff0ad", [[0,-10],[3,-5],[6,-3],[3,1],[0,3],[-3,2],[-3,-4]]);
  } else {
    const drift = (age - .073) * 43;
    ctx.globalAlpha = Math.max(0, .37 - (age - .073) * 2.4);
    poly(ctx, "#b0a593", [[-8,-4-drift],[-11,-9-drift],[-6,-15-drift],[2,-18-drift],[7,-15-drift],[9,-7-drift],[3,-3-drift]]);
    poly(ctx, "#817e78", [[-10,1-drift],[-9,-6-drift],[-3,-10-drift],[3,-8-drift],[5,-4-drift],[0,0-drift]]);
  }
  ctx.restore();
}

function createViewModel(ctx) {
  const atlas = new Image();
  atlas.src = new URL("./viewmodels.png?v=11", import.meta.url).href;

  return (p, time, viewWidth, viewHeight) => {
    if (!atlas.complete || !atlas.naturalWidth) return;
    const model = VIEW_MODELS[p.weapon];
    const blade = p.weapon === "blade";
    const recover = p.weapon === "pistol" || blade ? .195 : .29;
    const attack = clamp(p.recoil / recover, 0, 1);
    const recoil = attack * attack;
    const slash = blade ? Math.sin(Math.PI * attack) : 0;
    const reload = p.reloadLeft > 0 ? clamp(1 - p.reloadLeft / p.reloadSpan, 0, 1) : 0;
    const dip = Math.sin(Math.PI * reload);
    const settle = Math.sin(reload * Math.PI * 2) * dip;
    const step = p.moving * Math.sin(p.bob * .64);
    const breathe = Math.sin(time * 2.2) * .5;
    const size = Math.min(1, viewWidth * .80 / HAND_W, viewHeight / VIEW_H);
    const x = Math.round(step * 3 - slash * 62 + dip * 5);
    const y = Math.round(5 + Math.abs(Math.sin(p.bob)) * p.moving * 3 + breathe
      + (model.kick ?? 0) * recoil + (model.dip ?? 0) * dip + slash * 8 + p.dash * 18);
    const turn = blade ? -slash * .71 : model.tilt * dip + settle * .052;
    const [wx, wy] = model.wrist;
    const [sx, sy] = model.cell;

    ctx.save();
    ctx.translate(Math.round((viewWidth - HAND_W * size) / 2), Math.round(viewHeight - HAND_H * size));
    ctx.scale(size, size);
    ctx.translate(x + wx, y + wy);
    ctx.rotate(turn);
    if (!blade && p.recoil > .015 && !p.reloadLeft) {
      muzzleFlash(ctx, HAND_W / 2 - wx, model.muzzleY - wy, recover * (1 - attack), p.weapon === "scatter");
    }
    ctx.drawImage(atlas, sx * HAND_W, sy * HAND_H, HAND_W, HAND_H, -wx, -wy, HAND_W, HAND_H);
    ctx.restore();
  };
}

function spriteBook() {
  const sprites = {};
  for (const kind of ["drowned", "corsair", "captain", "sentinel", "crab",
    "vault-cutlass", "vault-gunner", "vault-shield", "vault-brute", "vault-powder", "vault-sniper",
    "vault-boatswain", "rust-hook", "fort-jailer"]) {
    for (const pose of STANCES) {
      sprites[kind + "-" + pose] = kind === "crab" ? crabSprite(pose) : sailor(kind, pose);
      if (kind === "sentinel" || kind === "vault-shield") sprites[kind + "-shield-" + pose] = sailor(kind, pose, true);
    }
  }
  sprites["captain-charge"] = sailor("captain", "charge");
  sprites["rust-hook-charge"] = sailor("rust-hook", "charge");
  sprites["king-charge"] = islandFighter("king", "charge");
  sprites["island-jailer-charge"] = islandFighter("gorilla", "charge");
  for (const pose of STANCES) sprites["island-jailer-" + pose] = islandFighter("gorilla", pose);
  for (const kind of ISLAND_MOBS) for (const pose of STANCES) sprites[kind + "-" + pose] = islandFighter(kind, pose);
  for (const vendor of ["skills", "arms", "chests"]) {
    sprites["vendor-" + vendor] = vendorSprite(vendor, 0);
    sprites["vendor-" + vendor + "-sway"] = vendorSprite(vendor, 1);
    sprites["stall-" + vendor] = stallSprite(vendor);
  }
  for (const [name, vendor] of [["runa", "skills"], ["brann", "arms"]]) {
    const [image, ctx] = pixelCanvas(56, 64);
    ctx.drawImage(sprites["vendor-" + vendor], 4, 0);
    for (const x of [4, 14, 24, 34, 44, 52]) {
      rect(ctx, "#24323a", x, 1, 3, 63);
      rect(ctx, "#756758", x, 1, 1, 63);
    }
    rect(ctx, "#554539", 3, 2, 52, 3);
    rect(ctx, "#554539", 3, 35, 52, 3);
    sprites["cell-" + name] = image;
  }
  for (const kind of ["torch","barrel","heal","ammo","relic","upgrade","scatter","musket","gate","closed","bolt","boss-bolt","spark","fern","palm","idol","stone-bolt","curse-bolt","coin","chest","chain-hook","coin-heap","rescue-lever"]) {
    sprites[kind] = prop(kind);
    if (kind === "torch" || kind === "gate") sprites[kind + "-lit"] = prop(kind, 2);
  }
  sprites["rescue-lever-on"] = prop("rescue-lever", 1);
  return sprites;
}

function enemyArt(enemy, time) {
  let pose = "idle";
  if (enemy.hp <= 0) pose = time - enemy.down < .22 ? "fall" : "down";
  else if (enemy.charge || enemy.leap) pose = "charge";
  else if (enemy.hurt > .07) pose = "hurt";
  else if (enemy.recover > .03) pose = "strike";
  else if (enemy.attack) pose = enemy.attack > enemy.attackSpan * .35 ? "wind" : "strike";
  else if (enemy.moving) pose = STANCES[2 + Math.floor(enemy.gait * 5.4) % 4];
  else if (Math.floor(time * 2.4 + enemy.phase) % 2) pose = "breathe";
  return enemy.kind + (shieldRaised(enemy) && enemy.hp > 0 ? "-shield-" : "-") + pose;
}

function sceneSprites(world, time) {
  const flick = Math.floor(time * 8) % 3 === 1;
  const shocked = world.arena.cleared || world.map.key === "port";
  const gate = shocked ? (flick ? "gate-lit" : "gate") : "closed";
  const propHeights = { torch: .63, palm: 1.66, idol: 1.04, fern: .51, "vendor-skills": 1.10,
    "vendor-arms": 1.28, "vendor-chests": .77, "stall-skills": 1.75, "stall-arms": 1.77, "stall-chests": 1.64 };
  const rescue = world.rescue;
  const prisoners = [];
  if (rescue && rescue.stage !== "saved") {
    const free = rescue.stage === "opened";
    const art = free ? "vendor-" + (rescue.person === "runa" ? "skills" : "arms") : "cell-" + rescue.person;
    prisoners.push({ ...rescue.cell, art, h: 1.15, lift: 0 });
    if (rescue.stage !== "cell") prisoners.push({ ...rescue.lever, art: free ? "rescue-lever-on" : "rescue-lever", h: .65, lift: 0 });
  }
  return [
    ...prisoners,
    ...world.props.map(p => ({ ...p, art: p.kind === "torch" && flick ? "torch-lit"
      : p.id && Math.floor(time * 2.4) % 2 ? p.kind + "-sway" : p.kind, h: propHeights[p.kind] ?? .52, lift: 0 })),
    ...world.items.map(p => ({ ...p, art: p.kind, h: p.kind === "coin" ? .29 : .39,
      lift: p.kind === "coin" || p.kind === "relic" || p.kind === "upgrade" ? .13 + Math.sin(world.time * 4) * .035 : 0 })),
    ...world.enemies.map(e => ({
      x: e.x, y: e.y, art: enemyArt(e, time),
      h: e.rescueGuard ? 1.27 : e.kingWard ? .92 : (({ captain: 1.16, king: 1.4, crab: .44, viper: .49, gorilla: 1.14, mask: .64,
        "rust-hook": 1.40, "vault-brute": 1.14 })[e.kind] ?? .93),
      lift: e.kind === "mask" && e.hp > 0 ? .24 + Math.sin(time * 5 + e.phase) * .044 : (e.lift ?? 0),
    })),
    ...world.bolts.map(b => ({ ...b, art: b.kind, h: b.pull || b.kind === "boss-bolt" ? .32 : .20, lift: .43 })),
    ...world.flashes.map(b => ({ ...b, art: "spark", h: .25, lift: .59 })),
    { ...world.gate, art: gate, h: 1.02, lift: 0 },
  ];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let viewWidth = 0, viewHeight = 0;
  let id, pixels, depth, vignette;
  let lastWorld, lastCamera;
  const palettes = panel => Array.from({ length: VAULT_MOSAIC + 1 }, (_, kind) => {
    const base = wallPixels(kind, panel);
    return Array.from({ length: 16 }, (_, i) => Uint32Array.from(base, c => shaded(c, .21 + i * .059)));
  });
  const palette = palettes(false), panelPalette = palettes(true);
  const sprites = spriteBook();
  const sky = islandSky();
  const drawViewModel = createViewModel(ctx);
  function resize(width, height) {
    if (!width || !height) return false;
    const ratio = width / height;
    const nextHeight = Math.max(1, Math.min(VIEW_H, Math.round(640 / ratio)));
    const nextWidth = Math.max(1, Math.min(640, Math.round(nextHeight * ratio)));
    if (viewWidth === nextWidth && viewHeight === nextHeight) return false;
    canvas.width = viewWidth = nextWidth;
    canvas.height = viewHeight = nextHeight;
    id = ctx.createImageData(viewWidth, viewHeight);
    pixels = new Uint32Array(id.data.buffer);
    depth = new Float32Array(viewWidth);
    vignette = ctx.createRadialGradient(viewWidth / 2, viewHeight * .44, Math.min(44, viewWidth * .19),
      viewWidth / 2, viewHeight * .44, Math.max(viewWidth * .66, viewHeight * .42));
    vignette.addColorStop(0, "#05090b00");
    vignette.addColorStop(.78, "#020a1070");
    vignette.addColorStop(1, "#020810de");
    ctx.imageSmoothingEnabled = false;
    return true;
  }

  function draw(world, camera = world.player) {
    lastWorld = world;
    lastCamera = camera;
    const p = camera;
    const ux = Math.cos(p.angle), uy = Math.sin(p.angle);
    // Keep the default projection in landscape and a playable horizontal field of view in portrait.
    const focalHeight = Math.min(viewHeight, viewWidth * 1.05);
    const plane = SCALE * viewWidth * VIEW_H / (VIEW_W * focalHeight);
    const vx = -uy * plane, vy = ux * plane;
    const horizon = Math.floor((viewHeight + focalHeight * p.pitch) / 2 + Math.sin(p.bob) * p.moving * 2.6);
    const rowLimit = Math.max(horizon + 1, viewHeight - horizon);
    const island = world.map.key === "island";
    const vault = world.map.key === "vault";
    const port = world.map.key === "port";
    const outdoor = island || port;
    const width = world.width;
    const skyAzimuth = Math.floor(p.angle / (Math.PI * 2) * SKY_W);
    const sampleFloor = (fx, fy) => Math.floor(fy) * width + Math.floor(fx);
    const floorPalette = [vault ? VAULT_WALL : 5, 7, 3, 5, vault ? VAULT_MOSAIC : island ? ISLAND_TERRAIN.shrine : 9,
      ISLAND_TERRAIN.sand, ISLAND_TERRAIN.jungle, ISLAND_TERRAIN.basalt];
    const powder = new Map();
    for (const hazard of world.hazards) {
      const minX = Math.floor(hazard.x - hazard.radius);
      const maxX = Math.floor(hazard.x + hazard.radius);
      const minY = Math.floor(hazard.y - hazard.radius);
      const maxY = Math.floor(hazard.y + hazard.radius);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const tile = y * width + x;
        if (tileAt(world, x, y)) continue;
        const bucket = powder.get(tile) ?? [];
        bucket.push(hazard);
        powder.set(tile, bucket);
      }
    }

    pixels.fill(island ? rgb(105, 133, 106) : rgb(43, 51, 57));
    for (let row = 1; row <= rowLimit; row++) {
      const distance = focalHeight * .49 / row;
      const dx = 2 * vx * distance / viewWidth;
      const dy = 2 * vy * distance / viewWidth;
      let fx = p.x + (ux - vx) * distance;
      let fy = p.y + (uy - vy) * distance;
      const light = clamp(Math.round(14.8 / (1 + distance * .195)), 1, 15);
      const floorY = horizon + row;
      const roofY = horizon - row;
      const skyRow = Math.max(0, SKY_H - row - 1) * SKY_W;
      for (let x = 0; x < viewWidth; x++, fx += dx, fy += dy) {
        const tx = Math.floor(fx * T) & (T - 1);
        const ty = Math.floor(fy * T) & (T - 1);
        if (floorY >= 0 && floorY < viewHeight) {
          const index = sampleFloor(fx, fy);
          const tile = world.floor[index];
          let color = palette[floorPalette[tile] ?? floorPalette[island ? 6 : 0]][Math.min(15, light + (vault ? 4 : outdoor ? 2 : 0))][ty * T + tx];
          const stains = world.blood.size && world.blood.get(index);
          if (stains) for (const mark of stains) {
            const radius = mark.radius * Math.min(1, .30 + (world.time - mark.time) * 2.6);
            if ((fx - mark.x) ** 2 + (fy - mark.y) ** 2 < (radius * (.81 + (tx + ty * 3) % 5 * .06)) ** 2) {
              color = rgb(44 + light * 3, 10 + light, 16 + light);
              break;
            }
          }
          const circles = powder.size && powder.get(index);
          if (circles) for (const hazard of circles) {
            const radius = hazard.radius;
            const d = (hazard.x - fx) ** 2 + (hazard.y - fy) ** 2;
            if (d >= radius * radius) continue;
            if (hazard.tone === "fault") {
              if (hazard.burst) color = rgb(133, 200, 176);
              else if (d >= (radius - .16) ** 2 || (tx * 2 + ty) % 9 < 3) color = rgb(100, 157, 139);
            } else if (hazard.tone === "root") {
              if (hazard.burst) color = d > radius * .80 ? rgb(211, 206, 116) : rgb(116, 134, 56);
              else if (d >= (radius - .11) ** 2) color = rgb(203, 211, 108);
              else if ((tx + ty) % 6 < 2) color = rgb(129, 144, 69);
            } else if (hazard.burst) color = d > radius * .80 ? rgb(243, 152, 96) : rgb(166, 58, 52);
            else if (d >= (radius - .11) ** 2) color = rgb(228, 110, 68);
            else if ((tx + ty) % 6 < 2) color = rgb(150, 65, 48);
          }
          pixels[floorY * viewWidth + x] = color;
        }
        if (roofY >= 0 && roofY < viewHeight) {
          if (outdoor) {
            pixels[roofY * viewWidth + x] = sky[skyRow + ((skyAzimuth + (x >> 1)) & (SKY_W - 1))];
          } else pixels[roofY * viewWidth + x] = palette[vault ? VAULT_WALL : 6][Math.max(0, light - (vault ? 3 : 4))][ty * T + tx];
        }
      }
    }

    for (let x = 0; x < viewWidth; x++) {
      const cam = x / viewWidth * 2 - 1;
      const hit = cast(world, p.x, p.y, ux + vx * cam, uy + vy * cam);
      const distance = Math.max(.04, hit.distance);
      depth[x] = distance;
      const tall = focalHeight / distance;
      const top = horizon - tall / 2;
      const bottom = Math.min(viewHeight, Math.ceil(top + tall));
      const shade = clamp(Math.round(15.2 / (1 + distance * .167)) - hit.side * 2 + (vault ? 4 : island ? 3 : 0), 0, 15);
      const slab = hit.wall === SECRET_PANEL
        ? panelPalette[world.secretWalls[hit.y * width + hit.x] || 1][shade]
        : palette[hit.wall || 1][shade];
      const column = Math.min(T - 1, Math.max(0, Math.floor(hit.u * T)));
      for (let y = Math.max(0, Math.floor(top)); y < bottom; y++) {
        const tex = clamp(Math.floor((y - top) * T / tall), 0, T - 1) * T + column;
        pixels[y * viewWidth + x] = slab[tex];
      }
    }
    ctx.putImageData(id, 0, 0);

    const view = sceneSprites(world, camera.time ?? world.time).map(s => ({ ...s,
      z: (s.x - p.x) * ux + (s.y - p.y) * uy,
      q: -(s.x - p.x) * uy + (s.y - p.y) * ux,
    })).filter(s => s.z > .15 && s.z < 23).sort((a, b) => b.z - a.z);

    for (const s of view) {
      const image = sprites[s.art];
      const height = focalHeight * s.h / s.z;
      const width = height * image.width / image.height;
      const center = viewWidth * .5 * (1 + s.q / (plane * s.z));
      const left = center - width / 2;
      const top = horizon + focalHeight * (.51 - s.h - s.lift) / s.z;
      if (left > viewWidth || left + width < 0) continue;
      ctx.globalAlpha = clamp(1.10 - s.z * .053, .23, 1);
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(viewWidth, Math.ceil(left + width)); x++) {
        if (depth[x] <= s.z) continue;
        const u = clamp(Math.floor((x - left) * image.width / width), 0, image.width - 1);
        ctx.drawImage(image, u, 0, 1, image.height, x, Math.round(top), 1, Math.ceil(height));
      }
      if ((s.art === "torch" || s.art === "torch-lit") && depth[clamp(Math.round(center), 0, viewWidth - 1)] > s.z) {
        ctx.globalAlpha = .68;
        const glow = ctx.createRadialGradient(center, top + height * .25, 0, center, top + height * .25, Math.max(1, height * .67));
        glow.addColorStop(0, "#ef984b58");
        glow.addColorStop(1, "#e28a4b00");
        rect(ctx, glow, center - height, top - height / 2, height * 2, height * 1.6);
      }
    }
    ctx.globalAlpha = 1;
    if (vault) ctx.globalAlpha = .55;
    rect(ctx, vignette, 0, 0, viewWidth, viewHeight);
    ctx.globalAlpha = 1;
    if (camera !== world.player) return;
    if (!port) drawViewModel(p, world.time, viewWidth, viewHeight);
    if (p.hurt) rect(ctx, "rgba(179,46,35," + Math.min(.31, p.hurt * .8) + ")", 0, 0, viewWidth, viewHeight);
    if (p.dash) rect(ctx, "rgba(95,181,175," + (p.dash * .36) + ")", 0, 0, viewWidth, viewHeight);
  }

  resize(canvas.clientWidth || VIEW_W, canvas.clientHeight || VIEW_H);
  const observer = new ResizeObserver(([{ contentRect }]) => {
    if (resize(contentRect.width, contentRect.height) && lastWorld) draw(lastWorld, lastCamera);
  });
  observer.observe(canvas);
  return draw;
}

export function mapDraw(canvas, world) {
  const { width, height } = world;
  const scale = Math.min(8, Math.floor(3800 / width));
  const left = 16, top = 16;
  canvas.width = width * scale + 2 * left;
  canvas.height = height * scale + 2 * top;
  const ctx = canvas.getContext("2d");
  const cell = (color, x, y) => rect(ctx, color, left + x * scale, top + y * scale, scale, scale);
  const ink = (x, y) => !tileAt(world, x, y) && discovered(world, x, y);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (!ink(x, y)) continue;
    const style = world.floor[y * width + x];
    cell(style === 4 ? "#88563b82" : style >= 5 ? "#65764d8f" : "#90694775", x, y);
    const px = left + x * scale, py = top + y * scale;
    if (!ink(x - 1, y)) rect(ctx, "#624025", px, py, 1, scale);
    if (!ink(x + 1, y)) rect(ctx, "#624025", px + scale - 1, py, 1, scale);
    if (!ink(x, y - 1)) rect(ctx, "#624025", px, py, scale, 1);
    if (!ink(x, y + 1)) rect(ctx, "#624025", px, py + scale - 1, scale, 1);
  }
  const seals = world.seals.filter(seal => seal.wing >= world.player.relics
    && [[-1, -.5], [1, -.5], [-1, .5], [1, .5]].some(([dx, dy]) => discovered(world, seal.x + dx, seal.y + dy)));
  for (const point of seals) {
    rect(ctx, "#8e4534", left + point.x * scale - 1, top + point.y * scale - scale, 3, scale * 2);
  }
  for (const secret of world.secrets) {
    if (!secret.open || !discovered(world, secret.x, secret.y)) continue;
    const x = left + secret.x * scale;
    const y = top + secret.y * scale;
    poly(ctx, "#354e78", [[x, y - 5], [x + 2, y - 2], [x + 5, y], [x + 2, y + 2],
      [x, y + 5], [x - 2, y + 2], [x - 5, y], [x - 2, y - 2]]);
  }
  for (const item of world.items) {
    if (!discovered(world, item.x, item.y)) continue;
    const x = left + item.x * scale, y = top + item.y * scale;
    if (item.kind === "relic") poly(ctx, "#1d685b", [[x, y - 5], [x + 4, y], [x, y + 5], [x - 4, y]]);
    else if (item.kind === "upgrade") rect(ctx, "#234d81", x - 1, y - 1, 3, 3);
    else rect(ctx, item.kind === "heal" ? "#9c4032" : "#8d5e21", x - 1, y - 1, 3, 3);
  }
  if (discovered(world, world.gate.x, world.gate.y)) {
    cell(world.arena.cleared || world.map.key === "port" ? "#216957" : "#8e4534", Math.floor(world.gate.x), Math.floor(world.gate.y));
  }
  for (const trader of world.merchants ?? []) {
    if (discovered(world, trader.x, trader.y)) cell("#92622b", Math.floor(trader.x), Math.floor(trader.y));
  }
  if (world.rescue && world.rescue.stage !== "saved") {
    const { cell: prison, lever, stage, seen } = world.rescue;
    if (seen || discovered(world, prison.x, prison.y)) cell("#406b8d", Math.floor(prison.x), Math.floor(prison.y));
    if (stage === "key") cell("#7a5d9d", Math.floor(lever.x), Math.floor(lever.y));
  }
  const p = world.player;
  const x = left + p.x * scale, y = top + p.y * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  poly(ctx, "#e5cf9d", [[12, 0], [-6, -6], [-3, 0], [-6, 6]]);
  poly(ctx, "#3c2723", [[9, 0], [-4, -4], [-1, 0], [-4, 4]]);
  ctx.restore();
  return { x, y };
}
