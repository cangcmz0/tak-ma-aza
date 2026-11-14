// Monitördeki gibi soldan sağa yazan EKG çizgisi.
export class Ecg {
  private ctx: CanvasRenderingContext2D | null;
  private buf: number[] = [];
  private head = 0;
  private phase = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  bpm = 72;
  flat = false;
  onBeat: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private color: string, private speed = 90) {
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.buf = new Array(w).fill(0);
    this.head = 0;
  }

  /** Bir atım içindeki konuma göre P-QRS-T dalgası (-1..1). */
  private wave(ph: number): number {
    const bump = (c: number, wdt: number, a: number) => a * Math.exp(-(((ph - c) / wdt) ** 2));
    return bump(0.12, 0.035, 0.12) + bump(0.255, 0.012, -0.15) + bump(0.28, 0.012, 1) + bump(0.305, 0.014, -0.28) + bump(0.52, 0.06, 0.25);
  }

  step(dt: number) {
    if (!this.ctx || this.w < 2) return;
    const px = this.speed * dt;
    const n = Math.max(1, Math.round(px));
    const beatLen = 60 / Math.max(20, this.bpm);
    for (let i = 0; i < n; i++) {
      const before = this.phase;
      this.phase += dt / n / beatLen;
      if (this.phase >= 1) this.phase -= 1;
      if (before < 0.28 && this.phase >= 0.28 && !this.flat) this.onBeat?.();
      const noise = (Math.random() - 0.5) * 0.02;
      this.buf[this.head] = this.flat ? noise : this.wave(this.phase) + noise;
      this.head = (this.head + 1) % this.w;
    }
    this.draw();
  }

  private draw() {
    const ctx = this.ctx!;
    const { w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    const mid = h * 0.6;
    const amp = h * 0.5;
    const gap = 14;
    ctx.beginPath();
    let pen = false;
    for (let x = 0; x < w; x++) {
      const dist = (x - this.head + w) % w;
      if (dist < gap) {
        pen = false;
        continue;
      }
      const y = mid - this.buf[x] * amp;
      if (!pen) {
        ctx.moveTo(x, y);
        pen = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Yazıcı ucu
    const hx = (this.head - 1 + w) % w;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(hx, mid - this.buf[hx] * amp, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
