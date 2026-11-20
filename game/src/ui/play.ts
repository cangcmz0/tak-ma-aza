// Gameplay scene: HUD + board canvas + tray. Owns the Session for one attempt.
import { BLOCK, MAX_TICKS_PER_FRAME, SHOW_ROTATE_BUTTON, SIM_TICK_HZ, TRAY_SIZE } from '../config';
import { maxX, pieceShape } from '../engine/pieces';
import { feedbackFor } from '../fx/feedback';
import { goalDone } from '../game/goals';
import { Session, type SessionEvent } from '../game/session';
import { fmt, strings } from '../i18n';
import { bindKeyboard } from '../input/keyboard';
import { PointerInput } from '../input/pointer';
import { getLevel } from '../levels/levels';
import { BoardRenderer, type Ghost } from '../render/boardRenderer';
import { drawPiecePreview } from '../render/piecePreview';
import { sandCss } from '../render/theme';
import type { App, Scene } from './app';
import { h } from './dom';
import { goalColor, goalLabel } from './goalText';
import { PauseScene } from './pause';
import { ResultScene } from './result';

const TICK_MS = 1000 / SIM_TICK_HZ;
const SLOT_CSS = 64;
/** Delay between game end and the result card (ms). */
const END_DELAY_MS = 700;

export class PlayScene implements Scene {
  readonly el: HTMLElement;
  readonly session: Session;
  private readonly renderer: BoardRenderer;
  private readonly boardArea: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly slotEls: HTMLButtonElement[] = [];
  private readonly slotCanvases: HTMLCanvasElement[] = [];
  private readonly goalEls: { root: HTMLElement; value: HTMLElement }[] = [];
  private readonly scoreEl: HTMLElement;
  private readonly piecesEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private input: PointerInput | null = null;
  private unbindKeys: (() => void) | null = null;
  private unbindSession: (() => void) | null = null;
  private resizeObs: ResizeObserver | null = null;

  private sel = 0;
  private ghostX = 0;
  private acc = 0;
  private endTimer = -1;
  private toastTimer = 0;
  private trayDirty = true;
  private hudCache = { score: -1, pieces: -1 };
  private goalCache: number[] = [];
  private readonly ghost: Ghost;

