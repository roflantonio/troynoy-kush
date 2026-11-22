const compare = [
  (a,b) => a === b, (a,b) => a !== b, (a,b) => a <= b,
  (a,b) => a < b, (a,b) => a >= b, (a,b) => a > b,
];

class GameRuntime {
  constructor(project, io) {
    this.project = project;
    this.io = io;
    this.globals = [...project.globals];
    this.down = new Set();
    this.tapped = new Set();
    this.glance = null;
    this.click = null;
    this.pending = null;
  }

  enter(frame) {
    if (this.entities) {
      for (const obj of this.entities) if (obj.video) this.io.removeVideo(obj);
    }
    this.frame = frame;
    this.entities = frame.placements.map(([handle,x,y,layer]) => makeEntity(frame.objects[handle],x,y,layer));
    this.time = 0;
    this.previousTime = -1;
    this.camera = {x: 0, y: 0};
    this.states = frame.events.map(() => ({matched: false, ran: false}));
    this.entering = true;
    this.pending = null;
    this.tapped.clear();
    this.click = null;
    this.io.selectFrame(frame);
    this.runEvents();
    this.entering = false;
  }

  keyDown(code) {
    if (!this.down.has(code)) this.tapped.add(code);
    this.down.add(code);
  }

  keyUp(code) { this.down.delete(code); }

  step(dt) {
    if (!this.frame || this.pending !== null || this.io.waiting()) return;
    this.previousTime = this.time;
    this.time += 1000 * dt;
    for (const entity of this.entities) {
      if (entity.dead) continue;
      advanceMovement(entity, dt, this.down, this.tapped);
      advanceAnimation(entity, dt);
      if (entity.projectile && (entity.x < -512 || entity.y < -512 ||
          entity.x > this.frame.width + 512 || entity.y > this.frame.height + 512)) entity.dead = true;
    }
    this.resolveSolidMovement();
    this.runEvents();
    this.entities = this.entities.filter(entity => !entity.dead);
    this.tapped.clear();
    this.click = null;
  }

  resolveSolidMovement() {
    const config = this.frame.solidMovement;
    if (!config) return;
    const body = this.entities.find(entity => entity.def === this.frame.objects[config.body] && !entity.dead);
    if (!body) return;
    const walls = this.entities.filter(entity => !entity.dead &&
      config.walls.some(handle => entity.def === this.frame.objects[handle]));
    slideAlongWalls(body,walls.map(wall => this.collisionBounds(wall)),this.collisionBounds(body));
  }

  eventDef(handle) {
    return this.frame.objects[this.frame.eventObjects[handle] ?? handle];
  }

  objects(handle, selection) {
    if (selection?.has(handle)) return selection.get(handle).filter(obj => !obj.dead);
    const def = this.eventDef(handle);
    return def ? this.entities.filter(obj => obj.def === def && !obj.dead) : [];
  }

  expression(data, selection) {
    if (!data?.Expressions) return data?.Value ?? 0;
    const terms = data.Expressions;
    const [first] = terms;
    if (!first) return 0;
    const {ObjectType:type, Num:num, ObjectInfo:handle, Expression:value} = first;
    if (type === -1) {
      if (num === 8) return terms.find(t => t.ObjectType === -1 && t.Num === 3)?.Expression.Value ?? '';
      if (num === 65) {
        const [low,high] = terms.filter(t => t.ObjectType === -1 && t.Num === 0).map(t => t.Expression.Value);
        return low + Math.floor(Math.random() * (high - low + 1));
      }
      return value.Value ?? 0;
    }
    if (type === 2 && num === 1) return this.objects(handle,selection)[0]?.y ?? 0;
    if (type === 7 && num === 80) return this.objects(handle,selection)[0]?.value ?? 0;
    if (type === 35 && num === 82) return this.io.readSave(terms[1]?.Expression.Value);
    return 0;
  }

