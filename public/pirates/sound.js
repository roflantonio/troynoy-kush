import { scoreUrl } from "./score.js?v=18";

const note = midi => 440 * 2 ** ((midi - 69) / 12);
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
  "vault-cutlass": { pitch: 178, cutoff: 1380, type: "triangle", scrape: 1430 },
  "vault-gunner": { pitch: 167, cutoff: 1260, type: "triangle", scrape: 1680 },
  "vault-shield": { pitch: 137, cutoff: 1110, type: "triangle", scrape: 1730 },
  "vault-brute": { pitch: 102, cutoff: 805, type: "triangle", scrape: 1040 },
  "fort-jailer": { pitch: 94, cutoff: 910, type: "square", scrape: 947 },
  "island-jailer": { pitch: 121, cutoff: 680, type: "sawtooth", scrape: 2190 },
  "vault-sniper": { pitch: 202, cutoff: 1330, type: "triangle", scrape: 2010 },
  "vault-powder": { pitch: 156, cutoff: 1030, type: "sawtooth", scrape: 1450 },
  "vault-boatswain": { pitch: 106, cutoff: 960, type: "square", scrape: 1660 },
  "rust-hook": { pitch: 121, cutoff: 978, type: "triangle", scrape: 1530 },
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
const voices = {
  pirate: { pitches: [230, 256, 240, 278, 252], fall: .82, span: .059, gain: .18, wave: "triangle", cutoff: 1420 },
  watcher: { pitches: [103, 118, 109, 92, 121], fall: .69, span: .082, gain: .23, wave: "sawtooth", cutoff: 670 },
  king: { pitches: [151, 167, 139, 186, 157], fall: .69, span: .082, gain: .23, wave: "sawtooth", cutoff: 670 },
  runa: { pitches: [465, 527, 492, 595, 553, 514], fall: .91, span: .081, gain: .20, wave: "triangle", cutoff: 2250 },
  brann: { pitches: [88, 101, 92, 106], fall: .67, span: .14, gain: .30, wave: "sawtooth", cutoff: 480 },
  shkiv: { pitches: [710, 930, 1150, 790, 1070], fall: .60, span: .107, gain: .15, wave: "sine", cutoff: 3000 },
  rust: { pitches: [128, 149, 121, 157, 138], fall: .72, span: .093, gain: .24, wave: "sawtooth", cutoff: 900 },
};

