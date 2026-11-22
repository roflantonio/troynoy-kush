const directionOf = (x, y) => (Math.round(-Math.atan2(y, x) * 16 / Math.PI) + 32) % 32;
const vectorOf = direction => [Math.cos(direction * Math.PI / 16), -Math.sin(direction * Math.PI / 16)];
const firstDirection = mask => mask === -1 || !mask ? 0 : 31 - Math.clz32(mask & -mask);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);

function makeEntity(def, x, y, layer, direction = firstDirection(def.movement.StartingDirection)) {
  return {
    def, x, y, prevX: x, prevY: y, layer, direction, anim: 0, animTime: 0, animIndex: 0,
    animStopped: false, animEnded: false, visible: def.visible, dead: false,
    move: def.movement, running: Boolean(def.movement.Move), pathNode: 0,
    pathProgress: 0, pathSign: 1, pathPause: 0, pathEnded: false,
    vx: 0, vy: 0, grounded: false, moving: false, wasMoving: false,
    paragraph: 0, value: def.detail?.Value ?? 0, color: def.detail?.color,
  };
}

function animationDirection(entity) {
  const anims = entity.def.detail;
  const anim = anims.find(item => item.id === entity.anim && item.directions.length)
    ?? anims.find(item => item.directions.length);
  return anim?.directions.find(dir => dir.Index === entity.direction)
    ?? anim?.directions[0];
}

function activeImage(entity) {
  const dir = animationDirection(entity);
  return dir?.Frames[Math.min(entity.animIndex, dir.Frames.length - 1)];
}

function advanceAnimation(entity, dt) {
  entity.animEnded = false;
  if (entity.def.type !== 2 || entity.animStopped) return;
  const dir = animationDirection(entity);
  if (!dir || dir.Frames.length < 2) return;
  const rate = Math.max(1, dir.MaximumSpeed) * 0.6;
  entity.animTime += dt * rate;
  while (entity.animTime >= 1 && !entity.animStopped) {
    entity.animTime--;
    if (++entity.animIndex < dir.Frames.length) continue;
    entity.animLoops = (entity.animLoops ?? 0) + 1;
    if (dir.Repeat && entity.animLoops >= dir.Repeat) {
      entity.animIndex = dir.Frames.length - 1;
      entity.animStopped = true;
      entity.animEnded = true;
    } else {
      entity.animIndex = dir.RepeatFrame;
    }
  }
}

function setAnimation(entity, anim) {
  if (entity.anim === anim) return;
  entity.anim = anim;
  entity.animIndex = 0;
  entity.animTime = 0;
  entity.animLoops = 0;
  entity.animStopped = false;
}

function advancePath(entity, dt) {
  const nodes = entity.move.PathNodes;
  if (!nodes?.length || entity.pathPause > 0) {
    entity.pathPause -= dt;
    return;
  }
  const node = nodes[entity.pathNode];
  if (!node) return;
  const length = Math.max(1, node.Length);
  const offset = clamp(entity.pathSign * node.Speed * 7.5 * dt / length, -1, 1);
  const progress = clamp(entity.pathProgress + offset, 0, 1);
  entity.x += node.Dx * (progress - entity.pathProgress);
  entity.y += node.Dy * (progress - entity.pathProgress);
  entity.pathProgress = progress;
  if (entity.pathSign > 0 ? progress < 1 : progress > 0) return;
  entity.pathNode += entity.pathSign;
  entity.pathProgress = entity.pathSign > 0 ? 0 : 1;
  entity.pathPause = node.Pause / 1000;
  if (entity.pathNode >= 0 && entity.pathNode < nodes.length) return;
  entity.pathEnded = true;
  if (entity.move.Reverse) {
    reversePath(entity);
  } else if (entity.move.Loop) {
    entity.pathNode = 0;
    entity.pathProgress = 0;
  } else {
    entity.pathNode = clamp(entity.pathNode, 0, nodes.length - 1);
    entity.pathProgress = entity.pathSign > 0 ? 1 : 0;
    entity.running = false;
  }
}

