import { SEA_WIDTH as W, SEA_HEIGHT as H, broadsideTarget } from "./sea.js?v=13";

const box = (c, color, x, y, w, h) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
function shape(c, color, points) {
  c.fillStyle = color;
  c.beginPath();
  for (const [i, [x, y]] of points.entries()) c[i ? "lineTo" : "moveTo"](x, y);
  c.closePath();
  c.fill();
}

function ocean(ctx, time, storm) {
  box(ctx, storm ? "#0f1722" : "#263544", 0, 0, W, 54);
  box(ctx, storm ? "#182732" : "#675b55", 0, 24, W, 24);
  box(ctx, storm ? "#223844" : "#af8262", 0, 43, W, 11);
  shape(ctx, storm ? "#426270" : "#e9bc84", [[306,44],[306,39],[311,33],[323,33],[328,39],[328,45]]);
  for (let i = 0; i < 19; i++) {
    const x = (i * 59 + Math.floor(time * .8)) % (W + 88) - 45;
    const y = 11 + i * 17 % 34;
    box(ctx, storm ? "#222e3b" : "#3c454c", x, y, 24 + i % 7 * 6, 2 + i % 3);
    box(ctx, storm ? "#192833" : "#525350", x - 15, y + 4, 37 + i % 8 * 7, 2);
  }
  const palette = storm ? ["#304e5b","#284551","#213843","#1b303c","#172a35","#132530"]
    : ["#43676c","#365b62","#2d5058","#264651","#1c3b47","#173540"];
  for (const [i, color] of palette.entries()) {
    const y = 53 + i * 12 + i * i * 3;
    box(ctx, color, 0, y, W, H - y);
  }
  for (let i = 0; i < 150; i++) {
    const advance = (time * (storm ? .24 : .16) + i * .618) % 1;
    const y = 54 + Math.floor(advance ** 1.7 * 190);
    const x = (i * 71 + Math.floor(time * (2 + i % 6))) % (W + 32) - 16;
    const len = Math.round(2 + advance * (9 + i % 7 * 5));
    const colors = storm ? ["#45636b","#243f50","#3b5965","#162d3a"] : ["#53767a","#31555d","#567d7e","#20414c"];
    box(ctx, colors[i % 4], x, y, len, advance > .89 ? 2 : 1);
  }
  box(ctx, storm ? "#3d545c" : "#c09b75", 0, 53, W, 1);
}

function vessel(c, x, y, time, { player = false, tier = 0, sunk = 0 } = {}) {
  const scale = player ? 1 : .44 + y / 470 + tier * .095;
  c.save();
  c.translate(Math.round(x), Math.round(y + Math.sin(time * 3 + x) * 1.5 + sunk * 17));
  c.scale(scale, scale * (1 - Math.min(.65, sunk * .50)));
  c.globalAlpha = Math.max(.08, 1 - sunk * .75);
  const trim = player ? "#d4ab71" : "#a28864";
  const sail = player ? "#ded2ac" : ["#806067","#8f5250","#756276"][tier];
  const darkSail = player ? "#ac9d80" : "#563940";
  shape(c, "#4e747b", [[-13,3],[-20,21],[-16,25],[-22,46],[-10,39],[2,46],[18,39],[12,20],[13,3]]);
  shape(c, "#24343b", [[0,-29],[10,-19],[17,-2],[17,20],[10,33],[-9,34],[-17,21],[-17,-2],[-11,-19]]);
  shape(c, "#604134", [[0,-27],[10,-16],[14,0],[14,17],[8,28],[-8,28],[-14,18],[-14,-1],[-10,-17]]);
  shape(c, "#a17753", [[0,-24],[9,-14],[12,2],[12,17],[6,25],[-7,25],[-12,17],[-12,1],[-8,-14]]);
  for (let j = -8; j <= 8; j += 4) box(c, "#745139", j, -6 - (j === 0 ? 10 : 0), 1, 28);
  shape(c, "#403036", [[-10,21],[10,21],[8,29],[-8,29]]);
  box(c, trim, -10, 17, 20, 2);
  box(c, trim, -6, 26, 12, 2);
  for (const [sx, sy] of [[-10,1],[7,1],[-10,11],[7,11]]) {
    box(c, "#362d33", sx, sy, 4, 4);
    box(c, "#869393", sx + 1, sy, 2, 2);
  }
  shape(c, darkSail, [[-9,-12],[9,-12],[12,2],[5,6],[-8,5],[-13,1]]);
  shape(c, sail, [[-10,-13],[8,-13],[8,-7],[10,0],[5,3],[-6,4],[-11,1]]);
  shape(c, darkSail, [[-8,-27],[8,-27],[11,-17],[7,-13],[-7,-14],[-11,-17]]);
  shape(c, sail, [[-7,-28],[7,-28],[8,-20],[5,-16],[-6,-16],[-9,-18]]);
  box(c, "#4b3430", -1, -36, 2, 22);
  shape(c, player ? "#6eb4ab" : "#b75852", [[0,-36],[7,-35],[12,-32],[6,-31],[0,-32]]);
  if (tier === 2) {
    box(c, "#dcb7ac", -4, -9, 8, 2);
    box(c, "#dcb7ac", -1, -12, 2, 9);
  }
  c.restore();
}