export function pirateSound(volumes) {
  let context;
  let musicBus;
  let effects;
  let grit;
  let syllable = 0;
  let track = "menu";
  let playing;
  let request = 0;
  const tracks = new Map();
  let musicLevel = volumes.music;
  let effectsLevel = volumes.effects;

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

  function loadTrack(name) {
    const cached = tracks.get(name);
    if (cached) {
      tracks.delete(name);
      tracks.set(name, cached);
      return cached;
    }
    const loading = fetch(scoreUrl(name))
      .then(response => {
        if (!response.ok) throw new Error("Soundtrack unavailable");
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(error => {
        if (tracks.get(name) === loading) tracks.delete(name);
        throw error;
      });
    tracks.set(name, loading);
    if (tracks.size > 3) tracks.delete(tracks.keys().next().value);
    return loading;
  }

  async function syncMusic() {
    const token = ++request;
    if (playing) {
      const { source, level } = playing;
      const now = context.currentTime;
      level.gain.cancelScheduledValues(now);
      level.gain.setTargetAtTime(0, now, .095);
      source.stop(now + .44);
      playing = null;
    }
    if (!musicLevel || context?.state !== "running" || document.hidden || track === "silence") return;
    try {
      const buffer = await loadTrack(track);
      if (token !== request) return;
      const source = context.createBufferSource();
      const level = context.createGain();
      const now = context.currentTime;
      level.gain.setValueAtTime(0, now);
      level.gain.setTargetAtTime(.38, now, .15);
      source.buffer = buffer;
      source.loop = true;
      source.connect(level).connect(musicBus);
      source.start(now);
      playing = { source, level };
    } catch { /* A missing track must not interrupt play. */ }
  }

  function prepare() {
    context = new AudioContext();
    grit = context.createBuffer(1, Math.round(context.sampleRate * .56), context.sampleRate);
    const data = grit.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const master = context.createGain();
    musicBus = context.createGain();
    musicBus.gain.value = musicLevel;
    musicBus.connect(master);
    effects = context.createGain();
    effects.gain.value = .50 * effectsLevel;
    master.gain.value = .6;
    effects.connect(master);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -17;
    limiter.ratio.value = 3;
    limiter.attack.value = .006;
    limiter.release.value = .18;
    master.connect(limiter).connect(context.destination);
    context.onstatechange = () => syncMusic();
  }

  async function unlock() {
    if (!musicLevel && !effectsLevel) return;
    try {
      if (!context) prepare();
      if (context.state !== "running") await context.resume();
    } catch { /* A browser can decline audio playback while the game continues. */ }
  }

  document.addEventListener("visibilitychange", syncMusic);

  function voice(kind, reply = false) {
    if (!effectsLevel || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .007;
    const { pitches, fall, span, gain, wave, cutoff } = voices[kind] ?? voices.pirate;
    const count = reply ? (kind === "runa" ? 5 : kind === "shkiv" ? 4 : 2) : 1;
    for (let i = 0; i < count; i++) {
      const pitch = pitches[syllable++ % pitches.length];
      const when = at + i * (kind === "brann" ? .24 : .114);
      tone(effects, when, pitch, pitch * fall, span, gain, wave, cutoff);
      if (kind === "shkiv") tone(effects, when + .036, pitch * .79, pitch * 1.35, .079, gain * .56, "triangle", cutoff);
    }
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
    const timbre = enemyTimbres[color] ?? enemyTimbres.drowned;
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
    if (!effectsLevel || !context || context.state !== "running" || document.hidden) return;
    const at = context.currentTime + .01;
    const bus = spatialBus(position);
    if (kind.startsWith("enemy-") || kind === "defeat") {
      enemyFoley(kind, color, bus, at);
      return;
    }
    if (kind === "pistol" || kind === "scatter" || kind === "musket") {
      noise(bus, at, kind === "scatter" ? .34 : kind === "musket" ? .28 : .21, kind === "musket" ? 920 : 1400, .63);
      tone(bus, at, kind === "musket" ? 181 : 122, 38, .19, .28, "sine");
    } else if (kind === "spell") {
      noise(bus, at, .31, 2140, .29);
      [55, 62, 70, 74].forEach((pitch, index) => swell(bus, at + index * .046, pitch, .35, .13, "triangle", 2200, .05));
    } else if (kind === "rally") {
      tone(bus, at, 164, 246, .16, .21, "square", 1180);
      tone(bus, at + .14, 220, 145, .28, .23, "sawtooth", 1080);
    } else if (kind === "coin") {
      tone(bus, at, 1060, 1590, .15, .19, "triangle", 2700);
      tone(bus, at + .05, 1630, 2190, .15, .12, "sine");
    } else if (kind === "chain-hook") {
      noise(bus, at, .32, 1850, .29);
      tone(bus, at + .015, 740, 176, .27, .20, "triangle", 1860);
    } else if (kind === "sea-cannon" || kind === "sea-enemy-cannon") {
      const distant = kind === "sea-enemy-cannon";
      noise(bus, at, .50, distant ? 620 : 880, distant ? .34 : .70);
      tone(bus, at, 122, 29, .37, distant ? .22 : .40, "sine");
    } else if (["ship-hit", "ship-sink", "kraken-hit", "kraken-rise", "kraken-fall"].includes(kind)) {
      const large = kind === "ship-sink" || kind === "kraken-rise" || kind === "kraken-fall";
      noise(bus, at, large ? .54 : .22, large ? 575 : 1260, large ? .50 : .27);
      tone(bus, at, large ? 93 : 165, large ? 27 : 60, large ? .75 : .2, .22, "triangle");
    } else if (kind === "kraken-warn" || kind === "kraken-ink" || kind === "kraken-splash") {
      const warning = kind === "kraken-warn";
      tone(bus, at, warning ? 215 : 133, warning ? 295 : 41, .36, warning ? .17 : .28, "triangle", 1050);
      noise(bus, at, warning ? .24 : .49, kind === "kraken-ink" ? 1410 : 685, warning ? .11 : .42);
    } else if (kind === "sea-signal" || kind === "ship-warn" || kind === "sea-evade") {
      const order = kind === "sea-signal";
      tone(bus, at, order ? 610 : 367, order ? 587 : 412, .20, order ? .21 : .095, "triangle");
      if (order) tone(bus, at + .18, 697, 570, .22, .17, "triangle");
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
    } else if (kind === "king-charge" || kind === "king-stomp" || kind === "king-root") {
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
    volume(channel, level) {
      if (channel === "music") {
        const changed = Boolean(musicLevel) !== Boolean(level);
        musicLevel = level;
        musicBus?.gain.setTargetAtTime(level, context.currentTime, .045);
        if (changed) syncMusic();
      } else {
        effectsLevel = level;
        effects?.gain.setTargetAtTime(.50 * level, context.currentTime, .045);
      }
    },
    track(name) {
      if (track === name) return;
      track = name;
      syncMusic();
    },
  };
}
