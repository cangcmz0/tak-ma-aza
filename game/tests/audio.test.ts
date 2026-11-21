// Audio service tests: safe without WebAudio (Node), mute/volume, overlap limiter,
// recipes render on a fake context, feedback mapping.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoopAudio, SOUND_NAMES, type AudioService, type PlayOptions, type SoundName } from '../src/audio/audio';
import { VoiceLimiter } from '../src/audio/limiter';
import { RECIPES, chainSemitones } from '../src/audio/sounds';
import { karplusStrong, pinkNoise, whiteNoise } from '../src/audio/synth';
import { FLOW_TIMEOUT_MS, WebAudioService } from '../src/audio/webAudio';
import { feedbackFor } from '../src/fx/feedback';
import { NoopHaptics, type HapticType, type HapticsService } from '../src/fx/haptics';
import type { SessionEvent } from '../src/core/events';
import { MemoryBackend, SaveStore } from '../src/platform/storage';

// Minimal fake AudioContext for tests: every node is a Proxy that accepts any call.
interface FakeCtx {
  ctx: AudioContext;
  created: Record<string, number>;
  resumes: number;
  suspends: number;
  /** Total oscillators + buffer sources started (≈ voices scheduled). */
  starts: number;
}

function param(): AudioParam {
  const p: Record<string, unknown> = { value: 0 };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
    p[m] = () => p;
  }
  return p as unknown as AudioParam;
}

function fakeAudioContext(): FakeCtx {
  const f: FakeCtx = { ctx: null as unknown as AudioContext, created: {}, resumes: 0, suspends: 0, starts: 0 };
  const node = (kind: string) => {
    f.created[kind] = (f.created[kind] ?? 0) + 1;
    const params = new Map<string, AudioParam>();
    const target: Record<string | symbol, unknown> = {};
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (prop === 'connect') return (dst: unknown) => dst;
        if (prop === 'start') return () => void f.starts++;
        if (typeof prop === 'string' && ['gain', 'frequency', 'Q', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release', 'detune'].includes(prop)) {
          if (!params.has(prop)) params.set(prop, param());
          return params.get(prop);
        }
        return () => undefined;
      },
      set(t, prop, v) {
        t[prop] = v;
        return true;
      },
    });
  };
  let state: AudioContextState = 'suspended';
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    destination: node('destination'),
    get state() {
      return state;
    },
    resume() {
      f.resumes++;
      state = 'running';
      return Promise.resolve();
    },
    suspend() {
      f.suspends++;
      state = 'suspended';
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBufferSource: () => node('source'),
    createBiquadFilter: () => node('filter'),
    createDelay: () => node('delay'),
    createDynamicsCompressor: () => node('compressor'),
    createBuffer(ch: number, len: number, sr: number) {
      const data = new Float32Array(len);
      return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => data };
    },
  };
  f.ctx = ctx as unknown as AudioContext;
  return f;
}

function readyService(now = { t: 0 }) {
  const fake = fakeAudioContext();
  const svc = new WebAudioService({ createContext: () => fake.ctx, unlockTarget: null, doc: null, now: () => now.t });
  return { fake, svc, now };
}

describe('WebAudioService without WebAudio (Node)', () => {
  it('never throws and plays nothing', () => {
    const svc = new WebAudioService();
    expect(() => svc.unlock()).not.toThrow();
    for (const n of SOUND_NAMES) expect(svc.play(n, { chain: 3, delay: 0.1 })).toBe(false);
    expect(() => {
      svc.setEnabled(false);
      svc.setEnabled(true);
      svc.setVolume(0.4);
      svc.setFlow(1);
      svc.setDanger(true);
      svc.setDanger(false);
      svc.stopLoops();
    }).not.toThrow();
    expect(svc.contextState).toBe('unavailable');
  });

  it('survives a context factory that throws', () => {
    const svc = new WebAudioService({
      createContext: () => {
        throw new Error('no audio');
      },
      unlockTarget: null,
      doc: null,
    });
    expect(() => svc.unlock()).not.toThrow();
    expect(svc.play('drop')).toBe(false);
  });

  it('NoopAudio implements the interface', () => {
    const a: AudioService = new NoopAudio();
    expect(() => {
      a.unlock();
      a.play('win');
      a.setFlow(1);
      a.stopLoops();
    }).not.toThrow();
  });
});

