const note = midi => 440 * 2 ** ((midi - 69) / 12);
// Each theme has a full harmonic progression with room for sound effects.
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
  [[40,47,53,58],[64,65,58]], [[40,47,52,53],[64,59]], [[38,45,50,56],[62,63,56]], [[41,48,53,59],[65,59]],
  [[40,47,52,58],[64,58,59]], [[43,50,56,59],[67,68]], [[41,48,53,59],[65,60,59]], [[39,46,51,58],[63]],
  [[40,47,53,58],[71,65,64]], [[41,48,53,60],[72,67]], [[37,44,52,55],[64,67,61]], [[38,45,50,56],[62,56]],
  [[40,47,52,59],[64,71,65]], [[42,49,54,60],[66,60]], [[41,48,53,59],[65,71,65]], [[35,42,47,53],[59,65]],
  [[40,47,53,58],[76,77,70]], [[38,45,52,56],[74,68]], [[36,43,48,54],[72,66,67]], [[37,44,49,55],[73,67]],
  [[40,47,52,58],[76,71,70]], [[41,48,53,59],[77,71]], [[35,42,48,53],[71,65,60]], [[40,47,53,58],[64,58]],
];
const WATCHER_TICK = 60 / 144 / 4;

const jungle = [
  [45,[69,72,74]], [45,[76,74,72]], [48,[67,72,67]], [43,[65,67,69]],
  [45,[69,72,76]], [50,[74,77,76]], [41,[72,69,65]], [43,[67,65,62]],
  [45,[69,72,74,76]], [48,[79,76,72]], [43,[67,72,74]], [40,[71,67,64]],
  [45,[64,69,72]], [41,[65,69,72]], [43,[74,71,67]], [50,[74,77,81,77]],
  [45,[76,72,69]], [48,[72,76,79]], [50,[81,77,74]], [43,[74,72,67]],
  [41,[65,67,69]], [43,[67,71,74]], [45,[76,74,72]], [40,[71,67,64]],
  [45,[69,72,76]], [43,[74,71,67]], [50,[77,76,74]], [41,[72,69,65]],
  [48,[67,72,76]], [43,[67,71,74]], [40,[71,67,64]], [45,[69,64,69]],
];
const throne = [
  [40,[64,65,59]], [40,[67,65,64]], [41,[65,60,66]], [38,[62,65,61]],
  [40,[64,71,65]], [43,[67,68,62]], [41,[65,72,66]], [35,[59,65,62]],
  [40,[64,65,71]], [38,[62,66,65]], [36,[60,67,65]], [41,[65,72,69]],
  [40,[76,74,71]], [43,[79,74,68]], [37,[73,76,67]], [35,[71,65,62]],
  [40,[76,77,71]], [41,[77,72,66]], [38,[74,77,65]], [39,[75,82,70]],
  [40,[76,71,65]], [43,[79,74,71]], [38,[74,65,62]], [40,[64,65,71]],
  [40,[76,77,83]], [41,[77,84,72]], [37,[73,76,67]], [35,[71,65,59]],
  [40,[76,71,65]], [38,[74,68,65]], [41,[77,72,65]], [40,[76,71,64]],
];
const ISLAND_BEAT = .263;
const KING_TICK = 60 / 152 / 4;

const tracks = {
  dock: { bars: shore, duration: 4.4, air: .49, cutoff: 1240, lead: .114 },
  fort: { bars: depths, duration: 4.0 },
  watcher: { bars: oath, duration: 32 * WATCHER_TICK },
  island: { bars: jungle, duration: 12 * ISLAND_BEAT },
  king: { bars: throne, duration: 32 * KING_TICK },
};