function tentacle(c, x, y, flip, height, time) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(flip, height);
  const curl = Math.round(Math.sin(time * 2.1 + x) * 4);
  shape(c, "#242835", [[-19,5],[-24,-11],[-17,-35],[-10,-55],[-15+curl,-67],
    [-8+curl,-72],[3+curl,-67],[6,-52],[1,-27],[9,4]]);
  shape(c, "#766272", [[-16,4],[-19,-11],[-13,-30],[-7,-48],[-7,-57],[-11+curl,-64],
    [-7+curl,-67],[-1+curl,-64],[3,-52],[-2,-31],[3,2]]);
  shape(c, "#473d50", [[-11,3],[-14,-12],[-9,-33],[-5,-48],[-5,-60],[1,-55],[2,-49],[-2,-27],[3,3]]);
  shape(c, "#8a737c", [[-17,-17],[-13,-31],[-8,-44],[-10,-30],[-13,-17],[-14,-8]]);
  for (let i=0;i<5;i++) {
    const px = -9 - i * 2, py = -53 + i * 10;
    box(c, "#ac7f87", px, py, 5 + i % 2, 4);
    box(c, "#574151", px + 1, py + 1, 3, 2);
    box(c, "#cf9d97", px + 1, py, 2, 1);
  }
  c.restore();
}

