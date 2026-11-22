// Gameplay juice (GDD §14.1/14.2), driven by session events: path burst + light sweep,
// grains flying into the order card, bomb shockwave, sack scraps, drop puffs, screen
// shake, lose dimming and Zerde's pepper sneeze (chain ≥ 3 with pul biber — the same rule
// the audio uses for the `sneeze` sound, fx/feedback.ts). Everything is skipped or toned
// down under prefers-reduced-motion.
import { zerde, setZerdePose, type ZerdePose } from '../art/zerde';
import { BLOCK, BOMB_RADIUS, SUB } from '../config';
import type { SessionEvent } from '../core/events';
import { JOKER } from '../engine/grid';
import { blockColor, pieceShape } from '../engine/pieces';
import { PEPPER_COLOR, SNEEZE_MIN_CHAIN } from '../fx/feedback';
import { FxLayer, PK, RK } from '../fx/particles';
import type { Session } from '../game/session';
import { strings } from '../i18n';
import type { BoardRenderer } from '../render/boardRenderer';
import { reducedMotion, sandCss, theme } from '../render/theme';
import { h } from './dom';

export interface PlayFxHost {
  readonly session: Session;
  readonly sceneEl: HTMLElement;
  readonly boardArea: HTMLElement;
  readonly boardFrame: HTMLElement;
  readonly renderer: BoardRenderer;
  /** Element grains of goal `i` fly into (null = no card line). */
  goalTarget(i: number): HTMLElement | null;
}

/** Max burst particles per path clear (GDD: ≤ 120 representative particles). */
const BURST_SAMPLES = 90;
const BURST_SPARKS = 14;

export class PlayFx {
  private readonly layer = new FxLayer();
  private readonly reduce = reducedMotion();
  private readonly sampleCell = new Int32Array(BURST_SAMPLES);
  private readonly sampleColor = new Uint8Array(BURST_SAMPLES);
  private samples = 0;
  private shakeAmp = 0;
  private shakeDur = 0;
  private shakeT = 0;
  private shaking = false;
  private readonly peek: HTMLElement;
  private readonly peekCat: SVGSVGElement;
  private readonly hapsu: HTMLElement;
  private peekTimers: number[] = [];
  private lastBump: number[] = [];

  constructor(private readonly host: PlayFxHost) {
    host.sceneEl.append(this.layer.canvas);
    this.layer.onArrive = (tag) => this.arrive(tag);
    this.peekCat = zerde('surprised');
    this.hapsu = h('span', { class: 'hapsu', text: strings().hud.sneeze });
    this.peek = h('div', { class: 'zerde-peek', 'aria-hidden': 'true', 'data-testid': 'zerde-peek' }, this.peekCat, this.hapsu);
    host.boardArea.append(this.peek);
  }

  resize(): void {
    const r = this.host.sceneEl.getBoundingClientRect();
    this.layer.resize(r.width, r.height, window.devicePixelRatio || 1);
  }

  destroy(): void {
    for (const t of this.peekTimers) window.clearTimeout(t);
    this.layer.canvas.remove();
    this.peek.remove();
  }

  /** Scene-local CSS position of a cell coordinate. */
  private at(gx: number, gy: number): { x: number; y: number } {
    const p = this.host.renderer.grainToClient(gx, gy);
    const r = this.host.sceneEl.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }

  /** CSS px per simulation cell (for converting cell distances: rects, radii). */
  private cellPx(): number {
    return this.host.renderer.cssPerGrain;
  }

  /** CSS px per design grain (particle sizes stay the same at any SUB). */
  private grainPx(): number {
    return this.host.renderer.cssPerGrain * SUB;
  }

  shake(amp: number, ms: number): void {
    if (this.reduce || amp < this.shakeAmp * (1 - this.shakeT / Math.max(1, this.shakeDur))) return;
    this.shakeAmp = amp;
    this.shakeDur = ms;
    this.shakeT = 0;
  }

  frame(dtMs: number): void {
    this.layer.update(dtMs);
    this.layer.draw();
    if (this.shakeAmp > 0) {
      this.shakeT += dtMs;
      const k = 1 - this.shakeT / this.shakeDur;
      if (k <= 0) {
        this.shakeAmp = 0;
        this.host.boardFrame.style.transform = '';
        this.shaking = false;
      } else {
        const a = this.shakeAmp * k * k;
        this.host.boardFrame.style.transform = `translate(${((Math.random() * 2 - 1) * a).toFixed(1)}px, ${((Math.random() * 2 - 1) * a).toFixed(1)}px)`;
        this.shaking = true;
      }
    } else if (this.shaking) {
      this.host.boardFrame.style.transform = '';
      this.shaking = false;
    }
  }

