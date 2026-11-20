// Draws the sand grid via a 1:1 ImageData buffer scaled up with nearest-neighbour.
// Allocation-free per frame.
import { BLOCK } from '../config';
import { JOKER } from '../engine/grid';
import { blockColor, pieceShape, type Piece } from '../engine/pieces';
import { SPECIAL_MASK } from '../engine/specials';
import type { Session } from '../game/session';
import { jokerPhase, packedPalette, sandCss, theme } from './theme';

export interface Ghost {
  piece: Piece;
  /** Grain column of the piece's left edge. */
  x: number;
  /** Whether the drop is currently possible. */
  ok: boolean;
}

export class BoardRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly off: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly px: Uint32Array;
  private lastVersion = -1;
  private lastFlashOn = false;
  private lastJokerPhase = -1;
  private hasJokers = false;
  private gw: number;
  private gh: number;
  /** Device pixels per grain. */
  private scale = 1;

  constructor(canvas: HTMLCanvasElement, gridW: number, gridH: number) {
    this.canvas = canvas;
    this.gw = gridW;
    this.gh = gridH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.off = document.createElement('canvas');
    this.off.width = gridW;
    this.off.height = gridH;
    const octx = this.off.getContext('2d');
    if (!octx) throw new Error('2D canvas not supported');
    this.octx = octx;
    this.img = octx.createImageData(gridW, gridH);
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
    if (this.canvas.width !== devW || this.canvas.height !== devH) {
      this.canvas.width = devW;
      this.canvas.height = devH;
    }
    const w = devW / dpr;
    const h = devH / dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.lastVersion = -1;
    return { w, h };
  }

  private upload(s: Session, flashOn: boolean, phase: number): void {
    const g = s.grid;
    const jokerChanged = this.hasJokers && phase !== this.lastJokerPhase;
    if (g.version === this.lastVersion && flashOn === this.lastFlashOn && !jokerChanged) return;
    this.lastVersion = g.version;
    this.lastFlashOn = flashOn;
    this.lastJokerPhase = phase;
    const pal = packedPalette();
    const jl = pal.joker.length;
    const { color, shade, flags, size } = g;
    const px = this.px;
    const marked = s.clear.marked;
    const flashing = flashOn && s.clearPending;
    let jokers = false;
    for (let i = 0; i < size; i++) {
      const c = color[i];
      if (c === 0) px[i] = pal.bg;
      else if (flashing && marked[i]) px[i] = pal.flash;
      else if (c === JOKER) {
        jokers = true;
        // Shade offsets the phase so a joker block shimmers instead of blinking as one.
        px[i] = pal.joker[(phase + shade[i] * 2) % jl];
      } else px[i] = (flags[i] & SPECIAL_MASK) !== 0 ? pal.bomb[c * 4 + shade[i]] : pal.grain[c * 4 + shade[i]];
    }
    this.hasJokers = jokers;
    this.octx.putImageData(this.img, 0, 0);
  }

  draw(s: Session, ghost: Ghost | null): void {
    // Blink marked grains: 4 ticks on, 4 off.
    const flashOn = s.clearPending && ((s.flashTicks >> 2) & 1) === 0;
    this.upload(s, flashOn, jokerPhase(performance.now()));
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, this.canvas.width, this.canvas.height);
    if (s.sacks.list.length) this.drawSackKnots(s);
    if (ghost) this.drawGhost(ghost);
  }

  /** Sack hp as knots along the top edge (placeholder; Art agent restyles). */
  private drawSackKnots(s: Session): void {
    const ctx = this.ctx;
    const sc = this.scale;
    ctx.fillStyle = theme().sackKnot;
    for (const sack of s.sacks.list) {
      if (sack.hp <= 0) continue;
      const r = Math.max(1.5, sc * 0.9);
      const gap = (sack.w * sc) / (sack.maxHp + 1);
      for (let k = 0; k < sack.hp; k++) {
        ctx.beginPath();
        ctx.arc(sack.x * sc + gap * (k + 1), sack.y * sc + r * 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = theme().sackKnot;
      ctx.lineWidth = Math.max(1, sc * 0.3);
      ctx.strokeRect(sack.x * sc + 0.5, sack.y * sc + 0.5, sack.w * sc - 1, sack.h * sc - 1);
    }
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
    ctx.fillStyle = t.columnHint;
    ctx.fillRect(gh.x * sc, 0, shape.w * bw, this.canvas.height);
    ctx.globalAlpha = gh.ok ? 0.75 : 0.5;
    for (let c = 0; c < shape.cells.length; c++) {
      const [bx, by] = shape.cells[c];
      ctx.fillStyle = gh.ok ? sandCss(blockColor(gh.piece, c), 1) : t.ghostBad;
      ctx.fillRect(gh.x * sc + bx * bw, by * bw, bw, bw);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gh.ok ? t.ghostOk : t.ghostBad;
    ctx.lineWidth = Math.max(1, sc * 0.4);
    for (let c = 0; c < shape.cells.length; c++) {
      const [bx, by] = shape.cells[c];
      ctx.strokeRect(gh.x * sc + bx * bw + 0.5, by * bw + 0.5, bw - 1, bw - 1);
    }
  }

  /** Convert a client X coordinate to a grain column (float). */
  clientToGrainX(clientX: number): number {
    const r = this.canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * this.gw;
  }
}
