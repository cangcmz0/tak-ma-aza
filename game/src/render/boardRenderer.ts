// Draws the sand board.
//
// Grains go through a small ImageData buffer (SUB×SUB pixels per grain) that is scaled up
// with nearest-neighbour onto the board canvas. The sub-grain pixels give each spice grain
// a soft highlight, a shaded corner, a lit top surface facing empty space and a dark seam
// where two colours touch (colour regions stay readable). Shelves get stable wood grain,
// sacks a jute weave. The buffer is rebuilt only when the grid (or the joker / ember
// phase) changes; the walnut tray background is pre-rendered once per resize.
// Per frame: two drawImage calls + small vector overlays (sack ties, ghost). No allocation.
import { BLOCK } from '../config';
import { JOKER, SACK, STONE } from '../engine/grid';
import { blockColor, pieceShape, type Piece } from '../engine/pieces';
import { SPECIAL_MASK } from '../engine/specials';
import type { Session } from '../game/session';
import { jokerPhase, mixHex, packedPalette, sandCss, theme, VARIANTS, V_EDGE, V_HI, V_LO, V_RIM } from './theme';

export interface Ghost {
  piece: Piece;
  /** Grain column of the piece's left edge. */
  x: number;
  /** Grain row of the piece's top edge (where it will be released). */
  y: number;
  /** Whether the drop is currently possible. */
  ok: boolean;
}

/** Image pixels per grain side. */
const SUB = 3;
/** Ember flicker period of bomb grains (ms). */
const SPARK_MS = 140;
/** Sack hit flash / wobble length (ms). */
const SACK_HIT_MS = 320;

