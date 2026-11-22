// Per-sound overlap limiter: a cooldown (minimum gap between starts) and a cap on
// simultaneously ringing voices. Pure logic with an injected clock (milliseconds),
// so it is testable without WebAudio.

export interface LimitRule {
  /** Minimum time between two starts of the same sound, ms. */
  cooldownMs: number;
  /** Maximum overlapping voices of the same sound. */
  maxVoices: number;
}

export class VoiceLimiter<K extends string> {
  private readonly last = new Map<K, number>();
  /** End times (ms) of voices still ringing, per sound. */
  private readonly voices = new Map<K, number[]>();

  constructor(private readonly rules: (k: K) => LimitRule) {}

  /**
   * Ask to start sound `k` at `nowMs` lasting `durMs`. Returns false (and records nothing)
   * if it is still in cooldown or all voices are busy.
   */
  tryStart(k: K, nowMs: number, durMs: number): boolean {
    const rule = this.rules(k);
    const last = this.last.get(k);
    if (last !== undefined && nowMs - last < rule.cooldownMs) return false;
    let list = this.voices.get(k);
    if (!list) {
      list = [];
      this.voices.set(k, list);
    }
    // Drop finished voices (in place, no allocation).
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i] > nowMs) list[n++] = list[i];
    list.length = n;
    if (n >= rule.maxVoices) return false;
    list.push(nowMs + Math.max(0, durMs));
    this.last.set(k, nowMs);
    return true;
  }

  /** Voices of `k` still ringing at `nowMs`. */
  active(k: K, nowMs: number): number {
    const list = this.voices.get(k);
    if (!list) return 0;
    let n = 0;
    for (const end of list) if (end > nowMs) n++;
    return n;
  }

  reset(): void {
    this.last.clear();
    this.voices.clear();
  }
}