describe('WebAudioService with a (fake) context', () => {
  afterEach(() => vi.useRealTimers());

  it('stays silent until unlocked (no context before a gesture)', () => {
    const { fake, svc } = readyService();
    expect(svc.play('ui_tap')).toBe(false);
    expect(fake.created.osc ?? 0).toBe(0);
    svc.unlock();
    expect(fake.resumes).toBe(1);
    expect(svc.play('ui_tap')).toBe(true);
    expect(fake.created.osc).toBeGreaterThan(0);
  });

  it('builds the noise buffers once, not per sound', () => {
    const { svc, now } = readyService();
    svc.unlock();
    const spy = vi.spyOn(Math, 'random');
    for (let i = 0; i < 5; i++) {
      now.t += 1000;
      svc.play('drop');
    }
    // Only offset picks (1 per noise voice), never a full buffer regeneration.
    expect(spy.mock.calls.length).toBeLessThan(50);
    spy.mockRestore();
  });

  it('does not play when sound is disabled or volume is 0', () => {
    const { fake, svc, now } = readyService();
    svc.unlock();
    svc.setEnabled(false);
    const before = fake.starts;
    for (const n of SOUND_NAMES) {
      now.t += 5000;
      expect(svc.play(n)).toBe(false);
    }
    expect(fake.starts).toBe(before);
    expect(fake.suspends).toBe(1);
    svc.setEnabled(true);
    svc.setVolume(0);
    now.t += 5000;
    expect(svc.play('clear')).toBe(false);
    svc.setVolume(0.5);
    now.t += 5000;
    expect(svc.play('clear')).toBe(true);
  });

  it('applies the cooldown and voice cap per sound', () => {
    const { svc, now } = readyService();
    svc.unlock();
    expect(svc.play('blocked')).toBe(true);
    now.t += 50; // < 160 ms cooldown
    expect(svc.play('blocked')).toBe(false);
    now.t += 200;
    expect(svc.play('blocked')).toBe(true);
    // Different sounds do not block each other.
    expect(svc.play('rotate')).toBe(true);
    // clear: cooldown 50 ms, 4 voices of ~400 ms.
    now.t = 10_000;
    let ok = 0;
    for (let i = 0; i < 10; i++) {
      if (svc.play('clear', { chain: i + 1 })) ok++;
      now.t += 60;
    }
    expect(ok).toBeLessThan(10);
    expect(ok).toBeGreaterThanOrEqual(4);
  });

  it('renders every recipe without throwing', () => {
    const { svc, now } = readyService();
    svc.unlock();
    for (const n of SOUND_NAMES) {
      now.t += 5000;
      expect(svc.play(n, { chain: 4, index: 2 })).toBe(true);
    }
  });

  it('flow loop starts, auto-fades, and stops on stopLoops / mute', () => {
    vi.useFakeTimers();
    const { fake, svc } = readyService();
    svc.unlock();
    svc.setFlow(1);
    expect(svc.flow).toBe(1);
    const sources = fake.created.source ?? 0;
    svc.setFlow(0.5); // reuses the running loop
    expect(fake.created.source ?? 0).toBe(sources);
    vi.advanceTimersByTime(FLOW_TIMEOUT_MS + 10);
    expect(svc.flow).toBe(0);
    svc.setFlow(1);
    svc.stopLoops();
    expect(svc.flow).toBe(0);
    svc.setEnabled(false);
    svc.setFlow(1);
    expect(svc.flow).toBe(0);
  });

  it('danger loop repeats and stops', () => {
    vi.useFakeTimers();
    const now = { t: 0 };
    const { svc } = readyService(now);
    svc.unlock();
    const spy = vi.spyOn(svc, 'play');
    svc.setDanger(true);
    svc.setDanger(true); // idempotent
    now.t += 1200;
    vi.advanceTimersByTime(1200);
    now.t += 1200;
    vi.advanceTimersByTime(1200);
    expect(spy.mock.calls.filter((c) => c[0] === 'danger').length).toBe(3);
    svc.setDanger(false);
    vi.advanceTimersByTime(5000);
    expect(spy.mock.calls.filter((c) => c[0] === 'danger').length).toBe(3);
    expect(svc.dangerOn).toBe(false);
  });
});

