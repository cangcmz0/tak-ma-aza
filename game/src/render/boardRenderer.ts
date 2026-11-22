// Draws the sand board.
//
// Cells go through a small ImageData buffer (TEX×TEX texels per simulation cell) that is
// scaled up with nearest-neighbour onto the board canvas. TEX adapts to the on-screen cell
// size (3 on a sharp phone screen, 2 / 1 when cells get small) so the per-grain texture —
// soft highlight, shaded corner, lit top surface facing empty space, dark seam where two
// colours touch — reads as fine spice dust instead of turning into noise. Shelves get stable
// wood grain, sacks a jute weave. Only rows that changed since the last upload are repainted
// and uploaded (dirty-row tracking against a shadow copy of the grid); the walnut tray
// background is pre-rendered once per resize.
// Per frame: two drawImage calls + small vector overlays (sack ties, ghost). No allocation.
import { BLOCK, SUB } from '../config';
import { JOKER, SACK, STONE } from '../engine/grid';
import { blockColor, pieceShape, type Piece } from '../engine/pieces';
import { SPECIAL_MASK } from '../engine/specials';
import type { Session } from '../game/session';
import { jokerPhase, mixHex, packedPalette, sandCss, theme, VARIANTS, V_EDGE, V_HI, V_LO, V_RIM } from './theme';

export interface Ghost {
  piece: Piece;
  /** Cell column of the piece's left edge. */
  x: number;
  /** Cell row of the piece's top edge (where it will be released). */
  y: number;
  /** Whether the drop is currently possible. */
  ok: boolean;
}

/** Device pixels per cell needed for 3 / 2 texels per cell side (else 1). */
const TEX3_MIN_PX = 9;
const TEX2_MIN_PX = 5;
/** Width of the joker shimmer bands, in cells (4 design grains). */
const JOKER_BAND = 4 * SUB;
/** Shelf plank joint every 3 blocks. */
const PLANK_CELLS = 3 * BLOCK;
/** Ember flicker period of bomb grains (ms). */
const SPARK_MS = 140;
/** Sack hit flash / wobble length (ms). */
const SACK_HIT_MS = 320;

