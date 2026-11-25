const note = midi => 440 * 2 ** ((midi - 69) / 12);
// Slow, mostly sparse phrases give each scene room for footsteps and dialogue.
const shore = [
  [[50,57,60,65],[69,72,77]], [[46,53,57,62],[74,72]], [[48,55,60,64],[67,72,76]], [[45,52,55,62],[74]],
  [[43,50,57,58],[70,74,69]], [[41,48,53,57],[65,67]], [[46,53,57,60],[69,72,74]], [[45,52,59,64],[71]],
  [[50,57,60,65],[77,76,72]], [[53,60,65,69],[74,77]], [[48,55,62,64],[79,76]], [[46,53,57,65],[72]],
  [[43,50,55,60],[70,69,65]], [[45,52,57,62],[69,74]], [[46,53,57,64],[76,72]], [[48,55,60,67],[]],
  [[53,57,60,64],[72,77,81]], [[46,53,57,62],[77,74,72]], [[48,55,60,65],[69,67]], [[43,50,57,62],[74,70]],
  [[45,52,55,60],[72,69]], [[46,53,58,64],[76,77]], [[45,52,55,61],[73,76]], [[50,53,57,64],[69]],
];
const depths = [
  [[45,52,59,60],[]], [[41,48,55,57],[64]], [[43,50,55,62],[67,62]], [[40,47,55,59],[62]],
  [[45,52,55,60],[64,69]], [[48,55,59,64],[]], [[46,53,57,60],[65]], [[43,50,57,62],[67,65,62]],
  [[41,48,53,60],[64]], [[40,47,55,57],[]], [[45,52,59,64],[67,71]], [[43,50,55,60],[69]],
  [[38,45,53,57],[62,65]], [[41,48,55,57],[64]], [[46,53,57,62],[]], [[45,52,57,60],[64,69]],
  [[40,47,53,57],[65,64]], [[43,50,58,62],[70,67]], [[45,52,55,59],[]], [[48,55,57,64],[72,67]],
  [[46,53,55,60],[62,65]], [[41,48,55,57],[]], [[45,52,57,64],[69,71]], [[40,47,50,56],[68]],
  [[45,52,55,60],[72,69,64]], [[43,50,55,59],[67]], [[41,48,55,62],[65,62]], [[40,47,56,57],[]],
];
const oath = [
  [[40,47,52,55],[64,67]], [[41,48,53,57],[65]], [[38,45,50,53],[62,65]], [[40,47,50,59],[71]],
  [[36,43,48,55],[67,64]], [[38,45,53,57],[69]], [[40,47,53,55],[65,67]], [[35,42,47,57],[]],
  [[40,47,52,59],[64,71]], [[43,50,55,58],[70]], [[41,48,53,57],[65,69]], [[38,45,50,55],[67,62]],
  [[35,42,50,57],[62]], [[36,43,48,52],[64,67]], [[41,48,53,55],[65]], [[40,47,52,55],[]],
  [[40,47,52,53],[65,64]], [[38,45,50,53],[62,65]], [[36,43,48,55],[67]], [[37,44,49,56],[68,73]],
  [[40,47,52,59],[71,67]], [[41,48,53,57],[69]], [[35,42,47,56],[68,71]], [[40,47,52,55],[64]],
];

const tracks = {
  dock: { bars: shore, duration: 4.4, air: .49, cutoff: 1240, lead: .114 },
  fort: { bars: depths, duration: 4.0, air: .84, cutoff: 890, lead: .082 },
  watcher: { bars: oath, duration: 3.5, air: .67, cutoff: 790, lead: .099 },
};