export class BoardRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly off: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly px: Uint32Array;
  private bg: HTMLCanvasElement | null = null;
  private lastVersion = -1;
  private lastFlashOn = false;
  private lastJokerPhase = -1;
  private lastSpark = -1;
  private hasJokers = false;
  private hasBombs = false;
  private gw: number;
  private gh: number;
  /** Device pixels per grain. */
  private scale = 1;
  /** performance.now() of the last hit per sack index. */
  private sackHitAt: number[] = [];

  constructor(canvas: HTMLCanvasElement, gridW: number, gridH: number) {
    this.canvas = canvas;
    this.gw = gridW;
    this.gh = gridH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.off = document.createElement('canvas');
    this.off.width = gridW * SUB;
    this.off.height = gridH * SUB;
    const octx = this.off.getContext('2d');
    if (!octx) throw new Error('2D canvas not supported');
    this.octx = octx;
    this.img = octx.createImageData(gridW * SUB, gridH * SUB);
    this.px = new Uint32Array(this.img.data.buffer);
  }

  /**
   * Fit the board into a CSS box. Uses an integer number of device pixels per grain
   * when possible so grains stay crisp. Returns the CSS size used.
   */
  fit(availCssW: number, availCssH: number, dpr: number): { w: number; h: number } {
    const cssCell = Math.max(1, Math.min(availCssW / this.gw, availCssH / this.gh));
    let dev = cssCell * dpr;
    if (dev >= 2) dev = Math.floor(dev);
    this.scale = dev;
    const devW = Math.round(dev * this.gw);
    const devH = Math.round(dev * this.gh);
    if (this.canvas.width !== devW || this.canvas.height !== devH || !this.bg) {
      this.canvas.width = devW;
      this.canvas.height = devH;
      this.bg = this.renderBackground(devW, devH);
    }
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
      c.lineWidth = Math.max(1, sc * 0.18);
      for (let k = 0; k < 9; k++) {
        const lx = x0 + rnd() * plankW;
        const amp = (0.4 + rnd() * 1.2) * sc;
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
          c.ellipse(kx, ky, r * sc * 0.55, r * sc * 1.3, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
      if (p > 0) {
        c.fillStyle = 'rgba(0,0,0,0.42)';
        c.fillRect(x0 - Math.max(1, sc * 0.15), 0, Math.max(1, sc * 0.3), H);
        c.fillStyle = 'rgba(255,220,180,0.05)';
        c.fillRect(x0 + Math.max(1, sc * 0.15), 0, Math.max(1, sc * 0.2), H);
      }
    }
    // Copper rivets along both walls (paths run wall to wall).
    const rr = Math.max(1.2, sc * 0.42);
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
    const top = c.createLinearGradient(0, 0, 0, sc * 5);
    top.addColorStop(0, 'rgba(0,0,0,0.45)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = top;
    c.fillRect(0, 0, W, sc * 5);
    return cv;
  }

  private upload(s: Session, flashOn: boolean, phase: number, spark: number): void {
    const g = s.grid;
    const jokerChanged = this.hasJokers && phase !== this.lastJokerPhase;
    const sparkChanged = this.hasBombs && spark !== this.lastSpark;
    if (g.version === this.lastVersion && flashOn === this.lastFlashOn && !jokerChanged && !sparkChanged) return;
    this.lastVersion = g.version;
    this.lastFlashOn = flashOn;
    this.lastJokerPhase = phase;
    this.lastSpark = spark;
    const pal = packedPalette();
    const jl = pal.joker.length;
    const { color, shade, flags } = g;
    const gw = this.gw;
    const gh = this.gh;
    const W3 = gw * SUB;
    const px = this.px;
    const marked = s.clear.marked;
    const flashing = flashOn && s.clearPending;
    let jokers = false;
    let bombs = false;
    for (let y = 0; y < gh; y++) {
      const rowO = y * SUB * W3;
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const c = color[i];
        const o = rowO + x * SUB;
        const o1 = o + W3;
        const o2 = o1 + W3;
        if (c === 0) {
          px[o] = px[o + 1] = px[o + 2] = px[o1] = px[o1 + 1] = px[o1 + 2] = px[o2] = px[o2 + 1] = px[o2 + 2] = 0;
          continue;
        }
        if (c === STONE) {
          this.woodCell(color, i, x, y, o, W3);
          continue;
        }
        if (c === SACK) {
          this.juteCell(color, i, x, y, o, W3);
          continue;
        }
        if (flashing && marked[i]) {
          const f = pal.flash;
          px[o] = px[o + 1] = px[o + 2] = px[o1] = px[o1 + 1] = px[o1 + 2] = px[o2] = px[o2 + 1] = f;
          px[o2 + 2] = pal.flashLo;
          continue;
        }
        if (c === JOKER) {
          jokers = true;
          // Diagonal shimmer bands; shade offsets the phase so a joker block glitters.
          const col = pal.joker[(phase + shade[i] * 2 + ((x + y) >> 2)) % jl];
          px[o] = px[o + 1] = px[o + 2] = px[o1] = px[o1 + 2] = px[o2] = px[o2 + 1] = px[o2 + 2] = col;
          px[o1 + 1] = ((Math.imul(i, 2654435761) + phase * 977) >>> 0) % 11 === 0 ? pal.flash : col;
          continue;
        }
        const bomb = (flags[i] & SPECIAL_MASK) !== 0;
        if (bomb) bombs = true;
        const tab = bomb ? pal.bomb : pal.grain;
        const sh = shade[i];
        const b = (c * 4 + sh) * VARIANTS;
        const vb = tab[b];
        const lo = tab[b + V_LO];
        const edge = tab[b + V_EDGE];
        const upEmpty = y > 0 && color[i - gw] === 0;
        const right = x < gw - 1 ? color[i + 1] : c;
        const below = y < gh - 1 ? color[i + gw] : c;
        const rd = right !== 0 && right !== c;
        const bd = below !== 0 && below !== c;
        if (upEmpty) {
          const rim = tab[b + V_RIM];
          px[o] = px[o + 1] = rim;
          px[o + 2] = rd ? edge : rim;
        } else {
          // Highlight / shaded corner only on the light / dark tone grains: irregular, dusty texture.
          px[o] = sh === 1 ? tab[b + V_HI] : vb;
          px[o + 1] = vb;
          px[o + 2] = rd ? edge : vb;
        }
        px[o1] = vb;
        px[o1 + 1] = bomb && ((Math.imul(i, 2654435761) + spark * 40503) >>> 0) % 7 === 0 ? pal.spark : vb;
        px[o1 + 2] = rd ? edge : vb;
        if (bd) px[o2] = px[o2 + 1] = px[o2 + 2] = edge;
        else {
          px[o2] = vb;
          px[o2 + 1] = vb;
          px[o2 + 2] = rd ? edge : sh === 2 ? lo : vb;
        }
      }
    }
    this.hasJokers = jokers;
    this.hasBombs = bombs;
    this.octx.putImageData(this.img, 0, 0);
  }

  /** Shelf ("Raf") wood: lit top edge, dark underside, horizontal grain streaks, plank joints. */
  private woodCell(color: Uint8Array, i: number, x: number, y: number, o: number, W3: number): void {
    const gw = this.gw;
    const w = packedPalette().wood;
    const up = y > 0 && color[i - gw] === STONE;
    const dn = y < this.gh - 1 && color[i + gw] === STONE;
    const lf = x > 0 && color[i - 1] === STONE;
    const rt = x < gw - 1 && color[i + 1] === STONE;
    const px = this.px;
    for (let r = 0; r < SUB; r++) {
      const gy = y * SUB + r;
      let col = ((Math.imul(gy, 73856093) ^ Math.imul((x >> 2) + (gy % 5), 19349663)) >>> 0) % 5 === 0 ? w[2] : w[0];
      if (!up && r === 0) col = w[1];
      else if (!dn && r === SUB - 1) col = w[3];
      const ro = o + r * W3;
      px[ro] = !lf ? w[2] : col;
      px[ro + 1] = col;
      px[ro + 2] = !rt || (x % 12 === 11 && r > 0) ? w[3] : col;
    }
  }

  /** Sack ("Çuval") jute: checker weave with a stitched seam along the outline. */
  private juteCell(color: Uint8Array, i: number, x: number, y: number, o: number, W3: number): void {
    const gw = this.gw;
    const j = packedPalette().jute;
    const up = y > 0 && color[i - gw] === SACK;
    const dn = y < this.gh - 1 && color[i + gw] === SACK;
    const lf = x > 0 && color[i - 1] === SACK;
    const rt = x < gw - 1 && color[i + 1] === SACK;
    const px = this.px;
    for (let r = 0; r < SUB; r++) {
      const gy = y * SUB + r;
      for (let k = 0; k < SUB; k++) {
        const gx = x * SUB + k;
        const border = (!up && r === 0) || (!dn && r === SUB - 1) || (!lf && k === 0) || (!rt && k === SUB - 1);
        px[o + r * W3 + k] = border ? ((gx + gy) % 3 === 0 ? j[3] : j[2]) : ((gx + gy) & 1 ? j[0] : j[1]);
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
    const sc = this.scale;
    const t = theme();
    s.sacks.list.forEach((sack, idx) => {
      if (sack.hp <= 0) return;
      const hitAge = now - (this.sackHitAt[idx] ?? -1e9);
      const hit = hitAge < SACK_HIT_MS ? 1 - hitAge / SACK_HIT_MS : 0;
      const wob = hit ? Math.sin(hitAge * 0.06) * hit * sc * 0.6 : 0;
      const x0 = sack.x * sc;
      const y0 = sack.y * sc;
      const w = sack.w * sc;
      const h = sack.h * sc;
      // Cinch band.
      const by = y0 + sc * 1.8;
      ctx.fillStyle = 'rgba(60,36,14,0.35)';
      ctx.fillRect(x0 + sc * 0.6, by - sc * 0.5, w - sc * 1.2, sc);
      // Bow.
      const cx = x0 + w / 2 + wob;
      ctx.lineWidth = Math.max(1, sc * 0.45);
      ctx.strokeStyle = t.twine[1];
      ctx.fillStyle = t.twine[0];
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + d * sc * 1.1, by - sc * 0.2, sc * 1.05, sc * 0.6, d * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // HP knots along the band.
      const n = sack.maxHp;
      const span = w - sc * 3;
      const r = Math.max(1.5, sc * 0.62);
      for (let k = 0; k < n; k++) {
        const kx = n === 1 ? cx : x0 + sc * 1.5 + (span * k) / (n - 1);
        const ky = y0 + h - sc * 1.9;
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

  /** CSS px per grain (for overlays positioned over the canvas). */
  get cssPerGrain(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.width / this.gw;
  }

  /** Client coordinates of a grain position (x, y may be fractional). */
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
    ctx.lineWidth = Math.max(1, sc * 0.35);
    ctx.setLineDash([sc * 0.9, sc * 0.6]);
    for (let c = 0; c < shape.cells.length; c++) {
      const [bx, by] = shape.cells[c];
      ctx.strokeRect(gh.x * sc + bx * bw + 1, gh.y * sc + by * bw + 1, bw - 2, bw - 2);
    }
    ctx.setLineDash([]);
  }

  /** Convert a client X coordinate to a grain column (float). */
  clientToGrainX(clientX: number): number {
    const r = this.canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * this.gw;
  }

  clientToGrainY(clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    return ((clientY - r.top) / r.height) * this.gh;
  }
}