  onEvent(e: SessionEvent): void {
    const s = this.host.session;
    switch (e.type) {
      case 'placed': {
        const shape = pieceShape(e.piece);
        const p = this.at(e.x + (shape.w * BLOCK) / 2, 1);
        const gp = this.grainPx();
        for (let k = 0; k < 12; k++) {
          const c = sandCss(blockColor(e.piece, k % 4), k % 3);
          this.layer.spawn(PK.Dust, p.x + (Math.random() - 0.5) * shape.w * BLOCK * this.cellPx(), p.y, (Math.random() - 0.5) * 160, -40 - Math.random() * 90, 0.45, gp * 1.4, c);
        }
        break;
      }
      case 'clearStart': {
        // Snapshot burst samples while the grains are still on the grid.
        const res = s.clear;
        const g = s.grid;
        const n = res.cellCount;
        const stride = Math.max(1, n / BURST_SAMPLES);
        let m = 0;
        for (let f = 0; m < BURST_SAMPLES && f < n; f += stride) {
          const i = res.cells[Math.floor(f)];
          this.sampleCell[m] = i;
          this.sampleColor[m] = g.color[i];
          m++;
        }
        this.samples = m;
        break;
      }
      case 'cleared': {
        const g = s.grid;
        const gp = this.grainPx();
        const count = this.reduce ? Math.min(this.samples, 30) : this.samples;
        for (let k = 0; k < count; k++) {
          const i = this.sampleCell[k];
          const c = this.sampleColor[k];
          const p = this.at((i % g.w) + 0.5, Math.floor(i / g.w) + 0.5);
          const col = c === JOKER ? sandCss(JOKER, k) : sandCss(c, k % 3);
          this.layer.spawn(PK.Grain, p.x, p.y, (Math.random() - 0.5) * 380, -260 - Math.random() * 520, 0.55 + Math.random() * 0.4, Math.max(2.5, gp * (0.9 + Math.random() * 0.6)), col);
        }
        if (!this.reduce)
          for (let k = 0; k < BURST_SPARKS; k++) {
            const i = this.sampleCell[(k * 7) % Math.max(1, this.samples)];
            const p = this.at((i % g.w) + 0.5, Math.floor(i / g.w) + 0.5);
            const a = Math.random() * Math.PI * 2;
            const v = 200 + Math.random() * 300;
            this.layer.spawn(PK.Spark, p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 120, 0.35 + Math.random() * 0.2, 2, k % 2 ? '#fff4d6' : '#ffc94a');
          }
        // Light sweep along the popped path(s).
        const left = this.at(0, e.cy ?? g.h / 2);
        const right = this.at(g.w, e.cy ?? g.h / 2);
        this.layer.ring(RK.Band, left.x, left.y, gp * 3, gp * 9, 0.38, 'rgba(255,236,190,0.75)', right.x - left.x);
        this.shake(e.chain >= 3 ? 4 : 2, e.chain >= 3 ? 220 : 150);
        if (e.chain >= SNEEZE_MIN_CHAIN && e.colors?.includes(PEPPER_COLOR)) this.sneeze();
        break;
      }
      case 'grainsToGoal':
        this.flyGrains(e.goal, e.color, e.cells);
        break;
      case 'bomb': {
        const p = this.at(e.x + 0.5, e.y + 0.5);
        const gp = this.grainPx();
        const r = BOMB_RADIUS * this.cellPx();
        this.layer.ring(RK.Glow, p.x, p.y, r * 0.4, r * 2.2, 0.4, 'rgba(255,120,40,0.9)');
        this.layer.ring(RK.Ring, p.x, p.y, gp, r * 1.5, 0.3, '#ffb347', gp * 1.6);
        const sparks = this.reduce ? 10 : 30;
        for (let k = 0; k < sparks; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 260 + Math.random() * 420;
          this.layer.spawn(PK.Spark, p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, 0.4 + Math.random() * 0.3, 2.4, ['#ffe066', '#ff8a3d', '#ff3b1f'][k % 3]);
        }
        this.shake(6, 300);
        break;
      }
      case 'sackHit': {
        this.host.renderer.flashSack(e.index);
        const gp = this.grainPx();
        const p = this.at(e.x + e.w / 2, e.y + 1);
        for (let k = 0; k < 6; k++)
          this.layer.spawn(PK.Dust, p.x + (Math.random() - 0.5) * e.w * this.cellPx(), p.y, (Math.random() - 0.5) * 120, -30 - Math.random() * 60, 0.5, gp * 1.6, theme().sack[1]);
        this.layer.spawn(PK.Grain, p.x, p.y + e.h * this.cellPx() * 0.6, (Math.random() - 0.5) * 200, -320, 0.7, Math.max(3, gp * 1.2), theme().sackKnot);
        break;
      }
      case 'sackBreak': {
        const gp = this.grainPx();
        const c = this.at(e.x + e.w / 2, e.y + e.h / 2);
        const t = theme();
        for (let k = 0; k < 4; k++) {
          const dx = k % 2 ? 1 : -1;
          const dy = k < 2 ? -1 : 0.3;
          this.layer.spawn(PK.Cloth, c.x + dx * e.w * this.cellPx() * 0.25, c.y + dy * e.h * this.cellPx() * 0.2, dx * (120 + Math.random() * 120), dy * 180 - 120, 0.9, gp * 2.2, t.sack[k % 3]);
        }
        for (let k = 0; k < 12; k++)
          this.layer.spawn(PK.Dust, c.x + (Math.random() - 0.5) * e.w * this.cellPx(), c.y + (Math.random() - 0.5) * e.h * this.cellPx(), (Math.random() - 0.5) * 140, -40 - Math.random() * 80, 0.7, gp * 2, t.sack[1]);
        this.shake(3, 150);
        break;
      }
      case 'goalComplete': {
        const el = this.host.goalTarget(e.index);
        if (el) {
          const r = el.getBoundingClientRect();
          const sr = this.host.sceneEl.getBoundingClientRect();
          this.layer.ring(RK.Ring, r.left + r.width / 2 - sr.left, r.top + r.height / 2 - sr.top, 4, 30, 0.45, '#ffd77a', 3);
        }
        break;
      }
      case 'won': {
        // Spice fountain from the board (GDD: confetti of spice); the result card continues it.
        const g = s.grid;
        const gp = this.grainPx();
        const colors = s.level.colors.length ? s.level.colors : [1, 2, 3];
        const n = this.reduce ? 0 : 50;
        for (let k = 0; k < n; k++) {
          const p = this.at(Math.random() * g.w, g.h * (0.55 + Math.random() * 0.4));
          this.layer.spawn(PK.Grain, p.x, p.y, (Math.random() - 0.5) * 300, -500 - Math.random() * 500, 0.9, Math.max(3, gp * 1.3), sandCss(colors[k % colors.length], k % 3));
        }
        break;
      }
      case 'lost':
        this.host.boardFrame.classList.add('lost');
        break;
      case 'revived':
        this.host.boardFrame.classList.remove('lost');
        break;
      default:
        break;
    }
  }

