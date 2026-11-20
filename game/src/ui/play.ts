// Gameplay scene: HUD + board canvas + tray. Owns the Session for one attempt
// (a level attempt or an endless run).
import { BLOCK, DRAG_LIFT_PX, MAX_TICKS_PER_FRAME, SHOW_ROTATE_BUTTON, SIM_TICK_HZ, TRAY_SIZE } from '../config';
import { maxX, pieceShape } from '../engine/pieces';
import { feedbackFor } from '../fx/feedback';
import { makeEndlessLevel } from '../game/endless';
import { goalDone } from '../game/goals';
import { Session, shouldHelp, type SessionEvent } from '../game/session';
import { fmt, strings } from '../i18n';
import { bindKeyboard } from '../input/keyboard';
import { PointerInput } from '../input/pointer';
import { getLevel } from '../levels/levels';
import { BoardRenderer, type Ghost } from '../render/boardRenderer';
import { drawPieceBlocks, drawPiecePreview } from '../render/piecePreview';
import { sandCss } from '../render/theme';
import type { App, Scene } from './app';
import { h } from './dom';
import { goalColor, goalLabel } from './goalText';
import { LevelIntroScene, unseenIntros } from './levelIntro';
import { LevelSelectScene } from './levelSelect';
import { PauseScene } from './pause';
import { ResultScene } from './result';
import { Tutorial } from './tutorial';

const TICK_MS = 1000 / SIM_TICK_HZ;
const SLOT_CSS = 64;
/** Delay between game end and the result card (ms). */
const END_DELAY_MS = 700;
/** Max flying grain dots per grainsToGoal event (simple placeholder effect). */
const FLY_DOTS = 10;

/** What a PlayScene plays. `intro: false` skips the pre-level card (retries). */
export type PlayMode = { kind: 'level'; id: number; intro?: boolean } | { kind: 'endless' };