const fortKicks = [
  [0, 3, 6, 8, 11, 14], [0, 2, 5, 8, 12, 15], [0, 4, 7, 10, 12, 14], [0, 3, 8, 11, 13],
];
const fortBass = [
  [[0, 0], [3, 0], [5, 1], [6, 0], [8, 0], [11, 2], [12, 1], [14, 0]],
  [[0, 0], [2, 1], [5, 0], [7, 2], [8, 0], [10, 0], [12, 1], [15, 2]],
  [[0, 0], [3, 1], [4, 0], [7, 0], [10, 2], [12, 0], [14, 1]],
  [[0, 0], [3, 0], [6, 1], [8, 0], [11, 0], [14, 2]],
];
const enemyTimbres = {
  drowned: { pitch: 131, cutoff: 465, type: "sawtooth", scrape: 710 },
  crab: { pitch: 366, cutoff: 1750, type: "triangle", scrape: 2590 },
  sentinel: { pitch: 224, cutoff: 1250, type: "triangle", scrape: 1280 },
  corsair: { pitch: 179, cutoff: 820, type: "sawtooth", scrape: 1110 },
  captain: { pitch: 91, cutoff: 590, type: "sawtooth", scrape: 640 },
  macaque: { pitch: 438, cutoff: 1775, type: "triangle", scrape: 2050 },
  slinger: { pitch: 302, cutoff: 1340, type: "square", scrape: 1320 },
  viper: { pitch: 548, cutoff: 1600, type: "triangle", scrape: 3260 },
  mask: { pitch: 198, cutoff: 770, type: "sine", scrape: 880 },
  gorilla: { pitch: 87, cutoff: 505, type: "sawtooth", scrape: 690 },
  king: { pitch: 111, cutoff: 885, type: "square", scrape: 835 },
};
const floorTimbres = {
  wood: { foot: 142, grit: 825, decay: .145, weight: .16 },
  damp: { foot: 97, grit: 1760, decay: .22, weight: .105 },
  stone: { foot: 113, grit: 2250, decay: .105, weight: .13 },
  flagstone: { foot: 82, grit: 1520, decay: .18, weight: .15 },
  sand: { foot: 92, grit: 2360, decay: .16, weight: .08 },
  leaves: { foot: 133, grit: 1960, decay: .14, weight: .10 },
  "forest-stone": { foot: 105, grit: 1830, decay: .17, weight: .12 },
};

