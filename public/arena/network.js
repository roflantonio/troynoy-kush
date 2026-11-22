const page = new URL("./", location.href);
const api = document.querySelector('meta[name="game-api-origin"]')?.content || page.origin;
const alpine = /^[A-HJ-NP-Z2-9]{6}$/;
export const codeFrom = text => text.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
export const validCode = code => alpine.test(code);
export function roomUrl(code) {
  const url = new URL(page);
  if (code) url.searchParams.set("room", code);
  return url;
}

export async function request(path, input, token) {
  const headers = {};
  if (input !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  let response;
  try {
    response = await fetch(new URL("/api/arena" + path, api), {
      method: input === undefined ? "GET" : "POST", headers,
      body: input === undefined ? undefined : JSON.stringify(input),
      cache: "no-store", signal: AbortSignal.timeout(path.endsWith("/relay") ? 2400 : 6500),
    });
  } catch { throw new Error("Связь с сервером прервалась."); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Сервер арены временно недоступен.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function gather(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => { if (pc.iceGatheringState === "complete") finish(); };
    const timer = setTimeout(finish, 2800);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export class Connection {
  constructor(session, handlers) {
    this.session = session;
    this.handlers = handlers;
    this.peers = new Map();
    this.closed = false;
  }

  get allDirect() {
    return this.room?.me === 0
      ? [1, 2].every(slot => this.peers.get(slot)?.channel?.readyState === "open")
      : this.peers.get(0)?.channel?.readyState === "open";
  }

  get path() { return "/" + this.session.code; }

  accept(room) {
    if (this.closed || (this.room && room.revision < this.room.revision)) return;
    this.room = room;
    this.handlers.room(room);
    if (typeof RTCPeerConnection !== "function") return;
    if (room.me === 0) {
      for (const { slot } of room.players) if (slot !== 0) this.offer(slot, room.links[slot]);
    } else if (room.links[room.me]) this.answer(room.links[room.me]);
  }

  async poll() {
    if (this.closed) return;
    try {
      const { room } = await request(this.path, undefined, this.session.token);
      this.accept(room);
      this.handlers.status("");
    } catch (error) {
      if (!this.closed) this.handlers.status(error.message, error.status);
    } finally {
      if (!this.closed) this.timer = setTimeout(() => this.poll(), 950);
    }
  }

  async action(action, details = {}) {
    const { room } = await request(this.path + "/action", { action, ...details }, this.session.token);
    this.accept(room);
  }

  async relay(packet) {
    return request(this.path + "/relay", { match: this.room.match, packet }, this.session.token);
  }

  bind(peer, channel, slot) {
    peer.channel = channel;
    channel.onmessage = event => {
      if (this.closed || this.peers.get(slot) !== peer || typeof event.data !== "string" || event.data.length > 15000) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.match === this.room.match && payload.data) this.handlers.packet(slot, payload.data);
      } catch { /* A newer snapshot supersedes this one. */ }
    };
  }

  createPeer(slot, nonce) {
    this.peers.get(slot)?.pc.close();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const peer = { pc, nonce, answer: false, busy: true };
    this.peers.set(slot, peer);
    return peer;
  }

  async offer(slot, link) {
    let peer = this.peers.get(slot);
    if (peer) {
      if (peer.busy || peer.answer || link?.nonce !== peer.nonce || !link.answer) return;
      peer.busy = true;
      try {
        await peer.pc.setRemoteDescription({ type: "answer", sdp: link.answer });
        peer.answer = true;
      } catch { /* Relay transport is still available. */ }
      finally { peer.busy = false; }
      return;
    }

    try {
      peer = this.createPeer(slot, crypto.randomUUID());
      const { pc, nonce } = peer;
      this.bind(peer, pc.createDataChannel("arena", { ordered: false, maxRetransmits: 0 }), slot);
      await pc.setLocalDescription(await pc.createOffer());
      await gather(pc);
      if (!this.closed) await this.action("offer", { slot, nonce, sdp: pc.localDescription.sdp });
    } catch { /* HTTP relay works with restrictive networks. */ }
    finally { if (peer) peer.busy = false; }
  }

  async answer(link) {
    if (this.peers.get(0)?.nonce === link.nonce) return;
    try {
      const peer = this.createPeer(0, link.nonce);
      const { pc, nonce } = peer;
      pc.ondatachannel = event => this.bind(peer, event.channel, 0);
      await pc.setRemoteDescription({ type: "offer", sdp: link.offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gather(pc);
      if (!this.closed && this.peers.get(0) === peer) await this.action("answer", { nonce, sdp: pc.localDescription.sdp });
    } catch { /* HTTP relay works with restrictive networks. */ }
  }

  send(data) {
    const message = JSON.stringify({ match: this.room.match, data });
    for (const peer of this.peers.values()) {
      const channel = peer.channel;
      if (channel?.readyState !== "open" || channel.bufferedAmount > 48000) continue;
      try { channel.send(message); } catch { /* The next frame goes over the available transport. */ }
    }
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
  }
}
