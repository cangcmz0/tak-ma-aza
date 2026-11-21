// Low-level synthesis helpers for the WebAudio service.
// Buffer generators are pure (Float32Array) so they run in Node tests too.

export const dB = (d: number): number => 10 ** (d / 20);
/** Transpose a frequency by `n` semitones. */
export const semi = (f: number, n: number): number => f * 2 ** (n / 12);

/** Note frequencies used by the recipes (equal temperament, A4 = 440). */
export const NOTE = {
  D3: 146.83,
  Fs3: 185.0,
  A3: 220.0,
  D4: 293.66,
  Eb4: 311.13,
  Fs4: 369.99,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
} as const;

// --- pure buffer generators ---------------------------------------------------

export function whiteNoise(n: number, rnd: () => number = Math.random): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rnd() * 2 - 1;
  return out;
}

/** Pink (1/f) noise, Paul Kellet's economy filter, normalised to ~±1. */
export function pinkNoise(n: number, rnd: () => number = Math.random): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  let peak = 1e-9;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    const v = b0 + b1 + b2 + w * 0.1848;
    out[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const k = 0.95 / peak;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/**
 * Karplus-Strong plucked string ("telli çalgı" — a saz-like pluck).
 * `decay` < 1 sets the sustain, `bright` 0..1 how much high end the pluck keeps.
 */
export function karplusStrong(
  sampleRate: number,
  freq: number,
  dur = 1.2,
  decay = 0.996,
  bright = 0.6,
  rnd: () => number = Math.random,
): Float32Array {
  const n = Math.max(1, Math.floor(sampleRate * dur));
  const out = new Float32Array(n);
  // The two-tap average adds half a sample of delay.
  const period = Math.max(2, Math.round(sampleRate / freq - 0.5));
  const line = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    // One-pole low-pass on the excitation: less bright = softer pick.
    const w = rnd() * 2 - 1;
    prev = prev + bright * (w - prev);
    line[i] = prev;
  }
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    const nxt = line[idx + 1 === period ? 0 : idx + 1];
    out[i] = cur;
    line[idx] = decay * 0.5 * (cur + nxt);
    idx = idx + 1 === period ? 0 : idx + 1;
  }
  // Short fade-out so the buffer end never clicks.
  const fade = Math.min(n, Math.floor(sampleRate * 0.03));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  // Normalise.
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = 0.9 / peak;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

export function toBuffer(ctx: BaseAudioContext, data: Float32Array): AudioBuffer {
  const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.getChannelData(0).set(data);
  return b;
}

// --- graph helpers ----------------------------------------------------------

/** Everything a recipe needs: context, output buses and shared, pre-built buffers. */
export interface Synth {
  readonly ctx: BaseAudioContext;
  /** Dry SFX bus. */
  readonly out: AudioNode;
  /** Short feedback-delay "room" send. */
  readonly verb: AudioNode;
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  /** Cached Karplus-Strong pluck for a frequency. */
  pluck(freq: number): AudioBuffer;
}

const SILENT = 0.0001;

/** Attack/decay envelope on a gain param (linear attack, exponential decay). */
export function envelope(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  p.setValueAtTime(SILENT, t);
  p.linearRampToValueAtTime(Math.max(SILENT, peak), t + attack);
  p.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  return t + attack + decay;
}

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  /** Optional sweep target (exponential). */
  freqEnd?: number;
  Q?: number;
}

function filterNode(s: Synth, f: FilterSpec, t: number, end: number): BiquadFilterNode {
  const bq = s.ctx.createBiquadFilter();
  bq.type = f.type;
  bq.frequency.setValueAtTime(f.freq, t);
  if (f.freqEnd !== undefined) bq.frequency.exponentialRampToValueAtTime(f.freqEnd, end);
  if (f.Q !== undefined) bq.Q.value = f.Q;
  return bq;
}

/** Route a voice gain to the dry bus and (optionally) the reverb send. */
function route(s: Synth, g: AudioNode, send: number, dest?: AudioNode): void {
  g.connect(dest ?? s.out);
  if (send > 0) {
    const sg = s.ctx.createGain();
    sg.gain.value = send;
    g.connect(sg);
    sg.connect(s.verb);
  }
}

