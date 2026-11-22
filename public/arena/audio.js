const clampVolume = value => Math.max(0, Math.min(1, Number(value) || 0));
const hz = note => 440 * 2 ** ((note - 69) / 12);
const BASS = [33, 33, 45, 33, 33, 40, 33, 36, 29, 29, 41, 29, 31, 31, 43, 36];
const LEAD = [69, 72, 76, 81, 67, 72, 76, 79, 65, 69, 72, 77, 67, 71, 74, 79];

export class Soundtrack {
  constructor(music, effects) {
    this.musicVolume = clampVolume(music);
    this.effectsVolume = clampVolume(effects);
    this.inMatch = false;
  }

  async unlock() {
    try {
      if (!this.context) this.init();
      if (this.context.state !== "running") await this.context.resume();
    } catch { /* The controls still work on devices with sound disabled. */ }
  }

  init() {
    this.context = new AudioContext();
    this.musicBus = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.ratio.value = 5;
    this.musicBus.connect(this.compressor);
    this.effectsBus.connect(this.compressor);
    this.compressor.connect(this.context.destination);
    this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate / 3, this.context.sampleRate);
    const buffer = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) buffer[i] = Math.random() * 2 - 1;
    this.setVolumes(this.musicVolume, this.effectsVolume);
    this.beat = 0;
    this.nextBeat = this.context.currentTime + 0.07;
    setInterval(() => this.schedule(), 45);
  }

  setVolumes(music, effects) {
    this.musicVolume = clampVolume(music);
    this.effectsVolume = clampVolume(effects);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVolume ** 1.55 * 0.57, now, 0.045);
    this.effectsBus.gain.setTargetAtTime(this.effectsVolume ** 1.45 * 0.66, now, 0.025);
  }

  tone(bus, time, { from, to = from, length, volume, wave = "sine", cutoff = 20000 }) {
    const osc = this.context.createOscillator();
    const level = this.context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + length);
    level.gain.setValueAtTime(0.0001, time);
    level.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    level.gain.exponentialRampToValueAtTime(0.0001, time + length);
    if (cutoff < 20000) {
      const filter = this.context.createBiquadFilter();
      filter.frequency.value = cutoff;
      osc.connect(filter).connect(level);
    } else osc.connect(level);
    level.connect(bus);
    osc.start(time);
    osc.stop(time + length + 0.01);
  }

  noise(bus, time, length, from, to, volume, type = "bandpass") {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const level = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(from, time);
    filter.frequency.exponentialRampToValueAtTime(to, time + length);
    level.gain.setValueAtTime(0.0001, time);
    level.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    level.gain.exponentialRampToValueAtTime(0.0001, time + length);
    source.connect(filter).connect(level).connect(bus);
    source.start(time);
    source.stop(time + length);
  }

  schedule() {
    const context = this.context;
    if (context.state !== "running" || document.hidden) return;
    if (this.nextBeat < context.currentTime) this.nextBeat = context.currentTime + 0.055;
    while (this.nextBeat < context.currentTime + 0.16) {
      if (this.musicVolume > 0) this.musicStep(this.beat % 32, this.nextBeat);
      this.beat++;
      this.nextBeat += 60 / 122 / 4;
    }
  }

  musicStep(step, time) {
    const bus = this.musicBus;
    const offbeat = step % 4;
    if (offbeat === 0) this.tone(bus, time, { from: 152, to: 37, length: 0.2, volume: 0.37 });
    if (step % 8 === 4) this.noise(bus, time, 0.14, 3700, 1250, this.inMatch ? 0.18 : 0.11);
    if (offbeat === 2 || (this.inMatch && offbeat === 3)) this.noise(bus, time, 0.054, 11000, 5800, 0.075, "highpass");
    if (step % 2 === 0) this.tone(bus, time, { from: hz(BASS[step / 2]), length: 0.23, volume: 0.23, wave: "sawtooth", cutoff: this.inMatch ? 670 : 430 });
    if (offbeat === 0 || (this.inMatch && offbeat === 3)) {
      const note = hz(LEAD[Math.floor(step / 2)]);
      this.tone(bus, time + 0.015, { from: note, length: 0.28, volume: 0.105, wave: "triangle" });
      this.tone(bus, time + 0.091, { from: note, length: 0.24, volume: 0.028 });
    }
  }

  effect(kind, pan = 0, strength = 1) {
    const context = this.context;
    if (context?.state !== "running" || !this.effectsVolume || document.hidden) return;
    const now = context.currentTime;
    const spatial = context.createStereoPanner();
    spatial.pan.value = Math.max(-1, Math.min(1, pan));
    spatial.connect(this.effectsBus);
    setTimeout(() => spatial.disconnect(), 1400);
    const tone = (from, to, length, volume, wave = "sine", delay = 0, cutoff = 20000) =>
      this.tone(spatial, now + delay, { from, to, length, volume: volume * strength, wave, cutoff });
    const noise = (length, from, to, volume) => this.noise(spatial, now, length, from, to, volume * strength);
    switch (kind) {
      case "shot": tone(760, 114, 0.13, 0.33, "triangle"); tone(1270, 462, 0.055, 0.12, "square", 0, 1800); break;
      case "bounce": tone(1430, 620, 0.075, 0.16, "triangle"); break;
      case "hit": noise(0.11, 2100, 420, 0.26); tone(271, 56, 0.12, 0.26, "triangle"); break;
      case "burst": noise(0.28, 1700, 190, 0.37); tone(148, 29, 0.34, 0.32); break;
      case "dash": noise(0.22, 500, 4000, 0.38); tone(111, 440, 0.16, 0.14, "sawtooth", 0, 1100); break;
      case "drop": tone(277, 550, 0.19, 0.19, "triangle"); tone(659, 659, 0.34, 0.1, "sine", 0.08); break;
      case "crystal": [74, 81, 86].forEach((note, i) => tone(hz(note), hz(note), 0.27, 0.19, "triangle", i * 0.056)); break;
      case "spawn": [50, 57, 62].forEach((note, i) => tone(hz(note), hz(note), 0.22, 0.14, "triangle", i * 0.074)); break;
      case "over": [45, 57, 60, 64, 69, 76].forEach((note, i) => tone(hz(note), hz(note), 0.52, 0.21, "triangle", i * 0.073)); break;
      default: tone(490, 660, 0.13, 0.15, "triangle");
    }
  }
}