  position(param, selection) {
    const object = param.ObjectInfoParent === 65535 ? null : this.objects(param.ObjectInfoParent,selection)[0];
    const point = object?.def.type === 2 && (param.PositionFlags?.Value ?? param.CreateFlags?.Value ?? 0) & 2
      ? this.project.images[activeImage(object)] : null;
    return {
      x: (object?.x ?? 0) + param.X + (point ? point[4] - point[2] : 0),
      y: (object?.y ?? 0) + param.Y + (point ? point[5] - point[3] : 0),
    };
  }

  bounds(entity) {
    const {def,x,y} = entity;
    if (def.type === 2) {
      const image = this.project.images[activeImage(entity)];
      if (!image) return null;
      return {x:x-image[2], y:y-image[3], w:image[0], h:image[1]};
    }
    if (def.type === 32) return {x,y,w:def.size[0],h:def.size[1]};
    if (def.type === 3 || def.type === 7) {
      const {Width, Height, DisplayType} = def.detail;
      // Fusion stores horizontal bar widths as negative values.
      const w = def.type === 7 && DisplayType === 3 ? Math.abs(Width) : Width;
      return {x,y,w,h:Height};
    }
    return null;
  }

  displayBounds(entity) {
    const rect = this.bounds(entity);
    if (!rect) return null;
    const layer = this.frame.layers[entity.layer];
    if (entity.def.scroll) {
      rect.x -= this.camera.x * (layer?.XCoefficient ?? 1);
      rect.y -= this.camera.y * (layer?.YCoefficient ?? 1);
    }
    return rect;
  }

  touches(entity, point) {
    if (!point || !(entity.visible || entity.def.inputOnly)) return false;
    const b = this.displayBounds(entity);
    return b && point.x >= b.x && point.x < b.x+b.w && point.y >= b.y && point.y < b.y+b.h;
  }

  collisionBounds(entity) {
    const rect = this.bounds(entity);
    const scale = entity.def.collisionScale;
    if (!rect || scale === undefined) return rect;
    const w = rect.w * scale;
    const h = rect.h * scale;
    return {x:rect.x + (rect.w-w)/2, y:rect.y + (rect.h-h)/2, w, h};
  }

