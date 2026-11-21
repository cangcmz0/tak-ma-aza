// WebAudio implementation of AudioService: everything is synthesised, no files.
//
// - One AudioContext, created on the first user gesture (unlock) so browsers never warn
//   about autoplay; resume() + a silent buffer unlock mobile Safari/WebView.
// - Noise and Karplus-Strong buffers are generated once and reused (low latency).
// - Overlaps are limited per sound (cooldown + max voices, see sounds.ts / limiter.ts).
// - Master volume + mute; loops stop and the context suspends in the background.
// - Without WebAudio (Node tests, very old WebViews) every call is a safe no-op.
import type { AudioService, PlayOptions, SoundName } from './audio';
import { VoiceLimiter } from './limiter';
import { PLUCK_NOTES, RECIPES } from './sounds';
import { dB, karplusStrong, pinkNoise, toBuffer, whiteNoise, type Synth } from './synth';

/** Flow hiss peak gain (GDD: 0 → −22 dB). */
const FLOW_MAX_GAIN = dB(-22);
/** Flow fades out by itself if setFlow() is not refreshed within this time. */
export const FLOW_TIMEOUT_MS = 2500;
/** Danger loop period (GDD: every 1.2 s). */
export const DANGER_PERIOD_MS = 1200;
const MASTER_LEVEL = 0.9;

export interface WebAudioOptions {
  /** Context factory (tests inject a fake). Default: window.AudioContext / webkitAudioContext. */
  createContext?: () => AudioContext | null;
  /** Where to listen for the first gesture to auto-unlock (default window; null = none). */
  unlockTarget?: EventTarget | null;
  /** Document for visibility changes (default document; null = none). */
  doc?: Document | null;
  /** Clock in ms for the limiter (default performance.now). */
  now?: () => number;
}

type Ctor = new (opts?: AudioContextOptions) => AudioContext;

