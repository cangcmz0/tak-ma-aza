// Synthesis recipes for every sound effect (GDD §14.4). Edit the numbers here to tune.
// Each recipe has an overlap rule (cooldown + max voices) and an approximate length used
// by the limiter. `render` schedules nodes starting at audio time `t`.
import type { PlayOptions, SoundName } from './audio';
import { NOTE, bell, dB, noise, pluck, semi, tone, type Synth } from './synth';

export interface Recipe {
  /** Minimum gap between two starts, ms. */
  cooldownMs: number;
  /** Max simultaneously ringing voices. */
  maxVoices: number;
  /** Approximate length, seconds (for the voice limiter). */
  dur: number;
  render(s: Synth, t: number, o: PlayOptions): void;
}

/** Chain pitch: each chain step +2 semitones (GDD §14.4), capped so it never gets shrill. */
export const CHAIN_SEMITONES_PER_STEP = 2;
export const CHAIN_PITCH_MAX_STEPS = 10;
export function chainSemitones(chain = 1): number {
  const step = Math.max(0, Math.min(CHAIN_PITCH_MAX_STEPS, Math.floor(chain) - 1));
  return step * CHAIN_SEMITONES_PER_STEP;
}

/** Hicaz on D: D Eb F# G A (Bb C D). Win motif ascends, lose motif descends. */
export const WIN_MOTIF = [NOTE.D4, NOTE.Eb4, NOTE.Fs4, NOTE.G4, NOTE.A4] as const;
export const LOSE_MOTIF = [NOTE.A4, NOTE.G4, NOTE.Fs4] as const;
export const STAR_NOTES = [NOTE.E5, NOTE.G5, NOTE.C6] as const;
/** Frequencies whose pluck buffers are pre-rendered on unlock. */
export const PLUCK_NOTES: readonly number[] = [NOTE.D3, NOTE.A3, ...WIN_MOTIF, NOTE.D5];

function arpeggio(s: Synth, t: number, chain: number, peak: number): void {
  const k = chainSemitones(chain);
  const notes = [NOTE.C5, NOTE.E5, NOTE.G5];
  notes.forEach((f, i) => {
    tone(s, { type: 'triangle', freq: semi(f, k), t: t + i * 0.06, attack: 0.004, decay: 0.22, peak, send: 0.35 });
  });
}

function thumpPair(s: Synth, t: number): void {
  for (const dt of [0, 0.23]) {
    // 60 Hz is the GDD note; a quiet 2nd/3rd harmonic keeps it audible on phone speakers.
    tone(s, { type: 'sine', freq: 70, freqEnd: 55, t: t + dt, attack: 0.005, decay: 0.08, peak: 0.45 });
    tone(s, { type: 'sine', freq: 140, freqEnd: 110, t: t + dt, attack: 0.005, decay: 0.06, peak: 0.12 });
    tone(s, { type: 'triangle', freq: 195, freqEnd: 165, t: t + dt, attack: 0.005, decay: 0.05, peak: 0.05 });
  }
}

function sackHit(s: Synth, t: number): void {
  tone(s, { type: 'sine', freq: 90, freqEnd: 70, t, attack: 0.004, decay: 0.1, peak: 0.45 });
  noise(s, { t, attack: 0.002, decay: 0.1, peak: 0.3, filter: { type: 'lowpass', freq: 400 } });
}

