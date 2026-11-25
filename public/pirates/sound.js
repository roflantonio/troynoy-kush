const note = midi => 440 * 2 ** ((midi - 69) / 12);
const dockMelody = [57, null, 60, 64, null, 60, 55, null, 59, 62, null, 59, 53, null, 57, 60, null, 57, 52, null, 55, 59, 56, null];
const dockBass = [33, 31, 29, 28];
const fortBass = [38, 38, 41, 38, 34, 34, 36, 37, 38, 38, 45, 41, 36, 36, 37, 45];
const fortMotif = [74, null, null, 72, 69, null, 67, null, 65, null, 69, null, 61, null, 64, 69];

const watcherBass = [28, 28, 29, 28, 34, 33, 29, 28, 35, 35, 34, 31, 29, 28, 26, 27];
const watcherBells = [64, null, null, 65, null, 70, null, 69, 67, null, 66, null, 72, 70, 65, 63];

export function pirateSound(enabled) {
  let context;
  let master;
  let music;
  let effects;
  let grit;
  let next = 0;
  let beat = 0;
  let track = "dock";
  let active = enabled;

  function tone(bus, at, from, to, span, strength, type = "triangle", cutoff = 5400) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, to), at + span);
    const filter = context.createBiquadFilter();
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(strength, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + span);
    oscillator.connect(filter).connect(gain).connect(bus);
    oscillator.start(at);
    oscillator.stop(at + span + .015);
  }

  function noise(bus, at, span, color, strength) {
    const source = context.createBufferSource();
    source.buffer = grit;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(color, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, color / 3), at + span);
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(strength, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + span);
    source.connect(filter).connect(gain).connect(bus);
    source.start(at);
    source.stop(at + span);
  }

  function dockStep(count, at) {
    const root = dockBass[Math.floor(count / 6)];
    if (count % 6 === 0) {
      tone(music.dock, at, note(root), note(root), 1.55, .17, "sine");
      tone(music.dock, at, 90, 42, .40, .22, "sine");
    }
    if (count % 6 === 3) tone(music.dock, at, note(root + 7), note(root + 7), .81, .12, "triangle", 1050);
    const pitch = dockMelody[count];
    if (pitch == null) return;
    tone(music.dock, at, note(pitch), note(pitch), .65, .20, "triangle", 1260);
    tone(music.dock, at + .087, note(pitch + 12), note(pitch + 12), .40, .037, "sine");
  }

  function fortStep(count, at) {
    const beatInBar = count % 4;
    if (beatInBar === 0) tone(music.fort, at, 153, 42, .20, .36, "sine");
    if (count % 8 === 4) noise(music.fort, at, .16, 2650, .25);
    if (beatInBar === 2 || count % 8 === 7) noise(music.fort, at, .07, 7300, .09);
    if (count % 2 === 0 || count % 8 === 7) {
      const root = note(fortBass[Math.floor(count / 2)]);
      tone(music.fort, at, root, root, .20, .21, "sawtooth", 690);
      tone(music.fort, at, root / 2, root / 2, .20, .12, "sine");
    }
    const pitch = fortMotif[Math.floor(count / 2)];
    if (pitch != null && count % 2 === 0) tone(music.fort, at, note(pitch), note(pitch), .22, .135, "square", 1610);
  }

  function watcherStep(count, at) {
    const bus = music.watcher;
    const measure = count % 8;
    if ([0, 3, 6].includes(measure)) tone(bus, at, 173, 29, .27, .49, "sine");
    if (measure === 2 || measure === 7) noise(bus, at, .14, 1860, .29);
    if (count % 2 === 0) {
      const root = note(watcherBass[Math.floor(count / 2)]);
      tone(bus, at, root, root * 1.003, .29, .25, "sawtooth", 920);
      tone(bus, at, root * 1.5, root * 1.5, .24, .095, "square", 620);
      const bell = watcherBells[count / 2];
      if (bell != null) {
        tone(bus, at, note(bell), note(bell), .56, .20, "triangle", 2400);
        tone(bus, at, note(bell) * 2.04, note(bell) * 2.01, .30, .077, "sine");
      }
    }
  }

  const tracks = {
    dock: { step: dockStep, count: 24, interval: .297 },
    fort: { step: fortStep, count: 32, interval: .125 },
    watcher: { step: watcherStep, count: 32, interval: .115 },
  };

  function score() {
    if (!active || !tracks[track] || document.hidden || context.state !== "running") return;
    const { step, count, interval } = tracks[track];
    if (next < context.currentTime) next = context.currentTime + .05;
    while (next < context.currentTime + .19) {
      step(beat++ % count, next);
      next += interval;
    }
  }

  function prepare() {
    context = new AudioContext();
    grit = context.createBuffer(1, Math.round(context.sampleRate * .56), context.sampleRate);
    const data = grit.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    master = context.createGain();
    music = Object.fromEntries(Object.keys(tracks).map(name => {
      const channel = context.createGain();
      channel.gain.value = name === track ? .28 : 0;
      channel.connect(master);
      return [name, channel];
    }));
    effects = context.createGain();
    effects.gain.value = .50;
    master.gain.value = active ? .6 : 0;
    effects.connect(master);
    master.connect(context.destination);
    setInterval(score, 50);
  }

  async function unlock() {
    if (!active) return;
    try {
      if (!context) prepare();
      if (context.state !== "running") await context.resume();
    } catch { /* A browser can decline audio playback while the game continues. */ }
  }

  function effect(kind) {
    if (!active || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .01;
    if (kind === "pistol" || kind === "scatter" || kind === "musket") {
      noise(effects, at, kind === "scatter" ? .34 : kind === "musket" ? .28 : .21, kind === "musket" ? 920 : 1400, .63);
      tone(effects, at, kind === "musket" ? 181 : 122, 38, .19, .28, "sine");
    } else if (kind === "dash") noise(effects, at, .18, 2800, .26);
    else if (kind === "arena") {
      noise(effects, at, .53, 570, .47);
      tone(effects, at, 73, 29, .87, .46, "triangle", 560);
    } else if (kind === "arena-rage") {
      tone(effects, at, 223, 45, .7, .32, "sawtooth", 650);
      noise(effects, at, .47, 1340, .24);
    } else if (kind === "boss-bolt") tone(effects, at, 192, 44, .31, .29, "sawtooth", 1140);
    else if (kind === "blade") noise(effects, at, .17, 2200, .31);
    else if (kind === "hurt" || kind === "dead") tone(effects, at, 130, 37, .25, .34, "sawtooth", 750);
    else if (kind === "shield") {
      tone(effects, at, 1460, 770, .14, .27, "triangle");
      tone(effects, at, 1100, 1070, .08, .20, "square", 1800);
    } else if (kind === "bolt") tone(effects, at, 590, 149, .23, .18, "triangle", 2200);
    else if (kind === "empty") noise(effects, at, .065, 3600, .18);
    else if (kind === "defeat") noise(effects, at, .23, 930, .21);
    else {
      const notes = kind === "relic" || kind === "win" ? [60, 64, 69, 72] : [55, 62];
      notes.forEach((n, i) => tone(effects, at + i * .081, note(n), note(n), .38, .18, "triangle", 1600));
    }
  }
  return {
    unlock, effect,
    active(on) {
      active = on;
      if (master) master.gain.setTargetAtTime(on ? .6 : 0, context.currentTime, .045);
    },
    track(name) {
      if (track === name) return;
      track = name;
      beat = 0;
      if (!context) return;
      const now = context.currentTime;
      next = now + .055;
      for (const [name, channel] of Object.entries(music)) {
        channel.gain.setTargetAtTime(name === track ? .28 : 0, now, .12);
      }
    },
  };
}