  /** Grains of a grain goal pop out and fly into the order line's chip (GDD §5.1). */
  flyGrains(goal: number, color: number, cells: readonly number[]): void {
    const target = this.host.goalTarget(goal);
    if (!target) return;
    const sr = this.host.sceneEl.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const tx = tr.left + tr.width / 2 - sr.left;
    const ty = tr.top + tr.height / 2 - sr.top;
    const w = this.host.session.grid.w;
    const gp = this.grainPx();
    const per = this.reduce ? 1 : 2;
    const max = this.reduce ? 8 : cells.length;
    for (let k = 0; k < Math.min(max, cells.length); k++) {
      const i = cells[k];
      const p = this.at((i % w) + 0.5, Math.floor(i / w) + 0.5);
      for (let j = 0; j < per; j++)
        this.layer.spawnHome(p.x, p.y, tx, ty, sandCss(color, (k + j) % 3), goal, 0.18 + Math.random() * 0.1, 0.42 + k * 0.012 + j * 0.05, Math.max(3, gp * 1.4));
    }
  }

  private arrive(goal: number): void {
    const el = this.host.goalTarget(goal);
    if (!el) return;
    const now = performance.now();
    if (now - (this.lastBump[goal] ?? 0) < 120) return;
    this.lastBump[goal] = now;
    const row = el.closest('.goal') as HTMLElement | null;
    for (const t of [el, row]) {
      if (!t) continue;
      t.classList.remove('bump');
      void t.offsetWidth;
      t.classList.add('bump');
    }
  }

  private setPeek(pose: ZerdePose, stay: boolean): void {
    for (const t of this.peekTimers) window.clearTimeout(t);
    this.peekTimers = [];
    setZerdePose(this.peekCat, pose);
    this.peek.classList.remove('sneezing');
    this.peek.classList.add('show');
    if (!stay) this.peekTimers.push(window.setTimeout(() => this.peek.classList.remove('show'), 1500));
  }

  /** Zerde pops up behind the board rim and sneezes a cloud of pepper (GDD §3.3). */
  sneeze(): void {
    this.setPeek('surprised', false);
    const later = (ms: number, fn: () => void) => this.peekTimers.push(window.setTimeout(fn, ms));
    later(300, () => {
      setZerdePose(this.peekCat, 'sneeze');
      this.peek.classList.remove('sneezing');
      void this.peek.offsetWidth;
      this.peek.classList.add('sneezing');
      const r = this.peekCat.getBoundingClientRect();
      const sr = this.host.sceneEl.getBoundingClientRect();
      if (r.width > 0) {
        const nx = r.left + r.width * 0.5 - sr.left;
        const ny = r.top + r.height * 0.55 - sr.top;
        const n = this.reduce ? 6 : 22;
        for (let k = 0; k < n; k++)
          this.layer.spawn(
            k % 3 ? PK.Dust : PK.Grain,
            nx,
            ny,
            -120 - Math.random() * 260,
            -60 - Math.random() * 160,
            0.7 + Math.random() * 0.3,
            k % 3 ? 7 + Math.random() * 6 : 2.5,
            ['#e0432f', '#f2705c', '#b83322'][k % 3],
          );
      }
    });
    later(1000, () => setZerdePose(this.peekCat, 'happy'));
  }
}
