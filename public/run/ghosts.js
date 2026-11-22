const FRAME_LIMIT = 1 / 30;
const COAST_MS = 125;
const FADE_AFTER_MS = 1900;
const HIDE_AFTER_MS = 3900;
const MAX_X_RATE = 540;
const MAX_Y_RATE = 1120;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function approach(from, to, maxStep) {
  return from + clamp(to - from, -maxStep, maxStep);
}

function sameLife(a, b) {
  return a.falls == null || b.falls == null || a.falls === b.falls;
}

export class RemoteRunner {
  constructor() {
    this.samples = [];
    this.interval = 250;
    this.jitter = 0;
    this.opacity = 0;
  }

  receive(packet, receivedAt, serverNow) {
    const at = Number.isFinite(packet.at) ? packet.at : serverNow;
    const prior = this.latest;
    if (prior && at <= prior.at) return;

    if (prior) {
      const gap = clamp(at - prior.at, 75, 1400);
      const arrivalGap = receivedAt - this.receivedAt;
      const variance = Math.abs(gap - this.interval) + Math.abs(arrivalGap - gap) * .35;
      this.jitter = .75 * this.jitter + .25 * Math.min(500, variance);
      this.interval = .72 * this.interval + .28 * gap;
    }
    this.latest = { ...packet, at };
    this.receivedAt = receivedAt;
    this.serverNow = Math.max(serverNow, at);
    this.samples.push(this.latest);
    if (this.samples.length > 14) this.samples.shift();
  }

  sampleAt(time) {
    while (this.samples.length > 2 && this.samples[1].at <= time) this.samples.shift();
    const a = this.samples[0];
    const b = this.samples[1];
    if (time <= a.at) return a;
    if (b && time < b.at) {
      // Use the next spawn only after its own timestamp. There is no path across a respawn.
      if (!sameLife(a, b) || a.down || b.down) return a;
      const fraction = (time - a.at) / (b.at - a.at);
      return { ...a, x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
        face: fraction < .5 ? a.face : b.face, moved: a.moved || b.moved };
    }

    const last = this.latest;
    const future = clamp(time - last.at, 0, COAST_MS) / 1000;
    if (!future || last.down) return last;
    return { ...last, x: Math.max(0, last.x + (last.vx || 0) * future),
      y: last.y + clamp((last.vy || 0) * future, -36, 36) };
  }

  drawAt(now) {
    if (!this.latest) return null;
    const dt = clamp((now - (this.lastDraw ?? now)) / 1000, 0, FRAME_LIMIT);
    this.lastDraw = now;
    const sinceArrival = Math.max(0, now - this.receivedAt);
    const delay = clamp(this.interval * .91 + this.jitter * 1.6, 210, 1150);
    const time = this.serverNow + sinceArrival - delay;
    // Slow the timeline when the buffer grows, and catch up gradually when it shrinks.
    this.cursor = this.cursor === undefined ? time
      : Math.max(this.cursor, Math.min(time, this.cursor + dt * 1320));
    const target = this.sampleAt(this.cursor);
    this.pos ??= { x: target.x, y: target.y, falls: target.falls };
    const relocating = !sameLife(this.pos, target);
    const freshness = clamp((HIDE_AFTER_MS - sinceArrival) / (HIDE_AFTER_MS - FADE_AFTER_MS), 0, 1);
    const previousOpacity = this.opacity;
    const opacityTarget = relocating || target.down ? 0 : freshness;
    this.opacity = approach(previousOpacity, opacityTarget, dt * (opacityTarget < previousOpacity ? 10 : 6));
    if (relocating || target.down) {
      if (!this.opacity) this.pos = { x: target.x, y: target.y, falls: target.falls };
    } else if (!previousOpacity) {
      this.pos = { x: target.x, y: target.y, falls: target.falls };
    } else {
      const blend = 1 - Math.exp(-dt * 19);
      this.pos.x = approach(this.pos.x, this.pos.x + (target.x - this.pos.x) * blend, MAX_X_RATE * dt);
      this.pos.y = approach(this.pos.y, this.pos.y + (target.y - this.pos.y) * blend, MAX_Y_RATE * dt);
      this.pos.falls = target.falls;
    }
    if (!this.opacity) return null;
    return { ...target, ...this.pos, down: false, opacity: this.opacity };
  }

}