describe('VoiceLimiter', () => {
  const lim = () => new VoiceLimiter<'a' | 'b'>((k) => (k === 'a' ? { cooldownMs: 100, maxVoices: 2 } : { cooldownMs: 0, maxVoices: 1 }));

  it('enforces the cooldown', () => {
    const l = lim();
    expect(l.tryStart('a', 0, 10)).toBe(true);
    expect(l.tryStart('a', 99, 10)).toBe(false);
    expect(l.tryStart('a', 100, 10)).toBe(true);
  });

  it('caps overlapping voices and frees them when they end', () => {
    const l = lim();
    expect(l.tryStart('b', 0, 500)).toBe(true);
    expect(l.tryStart('b', 100, 500)).toBe(false);
    expect(l.active('b', 100)).toBe(1);
    expect(l.tryStart('b', 500, 500)).toBe(true);
    const a = lim();
    expect(a.tryStart('a', 0, 1000)).toBe(true);
    expect(a.tryStart('a', 200, 1000)).toBe(true);
    expect(a.tryStart('a', 400, 1000)).toBe(false); // 2 voices busy
    expect(a.tryStart('a', 1001, 1000)).toBe(true); // first one ended
  });

  it('a rejected start does not reset the cooldown', () => {
    const l = lim();
    l.tryStart('a', 0, 10);
    l.tryStart('a', 50, 10);
    expect(l.tryStart('a', 100, 10)).toBe(true);
  });
});