function monster(c, x, y, scale, rise, time, rage) {
  const surface = 10;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(scale, scale);
  c.beginPath();
  c.rect(-118, -115, 236, 115 + surface);
  c.clip();
  c.translate(0, Math.round((1 - rise) * 62));
  tentacle(c, -48, 14, 1, 1.0, time);
  tentacle(c, 48, 14, -1, .84, time);
  tentacle(c, -71, 13, -1, .62, time);
  tentacle(c, 74, 16, 1, .52, time);
  shape(c, "#272734", [[-39,15],[-36,-10],[-25,-40],[-14,-52],[10,-55],[29,-47],[38,-30],[41,-10],[39,15]]);
  shape(c, rage ? "#824d63" : "#625569", [[-32,15],[-31,-12],[-22,-38],[-12,-48],[11,-51],
    [27,-44],[34,-28],[35,-4],[31,15]]);
  shape(c, rage ? "#674456" : "#51475b", [[-32,12],[-30,-18],[-21,-36],[-18,-32],[-26,-14],[-19,3],[-15,16]]);
  shape(c, rage ? "#895d70" : "#726575", [[-20,-38],[-11,-46],[7,-49],[21,-44],[25,-37],
    [11,-39],[4,-34],[-4,-38],[-13,-34]]);
  shape(c, "#544154", [[16,-37],[26,-40],[34,-28],[34,-9],[28,-12],[25,-27]]);
  shape(c, "#694756", [[-18,-32],[-11,-34],[-4,-31],[5,-32],[12,-35],[20,-30],[12,-29],[5,-26],[-5,-28],[-11,-27]]);
  for (const [dx, dy, length] of [[-15,-40,5],[-8,-44,6],[3,-43,4],[12,-44,5],[-23,-28,4],[-25,-23,3],
    [20,-35,4],[25,-33,3],[-11,-32,5],[-4,-29,3],[7,-30,4]]) {
    box(c, "#a17d84", dx, dy, length, 1);
  }
  shape(c, "#3c394b", [[-28,10],[-26,-8],[-17,-19],[0,-11],[16,-23],[30,-17],[35,-3],[30,12],[10,20],[-14,17]]);
  shape(c, "#34303d", [[-23,-15],[-14,-21],[-4,-18],[-2,-11],[-16,-8],[-22,-10]]);
  shape(c, "#34303d", [[7,-14],[16,-23],[28,-21],[30,-13],[21,-9],[10,-9]]);
  shape(c, "#ffc17d", [[-20,-14],[-13,-18],[-7,-16],[-7,-12],[-16,-10]]);
  shape(c, "#ffc17d", [[13,-15],[19,-20],[26,-19],[26,-15],[21,-12],[14,-12]]);
  box(c, "#492a3f", -12, -17, 2, 6);
  box(c, "#492a3f", 20, -19, 2, 6);
  shape(c, "#272334", [[-9,4],[-4,-5],[3,-7],[11,-3],[15,6],[9,12],[-6,12]]);
  shape(c, "#975d65", [[-9,4],[-4,-5],[3,-7],[8,-4],[5,-1],[-1,0],[-6,5]]);
  shape(c, "#514050", [[-4,4],[2,2],[8,4],[10,8],[1,10],[-5,8]]);
  box(c, "#c89b70", -4, 3, 2, 3);
  box(c, "#a5796f", 7, 4, 2, 2);
  box(c, "#98838b", -15, -38, 11, 2);
  box(c, "#9f7784", -19, -31, 9, 2);
  c.restore();
  for (let i = 0; i < 16; i++) {
    const dx = (i * 11 + Math.floor(time * (7 + i % 4))) % 162 - 81;
    box(c, i % 3 ? "#739396" : "#4b727b", x + dx * scale, y + (5 + i * 7 % 11) * scale, 3 + i % 4 * 3, 1);
  }
}

function ring(c, color, x, y, w, h) {
  box(c, color, x - w, y - h, 5, 1);
  box(c, color, x + w - 4, y - h, 5, 1);
  box(c, color, x - w, y + h, 5, 1);
  box(c, color, x + w - 4, y + h, 5, 1);
  for (const side of [-1,1]) {
    box(c, color, x + w * side, y - h, 1, 4);
    box(c, color, x + w * side, y + h - 3, 1, 4);
  }
}

function attackWarning(c, attack, time) {
  const { kind, x, y } = attack;
  if (kind === "surge") {
    const band = attack.width;
    box(c, "#b78f5e35", 0, y - band, W, band * 2);
    for (let px = 0; px < W; px += 12) {
      box(c, "#e1b080", px, y - band, 7, 1);
      box(c, "#e1b080", px, y + band, 7, 1);
      box(c, "#a99776", px + 3, y + Math.sin(px * .12 + time * 6) * 4, 4, 2);
    }
  } else if (kind === "vortex") {
    for (let i = 0; i < 72; i++) {
      const angle = i * Math.PI / 12 + time * 1.9;
      const r = attack.radius * (1 - Math.floor(i / 24) * .28);
      box(c, i < 24 ? "#e8ba89" : "#8cbcb5", x + Math.cos(angle) * r, y + Math.sin(angle) * r, 3, 2);
    }
  } else {
    const { fromX, fromY } = attack;
    for (let i = 1; i < 15; i++) {
      box(c, "#d49abb", fromX + (x - fromX) * i / 15, fromY + (y - fromY) * i / 15, 3, 1);
    }
    ring(c, "#dda3bc", x, y, 14, 14);
  }
}

