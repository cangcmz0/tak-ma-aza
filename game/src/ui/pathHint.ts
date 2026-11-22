// Board hint layer: glowing wall strips (paths run wall to wall) and live path progress.
// For the colours closest to a wall-to-wall connection it draws the missing gap as a
// dashed line from the region's tip to the opposite wall (or to the region growing from
// it), arrowheads at both ends and a "%80" tag. Recomputed once per settle
// (game/pathProgress.ts), drawn on its own canvas over the board; hidden while sand moves.
// All coordinates come from grid.w/h and the renderer (no hard-coded board size).
import { SUB } from '../config';
import type { SessionEvent } from '../core/events';
import { PathProgressScanner, type PathProgress } from '../game/pathProgress';
import type { Session } from '../game/session';
import type { BoardRenderer } from '../render/boardRenderer';
import { mixHex, sandCss } from '../render/theme';
import { h } from './dom';

/** Show a hint only from this coverage on, and at most this many colours. */
const MIN_FRAC = 0.5;
const MAX_HINTS = 2;

export interface PathHintHost {
  readonly session: Session;
  readonly boardFrame: HTMLElement;
  readonly renderer: BoardRenderer;
}

export class PathHint {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly scanner = new PathProgressScanner();
  private progress: PathProgress[] = [];
  private dpr = 1;
  private wCss = 0;
  private hCss = 0;

  constructor(private readonly host: PathHintHost) {
    this.canvas = h('canvas', { class: 'path-hint', 'aria-hidden': 'true', 'data-testid': 'path-hint' });
    this.ctx = this.canvas.getContext('2d');
    host.boardFrame.append(
      h('i', { class: 'wall-mark left', 'aria-hidden': 'true' }),
      h('i', { class: 'wall-mark right', 'aria-hidden': 'true' }),
      this.canvas,
    );
  }

  /** Latest progress per level colour (debug / tests). */
  get current(): readonly PathProgress[] {
    return this.progress;
  }

  resize(): void {
    const b = this.host.renderer.canvas;
    this.wCss = b.clientWidth;
    this.hCss = b.clientHeight;
    if (this.wCss < 4) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.wCss * this.dpr);
    this.canvas.height = Math.round(this.hCss * this.dpr);
    this.canvas.style.width = `${this.wCss}px`;
    this.canvas.style.height = `${this.hCss}px`;
    this.canvas.style.left = `${b.offsetLeft}px`;
    this.canvas.style.top = `${b.offsetTop}px`;
    this.refresh();
  }

  onEvent(e: SessionEvent): void {
    switch (e.type) {
      case 'placed':
      case 'clearStart':
      case 'toolCleared':
        this.canvas.classList.add('fade');
        break;
      case 'settled':
        this.refresh();
        break;
      default:
        break;
    }
  }

  /** Recompute (BFS per colour) and redraw. Call only when the board is calm. */
  refresh(): void {
    const s = this.host.session;
    this.progress = this.scanner.scan(s.grid, s.level.colors);
    this.draw();
    this.canvas.classList.remove('fade');
  }

  private draw(): void {
    const c = this.ctx;
    if (!c || this.wCss < 4) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.wCss, this.hCss);
    const g = this.host.session.grid;
    const k = this.wCss / g.w; // css px per cell
    const kg = k * SUB; // css px per design grain (decoration sizes)
    const hints = this.progress
      .filter((p) => p.frac >= MIN_FRAC && p.frac < 1)
      .sort((a, b) => b.frac - a.frac)
      .slice(0, MAX_HINTS);
    const placed: { x: number; y: number }[] = [];
    for (const p of hints) {
      const hasL = p.leftReach >= 0;
      const hasR = p.rightReach < g.w;
      const ax = hasL ? (p.leftReach + 1) * k : 0;
      const ay = (hasL ? p.leftRow + 0.5 : p.rightRow + 0.5) * k;
      const bx = hasR ? p.rightReach * k : this.wCss;
      const by = (hasR ? p.rightRow + 0.5 : p.leftRow + 0.5) * k;
      const col = sandCss(p.color, 1);
      const lw = Math.max(2, kg * 0.55);
      // Gap line: dark casing + coloured dashes.
      c.lineCap = 'round';
      c.setLineDash([]);
      c.strokeStyle = 'rgba(20,10,6,0.6)';
      c.lineWidth = lw + 3;
      this.gapPath(c, ax, ay, bx, by);
      c.stroke();
      c.setLineDash([lw * 1.6, lw * 1.4]);
      c.strokeStyle = col;
      c.lineWidth = lw;
      this.gapPath(c, ax, ay, bx, by);
      c.stroke();
      c.setLineDash([]);
      // Arrowheads: tips grow towards each other.
      this.arrow(c, ax, ay, 1, col, k);
      if (hasR) this.arrow(c, bx, by, -1, col, k);
      else this.wallFlag(c, bx, by, col, k);
      // Percentage tag beside the tip, over the region's own sand (the gap stays visible).
      const pct = `%${Math.round(p.frac * 100)}`;
      let tx = hasL ? ax - 34 : bx + 34;
      let ty = (hasL ? ay : by) - Math.max(14, kg * 3);
      for (const q of placed) if (Math.abs(q.x - tx) < 56 && Math.abs(q.y - ty) < 20) ty = q.y - 22;
      tx = Math.max(26, Math.min(this.wCss - 26, tx));
      placed.push({ x: tx, y: ty });
      this.tag(c, tx, ty, pct, p.color);
    }
  }

  private gapPath(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number): void {
    c.beginPath();
    c.moveTo(ax, ay);
    const lift = Math.min(18, Math.abs(bx - ax) * 0.15);
    c.bezierCurveTo(ax + (bx - ax) * 0.35, ay - lift, ax + (bx - ax) * 0.65, by - lift, bx, by);
  }

  private arrow(c: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, col: string, k: number): void {
    const s = Math.max(6, k * SUB * 1.8);
    c.beginPath();
    c.moveTo(x + dir * s, y);
    c.lineTo(x - dir * s * 0.2, y - s * 0.75);
    c.lineTo(x - dir * s * 0.2, y + s * 0.75);
    c.closePath();
    c.fillStyle = col;
    c.strokeStyle = 'rgba(20,10,6,0.75)';
    c.lineWidth = 1.5;
    c.fill();
    c.stroke();
  }

  /** Target marker on the opposite wall when no region grows from it yet. */
  private wallFlag(c: CanvasRenderingContext2D, x: number, y: number, col: string, k: number): void {
    const s = Math.max(5, k * SUB * 1.4);
    c.fillStyle = col;
    c.strokeStyle = 'rgba(20,10,6,0.75)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x - s * 0.6, y, s * 0.6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  private tag(c: CanvasRenderingContext2D, x: number, y: number, text: string, color: number): void {
    c.font = '900 12px system-ui, sans-serif';
    const w = c.measureText(text).width + 18;
    const hh = 18;
    const x0 = Math.max(2, Math.min(this.wCss - w - 2, x - w / 2));
    const y0 = Math.max(2, y - hh / 2);
    c.fillStyle = '#f4e4c3';
    c.strokeStyle = 'rgba(59,36,20,0.9)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect?.(x0, y0, w, hh, 4);
    if (!c.roundRect) c.rect(x0, y0, w, hh);
    c.fill();
    c.stroke();
    c.fillStyle = sandCss(color, 0);
    c.beginPath();
    c.arc(x0 + 8, y0 + hh / 2, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = mixHex('#3b2414', '#000000', 0.2);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(text, x0 + 14, y0 + hh / 2 + 0.5);
  }
}