  constructor(
    private readonly app: App,
    levelId: number,
  ) {
    const level = getLevel(levelId);
    if (!level) throw new Error(`Level ${levelId} not found`);
    const s = strings().hud;
    this.session = new Session(level, { attempt: app.save.level(levelId)?.attempts ?? 0 });
    const g = this.session.grid;

    this.canvas = h('canvas', { class: 'board', 'aria-label': s.boardAria, 'data-testid': 'board' });
    this.renderer = new BoardRenderer(this.canvas, g.w, g.h);
    this.toastEl = h('div', { class: 'toast', 'aria-live': 'polite' });
    this.boardArea = h('div', { class: 'board-area' }, h('div', { class: 'board-frame' }, this.canvas), this.toastEl);

    this.scoreEl = h('b', { class: 'hud-value', 'data-testid': 'hud-score', text: '0' });
    this.piecesEl = h('b', { class: 'hud-value', 'data-testid': 'hud-pieces' });

    const goalsEl = h('ul', { class: 'goals', 'aria-label': s.goals });
    for (const goal of this.session.goals.goals) {
      const color = goalColor(goal);
      const value = h('span', { class: 'goal-value' });
      const root = h(
        'li',
        { class: 'goal' },
        color !== undefined ? h('i', { class: 'swatch', style: `background:${sandCss(color)}` }) : null,
        h('span', { class: 'goal-label', text: goalLabel(goal) }),
        value,
      );
      this.goalEls.push({ root, value });
      goalsEl.append(root);
    }

    const tray = h('div', { class: SHOW_ROTATE_BUTTON ? 'tray with-rotate' : 'tray' });
    for (let i = 0; i < TRAY_SIZE; i++) {
      const cv = h('canvas', { width: SLOT_CSS, height: SLOT_CSS });
      const btn = h('button', { class: 'slot', type: 'button', 'aria-label': fmt(s.traySlot, { n: i + 1 }), 'data-testid': `slot-${i}` }, cv);
      this.slotEls.push(btn);
      this.slotCanvases.push(cv);
      tray.append(btn);
    }
    if (SHOW_ROTATE_BUTTON) tray.append(
      h('button', {
        class: 'btn rotate-btn',
        type: 'button',
        'data-testid': 'rotate',
        'aria-label': s.rotate,
        onclick: () => this.rotateSelected(),
      }, h('span', { class: 'rotate-icon', text: '↻' }), h('span', { text: s.rotate })),
    );

    this.el = h(
      'section',
      { class: 'scene play' },
      h(
        'header',
        { class: 'hud' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': s.pause, 'data-testid': 'pause', text: '❚❚', onclick: () => this.pause() }),
        h('div', { class: 'hud-title' }, h('small', { text: fmt(s.level, { n: level.id }) }), h('span', { text: level.name })),
        h('div', { class: 'hud-stats' },
          h('div', { class: 'hud-stat' }, this.piecesEl, h('small', { text: s.pieces })),
          h('div', { class: 'hud-stat' }, this.scoreEl, h('small', { text: s.score })),
        ),
      ),
      goalsEl,
      this.boardArea,
      tray,
    );

    this.ghost = { piece: this.session.tray[0] ?? { kind: 'O', rot: 0, color: 1, special: null, specialCell: -1 }, x: 0, ok: true };
    this.centerGhost();
  }

  enter(): void {
    this.input = new PointerInput(this.canvas, this.slotEls, {
      selected: () => this.sel,
      hasPiece: (i) => !!this.session.tray[i],
      select: (i) => this.select(i),
      rotate: (i) => this.rotate(i),
      aim: (cx) => {
        if (cx !== null) this.aimAt(cx);
      },
      drop: () => this.dropSelected(),
      enabled: () => this.session.isPlaying && this.app.scenes.top === this,
    });
    this.unbindKeys = bindKeyboard({
      nudge: (dx) => this.setGhostX(this.ghostX + dx),
      rotate: () => this.rotateSelected(),
      drop: () => this.dropSelected(),
      select: (i) => this.select(i),
      back: () => this.app.scenes.back(),
    });
    this.unbindSession = this.session.events.on((e) => this.onEvent(e));
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.boardArea);
    }
    if (this.session.level.hint) this.toast(this.session.level.hint, 3000);
    if (this.app.debug) (window as unknown as { __kum: unknown }).__kum = { scene: this, session: this.session };
  }

  exit(): void {
    this.input?.destroy();
    this.unbindKeys?.();
    this.unbindSession?.();
    this.resizeObs?.disconnect();
    window.clearTimeout(this.toastTimer);
  }

  resize(): void {
    const r = this.boardArea.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    this.renderer.fit(r.width - 6, r.height - 6, window.devicePixelRatio || 1);
    this.trayDirty = true;
    this.draw();
  }

  back(): void {
    this.pause();
  }

  suspend(): void {
    if (this.session.isPlaying && this.app.scenes.top === this) this.pause();
  }

  private pause(): void {
    if (this.app.scenes.top !== this) return;
    this.app.audio.play('ui_tap');
    this.app.scenes.push(new PauseScene(this.app, this.session.level.id));
  }

  // --- tray / ghost -------------------------------------------------------

  private select(i: number): void {
    if (!this.session.tray[i] || this.sel === i) return;
    this.sel = i;
    this.app.audio.play('pick');
    this.setGhostX(this.ghostX);
    this.trayDirty = true;
  }

  private rotate(i: number): void {
    if (this.session.rotate(i)) {
      this.setGhostX(this.ghostX);
      this.trayDirty = true;
    }
  }

  private rotateSelected(): void {
    if (this.app.scenes.top === this) this.rotate(this.sel);
  }

  private selectedPiece() {
    return this.session.tray[this.sel] ?? null;
  }

  private setGhostX(x: number): void {
    const p = this.selectedPiece();
    if (!p) return;
    this.ghostX = Math.max(0, Math.min(maxX(this.session.grid, pieceShape(p)), Math.round(x)));
  }

  private centerGhost(): void {
    const p = this.selectedPiece();
    if (!p) return;
    this.setGhostX((this.session.grid.w - pieceShape(p).w * BLOCK) / 2);
  }

  private aimAt(clientX: number): void {
    const p = this.selectedPiece();
    if (!p) return;
    const center = this.renderer.clientToGrainX(clientX);
    this.setGhostX(center - (pieceShape(p).w * BLOCK) / 2);
  }

  private dropSelected(): void {
    if (this.app.scenes.top !== this) return;
    if (this.session.drop(this.sel, this.ghostX)) {
      const next = this.session.tray.findIndex((t) => t !== null);
      if (next >= 0) {
        this.sel = next;
        this.setGhostX(this.ghostX);
      }
      this.trayDirty = true;
    }
  }

  // --- events ------------------------------------------------------------

  private onEvent(e: SessionEvent): void {
    const s = strings().hud;
    feedbackFor(e, this.app.audio, this.app.haptics);
    switch (e.type) {
      case 'blocked':
        this.toast(this.session.settled ? s.noRoom : s.wait, 900);
        this.boardArea.classList.remove('shake');
        void this.boardArea.offsetWidth; // restart animation
        this.boardArea.classList.add('shake');
        break;
      case 'trayRefill':
        this.sel = this.session.tray.findIndex((t) => t !== null);
        this.trayDirty = true;
        break;
      case 'cleared':
        this.toast(e.chain > 1 ? fmt(s.chain, { n: e.chain }) : fmt(s.plus, { n: e.points }), 1200);
        break;
      case 'won':
      case 'lost':
        this.app.save.recordResult(this.session.level.id, e.type === 'won', this.session.score, this.session.stars);
        this.endTimer = END_DELAY_MS;
        break;
      default:
        break;
    }
  }

  private toast(text: string, ms: number): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  // --- loop --------------------------------------------------------------

  frame(dtMs: number): void {
    this.acc += dtMs;
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      this.session.tick();
      this.acc -= TICK_MS;
      n++;
    }
    if (n === MAX_TICKS_PER_FRAME) this.acc = 0;
    if (this.endTimer > 0) {
      this.endTimer -= dtMs;
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        this.app.scenes.push(new ResultScene(this.app, this.session));
      }
    }
    this.draw();
  }

  private draw(): void {
    const p = this.selectedPiece();
    let ghost: Ghost | null = null;
    if (p && this.session.isPlaying) {
      this.ghost.piece = p;
      this.ghost.x = this.ghostX;
      this.ghost.ok = this.session.canDrop(this.sel, this.ghostX);
      ghost = this.ghost;
    }
    this.renderer.draw(this.session, ghost);
    this.updateHud();
    if (this.trayDirty) this.drawTray();
  }

  private drawTray(): void {
    this.trayDirty = false;
    const dpr = window.devicePixelRatio || 1;
    for (let i = 0; i < TRAY_SIZE; i++) {
      const piece = this.session.tray[i];
      drawPiecePreview(this.slotCanvases[i], piece, SLOT_CSS, dpr);
      this.slotEls[i].classList.toggle('sel', i === this.sel && !!piece);
      this.slotEls[i].classList.toggle('used', !piece);
      this.slotEls[i].disabled = !piece;
    }
  }

  private updateHud(): void {
    const s = this.session;
    if (s.score !== this.hudCache.score) {
      this.hudCache.score = s.score;
      this.scoreEl.textContent = String(s.score);
    }
    if (s.piecesLeft !== this.hudCache.pieces) {
      this.hudCache.pieces = s.piecesLeft;
      this.piecesEl.textContent = Number.isFinite(s.piecesLeft) ? String(s.piecesLeft) : strings().hud.unlimited;
      this.piecesEl.classList.toggle('low', Number.isFinite(s.piecesLeft) && s.piecesLeft <= 3);
    }
    let changed = false;
    for (let i = 0; i < s.goals.goals.length; i++) {
      const g = s.goals.goals[i];
      if (this.goalCache[i] === g.current) continue;
      this.goalCache[i] = g.current;
      changed = true;
      const el = this.goalEls[i];
      const done = goalDone(g);
      el.value.textContent = done ? '✓' : `${Math.min(g.current, g.target)}/${g.target}`;
      el.root.classList.toggle('done', done);
    }
    if (changed) this.el.dataset.goals = String(s.goals.progress());
  }
}