export function pirateSound(enabled) {
  let context;
  let master;
  let music;
  let effects;
  let grit;
  let next = 0;
  let bar = 0;
  let syllable = 0;
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

  function swell(bus, at, pitch, duration, gain, type, cutoff, rise) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = note(pitch);
    const filter = context.createBiquadFilter();
    filter.frequency.value = cutoff;
    const volume = context.createGain();
    volume.gain.setValueAtTime(0, at);
    volume.gain.linearRampToValueAtTime(gain, at + rise);
    volume.gain.setValueAtTime(gain * .86, at + duration * .68);
    volume.gain.linearRampToValueAtTime(0, at + duration);
    osc.connect(filter).connect(volume).connect(bus);
    osc.start(at);
    osc.stop(at + duration + .03);
  }

  function playBar(part, at) {
    const index = bar++ % part.bars.length;
    const [chord, melody] = part.bars[index];
    const bus = music[track];
    const { duration, air, cutoff, lead } = part;
    chord.forEach((pitch, i) => swell(bus, at + i * .065, pitch, duration * 1.17,
      i === 0 ? .113 : .052, i === 1 || i === 2 ? "triangle" : "sine", cutoff * .65, air));
    const spacing = melody.length === 3 ? .72 : .99;
    const start = [0.46, 0.77, 1.2, 0.88][index % 4];
    melody.forEach((pitch, i) => {
      const onset = at + start + i * spacing;
      swell(bus, onset, pitch, 1.84 + i * .14, lead * (i ? .87 : 1), "triangle", cutoff, .075);
      if (track === "dock" || index % 3 === 0) swell(bus, onset + .24, pitch, 1.45, lead * .21, "sine", cutoff, .18);
    });
    if (track === "watcher") {
      const drums = index % 4 === 2 ? [0, 1.95, 2.46] : index % 4 === 3 ? [.15] : [0, 1.42];
      for (const offset of drums) tone(bus, at + offset, 91, 38, .54, .155, "sine");
      if (index % 3 === 0) noise(bus, at + 2.6, .48, 460, .047);
    } else if (track === "fort" && index % 3 === 1) {
      swell(bus, at + .82, chord[0] - 12, duration * .73, .082, "sine", 280, .85);
    }
  }

  function score() {
    if (!active || !tracks[track] || document.hidden || context.state !== "running") return;
    if (next < context.currentTime) next = context.currentTime + .05;
    if (next < context.currentTime + .22) {
      const part = tracks[track];
      playBar(part, next);
      next += part.duration;
    }
  }

  function prepare() {
    context = new AudioContext();
    grit = context.createBuffer(1, Math.round(context.sampleRate * .56), context.sampleRate);
    const data = grit.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    master = context.createGain();
    const reverb = context.createConvolver();
    const impulse = context.createBuffer(2, Math.round(context.sampleRate * 2.35), context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (2 * Math.random() - 1) * (1 - i / samples.length) ** 3.1;
      }
    }
    reverb.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = .32;
    reverb.connect(wet).connect(master);
    music = Object.fromEntries(Object.keys(tracks).map(name => {
      const channel = context.createGain();
      channel.gain.value = name === track ? .31 : 0;
      channel.connect(master);
      channel.connect(reverb);
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

  function voice(kind) {
    if (!active || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .007;
    const pirate = kind === "pirate";
    const pitch = (pirate ? [230, 256, 240, 278, 252] : [103, 118, 109, 92, 121])[syllable++ % 5];
    tone(effects, at, pitch, pitch * (pirate ? .82 : .69), pirate ? .059 : .082,
      pirate ? .10 : .138, pirate ? "triangle" : "sawtooth", pirate ? 1420 : 670);
  }

  function effect(kind) {
    if (!active || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .01;
    if (kind === "pistol" || kind === "scatter" || kind === "musket") {
      noise(effects, at, kind === "scatter" ? .34 : kind === "musket" ? .28 : .21, kind === "musket" ? 920 : 1400, .63);
      tone(effects, at, kind === "musket" ? 181 : 122, 38, .19, .28, "sine");
    } else if (kind === "reload") {
      noise(effects, at, .13, 980, .25);
      tone(effects, at + .17, 720, 341, .071, .074, "triangle");
    } else if (kind === "reload-ready") {
      noise(effects, at, .12, 1710, .23);
      tone(effects, at + .013, 1090, 498, .10, .108, "triangle");
    } else if (kind === "dash") noise(effects, at, .18, 2800, .26);
    else if (kind === "arena") {
      noise(effects, at, .53, 570, .47);
      tone(effects, at, 73, 29, .87, .46, "triangle", 560);
    } else if (kind === "arena-rage") {
      tone(effects, at, 223, 45, .7, .32, "sawtooth", 650);
      noise(effects, at, .47, 1340, .24);
    } else if (kind === "arena-fury" || kind === "boss-charge") {
      tone(effects, at, 162, 34, .56, .31, "sawtooth", 540);
      noise(effects, at, .47, 760, .23);
    } else if (kind === "powder-mark") tone(effects, at, 320, 484, .34, .16, "triangle", 1700);
    else if (kind === "powder-burst") {
      tone(effects, at, 149, 30, .27, .29, "sine");
      noise(effects, at, .33, 660, .36);
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
    unlock, effect, voice,
    active(on) {
      active = on;
      if (master) master.gain.setTargetAtTime(on ? .6 : 0, context.currentTime, .045);
    },
    track(name) {
      if (track === name) return;
      track = name;
      bar = 0;
      if (!context) return;
      const now = context.currentTime;
      next = now + .075;
      for (const [name, channel] of Object.entries(music)) {
        channel.gain.setTargetAtTime(name === track ? .31 : 0, now, .23);
      }
    },
  };
}
