const note = midi => 440 * 2 ** ((midi - 69) / 12);
const melody = [57, null, 60, 64, null, 60, 55, null, 59, 62, null, 59, 53, null, 57, 60, null, 57, 52, null, 55, 59, 56, null];
const bass = [33, 31, 29, 28];

export function pirateSound(enabled) {
  let context;
  let master;
  let music;
  let effects;
  let grit;
  let next = 0;
  let beat = 0;
  let live = false;
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

  function score() {
    if (!active || document.hidden || context.state !== "running") return;
    if (next < context.currentTime) next = context.currentTime + .05;
    while (next < context.currentTime + .19) {
      const count = beat++ % 24;
      const d = bass[Math.floor(count / 6)];
      if (count % 6 === 0) {
        tone(music, next, note(d), note(d), 1.36, .18, "sine");
        tone(music, next, 112, 35, .29, .37, "sine");
      }
      if (count % 6 === 3) tone(music, next, note(d + 7), note(d + 7), .65, .15, "triangle", 1000);
      if (count % 3 === 2 && live) noise(music, next, .15, 2700, .19);
      const pitch = melody[count];
      if (pitch != null) {
        tone(music, next, note(pitch), note(pitch), .60, .22, "triangle", 1300);
        tone(music, next + .065, note(pitch + 12), note(pitch + 12), .29, .037, "sine");
      }
      next += live ? .238 : .297;
    }
  }

  function prepare() {
    context = new AudioContext();
    grit = context.createBuffer(1, Math.round(context.sampleRate * .56), context.sampleRate);
    const data = grit.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    master = context.createGain();
    music = context.createGain();
    effects = context.createGain();
    music.gain.value = .28;
    effects.gain.value = .50;
    master.gain.value = active ? .6 : 0;
    music.connect(master);
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
    if (kind === "pistol" || kind === "scatter") {
      noise(effects, at, kind === "scatter" ? .34 : .21, 1400, .63);
      tone(effects, at, 122, 38, .19, .28, "sine");
    } else if (kind === "blade") noise(effects, at, .17, 2200, .31);
    else if (kind === "hurt" || kind === "dead") tone(effects, at, 130, 37, .25, .34, "sawtooth", 750);
    else if (kind === "bolt") tone(effects, at, 590, 149, .23, .18, "triangle", 2200);
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
    battle(on) { live = on; },
  };
}