export interface ToneSpec {
  type: OscillatorType;
  freq: number;
  /** Pitch sweep target (exponential). */
  freqEnd?: number;
  t: number;
  attack?: number;
  decay: number;
  peak: number;
  filter?: FilterSpec;
  /** Reverb send 0..1. */
  send?: number;
  /** Vibrato: [rate Hz, depth Hz]. */
  vibrato?: [number, number];
  dest?: AudioNode;
}

/** One oscillator voice. Returns its end time. */
export function tone(s: Synth, o: ToneSpec): number {
  const attack = o.attack ?? 0.004;
  const end = o.t + attack + o.decay;
  const osc = s.ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, end);
  const g = s.ctx.createGain();
  envelope(g.gain, o.t, o.peak, attack, o.decay);
  let head: AudioNode = osc;
  if (o.filter) {
    const f = filterNode(s, o.filter, o.t, end);
    osc.connect(f);
    head = f;
  }
  head.connect(g);
  route(s, g, o.send ?? 0, o.dest);
  let lfo: OscillatorNode | null = null;
  if (o.vibrato) {
    lfo = s.ctx.createOscillator();
    lfo.frequency.value = o.vibrato[0];
    const depth = s.ctx.createGain();
    depth.gain.value = o.vibrato[1];
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(o.t);
    lfo.stop(end + 0.02);
  }
  osc.start(o.t);
  osc.stop(end + 0.02);
  osc.onended = () => g.disconnect();
  return end;
}

export interface NoiseSpec {
  pink?: boolean;
  t: number;
  attack?: number;
  decay: number;
  peak: number;
  filter: FilterSpec;
  /** Optional second filter in series (e.g. a high-pass to thin out a burst). */
  filter2?: FilterSpec;
  send?: number;
  dest?: AudioNode;
}

/** One filtered-noise voice from the shared pre-generated buffers. Returns its end time. */
export function noise(s: Synth, o: NoiseSpec): number {
  const attack = o.attack ?? 0.003;
  const end = o.t + attack + o.decay;
  const src = s.ctx.createBufferSource();
  const buf = o.pink ? s.pink : s.white;
  src.buffer = buf;
  const f = filterNode(s, o.filter, o.t, end);
  src.connect(f);
  let head: AudioNode = f;
  if (o.filter2) {
    const f2 = filterNode(s, o.filter2, o.t, end);
    f.connect(f2);
    head = f2;
  }
  const g = s.ctx.createGain();
  envelope(g.gain, o.t, o.peak, attack, o.decay);
  head.connect(g);
  route(s, g, o.send ?? 0, o.dest);
  // Random start offset so repeated bursts do not sound identical.
  const span = Math.max(0, buf.duration - (end - o.t) - 0.05);
  src.start(o.t, Math.random() * span);
  src.stop(end + 0.02);
  src.onended = () => g.disconnect();
  return end;
}

/** Plucked string note from a cached Karplus-Strong buffer. */
export function pluck(s: Synth, freq: number, t: number, peak: number, send = 0.25, length = 1.1): number {
  const src = s.ctx.createBufferSource();
  src.buffer = s.pluck(freq);
  const g = s.ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.setValueAtTime(peak, t + length - 0.08);
  g.gain.linearRampToValueAtTime(SILENT, t + length);
  src.connect(g);
  route(s, g, send);
  src.start(t);
  src.stop(t + length + 0.02);
  src.onended = () => g.disconnect();
  return t + length;
}

/** Bell: sine + 2nd and 3rd harmonics, exponential decay. */
export function bell(s: Synth, freq: number, t: number, peak: number, decay: number, send = 0.3): number {
  tone(s, { type: 'sine', freq, t, attack: 0.003, decay, peak, send });
  tone(s, { type: 'sine', freq: freq * 2, t, attack: 0.003, decay: decay * 0.6, peak: peak * 0.45, send });
  return tone(s, { type: 'sine', freq: freq * 3, t, attack: 0.003, decay: decay * 0.35, peak: peak * 0.22, send });
}