export class PlayScene implements Scene {
  readonly el: HTMLElement;
  readonly session: Session;
  readonly mode: PlayMode;
  private readonly renderer: BoardRenderer;
  private readonly boardArea: HTMLElement;
  private readonly boardFrame: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly slotEls: HTMLButtonElement[] = [];
  private readonly slotCanvases: HTMLCanvasElement[] = [];
  private readonly goalEls: { root: HTMLElement; value: HTMLElement }[] = [];
  private readonly scoreEl: HTMLElement;
  private readonly piecesEl: HTMLElement;
  private readonly piecesStat: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly wordEl: HTMLElement;
  private readonly dragEl: HTMLElement;
  private readonly dragCanvas: HTMLCanvasElement;
  private input: PointerInput | null = null;
  private unbindKeys: (() => void) | null = null;
  private unbindSession: (() => void) | null = null;
  private resizeObs: ResizeObserver | null = null;
  private tutorial: Tutorial | null = null;
  private focusSlot: number | null = null;
  private dragging = false;
  private newBest = false;

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
    mode: PlayMode | number,
  ) {
    this.mode = typeof mode === 'number' ? { kind: 'level', id: mode, intro: true } : mode;
    const s = strings().hud;
    if (this.mode.kind === 'endless') {
      const seed = (Date.now() ^ Math.imul(app.save.endlessBest + 1, 7919)) >>> 0;
      this.session = new Session(makeEndlessLevel(seed), { endless: true });
    } else {
      const level = getLevel(this.mode.id);
      if (!level) throw new Error(`Level ${this.mode.id} not found`);
      const prog = app.save.level(level.id);
      this.session = new Session(level, { attempt: prog?.attempts ?? 0, help: shouldHelp(prog?.lossStreak ?? 0) });
    }
    const level = this.session.level;
    const endless = this.session.endless;
    const g = this.session.grid;

    this.canvas = h('canvas', { class: 'board', 'aria-label': s.boardAria, 'data-testid': 'board' });
    this.renderer = new BoardRenderer(this.canvas, g.w, g.h);
    this.toastEl = h('div', { class: 'toast', 'aria-live': 'polite' });
    this.wordEl = h('div', { class: 'fx-word', 'aria-live': 'polite', 'data-testid': 'fx-word' });
    this.boardFrame = h('div', { class: 'board-frame' }, this.canvas, h('div', { class: 'danger-edge', 'aria-hidden': 'true' }));
    this.boardArea = h('div', { class: 'board-area' }, this.boardFrame, this.toastEl, this.wordEl);

    this.scoreEl = h('b', { class: 'hud-value', 'data-testid': 'hud-score', text: '0' });
    this.piecesEl = h('b', { class: 'hud-value', 'data-testid': 'hud-pieces' });
    this.piecesStat = h('div', { class: 'hud-stat' }, this.piecesEl, h('small', { text: endless ? s.best : s.pieces }));

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
    if (endless) goalsEl.append(h('li', { class: 'goal', text: s.endlessSub }));

    const tray = h('div', { class: SHOW_ROTATE_BUTTON ? 'tray with-rotate' : 'tray' });
    for (let i = 0; i < TRAY_SIZE; i++) {
      const cv = h('canvas', { width: SLOT_CSS, height: SLOT_CSS });
      const btn = h('button', { class: 'slot', type: 'button', 'aria-label': fmt(s.traySlot, { n: i + 1 }), 'data-testid': `slot-${i}` }, cv);
      this.slotEls.push(btn);
      this.slotCanvases.push(cv);
      tray.append(btn);
    }
    if (SHOW_ROTATE_BUTTON)
      tray.append(
        h(
          'button',
          {
            class: 'btn rotate-btn',
            type: 'button',
            'data-testid': 'rotate',
            'aria-label': s.rotate,
            onclick: () => this.rotateSelected(),
          },
          h('span', { class: 'rotate-icon', text: '↻' }),
          h('span', { text: s.rotate }),
        ),
      );

    this.dragCanvas = h('canvas');
    this.dragEl = h('div', { class: 'drag-piece', 'aria-hidden': 'true', 'data-testid': 'drag-piece' }, this.dragCanvas);

    this.el = h(
      'section',
      { class: 'scene play' },
      h(
        'header',
        { class: 'hud' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': s.pause, 'data-testid': 'pause', text: '❚❚', onclick: () => this.pause() }),
        h(
          'div',
          { class: 'hud-title' },
          h('small', { text: endless ? s.endlessSub : fmt(s.level, { n: level.id }) }),
          h('span', { text: endless ? s.endlessTitle : level.name }),
        ),
        h('div', { class: 'hud-stats' }, this.piecesStat, h('div', { class: 'hud-stat' }, this.scoreEl, h('small', { text: s.score }))),
      ),
      goalsEl,
      this.boardArea,
      tray,
      this.dragEl,
    );

    this.ghost = { piece: this.session.tray[0] ?? { kind: 'O', rot: 0, color: 1, special: null, specialCell: -1 }, x: 0, ok: true };
    this.centerGhost();
  }

  enter(): void {
    this.input = new PointerInput(this.canvas, this.slotEls, {
      selected: () => this.sel,
      hasPiece: (i) => this.slotUsable(i),
      select: (i) => this.select(i),
      rotate: (i) => this.rotate(i),
      aim: (cx) => {
        if (cx !== null) this.aimAt(cx);
      },
      drop: () => this.dropSelected(),
      enabled: () => this.session.isPlaying && this.app.scenes.top === this,
      drag: (x, y) => this.dragAt(x, y),
      dragEnd: () => this.endDrag(),
    });
    this.unbindKeys = bindKeyboard({
      nudge: (dx) => this.setGhostX(this.ghostX + dx),
      rotate: () => this.rotateSelected(),
      drop: () => this.dropSelected(),
      select: (i) => {
        if (this.slotUsable(i)) this.select(i);
      },
      back: () => this.app.scenes.back(),
    });
    this.unbindSession = this.session.events.on((e) => this.onEvent(e));
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.boardArea);
    }
    const level = this.session.level;
    const tut = level.tutorial;
    const tutorialOn = !this.session.endless && tut !== null && !this.app.save.isTutorialDone(tut);
    if (tutorialOn && tut) {
      this.tutorial = new Tutorial(
        tut,
        {
          session: this.session,
          overlayRoot: this.el,
          bubbleRoot: this.boardArea,
          slotEl: (i) => this.slotEls[i],
          piecesEl: this.piecesStat,
          grainToClient: (x, y) => this.renderer.grainToClient(x, y),
          setFocusSlot: (slot) => this.setFocusSlot(slot),
        },
        (done) => {
          if (done) this.app.save.markTutorialDone(tut);
          this.tutorial = null;
        },
      );
    }
    const wantsIntro = this.mode.kind === 'level' && this.mode.intro !== false;
    const showIntro = wantsIntro && (!tutorialOn || unseenIntros(this.app, level.intro).length > 0);
    if (showIntro) this.app.scenes.push(new LevelIntroScene(this.app, this.session, () => this.app.scenes.replace(new LevelSelectScene(this.app))));
    else if (level.hint && !tutorialOn) this.toast(level.hint, 3000);
    if (this.app.debug) (window as unknown as { __kum: unknown }).__kum = { scene: this, session: this.session };
  }

  exit(): void {
    this.input?.destroy();
    this.unbindKeys?.();
    this.unbindSession?.();
    this.resizeObs?.disconnect();
    this.tutorial?.destroy();
    window.clearTimeout(this.toastTimer);
  }

  resize(): void {
    const r = this.boardArea.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    this.renderer.fit(r.width - 6, r.height - 6, window.devicePixelRatio || 1);
    this.trayDirty = true;
    this.tutorial?.relayout();
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
    this.endDrag();
    this.app.audio.play('ui_tap');
    this.app.scenes.push(new PauseScene(this.app, this.mode));
  }

  // --- tray / ghost -------------------------------------------------------

  private slotUsable(i: number): boolean {
    return !!this.session.tray[i] && (this.focusSlot === null || this.focusSlot === i);
  }

  private setFocusSlot(slot: number | null): void {
    if (this.focusSlot === slot) return;
    this.focusSlot = slot;
    if (slot !== null && this.session.tray[slot]) this.select(slot);
    this.trayDirty = true;
  }

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

  /** Draw the dragged piece at board scale, DRAG_LIFT_PX above the finger (GDD §4.4). */
  private dragAt(clientX: number, clientY: number): void {
    const p = this.selectedPiece();
    if (!p) return;
    const shape = pieceShape(p);
    const cell = this.renderer.cssPerGrain * BLOCK;
    const w = shape.w * cell;
    const hh = shape.h * cell;
    if (!this.dragging) {
      this.dragging = true;
      const dpr = window.devicePixelRatio || 1;
      this.dragCanvas.width = Math.round(w * dpr);
      this.dragCanvas.height = Math.round(hh * dpr);
      this.dragCanvas.style.width = `${w}px`;
      this.dragCanvas.style.height = `${hh}px`;
      const c = this.dragCanvas.getContext('2d');
      if (c) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, hh);
        drawPieceBlocks(c, p, 0, 0, cell);
      }
      this.dragEl.classList.add('show');
      this.slotEls[this.sel]?.classList.add('dragging');
    }
    const root = this.el.getBoundingClientRect();
    this.dragEl.style.transform = `translate(${clientX - root.left - w / 2}px, ${clientY - root.top - DRAG_LIFT_PX - hh}px)`;
  }

  private endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.dragEl.classList.remove('show');
    for (const el of this.slotEls) el.classList.remove('dragging');
  }

  private dropSelected(): void {
    if (this.app.scenes.top !== this) return;
    if (!this.slotUsable(this.sel)) return;
    if (this.session.drop(this.sel, this.ghostX)) {
      const next = this.session.tray.findIndex((_, i) => this.slotUsable(i));
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
    this.tutorial?.onEvent(e);
    switch (e.type) {
      case 'blocked':
        this.toast(this.session.settled ? s.noRoom : s.wait, 900);
        this.restartAnim(this.boardArea, 'shake');
        break;
      case 'trayRefill':
      case 'trayRerolled':
        this.sel = Math.max(0, this.session.tray.findIndex((_, i) => this.slotUsable(i)));
        this.trayDirty = true;
        break;
      case 'cleared':
        this.floatText(`+${e.points}`, e.cx ?? this.session.grid.w / 2, e.cy ?? this.session.grid.h / 2);
        break;
      case 'chainWord':
      case 'double':
        this.showWord();
        break;
      case 'grainsToGoal':
        this.flyGrains(e.goal, e.color, e.cells);
        break;
      case 'sackHit':
        this.restartAnim(this.boardArea, 'shake');
        break;
      case 'sackBreak':
        this.floatText(`+${e.points}`, e.x + e.w / 2, e.y + e.h / 2);
        this.toast(s.sackTorn, 900);
        break;
      case 'danger':
        this.boardFrame.classList.toggle('danger', e.on);
        if (e.first) this.toast(s.danger, 1400);
        break;
      case 'won':
      case 'lost':
        this.endDrag();
        if (this.session.endless) this.newBest = this.app.save.recordEndless(this.session.score);
        else this.app.save.recordResult(this.session.level.id, e.type === 'won', this.session.score, this.session.stars);
        this.endTimer = END_DELAY_MS;
        break;
      default:
        break;
    }
  }

  /** Chain word / "Çifte!" in the middle of the board (one element, restarted per clear). */
  private showWord(): void {
    const s = strings().hud;
    const lines: string[] = [];
    // Called for both `double` and `chainWord` of the same clear; rebuild from session state.
    const last = this.session.chain;
    if (this.lastWordTick === this.session.ticks) return;
    this.lastWordTick = this.session.ticks;
    if (this.session.clear.regionCount >= 2) lines.push(s.double);
    if (last >= 2) lines.push(s.chainWords[Math.min(last, 5)] ?? fmt(s.chain, { n: last }));
    if (!lines.length) return;
    this.wordEl.replaceChildren(...lines.map((t) => h('span', { text: t })));
    this.wordEl.dataset.chain = String(last);
    this.restartAnim(this.wordEl, 'show');
  }
  private lastWordTick = -1;

  private restartAnim(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth; // restart CSS animation
    el.classList.add(cls);
  }

  private boardLocal(gx: number, gy: number): { x: number; y: number } {
    const p = this.renderer.grainToClient(gx, gy);
    const r = this.boardArea.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }

  private floatText(text: string, gx: number, gy: number): void {
    const p = this.boardLocal(gx, gy);
    const el = h('div', { class: 'fx-float', text, style: `left:${p.x}px;top:${p.y}px` });
    this.boardArea.append(el);
    window.setTimeout(() => el.remove(), 1000);
  }

  /** Placeholder for "grains fly into the order bag" (the Art agent replaces this). */
  private flyGrains(goal: number, color: number, cells: readonly number[]): void {
    const target = this.goalEls[goal]?.root;
    if (!target || typeof this.el.animate !== 'function') return;
    const root = this.el.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const tx = tr.left + tr.width / 2 - root.left;
    const ty = tr.top + tr.height / 2 - root.top;
    const w = this.session.grid.w;
    const step = Math.max(1, Math.floor(cells.length / FLY_DOTS));
    for (let k = 0, n = 0; k < cells.length && n < FLY_DOTS; k += step, n++) {
      const i = cells[k];
      const p = this.renderer.grainToClient((i % w) + 0.5, Math.floor(i / w) + 0.5);
      const x = p.x - root.left;
      const y = p.y - root.top;
      const dot = h('i', { class: 'fx-grain', style: `background:${sandCss(color)}` });
      this.el.append(dot);
      const a = dot.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${x + (n % 2 ? 18 : -18)}px, ${y - 30}px) scale(1.2)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0.9 },
        ],
        { duration: 500 + n * 30, easing: 'ease-in', delay: n * 15 },
      );
      a.onfinish = () => dot.remove();
      a.oncancel = () => dot.remove();
    }
    window.setTimeout(() => this.restartAnim(target, 'bump'), 520);
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
    this.tutorial?.frame(dtMs);
    if (this.endTimer > 0) {
      this.endTimer -= dtMs;
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        this.app.scenes.push(new ResultScene(this.app, this.session, { mode: this.mode, newBest: this.newBest }));
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
      this.slotEls[i].classList.toggle('dim', !!piece && !this.slotUsable(i));
      this.slotEls[i].disabled = !piece;
    }
  }

  private updateHud(): void {
    const s = this.session;
    if (s.score !== this.hudCache.score) {
      this.hudCache.score = s.score;
      this.scoreEl.textContent = String(s.score);
    }
    const pieceStat = s.endless ? Math.max(this.app.save.endlessBest, s.score) : s.piecesLeft;
    if (pieceStat !== this.hudCache.pieces) {
      this.hudCache.pieces = pieceStat;
      this.piecesEl.textContent = Number.isFinite(pieceStat) ? String(pieceStat) : strings().hud.unlimited;
      this.piecesEl.classList.toggle('low', !s.endless && Number.isFinite(pieceStat) && pieceStat <= 3);
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