export class BoardRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly off: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private img: ImageData;
  private px: Uint32Array;
  /** Texels per cell side in the offscreen buffer. */
  private tex = 0;
  private bg: HTMLCanvasElement | null = null;
  private lastVersion = -1;
  private lastFlashOn = false;
  private lastJokerPhase = -1;
  private lastSpark = -1;
  private hasJokers = false;
  private hasBombs = false;
  private needFull = true;
  // Shadow copy of the grid as last painted + per-row bookkeeping (dirty rows, specials).
  private readonly prevColor: Uint8Array;
  private readonly prevShade: Uint8Array;
  private readonly prevFlags: Uint8Array;
  private readonly rowDirty: Uint8Array;
  private readonly rowJoker: Uint8Array;
  private readonly rowBomb: Uint8Array;
  private gw: number;
  private gh: number;
  /** Device pixels per cell. */
  private scale = 1;
  /** performance.now() of the last hit per sack index. */
  private sackHitAt: number[] = [];
  /** Rows repainted by the last upload (perf stats / tests). */
  lastPaintedRows = 0;

  constructor(canvas: HTMLCanvasElement, gridW: number, gridH: number) {
    this.canvas = canvas;
    this.gw = gridW;
    this.gh = gridH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.off = document.createElement('canvas');
    const octx = this.off.getContext('2d');
    if (!octx) throw new Error('2D canvas not supported');
    this.octx = octx;
    const n = gridW * gridH;
    this.prevColor = new Uint8Array(n);
    this.prevShade = new Uint8Array(n);
    this.prevFlags = new Uint8Array(n);
    this.rowDirty = new Uint8Array(gridH);
    this.rowJoker = new Uint8Array(gridH);
    this.rowBomb = new Uint8Array(gridH);
    this.img = this.setTex(3);
    this.px = new Uint32Array(this.img.data.buffer);
  }

  /** (Re)allocate the offscreen buffer for `t` texels per cell. */
  private setTex(t: number): ImageData {
    this.tex = t;
    this.off.width = this.gw * t;
    this.off.height = this.gh * t;
    this.img = this.octx.createImageData(this.gw * t, this.gh * t);
    this.px = new Uint32Array(this.img.data.buffer);
    this.needFull = true;
    return this.img;
  }

  /**
   * Fit the board into a CSS box. Uses an integer number of device pixels per cell
   * when possible so grains stay crisp. Returns the CSS size used.
   */
  fit(availCssW: number, availCssH: number, dpr: number): { w: number; h: number } {
    const cssCell = Math.max(1, Math.min(availCssW / this.gw, availCssH / this.gh));
    let dev = cssCell * dpr;
    // Whole device pixels per design grain (SUB cells): same board size as the 48×80 layout,
    // grains stay crisp; the TEX texels inside a cell absorb the remaining fraction.
    if (dev * SUB >= 2) dev = Math.floor(dev * SUB) / SUB;
    this.scale = dev;
    const devW = Math.round(dev * this.gw);
    const devH = Math.round(dev * this.gh);
    if (this.canvas.width !== devW || this.canvas.height !== devH || !this.bg) {
      this.canvas.width = devW;
      this.canvas.height = devH;
      this.bg = this.renderBackground(devW, devH);
    }
    const t = dev >= TEX3_MIN_PX ? 3 : dev >= TEX2_MIN_PX ? 2 : 1;
    if (t !== this.tex) this.setTex(t);
    this.needFull = true;
    const w = devW / dpr;
    const h = devH / dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.lastVersion = -1;
    return { w, h };
  }

  /** Walnut tray: four planks (3 blocks each), wavy grain, seams, rivets on the walls, vignette. */
  private renderBackground(W: number, H: number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    if (!c) return cv;
    const t = theme();
    const sc = this.scale;
    // Decorative sizes follow the design grain (SUB cells) so the tray looks the same at any SUB.
    const gs = sc * SUB;
    let seed = 1234567;
    const rnd = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed / 4294967296;
    };
    c.fillStyle = t.boardBg;
    c.fillRect(0, 0, W, H);
    const plankW = 3 * BLOCK * sc;
    const planks = Math.ceil(W / plankW);
    for (let p = 0; p < planks; p++) {
      const x0 = p * plankW;
      c.fillStyle = t.boardWood[p % 3];
      c.fillRect(x0, 0, plankW, H);
      // Wavy grain lines.
      c.lineWidth = Math.max(1, gs * 0.18);
      for (let k = 0; k < 9; k++) {
        const lx = x0 + rnd() * plankW;
        const amp = (0.4 + rnd() * 1.2) * gs;
        const freq = 0.004 + rnd() * 0.01;
        const ph = rnd() * 6.28;
        c.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,214,170,0.035)';
        c.beginPath();
        for (let y = 0; y <= H; y += 6) {
          const xx = lx + Math.sin(y * freq + ph) * amp;
          if (y === 0) c.moveTo(xx, y);
          else c.lineTo(xx, y);
        }
        c.stroke();
      }
      // A couple of knots.
      if (rnd() < 0.7) {
        const kx = x0 + (0.25 + rnd() * 0.5) * plankW;
        const ky = rnd() * H;
        c.strokeStyle = 'rgba(0,0,0,0.18)';
        for (let r = 1; r <= 3; r++) {
          c.beginPath();
          c.ellipse(kx, ky, r * gs * 0.55, r * gs * 1.3, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
      if (p > 0) {
        c.fillStyle = 'rgba(0,0,0,0.42)';
        c.fillRect(x0 - Math.max(1, gs * 0.15), 0, Math.max(1, gs * 0.3), H);
        c.fillStyle = 'rgba(255,220,180,0.05)';
        c.fillRect(x0 + Math.max(1, gs * 0.15), 0, Math.max(1, gs * 0.2), H);
      }
    }
    // Copper rivets along both walls (paths run wall to wall).
    const rr = Math.max(1.2, gs * 0.42);
    for (let y = 2 * BLOCK; y < this.gh; y += 2 * BLOCK) {
      for (const x of [rr * 1.6, W - rr * 1.6]) {
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.beginPath();
        c.arc(x, y * sc + rr * 0.4, rr, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#9a5a2e';
        c.beginPath();
        c.arc(x, y * sc, rr, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,214,160,0.55)';
        c.beginPath();
        c.arc(x - rr * 0.3, y * sc - rr * 0.3, rr * 0.38, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Vignette + inner shadow under the copper rim.
    const g = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const top = c.createLinearGradient(0, 0, 0, gs * 5);
    top.addColorStop(0, 'rgba(0,0,0,0.45)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = top;
    c.fillRect(0, 0, W, gs * 5);
    return cv;
  }

  private upload(s: Session, flashOn: boolean, phase: number, spark: number): void {
    const g = s.grid;
    const jokerChanged = this.hasJokers && phase !== this.lastJokerPhase;
    const sparkChanged = this.hasBombs && spark !== this.lastSpark;
    const flashChanged = flashOn !== this.lastFlashOn;
    if (!this.needFull && g.version === this.lastVersion && !flashChanged && !jokerChanged && !sparkChanged) return;
    this.lastVersion = g.version;
    this.lastFlashOn = flashOn;
    this.lastJokerPhase = phase;
    this.lastSpark = spark;
    const { color, shade, flags } = g;
    const gw = this.gw;
    const gh = this.gh;
    const dirty = this.rowDirty;
    const pc = this.prevColor;
    const ps = this.prevShade;
    const pf = this.prevFlags;
    let lo = gh;
    let hi = -1;
    if (this.needFull) {
      dirty.fill(1);
      lo = 0;
      hi = gh - 1;
    } else {
      dirty.fill(0);
      if (flashChanged) {
        // Blink on/off: only rows holding marked cells change.
        const res = s.clear;
        for (let k = 0; k < res.cellCount; k++) {
          const yy = (res.cells[k] / gw) | 0;
          dirty[yy] = 1;
          if (yy < lo) lo = yy;
          if (yy > hi) hi = yy;
        }
      }
      // A cell's look depends on its up / right / below neighbours: a changed row also
      // repaints the rows above and below it.
      for (let y = 0; y < gh; y++) {
        const r0 = y * gw;
        let changed = (jokerChanged && this.rowJoker[y] === 1) || (sparkChanged && this.rowBomb[y] === 1);
        if (!changed)
          for (let i = r0, e = r0 + gw; i < e; i++) {
            if (color[i] !== pc[i] || shade[i] !== ps[i] || flags[i] !== pf[i]) {
              changed = true;
              break;
            }
          }
        if (!changed) continue;
        const a = y > 0 ? y - 1 : 0;
        const b = y < gh - 1 ? y + 1 : y;
        for (let yy = a; yy <= b; yy++) dirty[yy] = 1;
        if (a < lo) lo = a;
        if (b > hi) hi = b;
      }
    }
    this.needFull = false;
    pc.set(color);
    ps.set(shade);
    pf.set(flags);
    if (hi < 0) {
      this.lastPaintedRows = 0;
      return;
    }
    const flashing = flashOn && s.clearPending;
    let rows = 0;
    for (let y = lo; y <= hi; y++) {
      if (!dirty[y]) continue;
      rows++;
      this.paintRow(s, y, flashing, phase, spark);
    }
    this.lastPaintedRows = rows;
    let jokers = false;
    let bombs = false;
    for (let y = 0; y < gh; y++) {
      if (this.rowJoker[y]) jokers = true;
      if (this.rowBomb[y]) bombs = true;
    }
    this.hasJokers = jokers;
    this.hasBombs = bombs;
    const t = this.tex;
    this.octx.putImageData(this.img, 0, 0, 0, lo * t, gw * t, (hi - lo + 1) * t);
  }

  /** Paint one cell row into the texel buffer (TEX×TEX texels per cell). */
  private paintRow(s: Session, y: number, flashing: boolean, phase: number, spark: number): void {
    const g = s.grid;
    const pal = packedPalette();
    const jl = pal.joker.length;
    const { color, shade, flags } = g;
    const marked = s.clear.marked;
    const gw = this.gw;
    const gh = this.gh;
    const t = this.tex;
    const W = gw * t;
    const px = this.px;
    const mid = t >> 1;
    const last = t - 1;
    const rowO = y * t * W;
    let jokers = 0;
    let bombs = 0;
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const c = color[i];
      const o = rowO + x * t;
      if (c === 0) {
        if (t === 3) {
          px[o] = px[o + 1] = px[o + 2] = 0;
          px[o + W] = px[o + W + 1] = px[o + W + 2] = 0;
          px[o + 2 * W] = px[o + 2 * W + 1] = px[o + 2 * W + 2] = 0;
        } else for (let r = 0, ro = o; r < t; r++, ro += W) for (let k = 0; k < t; k++) px[ro + k] = 0;
        continue;
      }
      if (c === STONE) {
        this.woodCell(color, i, x, y, o, W);
        continue;
      }
      if (c === SACK) {
        this.juteCell(color, i, x, y, o, W);
        continue;
      }
      if (flashing && marked[i]) {
        const f = pal.flash;
        for (let r = 0, ro = o; r < t; r++, ro += W) for (let k = 0; k < t; k++) px[ro + k] = f;
        if (t > 1) px[o + last * W + last] = pal.flashLo;
        continue;
      }
      if (c === JOKER) {
        jokers = 1;
        // Diagonal shimmer bands; shade offsets the phase so a joker block glitters.
        const col = pal.joker[(phase + shade[i] * 2 + (((x + y) / JOKER_BAND) | 0)) % jl];
        for (let r = 0, ro = o; r < t; r++, ro += W) for (let k = 0; k < t; k++) px[ro + k] = col;
        if (((Math.imul(i, 2654435761) + phase * 977) >>> 0) % 11 === 0) px[o + mid * W + mid] = pal.flash;
        continue;
      }
      const bomb = (flags[i] & SPECIAL_MASK) !== 0;
      if (bomb) bombs = 1;
      const tab = bomb ? pal.bomb : pal.grain;
      const sh = shade[i];
      const b = (c * 4 + sh) * VARIANTS;
      const vb = tab[b];
      const upEmpty = y > 0 && color[i - gw] === 0;
      const sparkOn = bomb && ((Math.imul(i, 2654435761) + spark * 40503) >>> 0) % 7 === 0;
      if (t === 1) {
        // Too small for sub-cell detail: tone only (lit surface, light / dark grains).
        px[o] = sparkOn ? pal.spark : upEmpty ? tab[b + V_RIM] : sh === 1 ? tab[b + V_HI] : sh === 2 ? tab[b + V_LO] : vb;
        continue;
      }
      const right = x < gw - 1 ? color[i + 1] : c;
      const below = y < gh - 1 ? color[i + gw] : c;
      const rd = right !== 0 && right !== c;
      const bd = below !== 0 && below !== c;
      const edge = tab[b + V_EDGE];
      const o1 = o + W;
      if (t === 3) {
        // Unrolled 3×3: the common case on phones.
        const o2 = o1 + W;
        if (upEmpty) {
          const rim = tab[b + V_RIM];
          px[o] = px[o + 1] = rim;
          px[o + 2] = rd ? edge : rim;
        } else {
          px[o] = sh === 1 ? tab[b + V_HI] : vb;
          px[o + 1] = vb;
          px[o + 2] = rd ? edge : vb;
        }
        px[o1] = vb;
        px[o1 + 1] = sparkOn ? pal.spark : vb;
        px[o1 + 2] = rd ? edge : vb;
        if (bd) px[o2] = px[o2 + 1] = px[o2 + 2] = edge;
        else {
          px[o2] = vb;
          px[o2 + 1] = vb;
          px[o2 + 2] = rd ? edge : sh === 2 ? tab[b + V_LO] : vb;
        }
      } else {
        // 2×2
        if (upEmpty) {
          const rim = tab[b + V_RIM];
          px[o] = rim;
          px[o + 1] = rd ? edge : rim;
        } else {
          px[o] = sparkOn ? pal.spark : sh === 1 ? tab[b + V_HI] : vb;
          px[o + 1] = rd ? edge : vb;
        }
        if (bd) px[o1] = px[o1 + 1] = edge;
        else {
          px[o1] = vb;
          px[o1 + 1] = rd ? edge : sh === 2 ? tab[b + V_LO] : vb;
        }
      }
    }
    this.rowJoker[y] = jokers;
    this.rowBomb[y] = bombs;
  }

  /** Shelf ("Raf") wood: lit top edge, dark underside, horizontal grain streaks, plank joints. */
  private woodCell(color: Uint8Array, i: number, x: number, y: number, o: number, W: number): void {
    const gw = this.gw;
    const t = this.tex;
    const w = packedPalette().wood;
    const up = y > 0 && color[i - gw] === STONE;
    const dn = y < this.gh - 1 && color[i + gw] === STONE;
    const lf = x > 0 && color[i - 1] === STONE;
    const rt = x < gw - 1 && color[i + 1] === STONE;
    const joint = x % PLANK_CELLS === PLANK_CELLS - 1;
    // Streak pattern keyed to design-grain rows so it keeps its scale at any SUB / TEX.
    const gx = ((x / SUB) | 0) >> 2;
    const px = this.px;
    for (let r = 0; r < t; r++) {
      const gy = (((y * t + r) * SUB) / t) | 0;
      let col = ((Math.imul(gy, 73856093) ^ Math.imul(gx + (gy % 5), 19349663)) >>> 0) % 5 === 0 ? w[2] : w[0];
      if (!up && r === 0) col = w[1];
      else if (!dn && r === t - 1) col = w[3];
      const ro = o + r * W;
      for (let k = 0; k < t; k++) {
        let c = col;
        if (k === 0 && !lf) c = w[2];
        else if (k === t - 1 && (!rt || (joint && r > 0))) c = w[3];
        px[ro + k] = c;
      }
    }
  }

  /** Sack ("Çuval") jute: checker weave with a stitched seam along the outline. */
  private juteCell(color: Uint8Array, i: number, x: number, y: number, o: number, W: number): void {
    const gw = this.gw;
    const t = this.tex;
    const j = packedPalette().jute;
    const up = y > 0 && color[i - gw] === SACK;
    const dn = y < this.gh - 1 && color[i + gw] === SACK;
    const lf = x > 0 && color[i - 1] === SACK;
    const rt = x < gw - 1 && color[i + 1] === SACK;
    const px = this.px;
    for (let r = 0; r < t; r++) {
      const gy = y * t + r;
      for (let k = 0; k < t; k++) {
        const gx = x * t + k;
        const border = (!up && r === 0) || (!dn && r === t - 1) || (!lf && k === 0) || (!rt && k === t - 1);
        px[o + r * W + k] = border ? ((gx + gy) % 3 === 0 ? j[3] : j[2]) : ((gx + gy) & 1 ? j[0] : j[1]);
      }
    }
  }

  draw(s: Session, ghost: Ghost | null): void {
    const now = performance.now();
    // Blink marked grains: 4 ticks on, 4 off.
    const flashOn = s.clearPending && ((s.flashTicks >> 2) & 1) === 0;
    this.upload(s, flashOn, jokerPhase(now), Math.floor(now / SPARK_MS));
    const ctx = this.ctx;
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, this.canvas.width, this.canvas.height);
    if (s.sacks.list.length) this.drawSacks(s, now);
    if (ghost) this.drawGhost(ghost);
  }

  /** A sack took a hit: flash + wobble its tie for a moment. */
  flashSack(index: number): void {
    this.sackHitAt[index] = performance.now();
  }

  /** Sack tie (twine bow at the cinched neck) and hp knots: filled knots = hp left. */
  private drawSacks(s: Session, now: number): void {
    const ctx = this.ctx;
    const sc = this.scale; // device px per cell (rect positions)
    const gs = sc * SUB; // device px per design grain (decoration sizes)
    const t = theme();
    s.sacks.list.forEach((sack, idx) => {
      if (sack.hp <= 0) return;
      const hitAge = now - (this.sackHitAt[idx] ?? -1e9);
      const hit = hitAge < SACK_HIT_MS ? 1 - hitAge / SACK_HIT_MS : 0;
      const wob = hit ? Math.sin(hitAge * 0.06) * hit * gs * 0.6 : 0;
      const x0 = sack.x * sc;
      const y0 = sack.y * sc;
      const w = sack.w * sc;
      const h = sack.h * sc;
      // Cinch band.
      const by = y0 + gs * 1.8;
      ctx.fillStyle = 'rgba(60,36,14,0.35)';
      ctx.fillRect(x0 + gs * 0.6, by - gs * 0.5, w - gs * 1.2, gs);
      // Bow.
      const cx = x0 + w / 2 + wob;
      ctx.lineWidth = Math.max(1, gs * 0.45);
      ctx.strokeStyle = t.twine[1];
      ctx.fillStyle = t.twine[0];
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + d * gs * 1.1, by - gs * 0.2, gs * 1.05, gs * 0.6, d * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // HP knots along the band.
      const n = sack.maxHp;
      const span = w - gs * 3;
      const r = Math.max(1.5, gs * 0.62);
      for (let k = 0; k < n; k++) {
        const kx = n === 1 ? cx : x0 + gs * 1.5 + (span * k) / (n - 1);
        const ky = y0 + h - gs * 1.9;
        const alive = k < sack.hp;
        ctx.beginPath();
        ctx.arc(kx, ky, r, 0, Math.PI * 2);
        ctx.fillStyle = alive ? t.sackKnot : 'rgba(60,36,14,0.25)';
        ctx.fill();
        if (alive) {
          ctx.fillStyle = t.twine[0];
          ctx.beginPath();
          ctx.arc(kx - r * 0.3, ky - r * 0.3, r * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (hit) {
        ctx.fillStyle = `rgba(255,240,210,${0.45 * hit})`;
        ctx.fillRect(x0, y0, w, h);
      }
    });
  }

  /** CSS px per simulation cell (for overlays positioned over the canvas; ×SUB for a design grain). */
  get cssPerGrain(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.width / this.gw;
  }

  /** Client coordinates of a cell position (x, y may be fractional). */
  grainToClient(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (x / this.gw) * r.width, y: r.top + (y / this.gh) * r.height };
  }

  private drawGhost(gh: Ghost): void {
    const ctx = this.ctx;
    const t = theme();
    const sc = this.scale;
    const shape = pieceShape(gh.piece);
    const bw = BLOCK * sc;
    const H = this.canvas.height;
    // Drop lane: warm light falling from the top.
    const lane = ctx.createLinearGradient(0, 0, 0, H);
    lane.addColorStop(0, gh.ok ? 'rgba(255,214,150,0.14)' : 'rgba(255,90,60,0.16)');
    lane.addColorStop(1, gh.ok ? 'rgba(255,214,150,0.03)' : 'rgba(255,90,60,0.03)');
    ctx.fillStyle = lane;
    ctx.fillRect(gh.x * sc, 0, shape.w * bw, Math.min(H, gh.y * sc + shape.h * bw));
    ctx.globalAlpha = gh.ok ? 0.72 : 0.55;
    for (let c = 0; c < shape.cells.length; c++) {
      const [bx, by] = shape.cells[c];
      const col = blockColor(gh.piece, c);
      ctx.fillStyle = gh.ok ? (col === JOKER ? sandCss(JOKER, 5) : mixHex(sandCss(col, 1), '#ffffff', 0.15)) : t.ghostBad;
      ctx.fillRect(gh.x * sc + bx * bw, gh.y * sc + by * bw, bw, bw);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gh.ok ? t.ghostOk : t.ghostBad;
    const gs = sc * SUB;
    ctx.lineWidth = Math.max(1, gs * 0.35);
    ctx.setLineDash([gs * 0.9, gs * 0.6]);
    for (let c = 0; c < shape.cells.length; c++) {
      const [bx, by] = shape.cells[c];
      ctx.strokeRect(gh.x * sc + bx * bw + 1, gh.y * sc + by * bw + 1, bw - 2, bw - 2);
    }
    ctx.setLineDash([]);
  }

  /** Convert a client X coordinate to a cell column (float). */
  clientToGrainX(clientX: number): number {
    const r = this.canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * this.gw;
  }

  clientToGrainY(clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    return ((clientY - r.top) / r.height) * this.gh;
  }
}