function defaultContext(): AudioContext | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const C = g.AudioContext ?? g.webkitAudioContext;
  if (!C) return null;
  try {
    return new C({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

function userActivationBlocked(): boolean {
  const ua = (globalThis.navigator as (Navigator & { userActivation?: { isActive: boolean } }) | undefined)?.userActivation;
  return !!ua && !ua.isActive;
}

const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

export class WebAudioService implements AudioService {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private failed = false;
  private resumeRequested = false;
  private enabled = true;
  private volume = 1;
  private readonly limiter = new VoiceLimiter<SoundName>((k) => RECIPES[k]);
  private readonly createContext: () => AudioContext | null;
  private readonly now: () => number;
  private readonly unlockTarget: EventTarget | null;

  // Flow loop.
  private flowSrc: AudioBufferSourceNode | null = null;
  private flowGain: GainNode | null = null;
  private flowLevel = 0;
  private flowTimer: ReturnType<typeof setTimeout> | null = null;
  private flowStopTimer: ReturnType<typeof setTimeout> | null = null;
  // Danger loop.
  private dangerTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: WebAudioOptions = {}) {
    this.createContext = opts.createContext ?? defaultContext;
    this.now = opts.now ?? (() => (globalThis.performance ? performance.now() : Date.now()));
    this.unlockTarget = opts.unlockTarget !== undefined ? opts.unlockTarget : ((globalThis as { window?: EventTarget }).window ?? null);
    for (const ev of UNLOCK_EVENTS) this.unlockTarget?.addEventListener(ev, this.onGesture, { capture: true, passive: true });
    const doc = opts.doc !== undefined ? opts.doc : ((globalThis as { document?: Document }).document ?? null);
    doc?.addEventListener('visibilitychange', () => (doc.hidden ? this.onHidden() : this.onVisible()));
  }

  /** True once a context exists and is (being) resumed. */
  get ready(): boolean {
    return !!this.ctx && (this.ctx.state === 'running' || this.resumeRequested);
  }

  get contextState(): string {
    return this.failed ? 'unavailable' : (this.ctx?.state ?? 'locked');
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentVolume(): number {
    return this.volume;
  }

  unlock(): void {
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    if (ctx.state !== 'running' && this.enabled) {
      this.resumeRequested = true;
      try {
        void ctx
          .resume()
          ?.then(() => this.onRunning())
          .catch(() => {
            this.resumeRequested = false;
          });
      } catch {
        this.resumeRequested = false;
      }
      // iOS: a (silent) buffer started inside the gesture unlocks output.
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* ignore */
      }
    } else if (ctx.state === 'running') {
      this.onRunning();
    }
  }

  /**
   * Play a one-shot. Returns true if it was scheduled (false: muted, locked, unavailable,
   * or rejected by the overlap limiter).
   */
  play(name: SoundName, opts: PlayOptions = {}): boolean {
    if (!this.enabled || this.volume <= 0) return false;
    const s = this.synth;
    if (!s || !this.ready) return false;
    const r = RECIPES[name];
    if (!r) return false;
    const delay = Math.max(0, opts.delay ?? 0);
    if (!this.limiter.tryStart(name, this.now() + delay * 1000, r.dur * 1000)) return false;
    try {
      r.render(s, s.ctx.currentTime + 0.005 + delay, opts);
      return true;
    } catch (err) {
      if (import.meta.env?.DEV) console.debug('[audio] render failed', name, err);
      return false;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyMaster();
    if (!on) {
      this.stopLoops();
      try {
        if (this.ctx?.state === 'running') void this.ctx.suspend()?.catch(() => {});
      } catch {
        /* ignore */
      }
      this.resumeRequested = false;
    } else if (this.ctx && this.ctx.state !== 'running') {
      this.unlock();
    }
  }

  setVolume(v: number): void {
    this.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    this.applyMaster();
    if (this.volume <= 0) this.stopLoops();
  }

  setFlow(level: number): void {
    const lv = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    if (this.flowTimer) clearTimeout(this.flowTimer);
    this.flowTimer = null;
    if (lv <= 0 || !this.enabled || this.volume <= 0 || !this.synth || !this.ready) {
      this.fadeFlow();
      return;
    }
    const s = this.synth;
    const ctx = s.ctx;
    if (this.flowStopTimer) clearTimeout(this.flowStopTimer);
    this.flowStopTimer = null;
    try {
      if (!this.flowSrc || !this.flowGain) {
        // Pink noise → band-pass 2.5 kHz (Q 0.7) → slow grainy tremolo → gain.
        const src = ctx.createBufferSource();
        src.buffer = s.pink;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2500;
        bp.Q.value = 0.7;
        const trem = ctx.createGain();
        trem.gain.value = 0.85;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 7;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.15;
        lfo.connect(lfoDepth);
        lfoDepth.connect(trem.gain);
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        src.connect(bp);
        bp.connect(trem);
        trem.connect(g);
        g.connect(s.out);
        src.start(ctx.currentTime, Math.random() * Math.max(0, s.pink.duration - 0.1));
        lfo.start(ctx.currentTime);
        src.onended = () => {
          try {
            lfo.stop();
          } catch {
            /* ignore */
          }
          g.disconnect();
        };
        this.flowSrc = src;
        this.flowGain = g;
      }
      // 100 ms smoothing (time constant ≈ 1/3 of it).
      this.flowGain.gain.setTargetAtTime(Math.max(0.0001, lv * FLOW_MAX_GAIN), ctx.currentTime, 0.033);
      this.flowLevel = lv;
    } catch {
      this.flowSrc = null;
      this.flowGain = null;
      return;
    }
    this.flowTimer = setTimeout(() => this.setFlow(0), FLOW_TIMEOUT_MS);
  }

  /** Current flow loop level (0 when silent). */
  get flow(): number {
    return this.flowLevel;
  }

  setDanger(on: boolean): void {
    if (on) {
      if (this.dangerTimer || !this.enabled) return;
      this.play('danger');
      this.dangerTimer = setInterval(() => this.play('danger'), DANGER_PERIOD_MS);
    } else if (this.dangerTimer) {
      clearInterval(this.dangerTimer);
      this.dangerTimer = null;
    }
  }

  get dangerOn(): boolean {
    return this.dangerTimer !== null;
  }

  stopLoops(): void {
    if (this.flowTimer) clearTimeout(this.flowTimer);
    this.flowTimer = null;
    this.fadeFlow();
    this.setDanger(false);
  }

  // --- internals -----------------------------------------------------------

  private readonly onGesture = (): void => {
    if (this.failed || (this.ctx && this.ctx.state === 'running')) return this.removeGestureListeners();
    // Creating the context outside a real activation would log an autoplay warning.
    if (!this.ctx && userActivationBlocked()) return;
    this.unlock();
  };

  private removeGestureListeners(): void {
    for (const ev of UNLOCK_EVENTS) this.unlockTarget?.removeEventListener(ev, this.onGesture, { capture: true });
  }

  private onRunning(): void {
    this.resumeRequested = false;
    this.removeGestureListeners();
  }

  private onHidden(): void {
    this.stopLoops();
    try {
      if (this.ctx?.state === 'running') void this.ctx.suspend()?.catch(() => {});
    } catch {
      /* ignore */
    }
    this.resumeRequested = false;
  }

  private onVisible(): void {
    if (this.ctx && this.enabled) this.unlock();
  }

  private applyMaster(): void {
    if (!this.master || !this.ctx) return;
    const v = this.enabled ? this.volume * MASTER_LEVEL : 0;
    try {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
    } catch {
      this.master.gain.value = v;
    }
  }

  private fadeFlow(): void {
    this.flowLevel = 0;
    const g = this.flowGain;
    const src = this.flowSrc;
    if (!g || !src || !this.ctx) return;
    try {
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
    } catch {
      /* ignore */
    }
    if (this.flowStopTimer) return;
    this.flowStopTimer = setTimeout(() => {
      this.flowStopTimer = null;
      if (this.flowLevel > 0 || this.flowSrc !== src) return;
      try {
        src.stop();
      } catch {
        /* ignore */
      }
      this.flowSrc = null;
      this.flowGain = null;
    }, 450);
  }

  /** Create the context + shared graph once. Returns false if WebAudio is unavailable. */
  private ensure(): boolean {
    if (this.synth) return true;
    if (this.failed) return false;
    let ctx: AudioContext | null = null;
    try {
      ctx = this.createContext();
    } catch {
      ctx = null;
    }
    if (!ctx) {
      this.failed = true;
      this.removeGestureListeners();
      return false;
    }
    try {
      // master → compressor (keeps stacked clears from clipping) → speakers
      const master = ctx.createGain();
      master.gain.value = this.enabled ? this.volume * MASTER_LEVEL : 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      master.connect(comp);
      comp.connect(ctx.destination);

      const out = ctx.createGain();
      out.connect(master);

      // Light "room": two feedback delays with low-passed feedback (GDD: short delay feedback).
      const verb = ctx.createGain();
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      wet.connect(master);
      for (const [time, fbAmt] of [
        [0.067, 0.32],
        [0.113, 0.26],
      ] as const) {
        const d = ctx.createDelay(0.5);
        d.delayTime.value = time;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        const fb = ctx.createGain();
        fb.gain.value = fbAmt;
        verb.connect(d);
        d.connect(lp);
        lp.connect(fb);
        fb.connect(d);
        lp.connect(wet);
      }

      const sr = ctx.sampleRate;
      const white = toBuffer(ctx, whiteNoise(Math.floor(sr * 1)));
      const pink = toBuffer(ctx, pinkNoise(Math.floor(sr * 2)));
      const plucks = new Map<number, AudioBuffer>();
      const c = ctx;
      this.synth = {
        ctx,
        out,
        verb,
        white,
        pink,
        pluck(freq: number): AudioBuffer {
          const key = Math.round(freq * 100);
          let b = plucks.get(key);
          if (!b) {
            b = toBuffer(c, karplusStrong(sr, freq, 1.6, 0.9965, 0.55));
            plucks.set(key, b);
          }
          return b;
        },
      };
      this.ctx = ctx;
      this.master = master;
      // Pre-render the jingle plucks off the gesture handler.
      const synth = this.synth;
      setTimeout(() => {
        for (const f of PLUCK_NOTES) synth.pluck(f);
      }, 0);
      return true;
    } catch (err) {
      if (import.meta.env?.DEV) console.debug('[audio] init failed', err);
      this.failed = true;
      this.synth = null;
      this.ctx = null;
      try {
        void ctx.close?.();
      } catch {
        /* ignore */
      }
      return false;
    }
  }
}

/** Real audio if the platform has WebAudio, else the no-op. */
export function createAudio(): AudioService {
  return new WebAudioService();
}