describe('recipes and buffers', () => {
  it('every sound name has a recipe with sane limits', () => {
    for (const n of SOUND_NAMES) {
      const r = RECIPES[n];
      expect(r, n).toBeDefined();
      expect(r.maxVoices).toBeGreaterThanOrEqual(1);
      expect(r.dur).toBeGreaterThan(0);
    }
  });

  it('chain pitch rises 2 semitones per step and is capped', () => {
    expect(chainSemitones(1)).toBe(0);
    expect(chainSemitones(2)).toBe(2);
    expect(chainSemitones(5)).toBe(8);
    expect(chainSemitones(100)).toBe(chainSemitones(11));
    expect(chainSemitones(0)).toBe(0);
  });

  it('noise and pluck generators are bounded', () => {
    for (const buf of [whiteNoise(1000), pinkNoise(4000), karplusStrong(8000, 440, 0.5)]) {
      let peak = 0;
      for (const v of buf) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
});

class RecAudio implements AudioService {
  plays: [SoundName, PlayOptions | undefined][] = [];
  flow: number[] = [];
  danger: boolean[] = [];
  stops = 0;
  play(n: SoundName, o?: PlayOptions) {
    this.plays.push([n, o]);
  }
  setEnabled() {}
  setVolume() {}
  setFlow(l: number) {
    this.flow.push(l);
  }
  setDanger(on: boolean) {
    this.danger.push(on);
  }
  stopLoops() {
    this.stops++;
  }
  unlock() {}
  names() {
    return this.plays.map((p) => p[0]);
  }
}
class RecHaptics implements HapticsService {
  got: HapticType[] = [];
  haptic(t: HapticType) {
    this.got.push(t);
  }
  setEnabled() {}
}

describe('feedback mapping (GDD §14.3/14.4)', () => {
  let a: RecAudio;
  let h: RecHaptics;
  beforeEach(() => {
    a = new RecAudio();
    h = new RecHaptics();
  });
  const fire = (e: unknown) => feedbackFor(e as SessionEvent, a, h);

  it('drop: puf + flow + light haptic; settle stops the flow', () => {
    fire({ type: 'placed', slot: 0, piece: null, x: 0 });
    expect(a.names()).toEqual(['drop']);
    expect(a.flow).toEqual([1]);
    expect(h.got).toEqual(['light']);
    fire({ type: 'settled' });
    expect(a.flow.at(-1)).toBe(0);
  });

  it('clear pitch follows the chain; ×3 is heavy; pepper ×3 sneezes', () => {
    fire({ type: 'cleared', paths: 1, grains: 50, chain: 1, points: 10 });
    expect(a.plays[0]).toEqual(['clear', { chain: 1 }]);
    expect(h.got).toEqual(['medium']);
    fire({ type: 'cleared', paths: 1, grains: 50, chain: 3, points: 10, colors: [1, 2] });
    expect(a.names()).toContain('chainWord');
    expect(a.names()).toContain('sneeze');
    expect(h.got.at(-1)).toBe('heavy');
  });

  it('two paths → double (the separate double/chainWord events add nothing); bomb → bomb + heavy', () => {
    fire({ type: 'cleared', paths: 2, grains: 50, chain: 2, points: 10 });
    fire({ type: 'double', paths: 2 });
    fire({ type: 'chainWord', chain: 2 });
    expect(a.names()).toEqual(['double', 'chainWord']);
    fire({ type: 'bomb', grains: 80, x: 1, y: 1 });
    expect(a.names()).toContain('bomb');
    expect(h.got.at(-1)).toBe('heavy');
  });

  it('blocked → invalid sound + warning', () => {
    fire({ type: 'blocked', slot: 0, x: 0 });
    expect(a.names()).toEqual(['blocked']);
    expect(h.got).toEqual(['warning']);
  });

  it('win: jingle + one star per star + success; lose is soft (no haptic)', () => {
    fire({ type: 'won', score: 1, stars: 2, bonus: 0 });
    expect(a.names()).toEqual(['win', 'star', 'star']);
    expect(a.plays[2][1]?.index).toBe(1);
    expect(a.stops).toBe(1);
    expect(h.got).toEqual(['success']);
    fire({ type: 'lost', reason: 'no_space', score: 0 });
    expect(a.names().at(-1)).toBe('lose');
    expect(h.got).toEqual(['success']);
  });

  it('danger loop follows on/off; warning haptic only on the first entry', () => {
    fire({ type: 'danger', on: true, first: true });
    fire({ type: 'danger', on: false, first: false });
    fire({ type: 'danger', on: true, first: false });
    expect(a.danger).toEqual([true, false, true]);
    expect(h.got).toEqual(['warning']);
  });

  it('boosters, sacks, joker, extra pieces', () => {
    fire({ type: 'toolCleared', grains: 30, points: 30 });
    fire({ type: 'sackHit', index: 0, hp: 1, maxHp: 2, x: 0, y: 0, w: 8, h: 8 });
    fire({ type: 'sackBreak', index: 0, x: 0, y: 0, w: 8, h: 8, points: 100 });
    fire({ type: 'joker', grains: 16 });
    fire({ type: 'piecesAdded', n: 5 });
    expect(a.names()).toEqual(['booster', 'sackHit', 'sackBreak', 'joker', 'coin']);
    expect(h.got).toEqual(['medium', 'light', 'medium']);
  });

  it('unknown events are ignored', () => {
    fire({ type: 'trayRefill' });
    fire({ type: 'grainsToGoal', goal: 0, color: 1, total: 10, cells: [] });
    fire({ type: 'somethingNew' });
    expect(a.plays).toEqual([]);
    expect(h.got).toEqual([]);
  });

  it('works with the no-op services', () => {
    expect(() => feedbackFor({ type: 'won', score: 0, stars: 3, bonus: 0 }, new NoopAudio(), new NoopHaptics())).not.toThrow();
  });
});

describe('settings', () => {
  it('sound/haptics default on, volume defaults to 1 and is clamped on load', async () => {
    const b = new MemoryBackend();
    const s = await SaveStore.load(b);
    expect(s.settings).toMatchObject({ sound: true, haptics: true, volume: 1 });
    await b.set('kumakisi.save.v1', JSON.stringify({ version: 1, levels: {}, settings: { sound: false, haptics: false, volume: 7 } }));
    const s2 = await SaveStore.load(b);
    expect(s2.settings).toMatchObject({ sound: false, haptics: false, volume: 1 });
    s2.setSetting('volume', 0.3);
    await s2.flush();
    const s3 = await SaveStore.load(b);
    expect(s3.settings.volume).toBeCloseTo(0.3);
  });
});