function reversePath(entity) {
  const last = (entity.move.PathNodes?.length ?? 1) - 1;
  if (entity.pathNode > last) {
    entity.pathNode = last;
    entity.pathProgress = 1;
  } else if (entity.pathNode < 0) {
    entity.pathNode = 0;
    entity.pathProgress = 0;
  }
  entity.pathSign *= -1;
  entity.running = true;
}

function advanceMovement(entity, dt, down, tapped) {
  const move = entity.move;
  entity.prevX = entity.x;
  entity.prevY = entity.y;
  entity.wasMoving = entity.moving;
  entity.pathEnded = false;
  const inputX = Number(down.has(39)) - Number(down.has(37));
  const inputY = Number(down.has(40)) - Number(down.has(38));
  const max = (entity.maxSpeed ?? move.Speed ?? 0) * 6;
  if (entity.projectile) {
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
  } else if (entity.running && move.Type === 5) {
    advancePath(entity, dt);
  } else if (entity.running && move.Type === 9) {
    entity.vx = approach(entity.vx, inputX * max, (inputX ? move.Acceleration : move.Deceleration) * 40 * dt);
    if (entity.grounded && move.Jump > 0 && (tapped.has(38) || tapped.has(32))) {
      entity.vy = -move.Jump * 7;
      entity.grounded = false;
    }
    entity.vy = Math.min(800, entity.vy + move.Gravity * 35 * dt);
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    if (inputX) entity.direction = inputX < 0 ? 16 : 0;
  } else if (entity.running && move.Type === 3) {
    const norm = inputX && inputY ? Math.SQRT1_2 : 1;
    entity.vx = approach(entity.vx, norm * inputX * max, (inputX ? move.Acceleration : move.Deceleration) * 38 * dt);
    entity.vy = approach(entity.vy, norm * inputY * max, (inputY ? move.Acceleration : move.Deceleration) * 38 * dt);
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    if (inputX || inputY) entity.direction = directionOf(inputX,inputY);
  } else if (entity.running && move.Type === 4) {
    const [x,y] = vectorOf(entity.direction);
    entity.x += max * x * dt;
    entity.y += max * y * dt;
  }
  entity.moving = Math.abs(entity.x - entity.prevX) > 0.015 || (move.Type !== 9 && Math.abs(entity.y - entity.prevY) > 0.015);
}

function stopMovement(entity, obstacle, bounds) {
  if (obstacle?.edgeX || obstacle?.edgeY) {
    if (obstacle.edgeX) { entity.x = entity.prevX; entity.vx = 0; }
    if (obstacle.edgeY) { entity.y = entity.prevY; entity.vy = 0; }
    entity.moving = false;
  } else if (entity.move.Type === 9 && obstacle) {
    const box = bounds(entity);
    const other = bounds(obstacle);
    const landed = box && other && (box.y + box.h - (entity.y - entity.prevY) <= other.y + 2 ||
      (other.w > box.w && other.y >= box.y + box.h * 0.6));
    if (landed && entity.vy >= 0) {
      entity.y += other.y - box.y - box.h + 0.1;
      entity.vy = 0;
      entity.grounded = true;
    } else {
      entity.x = entity.prevX;
      entity.vx = 0;
      entity.moving = false;
    }
  } else if (entity.move.Type === 3 || entity.move.Type === 9) {
    if (obstacle) {
      entity.x = entity.prevX;
      entity.y = entity.prevY;
    }
    entity.vx = 0;
    entity.vy = 0;
    entity.moving = false;
  } else {
    entity.running = false;
  }
}

function bounceMovement(entity, obstacle, bounds) {
  const box = bounds(entity);
  const target = obstacle?.def && bounds(obstacle);
  const flipX = obstacle?.edgeX || (target && box
    ? Math.min(box.x + box.w - target.x, target.x + target.w - box.x) <
      Math.min(box.y + box.h - target.y, target.y + target.h - box.y)
    : false);
  entity.x = entity.prevX;
  entity.y = entity.prevY;
  if (flipX) entity.vx *= -1;
  else entity.vy *= -1;
  entity.direction = (flipX ? 48 - entity.direction : 32 - entity.direction) % 32;
}
