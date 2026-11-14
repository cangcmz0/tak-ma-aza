// Sentezlenmiş sesler (dosya yok) ve titreşim.
type Wave = OscillatorType;

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  private tone(freq: number, dur: number, o: { type?: Wave; vol?: number; at?: number; slide?: number } = {}) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    const vol = o.vol ?? 0.12;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  vibrate(pattern: number | number[]) {
    if (!this.enabled) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* desteklenmiyor */
    }
  }

  tap() { this.tone(1400, 0.04, { type: 'triangle', vol: 0.05 }); }
  /** Hastane anons zili. */
  arrive() { this.tone(659, 0.22, { vol: 0.07 }); this.tone(523, 0.3, { vol: 0.07, at: 0.18 }); }
  siren() {
    for (let i = 0; i < 3; i++) {
      this.tone(620, 0.36, { type: 'triangle', vol: 0.06, at: i * 0.5, slide: 940 });
      this.tone(940, 0.14, { type: 'triangle', vol: 0.05, at: i * 0.5 + 0.36, slide: 620 });
    }
  }
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, { vol: 0.07, at: i * 0.06 })); }
  wrong() { this.tone(170, 0.22, { type: 'square', vol: 0.05 }); }
  ready() { this.tone(988, 0.12, { vol: 0.08 }); this.tone(1319, 0.2, { vol: 0.07, at: 0.1 }); }
  discharge() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.06, at: i * 0.05 })); }
  shout() { this.tone(520, 0.12, { type: 'sawtooth', vol: 0.04, slide: 700 }); this.tone(520, 0.16, { type: 'sawtooth', vol: 0.04, at: 0.14, slide: 760 }); }
  complaint() { this.tone(330, 0.3, { type: 'sawtooth', vol: 0.04, slide: 180 }); }
  alarm() { this.tone(960, 0.1, { type: 'square', vol: 0.035 }); this.tone(960, 0.1, { type: 'square', vol: 0.035, at: 0.16 }); }
  tick() { this.tone(1046, 0.05, { type: 'square', vol: 0.04 }); }
  hit() { this.tone(196, 0.12, { type: 'sine', vol: 0.18, slide: 90 }); }
  miss() { this.tone(140, 0.08, { type: 'square', vol: 0.03 }); }
  flat() { this.tone(1000, 1.0, { vol: 0.05 }); }
  saved() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.18, { vol: 0.07, at: i * 0.08 })); }
  fail() { this.tone(392, 0.5, { type: 'triangle', vol: 0.06, slide: 196 }); }
  morning() { [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone(f, 0.3, { vol: 0.06, at: i * 0.11 })); }
}
