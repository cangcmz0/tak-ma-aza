// Scene-wide particle layer for gameplay juice (GDD §14.1): path bursts, grains flying
// into the order card, bomb sparks + shockwave, sack cloth scraps, drop puffs, sneeze dust.
// One canvas over the play scene (pointer-events: none). Structure-of-arrays pool with a
// hard cap; nothing is allocated per frame and the canvas is left untouched while idle.

export const MAX_PARTICLES = 260;
const MAX_RINGS = 16;

export const PK = { Grain: 0, Spark: 1, Home: 2, Cloth: 3, Dust: 4 } as const;
export type PK = (typeof PK)[keyof typeof PK];

export const RK = { Ring: 0, Band: 1, Glow: 2 } as const;
export type RK = (typeof RK)[keyof typeof RK];

const GRAVITY = 1400; // px/s²

export class FxLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private n = 0;
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly age = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  private readonly rot = new Float32Array(MAX_PARTICLES);
  private readonly vr = new Float32Array(MAX_PARTICLES);
  /** Home: start point of the flight, target, and when the flight starts (s). */
  private readonly sx = new Float32Array(MAX_PARTICLES);
  private readonly sy = new Float32Array(MAX_PARTICLES);
  private readonly tx = new Float32Array(MAX_PARTICLES);
  private readonly ty = new Float32Array(MAX_PARTICLES);
  private readonly delay = new Float32Array(MAX_PARTICLES);
  private readonly kind = new Uint8Array(MAX_PARTICLES);
  private readonly col = new Uint8Array(MAX_PARTICLES);
  private readonly tag = new Int16Array(MAX_PARTICLES);
  private readonly colors: string[] = [];
  private readonly colorIdx = new Map<string, number>();
  private readonly rings: { kind: RK; x: number; y: number; r0: number; r1: number; age: number; life: number; color: string; w: number }[] = [];
  private dirty = false;
  /** Called when a Home particle reaches its target (tag = what it was flying to). */
  onArrive: ((tag: number) => void) | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
  }

  get active(): number {
    return this.n + this.rings.length;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    // Particles are soft; cap the backing store at 2× to save fill rate on 3× phones.
    this.dpr = Math.min(2, dpr || 1);
    this.w = cssW;
    this.h = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.dirty = true;
  }

  private color(c: string): number {
    let i = this.colorIdx.get(c);
    if (i === undefined) {
      if (this.colors.length >= 250) return 0;
      i = this.colors.length;
      this.colors.push(c);
      this.colorIdx.set(c, i);
    }
    return i;
  }

  /** Add one particle; returns its slot or -1 when the pool is full. */
  spawn(kind: PK, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): number {
    if (this.n >= MAX_PARTICLES) return -1;
    const i = this.n++;
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.col[i] = this.color(color);
    this.rot[i] = Math.random() * 6.28;
    this.vr[i] = (Math.random() - 0.5) * 14;
    this.tag[i] = -1;
    this.delay[i] = 0;
    return i;
  }

  /** A grain that pops up, then flies along a curve into (tx, ty) (order card). */
  spawnHome(x: number, y: number, tx: number, ty: number, color: string, tag: number, burst: number, flight: number, size: number): void {
    const i = this.spawn(PK.Home, x, y, (Math.random() - 0.5) * 260, -220 - Math.random() * 260, burst + flight, size, color);
    if (i < 0) return;
    this.tx[i] = tx;
    this.ty[i] = ty;
    this.delay[i] = burst;
    this.tag[i] = tag;
  }

  ring(kind: RK, x: number, y: number, r0: number, r1: number, life: number, color: string, w = 0): void {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ kind, x, y, r0, r1, age: 0, life, color, w });
  }

  clear(): void {
    this.n = 0;
    this.rings.length = 0;
    this.dirty = true;
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.kind[i] = this.kind[j];
    this.x[i] = this.x[j];
    this.y[i] = this.y[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.age[i] = this.age[j];
    this.life[i] = this.life[j];
    this.size[i] = this.size[j];
    this.col[i] = this.col[j];
    this.rot[i] = this.rot[j];
    this.vr[i] = this.vr[j];
    this.sx[i] = this.sx[j];
    this.sy[i] = this.sy[j];
    this.tx[i] = this.tx[j];
    this.ty[i] = this.ty[j];
    this.delay[i] = this.delay[j];
    this.tag[i] = this.tag[j];
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    for (let i = this.n - 1; i >= 0; i--) {
      const a = (this.age[i] += dt);
      const k = this.kind[i];
      if (k === PK.Home) {
        const d = this.delay[i];
        if (a < d) {
          this.vy[i] += GRAVITY * 0.8 * dt;
          this.vx[i] *= 0.96;
          this.x[i] += this.vx[i] * dt;
          this.y[i] += this.vy[i] * dt;
          this.sx[i] = this.x[i];
          this.sy[i] = this.y[i];
        } else {
          const t = Math.min(1, (a - d) / (this.life[i] - d));
          const e = t * t * (3 - 2 * t);
          const cx = (this.sx[i] + this.tx[i]) / 2 + (this.sx[i] < this.tx[i] ? -40 : 40);
          const cy = Math.min(this.sy[i], this.ty[i]) - 60;
          const u = 1 - e;
          this.x[i] = u * u * this.sx[i] + 2 * u * e * cx + e * e * this.tx[i];
          this.y[i] = u * u * this.sy[i] + 2 * u * e * cy + e * e * this.ty[i];
          if (t >= 1) {
            const tag = this.tag[i];
            this.kill(i);
            this.onArrive?.(tag);
            continue;
          }
        }
        continue;
      }
      if (a >= this.life[i]) {
        this.kill(i);
        continue;
      }
      if (k === PK.Dust) {
        this.vx[i] *= 0.9;
        this.vy[i] = this.vy[i] * 0.9 - 20 * dt;
      } else {
        const g = k === PK.Spark ? GRAVITY * 0.35 : k === PK.Cloth ? GRAVITY * 0.55 : GRAVITY;
        this.vy[i] += g * dt;
        this.vx[i] *= k === PK.Cloth ? 0.97 : 0.985;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
    }
    for (let r = this.rings.length - 1; r >= 0; r--) {
      const ring = this.rings[r];
      ring.age += dt;
      if (ring.age >= ring.life) this.rings.splice(r, 1);
    }
  }

  draw(): void {
    const c = this.ctx;
    if (!c) return;
    if (!this.n && !this.rings.length) {
      if (this.dirty) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.dirty = false;
      }
      return;
    }
    this.dirty = true;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    // Light effects first (additive).
    c.globalCompositeOperation = 'lighter';
    for (const ring of this.rings) {
      const t = ring.age / ring.life;
      const e = 1 - (1 - t) * (1 - t);
      const alpha = 1 - t;
      if (ring.kind === RK.Ring) {
        c.globalAlpha = alpha;
        c.strokeStyle = ring.color;
        c.lineWidth = Math.max(1, ring.w * (1 - t));
        c.beginPath();
        c.arc(ring.x, ring.y, ring.r0 + (ring.r1 - ring.r0) * e, 0, Math.PI * 2);
        c.stroke();
      } else if (ring.kind === RK.Glow) {
        const r = ring.r0 + (ring.r1 - ring.r0) * e;
        const g = c.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, r);
        g.addColorStop(0, ring.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = alpha;
        c.fillStyle = g;
        c.fillRect(ring.x - r, ring.y - r, r * 2, r * 2);
      } else {
        // Band: horizontal light sweep across the board (a path just popped). x = left, w = width.
        const hh = ring.r0 + (ring.r1 - ring.r0) * e;
        const g = c.createLinearGradient(0, ring.y - hh, 0, ring.y + hh);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, ring.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = alpha * 0.9;
        c.fillStyle = g;
        c.fillRect(ring.x, ring.y - hh, ring.w, hh * 2);
      }
    }
    c.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== PK.Spark) continue;
      const t = this.age[i] / this.life[i];
      c.globalAlpha = 1 - t;
      c.strokeStyle = this.colors[this.col[i]];
      c.lineWidth = this.size[i];
      c.beginPath();
      c.moveTo(this.x[i], this.y[i]);
      c.lineTo(this.x[i] - this.vx[i] * 0.03, this.y[i] - this.vy[i] * 0.03);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      if (k === PK.Spark) continue;
      const t = this.age[i] / this.life[i];
      const s = this.size[i];
      c.fillStyle = this.colors[this.col[i]];
      if (k === PK.Dust) {
        c.globalAlpha = 0.45 * (1 - t);
        c.beginPath();
        c.arc(this.x[i], this.y[i], s * (0.6 + t * 1.6), 0, Math.PI * 2);
        c.fill();
      } else if (k === PK.Cloth) {
        c.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        c.save();
        c.translate(this.x[i], this.y[i]);
        c.rotate(this.rot[i]);
        c.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        c.fillStyle = 'rgba(60,36,14,0.45)';
        c.fillRect(-s, -s * 0.1, s * 2, s * 0.2);
        c.restore();
      } else if (k === PK.Home) {
        const d = this.delay[i];
        const a = this.age[i];
        const ft = a < d ? 0 : (a - d) / (this.life[i] - d);
        const sz = s * (1 - ft * 0.45);
        c.globalAlpha = 1;
        c.fillRect(this.x[i] - sz / 2, this.y[i] - sz / 2, sz, sz);
        c.globalAlpha = 0.5;
        c.fillStyle = '#fff4d6';
        c.fillRect(this.x[i] - sz / 2, this.y[i] - sz / 2, sz / 2, sz / 2);
      } else {
        c.globalAlpha = t > 0.65 ? (1 - t) / 0.35 : 1;
        c.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
      }
    }
    c.globalAlpha = 1;
  }
}
