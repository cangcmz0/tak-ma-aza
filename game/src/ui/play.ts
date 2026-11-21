// Gameplay scene: HUD + board canvas + tray. Owns the Session for one attempt
// (a level attempt or an endless run).
import { BLOCK, DRAG_LIFT_PX, MAX_TICKS_PER_FRAME, SHOW_ROTATE_BUTTON, SIM_TICK_HZ, TRAY_SIZE } from '../config';
import { maxX, pieceShape } from '../engine/pieces';
import { feedbackFor } from '../fx/feedback';
import { CONTINUE_CLEAR_ROWS, CONTINUE_PIECES } from '../game/economy';
import type { SessionEndInfo } from '../game/meta';
import { makeEndlessLevel } from '../game/endless';
import { findHintMove } from '../game/hintMove';
import { Session, shouldHelp, type SessionEvent } from '../game/session';
import { fmt, strings } from '../i18n';
import { bindKeyboard } from '../input/keyboard';
import { PointerInput } from '../input/pointer';
import { getLevel, LEVELS } from '../levels/levels';
import { BoardRenderer, type Ghost } from '../render/boardRenderer';
import { drawPieceBlocks, drawPiecePreview } from '../render/piecePreview';
import type { App, Scene } from './app';
import { BoosterBar } from './boosterBar';
import { h } from './dom';
import { PlayHud } from './hud';
import { LevelIntroScene, unseenIntros } from './levelIntro';
import { LevelSelectScene } from './levelSelect';
import { PauseScene } from './pause';
import { PlayFx } from './playFx';
import { ResultScene } from './result';
import { Tutorial } from './tutorial';

const TICK_MS = 1000 / SIM_TICK_HZ;
const SLOT_CSS = 72;
/** Delay between game end and the result card (ms). */
const END_DELAY_MS = 700;

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
  /** HUD: order card, pieces counter, score bar (ui/hud.ts). */
  private readonly hud: PlayHud;
  /** Juice: particles, shake, Zerde's sneeze (ui/playFx.ts). */
  private readonly fx: PlayFx;
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
  /** Economy: booster bar + gold (ui/boosterBar.ts). */
  private readonly boosters: BoosterBar;
  private endInfo: SessionEndInfo | undefined;
  private gifts: string[] = [];

  private sel = 0;
  private ghostX = 0;
  private acc = 0;
  private endTimer = -1;
  private toastTimer = 0;
  private trayDirty = true;
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
    this.hud = new PlayHud(this.session, () => this.pause());
    this.boardArea = h('div', { class: 'board-area' }, this.boardFrame, this.toastEl, this.wordEl);

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

    // Economy: boosters unlock by level / progress; first unlock gifts 2 (GDD §10.2).
    const progress = app.save.currentLevel(LEVELS.map((l) => l.id)) ?? 1;
    const unlockLevel = endless ? progress : Math.max(level.id, progress);
    this.gifts = app.meta.economy.grantUnlockGifts(unlockLevel);
    this.boosters = new BoosterBar(app, {
      session: this.session,
      unlockLevel,
      boardArea: this.boardArea,
      canvas: this.canvas,
      isActive: () => this.session.isPlaying && this.app.scenes.top === this,
      toast: (t, ms) => this.toast(t, ms),
      trayChanged: () => (this.trayDirty = true),
    });

    this.dragCanvas = h('canvas');
    this.dragEl = h('div', { class: 'drag-piece', 'aria-hidden': 'true', 'data-testid': 'drag-piece' }, this.dragCanvas);

    this.el = h(
      'section',
      { class: 'scene play' },
      this.hud.header,
      this.hud.scoreBar,
      this.boardArea,
      tray,
      this.boosters.el,
      this.dragEl,
    );

    this.fx = new PlayFx({
      session: this.session,
      sceneEl: this.el,
      boardArea: this.boardArea,
      boardFrame: this.boardFrame,
      renderer: this.renderer,
      goalTarget: (i) => this.hud.goalEls[i]?.chip ?? null,
    });
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
      enabled: () => this.session.isPlaying && this.app.scenes.top === this && !this.boosters.busy,
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
          piecesEl: this.hud.piecesStat,
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
    if (this.gifts.length) {
      const e = strings();
      this.toast(fmt(e.economy.giftToast, { list: this.gifts.map((id) => e.boosters.names[id]).join(', ') }), 2200);
    }
    if (this.app.debug)
      (window as unknown as { __kum: unknown }).__kum = { scene: this, session: this.session, hint: () => findHintMove(this.session) };
  }

  exit(): void {
    this.input?.destroy();
    this.unbindKeys?.();
    this.unbindSession?.();
    this.resizeObs?.disconnect();
    this.tutorial?.destroy();
    this.boosters.destroy();
    this.fx.destroy();
    window.clearTimeout(this.toastTimer);
  }

  resize(): void {
    const r = this.boardArea.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    this.renderer.fit(r.width - 14, r.height - 14, window.devicePixelRatio || 1);
    this.fx.resize();
    this.trayDirty = true;
    this.tutorial?.relayout();
    this.draw();
  }

  back(): void {
    if (this.boosters.cancel()) return; // leave booster targeting first
    this.pause();
  }

  suspend(): void {
    if (this.session.isPlaying && this.app.scenes.top === this) this.pause();
  }

  private pause(): void {
    if (this.app.scenes.top !== this) return;
    this.endDrag();
    this.boosters.cancel();
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
    this.fx.onEvent(e);
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
        this.boosters.cancel();
        this.endInfo = this.app.meta.onSessionEnd(this.session); // gold; before recordResult (needs old progress)
        if (this.session.endless) this.newBest = this.app.save.recordEndless(this.session.score);
        else this.app.save.recordResult(this.session.level.id, e.type === 'won', this.session.score, this.session.stars);
        this.endTimer = END_DELAY_MS;
        break;
      default:
        break;
    }
  }

  /** "Devam et +5" was paid (ui/continueOffer.ts): close the result card and resume. */
  private continueRun(): void {
    if (this.session.state !== 'lost' || this.session.endless || !(this.app.scenes.top instanceof ResultScene)) return;
    this.app.scenes.pop();
    this.app.save.undoLastLoss(this.session.level.id); // still the same attempt
    this.session.revive(CONTINUE_PIECES, CONTINUE_CLEAR_ROWS);
    this.endInfo = undefined;
    this.sel = Math.max(0, this.session.tray.findIndex((_, i) => this.slotUsable(i)));
    this.setGhostX(this.ghostX);
    this.trayDirty = true;
    this.boosters.paint();
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
    this.wordEl.replaceChildren(...lines.map((t, li) => wordLine(t, li === 0 && lines.length > 1)));
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
    this.fx.frame(dtMs);
    if (this.endTimer > 0) {
      this.endTimer -= dtMs;
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        this.app.scenes.push(
          new ResultScene(this.app, this.session, {
            mode: this.mode,
            newBest: this.newBest,
            endInfo: this.endInfo,
            onContinue: () => this.continueRun(),
          }),
        );
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
    if (this.hud.update(this.app.save.endlessBest)) this.el.dataset.goals = String(this.session.goals.progress());
  }
}

/** One line of the chain word, split into letters for the staggered pop (CSS --i). */
function wordLine(text: string, small: boolean): HTMLElement {
  const line = h('span', { class: small ? 'fx-line fx-double' : 'fx-line', 'aria-label': text });
  [...text].forEach((ch, i) => {
    const l = h('i', { text: ch, 'aria-hidden': 'true' });
    l.style.setProperty('--i', String(i));
    line.append(l);
  });
  return line;
}