export function seaRenderer(canvas) {
  const c = canvas.getContext("2d", { alpha: false });
  return (sea, film, reduced) => {
    const time = sea.time + film;
    const p = sea.player;
    const storm = sea.phase !== "fleet";
    ocean(c, time, storm);
    if (sea.phase === "reveal") {
      const rise = reduced ? 1 : Math.min(1, Math.max(.05, film - .45) / 2.4);
      const flash = !reduced && (film > .55 && film < .68 || film > 2 && film < 2.09);
      if (flash) box(c, "#456075", 0, 0, W, 78);
      monster(c, 216, 140, 1.45 + rise * .34, rise, time, true);
      vessel(c, 216, 191, time, { player: true });
      return;
    }
    if (sea.phase === "kraken" || sea.phase === "victory") {
      const boss = sea.boss;
      if (boss.attack) attackWarning(c, boss.attack, reduced ? 0 : time);
      const rise = sea.phase === "victory" ? Math.max(0, 1 - film * .46) : boss.openness;
      monster(c, boss.x, boss.y, .85, rise, time, boss.stage > 1);
    }
    if (sea.phase === "fleet" || sea.phase === "kraken") {
      for (const side of [-1, 1]) {
        const target = broadsideTarget(sea, side);
        const color = target ? "#d6d0a5" : "#6c959695";
        const end = target?.x ?? (side < 0 ? 17 : W - 17);
        for (let x = p.x + side * 24; (end - x) * side > 17; x += side * 9) {
          box(c, color, x, p.y - 3 + (target ? (target.y - p.y) * (x - p.x) / (end - p.x) : 0), 2, 1);
        }
        if (target) ring(c, color, target.x, target.y - 3, target === sea.boss ? 26 : 17, target === sea.boss ? 33 : 22);
      }
    }
    for (const ship of sea.ships) {
      vessel(c, ship.x, ship.y, time, ship);
      if (ship.hp > 0) box(c, "#f0aa86", ship.x - ship.hp * 2, ship.y + 25, ship.hp * 4, 2);
      if (ship.aim) ring(c, "#ea8b72", ship.aim.x, ship.aim.y, 17, 20);
    }
    vessel(c, p.x, p.y, time, { player: true });
    for (const [i, flash] of sea.flash.entries()) {
      if (!flash) continue;
      const side = i * 2 - 1, x = p.x + side * 16, y = p.y - 2;
      shape(c, "#e59754", [[x,y-4],[x+side*9,y-5],[x+side*21,y],[x+side*9,y+5],[x,y+4]]);
      box(c, "#fff0bd", x - 3 + side * 4, y - 1, 8, 3);
    }
    for (const shot of sea.shots) {
      const k = Math.min(1, shot.age / shot.span);
      const x = shot.x + (shot.tx - shot.x) * k, y = shot.y + (shot.ty - shot.y) * k;
      box(c, shot.hostile ? "#f09164" : "#f7d9a0", x - 2, y - 1, 4, 2);
    }
    for (const glob of sea.ink) {
      box(c, "#9772a0", glob.x - glob.vx * .021 - 1, glob.y - glob.vy * .021, 3, 2);
      box(c, "#523454", glob.x - 5, glob.y - 3, 10, 7);
      box(c, "#a97aa6", glob.x - 3, glob.y - 2, 5, 2);
    }
    for (const effect of sea.bursts) {
      const { kind } = effect;
      if (kind === "surge") {
        const y = effect.y - 14 + effect.age * 42;
        for (let x = 0; x < W; x += 6) {
          box(c, "#b4d5ca", x, y + Math.sin(x * .14) * 4, 5, 2);
        }
        continue;
      }
      const color = kind === "ink" ? "#c180a7" : kind === "impact" ? "#e6a273" : "#a5c2b2";
      const rays = kind === "vortex" ? 25 : 9;
      const spread = 3 + effect.age * 24;
      for (let i = 0; i < rays; i++) {
        const a = i * 2.399;
        const radius = kind === "vortex" ? spread * 2.8 : spread;
        box(c, color, effect.x + Math.cos(a) * radius, effect.y + Math.sin(a) * radius * .65, 2, 2);
      }
    }
    if (sea.damage > 0 && !reduced) box(c, "#b5384a35", 0, 0, W, H);
  };
}