export const RECIPES: Record<SoundName, Recipe> = {
  // UI tap: square 1 kHz, 20 ms, −20 dB.
  ui_tap: {
    cooldownMs: 35,
    maxVoices: 2,
    dur: 0.03,
    render(s, t) {
      tone(s, { type: 'square', freq: 1000, t, attack: 0.002, decay: 0.02, peak: dB(-20), filter: { type: 'lowpass', freq: 4000 } });
    },
  },
  // Lifting a pouch: soft upward sine blip + tiny cloth rustle.
  pick: {
    cooldownMs: 50,
    maxVoices: 2,
    dur: 0.08,
    render(s, t) {
      tone(s, { type: 'sine', freq: 520, freqEnd: 820, t, attack: 0.005, decay: 0.06, peak: dB(-18) });
      noise(s, { t, attack: 0.004, decay: 0.05, peak: dB(-28), filter: { type: 'bandpass', freq: 3500, Q: 1.2 } });
    },
  },
  // Rotate: square 600 Hz, 30 ms, −18 dB (low-passed so it is a "tick", not a buzz).
  rotate: {
    cooldownMs: 45,
    maxVoices: 2,
    dur: 0.04,
    render(s, t) {
      tone(s, { type: 'square', freq: 600, t, attack: 0.002, decay: 0.03, peak: dB(-18), filter: { type: 'lowpass', freq: 2500 } });
    },
  },
  // Drop "puf": white noise, LP 900 Hz, fast attack, 70 ms decay, −12 dB, then a short
  // "şhh" of falling grains (band-passed noise sweeping down). The ongoing hiss is setFlow().
  drop: {
    cooldownMs: 60,
    maxVoices: 3,
    dur: 0.32,
    render(s, t) {
      noise(s, { t, attack: 0.004, decay: 0.07, peak: dB(-12), filter: { type: 'lowpass', freq: 900 } });
      noise(s, {
        pink: true,
        t: t + 0.02,
        attack: 0.03,
        decay: 0.26,
        peak: dB(-24),
        filter: { type: 'bandpass', freq: 4200, freqEnd: 1800, Q: 0.9 },
      });
    },
  },
  // Invalid drop: square 150 → 110 Hz, 120 ms (soft "bırr").
  blocked: {
    cooldownMs: 160,
    maxVoices: 1,
    dur: 0.13,
    render(s, t) {
      tone(s, { type: 'square', freq: 150, freqEnd: 110, t, attack: 0.004, decay: 0.12, peak: dB(-17), filter: { type: 'lowpass', freq: 1200 } });
    },
  },
  // Path clear "tıng": triangle arpeggio C5–E5–G5, 60 ms per note, light room reverb.
  // Each chain step +2 semitones.
  clear: {
    cooldownMs: 50,
    maxVoices: 4,
    dur: 0.4,
    render(s, t, o) {
      arpeggio(s, t, o.chain ?? 1, dB(-13));
    },
  },
  chain: {
    cooldownMs: 50,
    maxVoices: 4,
    dur: 0.4,
    render(s, t, o) {
      arpeggio(s, t, o.chain ?? 2, dB(-13));
    },
  },
  // Chain word: sine "sparkle" one octave above the clear arpeggio, 2 notes × 40 ms.
  chainWord: {
    cooldownMs: 120,
    maxVoices: 2,
    dur: 0.25,
    render(s, t, o) {
      const k = chainSemitones(o.chain ?? 2) + 12;
      tone(s, { type: 'sine', freq: semi(NOTE.E5, k), t, attack: 0.003, decay: 0.12, peak: dB(-19), send: 0.4 });
      tone(s, { type: 'sine', freq: semi(NOTE.C6, k), t: t + 0.04, attack: 0.003, decay: 0.16, peak: dB(-19), send: 0.4 });
    },
  },
  // Double: two clear arpeggios 30 ms apart (second one a chain step higher).
  double: {
    cooldownMs: 80,
    maxVoices: 2,
    dur: 0.45,
    render(s, t, o) {
      const c = o.chain ?? 2;
      arpeggio(s, t, Math.max(1, c - 1), dB(-15));
      arpeggio(s, t + 0.03, c, dB(-15));
    },
  },
  // Goal tick: sine 880 + 1320 Hz, 90 ms.
  goal: {
    cooldownMs: 90,
    maxVoices: 2,
    dur: 0.12,
    render(s, t) {
      tone(s, { type: 'sine', freq: 880, t, attack: 0.004, decay: 0.09, peak: dB(-16), send: 0.25 });
      tone(s, { type: 'sine', freq: 1320, t, attack: 0.004, decay: 0.09, peak: dB(-20), send: 0.25 });
    },
  },
  // Star: bell (sine + 2nd + 3rd harmonic), 600 ms exponential decay; index 0..2 → E5, G5, C6.
  star: {
    cooldownMs: 0,
    maxVoices: 3,
    dur: 0.62,
    render(s, t, o) {
      const i = Math.max(0, Math.min(STAR_NOTES.length - 1, o.index ?? 0));
      bell(s, STAR_NOTES[i], t, dB(-14), 0.6);
    },
  },
  // Win: Hicaz 5-note motif D–E♭–F♯–G–A, Karplus-Strong pluck, 110 ms per note,
  // with a soft D3 drone pluck under it and the octave D5 to close.
  win: {
    cooldownMs: 1000,
    maxVoices: 1,
    dur: 1.9,
    render(s, t) {
      pluck(s, NOTE.D3, t, dB(-14), 0.2, 1.6);
      WIN_MOTIF.forEach((f, i) => pluck(s, f, t + i * 0.11, dB(-8), 0.3, i === WIN_MOTIF.length - 1 ? 1.2 : 0.6));
      pluck(s, NOTE.D5, t + WIN_MOTIF.length * 0.11 + 0.06, dB(-11), 0.35, 1.2);
    },
  },
  // Lose: same timbre, descending A–G–F♯, slower, −6 dB. Gentle, no harsh hit (GDD §14.1).
  lose: {
    cooldownMs: 1000,
    maxVoices: 1,
    dur: 1.6,
    render(s, t) {
      LOSE_MOTIF.forEach((f, i) => pluck(s, f, t + i * 0.24, dB(-14), 0.3, i === LOSE_MOTIF.length - 1 ? 1.1 : 0.7));
      pluck(s, NOTE.D3, t + 0.72, dB(-20), 0.2, 1.0);
    },
  },
  // Bomb (acı biber): sine 120 → 40 Hz sweep 300 ms + noise burst (LP 600 Hz, 200 ms) + crackle.
  bomb: {
    cooldownMs: 90,
    maxVoices: 2,
    dur: 0.4,
    render(s, t) {
      tone(s, { type: 'sine', freq: 120, freqEnd: 40, t, attack: 0.004, decay: 0.3, peak: dB(-5) });
      noise(s, { t, attack: 0.002, decay: 0.2, peak: dB(-8), filter: { type: 'lowpass', freq: 600 } });
      noise(s, { t: t + 0.01, attack: 0.002, decay: 0.12, peak: dB(-18), filter: { type: 'highpass', freq: 2500 } });
    },
  },
  // Danger: two low "thumps" (sine 60 Hz-ish, 80 ms, 150 ms gap). Looped by setDanger().
  danger: {
    cooldownMs: 500,
    maxVoices: 1,
    dur: 0.35,
    render(s, t) {
      thumpPair(s, t);
    },
  },
  // Zerde's sneeze "ha… ha… HAPŞU!": two rising breathy inhales, a beat of silence,
  // then a bright noise burst with a squeaky falling "şu".
  sneeze: {
    cooldownMs: 800,
    maxVoices: 1,
    dur: 0.75,
    render(s, t) {
      // "ha…" "ha…" (second higher)
      for (const [dt, f0, f1] of [
        [0, 330, 480],
        [0.2, 400, 620],
      ] as const) {
        tone(s, { type: 'triangle', freq: f0, freqEnd: f1, t: t + dt, attack: 0.03, decay: 0.12, peak: dB(-22), vibrato: [18, 12], filter: { type: 'lowpass', freq: 1800 } });
        noise(s, { t: t + dt, attack: 0.04, decay: 0.11, peak: dB(-26), filter: { type: 'bandpass', freq: 900, freqEnd: 1800, Q: 1.5 } });
      }
      // "HAP-ŞU!"
      const b = t + 0.47;
      noise(s, { t: b, attack: 0.004, decay: 0.2, peak: dB(-9), filter: { type: 'bandpass', freq: 4500, freqEnd: 2500, Q: 0.8 } });
      noise(s, { t: b, attack: 0.002, decay: 0.05, peak: dB(-12), filter: { type: 'lowpass', freq: 700 } });
      tone(s, { type: 'square', freq: 950, freqEnd: 380, t: b + 0.01, attack: 0.004, decay: 0.15, peak: dB(-24), filter: { type: 'lowpass', freq: 2200 } });
    },
  },
  // Joker: 3 random sine blips 2–4 kHz, 30 ms apart.
  joker: {
    cooldownMs: 100,
    maxVoices: 2,
    dur: 0.12,
    render(s, t) {
      for (let i = 0; i < 3; i++) {
        tone(s, { type: 'sine', freq: 2000 + Math.random() * 2000, t: t + i * 0.03, attack: 0.002, decay: 0.025, peak: dB(-20), send: 0.3 });
      }
    },
  },
  // Sack hit: sine 90 Hz 100 ms + low-passed noise (400 Hz).
  sackHit: {
    cooldownMs: 80,
    maxVoices: 2,
    dur: 0.12,
    render(s, t) {
      sackHit(s, t);
    },
  },
  // Sack break: sackHit + high-passed "cırt" rip (3 kHz, 150 ms).
  sackBreak: {
    cooldownMs: 120,
    maxVoices: 2,
    dur: 0.2,
    render(s, t) {
      sackHit(s, t);
      noise(s, { t: t + 0.02, attack: 0.003, decay: 0.15, peak: dB(-14), filter: { type: 'highpass', freq: 3000 }, filter2: { type: 'peaking', freq: 5000, Q: 2 } });
    },
  },
  // Coin: two quick sines 1.3 kHz → 1.9 kHz, 50 ms.
  coin: {
    cooldownMs: 60,
    maxVoices: 3,
    dur: 0.12,
    render(s, t) {
      tone(s, { type: 'sine', freq: 1300, t, attack: 0.002, decay: 0.05, peak: dB(-17), send: 0.2 });
      tone(s, { type: 'sine', freq: 1900, t: t + 0.05, attack: 0.002, decay: 0.07, peak: dB(-17), send: 0.2 });
    },
  },
  // Booster "vuuş": band-pass noise sweep 400 Hz → 3 kHz, 250 ms.
  booster: {
    cooldownMs: 200,
    maxVoices: 1,
    dur: 0.27,
    render(s, t) {
      noise(s, { t, attack: 0.06, decay: 0.19, peak: dB(-11), filter: { type: 'bandpass', freq: 400, freqEnd: 3000, Q: 2 } });
    },
  },
};