  overlaps(left, right) {
    const a = this.collisionBounds(left), b = this.collisionBounds(right);
    return a && b && a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  pick(handle, selection, filter, negate = false) {
    const chosen = this.objects(handle, selection).filter(obj => Boolean(filter(obj)) !== negate);
    selection.set(handle, chosen);
    return chosen.length > 0;
  }

  condition(op, selection, contacts) {
    const [type,num,handle,flags,params] = op;
    const data = params[0]?.[1];
    const negate = Boolean(flags & 1);
    const expected = data?.Value;
    if (type === -6) {
      if (num === -1) return this.tapped.has(expected) !== negate;
      if (num === -2) return this.down.has(expected) !== negate;
      if (num === -5) return Boolean(this.click) !== negate;
      if (num === -7 || num === -4) {
        const point = num === -7 ? this.click : this.glance;
        return this.pick(params[num === -7 ? 1 : 0][1].ObjectInfo, selection,obj => this.touches(obj,point),negate);
      }
    }
    if (type === -4) {
      const interval = data.Timer;
      if (num === -7) return this.previousTime < interval && this.time >= interval;
      if (num === -8) return this.time >= interval && Math.floor(this.previousTime/interval) !== Math.floor(this.time/interval);
    }
    if (type === -3 && num === -1) return this.entering;
    if (type === -2 && num === -1) return !this.io.isPlaying(data.Name) !== negate;
    if (type === -1) {
      if (num === -8) {
        const rhs = params[1][1];
        return compare[rhs.Comparison](this.globals[expected] ?? 0,this.expression(rhs,selection)) !== negate;
      }
      if (num === -1 || num === -6 || num === -7) return true;
    }
    if (type === 7 && num === -81) {
      return this.pick(handle,selection,obj => compare[data.Comparison](obj.value,this.expression(data,selection)),negate);
    }
    if (type === 32 && num === -81) return this.pick(handle,selection,obj => this.io.videoPlaying(obj),negate);
    if (type !== 2) return false;
    if (num === -21) return this.pick(handle,selection,obj => obj.pathEnded,negate);
    if (num === -8) return this.pick(handle,selection,obj => expected & (1 << obj.direction),negate);
    if (num === -7) return this.pick(handle,selection,obj => !obj.moving && !(obj.move.Type === 5 && obj.running),negate);
    if (num === -3) return this.pick(handle,selection,obj => obj.anim === expected && !obj.animStopped,negate);
    if (num === -2) return this.pick(handle,selection,obj => obj.anim === expected && obj.animEnded,negate);
    if (num === -12) {
      return this.pick(handle,selection,obj => {
        const b = this.bounds(obj);
        if (!b) return false;
        const edgeX = (expected & 1 && b.x < 0 && obj.x < obj.prevX) ||
          (expected & 2 && b.x+b.w > this.frame.width && obj.x > obj.prevX);
        const edgeY = (expected & 4 && b.y < 0 && obj.y < obj.prevY) ||
          (expected & 8 && b.y+b.h > this.frame.height && obj.y > obj.prevY);
        if (edgeX || edgeY) contacts.set(obj,{edgeX,edgeY});
        return edgeX || edgeY;
      },negate);
    }
    if (num === -14 || num === -4) {
      const otherHandle = data.ObjectInfo;
      const others = this.objects(otherHandle,selection);
      const matched = new Set();
      const success = this.pick(handle,selection,obj => {
        for (const other of others) {
          if (other === obj || !this.overlaps(obj,other)) continue;
          contacts.set(obj,other);
          matched.add(other);
        }
        return contacts.has(obj);
      },negate);
      if (!negate) selection.set(otherHandle,[...matched]);
      return success;
    }
    return false;
  }

  runEvents() {
    let suppressed = 0;
    for (const [i,[conditions,actions]] of this.frame.events.entries()) {
      const [type,num,,,params] = conditions[0] ?? [];
      if (type === -1 && num === -10) {
        if (suppressed || params[0][1].GroupFlags.Value & 1) suppressed++;
        continue;
      }
      if (type === -1 && num === -11) {
        suppressed = Math.max(0,suppressed-1);
        continue;
      }
      if (suppressed) continue;
      const selection = new Map();
      const contacts = new Map();
      const state = this.states[i];
      const matched = conditions.every(op => this.condition(op,selection,contacts));
      const ranOnce = conditions.some(op => op[0] === -1 && op[1] === -6);
      const onChange = conditions.some(op => op[0] === -1 && op[1] === -7);
      const shouldRun = matched && !(ranOnce && state.ran) && !(onChange && state.matched);
      state.matched = matched;
      if (!shouldRun) continue;
      for (const op of actions) this.action(op,selection,contacts);
      state.ran = true;
    }
    if (this.pending !== null) this.io.go(this.pending);
  }

  spawn(param,selection,shooter = null) {
    const def = this.eventDef(param.ObjectInfo);
    if (!def) return;
    const point = shooter ? {x:shooter.x+param.X,y:shooter.y+param.Y} : this.position(param,selection);
    const direction = firstDirection(param.Direction);
    if (!shooter && !def.movement.Type) {
      const existing = this.entities.find(obj => !obj.dead && obj.def === def &&
        obj.x === point.x && obj.y === point.y && obj.layer === param.Layer);
      if (existing) {
        selection.set(param.ObjectInfo,[existing]);
        return;
      }
    }
    const obj = makeEntity(def,point.x,point.y,param.Layer,direction);
    if (shooter) {
      const [x,y] = vectorOf(direction);
      obj.projectile = true;
      obj.vx = x * param.ShootSpeed * 6;
      obj.vy = y * param.ShootSpeed * 6;
    }
    this.entities.push(obj);
    selection.set(param.ObjectInfo,[obj]);
  }

  action(op, selection, contacts) {
    const [type,num,handle,,params] = op;
    const first = params[0]?.[1], second = params[1]?.[1];
    const expr = data => this.expression(data,selection);
    if (type === -6) return this.io.cursor(num === 1);
    if (type === -5) return this.spawn(first,selection);
    if (type === -4) { this.previousTime = -1; this.time = first.Timer; return; }
    if (type === -3) {
      if (num === 0) this.pending = this.project.frames[this.frame.index+1]?.id ?? 1;
      if (num === 2) this.pending = first.Value;
      if (num === 4) this.io.quit();
      if (num === 6) this.pending = this.frame.id;
      if (num === 7) {
        const pos = this.position(first,selection);
        this.camera.x = clamp(pos.x - this.project.width / 2,0,Math.max(0,this.frame.width-this.project.width));
        this.camera.y = clamp(pos.y - this.project.height / 2,0,Math.max(0,this.frame.height-this.project.height));
      }
      return;
    }
    if (type === -2) {
      if (num === 0 || num === 4) this.io.playSound(first.Name,num === 4 ? expr(second) : 1);
      if (num === 1) this.io.stopSounds();
      if (num === 6) this.io.stopSound(first.Name);
      if (num === 21) this.io.soundVolume(first.Name,expr(second)/100);
      if (num === 23) this.io.soundPan(first.Name,expr(second)/100);
      return;
    }
    if (type === -1) {
      if (num === 3) this.globals[first.Value] = expr(second);
      return;
    }
    const objects = this.objects(handle,selection);
    for (const entity of objects) {
      if (num === 1) {
        const point = this.position(first,selection);
        const parent = first.ObjectInfoParent === 65535 ? null : this.objects(first.ObjectInfoParent,selection)[0];
        entity.prevX = point.x - (parent ? parent.x - parent.prevX : 0);
        entity.prevY = point.y - (parent ? parent.y - parent.prevY : 0);
        Object.assign(entity,point);
      }
      if (num === 3 && type === 2) entity.y = expr(first);
      if (num === 4) stopMovement(entity,contacts.get(entity),this.bounds.bind(this));
      if (num === 5) entity.running = true;
      if (num === 7 && type === 2) entity.maxSpeed = expr(first);
      if (num === 9 && type === 2) bounceMovement(entity,contacts.get(entity),this.bounds.bind(this));
      if (num === 10 && type === 2) reversePath(entity);
      if (num === 14 && type === 2) {
        const pos = this.position(first,selection);
        entity.direction = directionOf(pos.x-entity.x,pos.y-entity.y);
      }
      if (num === 15 && type === 2) entity.animStopped = true;
      if (num === 16 && type === 2) entity.animStopped = false;
      if (num === 17 && type === 2) setAnimation(entity,first.Value);
      if (num === 18 && type === 2) entity.direction = firstDirection(first.Value);
      if (num === 24) {
        if (entity.video) this.io.removeVideo(entity);
        entity.dead = true;
      }
      if (num === 26) entity.visible = false;
      if (num === 27) entity.visible = true;
      if (num === 28 && type === 3) entity.flash = first.Timer;
      if (num === 29 && type === 2) this.spawn(first,selection,entity);
      if (type === 3) {
        if (num === 84) entity.paragraph = first.Value;
        if (num === 86) entity.paragraph = (entity.paragraph + 1) % entity.def.detail.paragraphs.length;
      }
      if (type === 7) {
        if (num === 80) entity.value = expr(first);
        if (num === 81) entity.value += expr(first);
        if (num === 82) entity.value -= expr(first);
        if (num === 85) entity.color = 'rgb(' + first.Color.split(',').slice(1).join(',') + ')';
        entity.value = clamp(entity.value,entity.def.detail.Minimum,entity.def.detail.Maximum);
      }
      if (type === 32) {
        if (num === 80) this.io.setVideo(entity,expr(first));
        if (num === 82) this.io.playVideo(entity);
        if (num === 83) this.io.stopVideo(entity);
        if (num === 90) this.io.videoVolume(entity,expr(first)/100);
        if (num === 91 || num === 92) this.io.loopVideo(entity,num === 91);
      }
      if (type === 33 && (num === 80 || num === 81)) this.io.fullScreen(num === 80);
      if (type === 34) this.io.cursor(num === 81);
      if (type === 35 && num === 87) this.io.writeSave(expr(first),expr(second));
    }
  }
}
