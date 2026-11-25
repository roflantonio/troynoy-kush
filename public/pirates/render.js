import { HEIGHT, SECRET_PANEL, WIDTH, cast, discovered, seeded, shieldRaised, tileAt } from "./world.js?v=6";

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
    } else if (kind === SECRET_PANEL) {
      const grain = 5 * Math.sin(x * 2 + y / 4);
      color = x % 6 === 0 ? [29, 29, 34] : [64 + grain, 53 + grain, 48 + grain];
      if (y === 3 || y === 28) color = [102, 78, 53];
      const rose = Math.abs(x - 15.5) + Math.abs(y - 15.5);
      if (rose >= 5 && rose < 7) color = [190, 136, 76];
      if (rose < 4 && (x === 15 || y === 15)) color = [153, 108, 66];
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
  const leader = kind === "captain";
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
  const shooter = kind === "corsair";
  const sentinel = kind === "sentinel";
  const coat = leader ? "#983e38" : shooter ? "#84472d" : sentinel ? "#556653" : "#23767b";
  const shade = leader ? "#542d31" : shooter ? "#58362b" : sentinel ? "#363b33" : "#194049";
  const rim = leader ? "#ffc885" : shooter ? "#e4a567" : sentinel ? "#b8ae72" : "#5cc1b0";
  const bone = flare ? "#fff3ae" : "#e5dcb1";
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
    poly(c, "#6e4439", [[3,25],[7,22],[22,16],[27,16],[27,19],[15,25],[8,30],[4,30]]);
    poly(c, "#cba987", [[10,22],[20,17],[28,15],[30,16],[28,19],[16,24]]);
    rect(c, "#f3bb75", 8, 24, 8, 3);
  } else if (kind === "musket") {
    poly(c, "#633c2b", [[1,27],[4,23],[15,20],[30,12],[31,15],[16,23],[7,30],[2,31]]);
    poly(c, "#adc4b7", [[8,23],[16,18],[30,11],[31,13],[16,21]]);
    rect(c, "#f6c475", 14, 19, 4, 3);
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

// Separate profiles, grip positions and muzzle anchors keep each weapon legible in silhouette.
function arm(kind) {
  const [image, c] = pixelCanvas(160, 94);
  let muzzle;
  if (kind === "blade") {
    poly(c, "#263234", [[111,94],[101,72],[105,65],[114,65],[114,61],[103,56],[101,48],[112,49],[124,58],[133,46],[140,29],[144,6],[151,13],[153,29],[149,45],[139,60],[136,74],[141,94]]);
    poly(c, "#a7b5a4", [[125,59],[134,46],[142,28],[145,9],[150,16],[151,29],[147,44],[137,59],[134,65]]);
    poly(c, "#ecf4d6", [[147,14],[149,20],[149,32],[145,44],[138,56],[132,61],[143,42]]);
    poly(c, "#b5894d", [[104,50],[115,50],[127,60],[138,64],[137,69],[130,72],[115,61],[108,58]]);
    poly(c, "#855449", [[110,94],[104,76],[110,66],[121,65],[132,72],[137,82],[140,94]]);
    poly(c, "#cf996f", [[109,75],[113,68],[121,67],[131,73],[131,78],[118,73],[111,81]]);
  } else if (kind === "scatter") {
    muzzle = [72, 27];
    poly(c, "#1a2022", [[32,94],[38,77],[48,63],[52,48],[43,37],[42,26],[52,15],[92,15],[103,25],[102,39],[91,48],[92,66],[111,75],[115,94]]);
    poly(c, "#73523b", [[45,94],[45,77],[57,63],[59,43],[83,42],[85,62],[103,78],[104,94]]);
    poly(c, "#a07747", [[50,41],[45,33],[46,25],[55,19],[90,19],[99,27],[98,36],[91,44],[83,48],[63,48]]);
    poly(c, "#e1d4a0", [[47,28],[54,21],[91,21],[97,28],[93,36],[87,39],[56,39],[49,34]]);
    poly(c, "#252a2a", [[53,28],[58,24],[88,24],[93,28],[89,34],[55,34]]);
    rect(c, "#f3c984", 56, 44, 32, 3);
    poly(c, "#9f6650", [[35,94],[42,80],[51,77],[55,69],[63,70],[73,80],[82,69],[92,65],[100,68],[108,80],[111,94]]);
    poly(c, "#dda879", [[42,84],[53,78],[59,72],[68,77],[67,83],[52,86],[45,92]]);
    poly(c, "#d69a6b", [[80,77],[87,70],[93,68],[101,72],[103,79],[96,77],[94,82],[84,83]]);
  } else if (kind === "musket") {
    muzzle = [81, 5];
    poly(c, "#232629", [[68,94],[54,80],[59,68],[64,59],[71,30],[75,15],[76,2],[86,2],[87,15],[85,28],[84,45],[89,63],[96,74],[113,83],[118,94]]);
    poly(c, "#824e34", [[64,76],[70,61],[75,37],[81,25],[83,39],[80,50],[85,63],[94,75],[111,86],[114,94],[96,94],[83,85]]);
    poly(c, "#657e83", [[67,62],[74,34],[77,14],[78,6],[85,6],[84,19],[81,41],[77,58],[73,67]]);
    poly(c, "#a6bcc0", [[72,57],[77,32],[80,11],[84,8],[81,30],[77,54]]);
    rect(c, "#d1bc92", 77, 3, 9, 4);
    rect(c, "#20292c", 79, 4, 5, 2);
    poly(c, "#d8a660", [[70,50],[73,48],[80,49],[79,53],[72,53]]);
    poly(c, "#b28160", [[38,94],[46,79],[57,74],[63,65],[71,62],[78,66],[76,71],[68,75],[77,75],[77,79],[68,83],[65,94]]);
    poly(c, "#e2aa79", [[50,81],[57,77],[63,72],[69,66],[75,66],[71,70],[62,79],[53,85]]);
    poly(c, "#a8704e", [[95,94],[87,87],[88,81],[98,81],[112,88],[117,94]]);
  } else {
    muzzle = [76, 34];
    poly(c, "#1d252b", [[61,94],[58,80],[61,69],[65,59],[62,51],[66,37],[70,31],[83,30],[89,38],[87,50],[90,59],[93,71],[109,87],[112,94]]);
    poly(c, "#825239", [[64,88],[64,75],[70,62],[68,51],[72,44],[82,44],[85,57],[87,68],[100,85],[99,94],[78,94]]);
    poly(c, "#627c80", [[64,52],[66,42],[68,37],[71,33],[83,33],[87,39],[86,47],[80,54],[70,57]]);
    poly(c, "#b2ccbd", [[68,45],[70,38],[72,34],[81,34],[84,39],[81,46],[73,49]]);
    rect(c, "#27383b", 72, 34, 8, 4);
    poly(c, "#b58a55", [[82,57],[91,47],[94,49],[92,58],[85,63]]);
    poly(c, "#927362", [[76,94],[67,81],[70,71],[77,66],[87,66],[93,73],[102,79],[112,85],[114,94]]);
    poly(c, "#d49b72", [[71,78],[78,69],[86,69],[92,76],[85,75],[79,79],[77,87]]);
  }
  return { image, muzzle };
}

function spriteBook() {
  const sprites = {};
  for (const kind of ["drowned", "corsair", "captain", "sentinel", "crab"]) {
    for (const pose of STANCES) {
      sprites[kind + "-" + pose] = kind === "crab" ? crabSprite(pose) : sailor(kind, pose);
      if (kind === "sentinel") sprites[kind + "-shield-" + pose] = sailor(kind, pose, true);
    }
  }
  sprites["captain-charge"] = sailor("captain", "charge");
  for (const kind of ["torch","barrel","heal","ammo","relic","upgrade","scatter","musket","gate","closed","bolt","boss-bolt","spark"]) {
    sprites[kind] = prop(kind);
    if (kind === "torch" || kind === "gate") sprites[kind + "-lit"] = prop(kind, 2);
  }
  return sprites;
}

function enemyArt(enemy, time) {
  let pose = "idle";
  if (enemy.hp <= 0) pose = time - enemy.down < .22 ? "fall" : "down";
  else if (enemy.charge) pose = "charge";
  else if (enemy.hurt > .07) pose = "hurt";
  else if (enemy.recover > .03) pose = "strike";
  else if (enemy.attack) pose = enemy.attack > enemy.attackSpan * .35 ? "wind" : "strike";
  else if (enemy.moving) pose = STANCES[2 + Math.floor(enemy.gait * 5.4) % 4];
  else if (Math.floor(time * 2.4 + enemy.phase) % 2) pose = "breathe";
  return enemy.kind + (shieldRaised(enemy) && enemy.hp > 0 ? "-shield-" : "-") + pose;
}

function sceneSprites(world, time) {
  const flick = Math.floor(time * 8) % 3 === 1;
  const shocked = world.arena.cleared;
  const gate = shocked ? (flick ? "gate-lit" : "gate") : "closed";
  return [
    ...world.props.map(p => ({ ...p, art: p.kind === "torch" && flick ? "torch-lit" : p.kind, h: p.kind === "torch" ? .63 : .52, lift: 0 })),
    ...world.items.map(p => ({ ...p, art: p.kind, h: .39,
      lift: p.kind === "relic" || p.kind === "upgrade" ? .13 + Math.sin(world.time * 4) * .035 : 0 })),
    ...world.enemies.map(e => ({
      x: e.x, y: e.y, art: enemyArt(e, time),
      h: e.kind === "captain" ? 1.16 : e.kind === "crab" ? .44 : .93, lift: 0,
    })),
    ...world.bolts.map(b => ({ ...b, art: b.kind, h: b.kind === "boss-bolt" ? .30 : .20, lift: .43 })),
    ...world.flashes.map(b => ({ ...b, art: "spark", h: .25, lift: .59 })),
    { ...world.gate, art: gate, h: 1.02, lift: 0 },
  ];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const id = ctx.createImageData(VIEW_W, VIEW_H);
  const pixels = new Uint32Array(id.data.buffer);
  const depth = new Float32Array(VIEW_W);
  const palette = Array.from({ length: SECRET_PANEL + 1 }, (_, kind) => {
    const base = wallPixels(kind);
    return Array.from({ length: 16 }, (_, i) => Uint32Array.from(base, c => shaded(c, .21 + i * .059)));
  });
  const sprites = spriteBook();
  const arms = Object.fromEntries(["pistol","scatter","blade","musket"].map(kind => [kind, arm(kind)]));
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * .44, 44, VIEW_W / 2, VIEW_H * .44, VIEW_W * .66);
  vignette.addColorStop(0, "#05090b00");
  vignette.addColorStop(.78, "#020a1070");
  vignette.addColorStop(1, "#020810de");
  ctx.imageSmoothingEnabled = false;

  return (world, camera = world.player) => {
    const p = camera;
    const ux = Math.cos(p.angle), uy = Math.sin(p.angle);
    const vx = -uy * SCALE, vy = ux * SCALE;
    const horizon = Math.floor(VIEW_H * (1 + p.pitch) / 2 + Math.sin(p.bob) * p.moving * 2.6);
    const rowLimit = Math.max(horizon + 1, VIEW_H - horizon);
    const sampleFloor = (fx, fy) => Math.floor(fy) * WIDTH + Math.floor(fx);
    const powder = new Map();
    for (const hazard of world.hazards) {
      const minX = Math.floor(hazard.x - hazard.radius);
      const maxX = Math.floor(hazard.x + hazard.radius);
      const minY = Math.floor(hazard.y - hazard.radius);
      const maxY = Math.floor(hazard.y + hazard.radius);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const tile = y * WIDTH + x;
        if (world.floor[tile] !== 4) continue;
        const bucket = powder.get(tile) ?? [];
        bucket.push(hazard);
        powder.set(tile, bucket);
      }
    }

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
        if (floorY >= 0 && floorY < VIEW_H) {
          const index = sampleFloor(fx, fy);
          const tile = world.floor[index];
          let color = palette[tile === 1 ? 7 : tile === 2 ? 3 : tile === 4 ? 9 : 5][light][ty * T + tx];
          const circles = powder.size && tile === 4 ? powder.get(index) : null;
          if (circles) for (const hazard of circles) {
            const radius = hazard.radius;
            const d = (hazard.x - fx) ** 2 + (hazard.y - fy) ** 2;
            if (d >= radius * radius) continue;
            if (hazard.burst) color = d > radius * .80 ? rgb(243, 152, 96) : rgb(166, 58, 52);
            else if (d >= (radius - .11) ** 2) color = rgb(228, 110, 68);
            else if ((tx + ty) % 6 < 2) color = rgb(150, 65, 48);
          }
          pixels[floorY * VIEW_W + x] = color;
        }
        if (roofY >= 0 && roofY < VIEW_H) pixels[roofY * VIEW_W + x] = palette[6][Math.max(0, light - 4)][ty * T + tx];
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

    const view = sceneSprites(world, camera.time ?? world.time).map(s => ({ ...s,
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
    if (camera !== world.player) return;
    const { image, muzzle } = arms[p.weapon];
    const flash = muzzle && p.recoil > (p.weapon === "pistol" ? .14 : .235);
    const slash = p.weapon === "blade" ? Math.sin(p.recoil * Math.PI / .195) : 0;
    const handX = VIEW_W / 2 - 79 + Math.sin(p.bob * .61) * p.moving * 6 - slash * 57;
    const reload = p.reloadLeft ? Math.sin(Math.PI * p.reloadLeft / p.reloadSpan) : 0;
    const handY = VIEW_H - 93 + Math.abs(Math.sin(p.bob)) * p.moving * 4 + p.recoil * 40 + p.dash * 26 + reload * 57;
    if (flash) {
      const cx = handX + muzzle[0];
      const cy = handY + muzzle[1];
      poly(ctx, "#ffd47c", [[cx-26,cy-10],[cx-10,cy-12],[cx-9,cy-30],[cx,cy-18],[cx+12,cy-29],[cx+12,cy-12],[cx+28,cy-7],[cx+13,cy+5],[cx,cy+14],[cx-13,cy+5]]);
      poly(ctx, "#fff5bf", [[cx-13,cy-5],[cx-2,cy-19],[cx+8,cy-10],[cx+16,cy-4],[cx,cy+4]]);
    }
    if (reload > .20) {
      const hand = reload * 19;
      poly(ctx, "#835f47", [[123,244],[130,226+hand],[146,211+hand],[158,211+hand],[160,219+hand],[148,230+hand],[146,244]]);
      poly(ctx, "#dba474", [[134,226+hand],[147,213+hand],[156,213+hand],[155,219+hand],[145,225+hand],[140,232+hand]]);
      rect(ctx, "#e2bc70", 150, 207 + hand, 15, 4);
      rect(ctx, "#9d4e40", 159, 207 + hand, 6, 4);
    }
    ctx.drawImage(image, Math.round(handX), Math.round(handY));
    if (p.hurt) rect(ctx, "rgba(179,46,35," + Math.min(.31, p.hurt * .8) + ")", 0, 0, VIEW_W, VIEW_H);
    if (p.dash) rect(ctx, "rgba(95,181,175," + (p.dash * .36) + ")", 0, 0, VIEW_W, VIEW_H);
  };
}

export function mapDraw(canvas, world) {
  const ctx = canvas.getContext("2d");
  const scale = Math.floor(Math.min((canvas.width - 28) / WIDTH, (canvas.height - 28) / HEIGHT));
  const left = Math.floor((canvas.width - WIDTH * scale) / 2);
  const top = Math.floor((canvas.height - HEIGHT * scale) / 2);
  const shade = ctx.createRadialGradient(canvas.width * .5, canvas.height * .42, 10, canvas.width * .5, canvas.height * .5, canvas.width * .61);
  shade.addColorStop(0, "#efdbad");
  shade.addColorStop(.80, "#d4b078");
  shade.addColorStop(1, "#a77c4c");
  rect(ctx, shade, 0, 0, canvas.width, canvas.height);
  const rand = seeded(20572);
  for (let i = 0; i < 1900; i++) rect(ctx, i % 2 ? "#71472327" : "#fff7cc50",
    rand() * canvas.width, rand() * canvas.height, 1 + rand() * 4, 1);

  const cell = (color, x, y, inset = 0) => rect(ctx, color, left + x * scale + inset, top + y * scale + inset, scale - inset * 2, scale - inset * 2);
  const ink = (x, y) => !tileAt(world, x, y) && discovered(world, x, y);
  ctx.strokeStyle = "#794e2a8c";
  ctx.lineWidth = 1;
  ctx.strokeRect(8.5, 8.5, canvas.width - 17, canvas.height - 17);
  for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
    if (!ink(x, y)) continue;
    cell(world.floor[y * WIDTH + x] === 4 ? "#a079645e" : "#9e74504b", x, y);
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
    cell(world.arena.cleared ? "#216957" : "#8e4534", Math.floor(world.gate.x), Math.floor(world.gate.y), 0);
  }
  const p = world.player;
  const x = left + p.x * scale, y = top + p.y * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  poly(ctx, "#e5cf9d", [[12, 0], [-6, -6], [-3, 0], [-6, 6]]);
  poly(ctx, "#3c2723", [[9, 0], [-4, -4], [-1, 0], [-4, 4]]);
  ctx.restore();
  return x / canvas.width;
}