export function pirateSound(enabled) {
  let context;
  let master;
  let music;
  let effects;
  let pursuit;
  let grit;
  let next = 0;
  let bar = 0;
  let syllable = 0;
  let track = "dock";
  let danger = 0;
  let watcherPhase = 0;
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
    source.start(at, Math.random() * Math.max(0, grit.duration - span));
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

  // Two measures at 120 BPM per harmony. The percussion fills are arranged across the full cue.
  function fortBar(bus, at, chord, melody, index) {
    const groove = (index + Math.floor(index / 4)) % fortKicks.length;
    const [root, fifth] = chord;
    const bass = [root - 12, fifth - 12, root];
    for (const [tick, degree] of fortBass[groove]) {
      const frequency = note(bass[degree]);
      tone(bus, at + tick * .25, frequency, frequency, tick % 2 ? .18 : .26, degree ? .103 : .147, "triangle", 395);
    }
    for (const tick of fortKicks[groove]) {
      tone(bus, at + tick * .25, tick % 2 ? 84 : 112, 42, .22, tick % 2 ? .127 : .255, "sine");
    }
    for (const tick of [4, 12]) {
      const accent = at + tick * .25;
      noise(bus, accent, .19, 1480, .16);
      tone(bus, accent, 181, 92, .11, .085, "triangle", 475);
    }
    const shakerStart = index % 4 === 3 ? 2 : 1;
    for (let tick = shakerStart; tick < 16; tick += 2) {
      noise(bus, at + tick * .25, .077, 4880, tick % 4 === 1 ? .051 : .027);
    }

    const bed = index % 8 < 4 ? .044 : .030;
    for (const pitch of chord.slice(1)) swell(bus, at, pitch, 4.24, bed, "sine", 950, .29);
    melody.forEach((pitch, i) => {
      const offset = (.50 + .25 * (index % 3)) + i * .75;
      swell(bus, at + offset, pitch, .73, .104, "triangle", 1450, .040);
      if (i === 0 && index % 3 === 0) swell(bus, at + offset + .51, pitch - 12, .90, .036, "sine", 860, .10);
    });
    for (const tick of index % 4 === 3 ? [7, 9, 13, 14, 15] : [3, 7, 11, 15]) {
      const fill = at + tick * .25;
      tone(pursuit, fill, 165 - (tick % 3) * 19, 62, .23, .215, "triangle", 760);
      noise(pursuit, fill + .039, .087, 2320, .088);
    }
  }

  function watcherBar(bus, at, chord, motif, index) {
    const tickTime = tick => at + tick * WATCHER_TICK;
    const root = chord[0];
    const final = watcherPhase === 2;
    const accent = index % 4;
    const bass = [root - 12, root - 11, chord[1] - 12];
    const phrase = accent % 2 ? [0, 3, 6, 8, 10, 13, 15, 16, 20, 22, 25, 28, 30]
      : [0, 2, 4, 7, 9, 12, 14, 16, 18, 21, 24, 27, 29, 31];
    for (const [i, tick] of phrase.entries()) {
      const pitch = note(bass[(i + accent) % 7 === 3 ? 1 : i % 7 === 6 ? 2 : 0]);
      tone(bus, tickTime(tick), pitch, pitch, .15, .235, "sawtooth", final ? 660 : 490);
      if (tick % 4 === 0) tone(bus, tickTime(tick), pitch, pitch, .20, .10, "sine");
    }
    const kicks = accent === 3 ? [0, 3, 7, 10, 12, 15, 16, 19, 23, 26, 28, 30]
      : [0, 2, 6, 8, 11, 15, 16, 18, 22, 24, 27, 30];
    for (const tick of kicks) tone(bus, tickTime(tick), 132, 38, .22, tick % 4 === 0 ? .31 : .18, "sine");
    for (const tick of [4, 12, 20, 28]) {
      noise(bus, tickTime(tick), .22, 1860, .21);
      tone(bus, tickTime(tick), 201, 66, .20, .203, "triangle", 800);
    }
    const extra = final ? [1, 5, 13, 17, 21, 25, 29, 31] : watcherPhase ? [5, 13, 21, 29] : [];
    for (const tick of extra) tone(bus, tickTime(tick), 157, 49, .15, .193, "triangle", 680);
    for (const offset of [0, 16]) {
      for (const pitch of chord.slice(1)) swell(bus, tickTime(offset), pitch, 1.86, .075,
        pitch === chord[2] ? "sawtooth" : "triangle", 680, .073);
      if (accent % 2 || offset === 0) {
        tone(bus, tickTime(offset), 390, 298, .49, .10, "triangle", 1350);
        tone(bus, tickTime(offset + .15), 557, 483, .37, .065, "sine");
      }
    }
    motif.forEach((pitch, i) => {
      const onset = tickTime(6 + i * 7 + (accent % 2 ? 2 : 0));
      swell(bus, onset, pitch - 12, .56, .145, "sawtooth", 1420, .041);
      if (i === 0 || final) swell(bus, onset + .024, pitch, .47, .044, "triangle", 1520, .055);
    });
  }

  function islandBar(bus, at, root, melody, index) {
    const beat = n => at + n * ISLAND_BEAT;
    const accents = index % 4 === 3 ? [0, 2, 4, 6, 9, 10, 11] : [0, 3, 5, 6, 8, 10];
    for (const n of accents) {
      const down = n % 3 === 0;
      tone(bus, beat(n), down ? 147 : 208, down ? 62 : 112, .16, down ? .20 : .12, "sine");
      noise(bus, beat(n) + .014, .086, down ? 846 : 1400, .09);
    }
    for (const n of [1, 4, 7, 10]) noise(bus, beat(n), .095, 4200, .063);
    for (const n of [0, 3, 6, 9]) {
      const pitch = note(root - 12 + (n === 9 ? 7 : 0));
      tone(bus, beat(n), pitch, pitch, .35, .171, "triangle", 540);
    }
    for (const [i, pitch] of melody.entries()) {
      const onset = beat([.62, 3.83, 7.1, 9.2][i]);
      tone(bus, onset, note(pitch), note(pitch), .31, .138, "triangle", 1770);
      tone(bus, onset, note(pitch + 12), note(pitch + 12), .08, .041, "sine");
      if (index % 2) swell(bus, onset + .087, pitch - 12, .68, .060, "sine", 1030, .093);
    }
    if (index % 8 < 4) swell(bus, beat(2), root + 12, 2.71, .057, "sine", 850, .55);
  }

  function kingBar(bus, at, root, riff, index) {
    const tick = n => at + n * KING_TICK;
    const late = watcherPhase === 2;
    const bassSteps = index % 4 === 3 ? [0,3,4,7,8,11,13,16,19,20,23,24,26,29,31]
      : [0,2,4,6,9,11,13,16,18,20,22,24,27,30];
    for (const [i, n] of bassSteps.entries()) {
      const frequency = note(root - 12 + (i % 7 === 4 ? 1 : i % 9 === 7 ? 7 : 0));
      tone(bus, tick(n), frequency, frequency, .15, .242, "sawtooth", late ? 925 : 690);
      if (n % 4 === 0) tone(bus, tick(n), frequency, frequency, .18, .13, "sine");
    }
    for (const n of [0,4,8,12,16,20,24,28]) tone(bus, tick(n), 163, 39, .21, .31, "sine");
    const congas = late ? [1,3,6,9,10,11,14,15,17,19,22,23,25,27,29,31]
      : watcherPhase ? [3,6,9,11,14,15,19,22,23,27,30,31] : [3,6,9,14,19,22,27,30];
    for (const n of congas) {
      tone(bus, tick(n), n % 2 ? 264 : 206, n % 2 ? 132 : 90, .149, .134, "triangle", 1250);
      noise(bus, tick(n), .095, 1920 + (n % 4) * 170, .087);
    }
    for (const n of [4,12,20,28]) noise(bus, tick(n) + .02, .17, 3440, .157);
    for (const [i, pitch] of riff.entries()) {
      const push = [0, .35, .14, .53][Math.floor(index / 8)];
      const atNote = tick(3 + i * 8 + index % 2 + push);
      const freq = note(pitch);
      tone(bus, atNote, freq, freq * .94, .26, .133, i % 2 ? "sawtooth" : "square", 1710);
      if (late || i === 0) tone(bus, atNote + .023, freq * 2.01, freq * 1.98, .14, .042, "triangle");
    }
  }

  function playBar(part, at) {
    const index = bar++ % part.bars.length;
    const [chord, melody] = part.bars[index];
    const bus = music[track];
    if (track === "island") {
      islandBar(bus, at, chord, melody, index);
      return;
    }
    if (track === "king") {
      kingBar(bus, at, chord, melody, index);
      return;
    }
    if (track === "fort") {
      fortBar(bus, at, chord, melody, index);
      return;
    }
    if (track === "watcher") {
      watcherBar(bus, at, chord, melody, index);
      return;
    }
    const { duration, air, cutoff, lead } = part;
    chord.forEach((pitch, i) => swell(bus, at + i * .065, pitch, duration * 1.17,
      i === 0 ? .113 : .052, i === 1 || i === 2 ? "triangle" : "sine", cutoff * .65, air));
    const spacing = melody.length === 3 ? .72 : .99;
    const start = [0.46, 0.77, 1.2, 0.88][index % 4];
    melody.forEach((pitch, i) => {
      const onset = at + start + i * spacing;
      swell(bus, onset, pitch, 1.84 + i * .14, lead * (i ? .87 : 1), "triangle", cutoff, .075);
      swell(bus, onset + .24, pitch, 1.45, lead * .21, "sine", cutoff, .18);
    });
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
    pursuit = context.createGain();
    pursuit.gain.value = danger;
    pursuit.connect(music.fort);
    effects = context.createGain();
    effects.gain.value = .50;
    master.gain.value = active ? .6 : 0;
    effects.connect(master);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -17;
    limiter.ratio.value = 3;
    limiter.attack.value = .006;
    limiter.release.value = .18;
    master.connect(limiter).connect(context.destination);
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
    const pitches = pirate ? [230, 256, 240, 278, 252] : kind === "king" ? [151, 167, 139, 186, 157] : [103, 118, 109, 92, 121];
    const pitch = pitches[syllable++ % pitches.length];
    tone(effects, at, pitch, pitch * (pirate ? .82 : .69), pirate ? .059 : .082,
      pirate ? .10 : .138, pirate ? "triangle" : "sawtooth", pirate ? 1420 : 670);
  }

  function spatialBus(position) {
    if (!position) return effects;
    const volume = context.createGain();
    volume.gain.value = position.level;
    let output = volume;
    if (position.muffled) {
      const lowPass = context.createBiquadFilter();
      lowPass.frequency.value = 700;
      output = output.connect(lowPass);
    }
    if (typeof context.createStereoPanner === "function") {
      const stereo = context.createStereoPanner();
      stereo.pan.value = position.pan;
      output = output.connect(stereo);
    }
    output.connect(effects);
    return volume;
  }

  function enemyFoley(kind, color, bus, at) {
    if (color === "charge" || color === "powder") {
      const lunge = color === "charge";
      tone(bus, at, lunge ? 70 : 222, lunge ? 164 : 455, .52, .29, lunge ? "sawtooth" : "triangle", lunge ? 590 : 1700);
      noise(bus, at + .09, .37, lunge ? 850 : 2190, .23);
      return;
    }
    const timbre = enemyTimbres[color];
    const { pitch, cutoff, type, scrape } = timbre;
    const varied = pitch * (.89 + Math.random() * .22);
    if (kind === "enemy-step") {
      noise(bus, at, .11, scrape, .14);
      if (color === "sentinel" || color === "crab") {
        tone(bus, at, varied * 3.1, varied * 1.7, .08, .084, "triangle", cutoff * 2);
      } else tone(bus, at, 94, 53, .105, .078, "sine");
    } else if (kind === "enemy-alert") {
      noise(bus, at, .23, scrape, .22);
      tone(bus, at, varied * .84, varied * 1.24, .33, .30, type, cutoff);
      tone(bus, at + .125, varied * 1.27, varied * .61, .30, .20, type, cutoff);
    } else if (kind === "enemy-windup") {
      noise(bus, at, .17, scrape * 1.3, .24);
      tone(bus, at, varied * (color === "corsair" ? 2.7 : .75), varied * 1.35,
        .23, .23, type, cutoff * 1.35);
    } else if (kind === "enemy-strike" || kind === "enemy-hit") {
      noise(bus, at, .13, scrape * 1.5, .31);
      tone(bus, at, varied * 1.48, varied * .69, .16, .21, type, cutoff * 1.4);
    } else {
      noise(bus, at, .28, scrape * .79, .30);
      tone(bus, at, varied * 1.15, varied * .36, .42, .26, type, cutoff);
      tone(bus, at + .16, 104, 51, .24, .11, "sine");
    }
  }

  function effect(kind, color, position) {
    if (!active || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .01;
    const bus = spatialBus(position);
    if (kind.startsWith("enemy-") || kind === "defeat") {
      enemyFoley(kind, color, bus, at);
      return;
    }
    if (kind === "pistol" || kind === "scatter" || kind === "musket") {
      noise(bus, at, kind === "scatter" ? .34 : kind === "musket" ? .28 : .21, kind === "musket" ? 920 : 1400, .63);
      tone(bus, at, kind === "musket" ? 181 : 122, 38, .19, .28, "sine");
    } else if (kind === "reload") {
      noise(bus, at, .13, 980, .25);
      tone(bus, at + .17, 720, 341, .071, .074, "triangle");
    } else if (kind === "reload-ready") {
      noise(bus, at, .12, 1710, .23);
      tone(bus, at + .013, 1090, 498, .10, .108, "triangle");
    } else if (kind === "player-step") {
      const { foot, grit: texture, decay, weight } = floorTimbres[color];
      const variation = .89 + Math.random() * .22;
      tone(bus, at, foot * variation, foot * .55, decay, weight, "sine");
      noise(bus, at + .006, decay, texture * variation, .24);
      if (color === "damp") noise(bus, at + .063, .14, 2950 * variation, .135);
      if (color === "wood") tone(bus, at + .028, 465 * variation, 284, .13, .069, "triangle", 1130);
    } else if (kind === "ambience") {
      if (color === "jungle") {
        tone(bus, at, 1160, 1780, .095, .064, "sine", 2450);
        tone(bus, at + .19, 1510, 982, .135, .046, "sine", 2240);
        noise(bus, at, .43, 2070, .11);
      } else if (color === "dock") {
        noise(bus, at, .53, 430, .17);
        tone(bus, at + .17, 312, 173, .48, .073, "triangle", 660);
      } else {
        tone(bus, at, 810, 343, .13, .092, "sine");
        tone(bus, at + .28, 704, 320, .19, .048, "sine");
      }
    } else if (kind === "dash") {
      noise(bus, at, .20, 2400, .29);
      tone(bus, at + .032, 137, 72, .19, .093, "sine");
    } else if (kind === "arena") {
      noise(bus, at, .53, 570, .47);
      tone(bus, at, 73, 29, .87, .46, "triangle", 560);
    } else if (kind === "arena-rage") {
      tone(bus, at, 223, 45, .7, .32, "sawtooth", 650);
      noise(bus, at, .47, 1340, .24);
    } else if (kind === "arena-fury" || kind === "boss-charge") {
      tone(bus, at, 162, 34, .56, .31, "sawtooth", 540);
      noise(bus, at, .47, 760, .23);
    } else if (kind === "secret-open") {
      noise(bus, at, .53, 676, .32);
      tone(bus, at, 119, 49, .56, .26, "triangle", 680);
      tone(bus, at + .29, 920, 330, .24, .14, "triangle", 1360);
    } else if (kind === "skill") {
      tone(bus, at, 370, 544, .27, .18, "triangle", 1220);
    } else if (kind === "king-bolt" || kind === "king-charge" || kind === "king-stomp" || kind === "king-root") {
      tone(bus, at, kind === "king-charge" ? 173 : 113, 42, .44, .29, "sawtooth", 610);
      noise(bus, at + .032, .33, kind === "king-root" ? 1750 : 940, .24);
    } else if (kind === "stone-bolt" || kind === "curse-bolt") {
      tone(bus, at, kind === "stone-bolt" ? 298 : 522, 111, .21, .177, "triangle", 1700);
      noise(bus, at, .145, 1490, .11);
    } else if (kind === "upgrade") {
      [57, 64, 69, 73].forEach((pitch, i) => swell(bus, at + i * .066, pitch, .56, .18, "triangle", 1700, .031));
    } else if (kind === "seal-open") {
      noise(bus, at, .53, 1000, .29);
      tone(bus, at + .06, 115, 47, .52, .20, "triangle", 650);
      tone(bus, at + .43, 800, 483, .15, .085, "triangle", 1560);
    } else if (kind === "powder-mark") tone(bus, at, 320, 484, .34, .16, "triangle", 1700);
    else if (kind === "powder-burst") {
      tone(bus, at, 149, 30, .27, .29, "sine");
      noise(bus, at, .33, 660, .36);
    } else if (kind === "boss-bolt") tone(bus, at, 192, 44, .31, .29, "sawtooth", 1140);
    else if (kind === "blade") noise(bus, at, .17, 2200, .31);
    else if (kind === "hurt" || kind === "dead") tone(bus, at, 130, 37, .25, .34, "sawtooth", 750);
    else if (kind === "shield") {
      tone(bus, at, 1460, 770, .14, .27, "triangle");
      tone(bus, at, 1100, 1070, .08, .20, "square", 1800);
    } else if (kind === "bolt") {
      noise(bus, at, .18, 1660, .49);
      tone(bus, at, 323, 106, .24, .22, "triangle", 1280);
    } else if (kind === "bolt-impact" || kind === "wall-hit") {
      const blade = color === "blade";
      noise(bus, at, blade ? .18 : .125, blade ? 1440 : 3100, .29);
      tone(bus, at, blade ? 352 : 195, 86, .13, .129, "triangle", 1260);
    } else if (kind === "empty") noise(bus, at, .065, 3600, .18);
    else if (kind === "equip" || kind === "pickup") {
      const healing = color === "heal";
      noise(bus, at, healing ? .19 : .084, healing ? 744 : 2050, .27);
      tone(bus, at + .016, healing ? 274 : 1060, healing ? 148 : 720, .12, .13, "triangle");
      if (color === "ammo") tone(bus, at + .093, 1530, 603, .093, .09, "triangle");
    } else if (kind === "relic" || kind === "win" || kind === "victory") {
      const notes = kind === "relic" ? [60, 64, 69, 72] : [55, 62, 67, 74];
      notes.forEach((n, i) => tone(bus, at + i * .081, note(n), note(n), .38, .18, "triangle", 1600));
    }
  }
  return {
    unlock, effect, voice,
    active(on) {
      active = on;
      if (master) master.gain.setTargetAtTime(on ? .6 : 0, context.currentTime, .045);
    },
    combat(level) {
      if (danger === level) return;
      const rise = level > danger;
      danger = level;
      if (pursuit) pursuit.gain.setTargetAtTime(level, context.currentTime, rise ? .23 : .78);
    },
    bossPhase(stage) { watcherPhase = stage; },
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
