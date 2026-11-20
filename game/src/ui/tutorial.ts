// Tutorial scenarios t1..t3 (GDD §13): a text bubble, an animated "hand" hint and
// optional input focus on one tray slot. Steps advance on session events or timers.
// Wrong moves never block: the hand is recomputed after every settle.
import { BLOCK } from '../config';
import type { SessionEvent, SessionEventType } from '../core/events';
import { pieceShape } from '../engine/pieces';
import { findHintMove } from '../game/hintMove';
import type { Session } from '../game/session';
import { colorName, fmt, strings } from '../i18n';
import type { TutorialId } from '../levels/schema';
import { h } from './dom';

export interface TutorialHost {
  readonly session: Session;
  /** Positioned container for the hand (the scene element). */
  readonly overlayRoot: HTMLElement;
  /** Positioned container for the text bubble (the board area). */
  readonly bubbleRoot: HTMLElement;
  slotEl(i: number): HTMLElement;
  /** Element to point at for "pieces left". */
  readonly piecesEl: HTMLElement;
  /** Client coordinates of a grain position on the board. */
  grainToClient(x: number, y: number): { x: number; y: number };
  /** Restrict input to one tray slot (null = all). */
  setFocusSlot(slot: number | null): void;
}

type HandKind = 'move' | 'tapSlot' | 'tapSlots' | 'pieces';

interface Step {
  text?: (s: Session) => string;
  hand?: HandKind;
  /** Slot the hand / focus refers to (falls back to any slot when it is empty). */
  slot?: number;
  /** Only `slot` can be used during this step. */
  focus?: boolean;
  /** Advance on this event, or after `ms` when 'timer'. */
  until: SessionEventType | 'timer';
  /** Timer length, or max wait for an event. */
  ms?: number;
}

const T = () => strings().tutorial;

function pieceColorName(s: Session, slot: number): string {
  const p = s.tray[slot] ?? s.tray.find((t) => t);
  return p ? colorName(p.color) : '';
}

export const TUTORIAL_STEPS: Record<TutorialId, Step[]> = {
  t1: [
    { text: () => T().t1_drag, hand: 'move', slot: 0, focus: true, until: 'cleared' },
    { text: () => T().t1_great, until: 'timer', ms: 2600 },
    { text: (s) => fmt(T().t1_next, { color: pieceColorName(s, 1) }), hand: 'move', slot: 1, focus: true, until: 'cleared' },
    { text: () => T().t1_done, until: 'timer', ms: 2200 },
  ],
  t2: [
    { text: () => T().t2_color, hand: 'move', until: 'placed' },
    { text: () => T().t2_counter, hand: 'pieces', until: 'timer', ms: 3200 },
    { text: () => T().t2_order, hand: 'tapSlots', until: 'placed' },
    { text: () => T().t2_refill, hand: 'move', until: 'trayRefill', ms: 20000 },
  ],
  t3: [
    { text: () => T().t3_rotate, hand: 'tapSlot', slot: 0, focus: true, until: 'rotated' },
    { text: () => T().t3_drop, hand: 'move', slot: 0, focus: true, until: 'placed' },
    { until: 'chainWord', ms: 15000 },
    { text: () => T().t3_chain, until: 'timer', ms: 3000 },
  ],
};

export class Tutorial {
  private readonly steps: Step[];
  private index = -1;
  private elapsed = 0;
  private handDirty = true;
  private readonly hand: HTMLElement;
  private readonly bubble: HTMLElement;
  private anim: Animation | null = null;
  private pulsed: HTMLElement | null = null;
  private finished = false;

  constructor(
    readonly id: TutorialId,
    private readonly host: TutorialHost,
    private readonly onDone: () => void,
  ) {
    this.steps = TUTORIAL_STEPS[id];
    this.hand = h('div', { class: 'tut-hand', 'aria-hidden': 'true', 'data-testid': 'tutorial-hand' });
    this.bubble = h('div', { class: 'tut-bubble', role: 'status', 'data-testid': 'tutorial-text' });
    host.overlayRoot.append(this.hand);
    host.bubbleRoot.append(this.bubble);
    this.goto(0);
  }

  get active(): boolean {
    return !this.finished;
  }

  get stepIndex(): number {
    return this.index;
  }

  private get step(): Step | undefined {
    return this.steps[this.index];
  }

  private goto(i: number): void {
    this.index = i;
    this.elapsed = 0;
    this.handDirty = true;
    const st = this.step;
    if (!st) return this.finish();
    const text = st.text?.(this.host.session) ?? '';
    this.bubble.textContent = text;
    this.bubble.classList.toggle('show', !!text);
    this.updateFocus();
    this.setPulse(st.hand === 'pieces' ? this.host.piecesEl : null);
  }

  private updateFocus(): void {
    const st = this.step;
    const slot = st?.focus && st.slot !== undefined && this.host.session.tray[st.slot] ? st.slot : null;
    this.host.setFocusSlot(slot);
  }

  private setPulse(el: HTMLElement | null): void {
    this.pulsed?.classList.remove('tut-pulse');
    this.pulsed = el;
    el?.classList.add('tut-pulse');
  }

  onEvent(e: SessionEvent): void {
    if (this.finished) return;
    if (e.type === 'won' || e.type === 'lost') return this.finish();
    if (e.type === 'settled' || e.type === 'trayRefill' || e.type === 'rotated' || e.type === 'placed') {
      this.handDirty = true;
      this.updateFocus();
    }
    const st = this.step;
    if (st && st.until === e.type) this.goto(this.index + 1);
  }

  frame(dtMs: number): void {
    if (this.finished) return;
    const st = this.step;
    if (!st) return;
    this.elapsed += dtMs;
    if (st.ms !== undefined && this.elapsed >= st.ms) return this.goto(this.index + 1);
    const s = this.host.session;
    const calm = s.settled && !s.clearPending && s.isPlaying;
    if (!calm) {
      this.hideHand();
      return;
    }
    if (this.handDirty) {
      this.handDirty = false;
      this.showHand(st);
    }
  }

  /** Layout changed: rebuild the hand animation. */
  relayout(): void {
    this.handDirty = true;
  }

  private local(p: { x: number; y: number }): { x: number; y: number } {
    const r = this.host.overlayRoot.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }

  private centerOf(el: HTMLElement): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return this.local({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  private hideHand(): void {
    if (this.anim) {
      this.anim.cancel();
      this.anim = null;
    }
    this.hand.classList.remove('show');
    this.handDirty = true;
  }

  private showHand(st: Step): void {
    this.hideHand();
    this.handDirty = false;
    const s = this.host.session;
    const kind = st.hand;
    if (!kind) return;
    const preferred = st.slot !== undefined && s.tray[st.slot] ? st.slot : -1;
    if (kind === 'pieces') return this.animTap(this.centerOf(this.host.piecesEl), 1);
    if (kind === 'tapSlot') {
      const slot = preferred >= 0 ? preferred : s.tray.findIndex((t) => t);
      if (slot >= 0) this.animTap(this.centerOf(this.host.slotEl(slot)), 2);
      return;
    }
    if (kind === 'tapSlots') {
      const filled = s.tray.map((t, i) => (t ? i : -1)).filter((i) => i >= 0).reverse();
      if (filled.length) this.animTapSeq(filled.map((i) => this.centerOf(this.host.slotEl(i))));
      return;
    }
    // 'move': the best drop for the preferred slot (or any slot).
    const hint = findHintMove(s, preferred >= 0 ? [preferred] : undefined);
    if (!hint) return;
    const p = s.tray[hint.slot];
    if (!p) return;
    const from = this.centerOf(this.host.slotEl(hint.slot));
    if (hint.rot !== p.rot) return this.animTap(from, 2);
    const shape = pieceShape(p);
    const g = s.grid;
    const to = this.local(this.host.grainToClient(hint.x + (shape.w * BLOCK) / 2, g.h * 0.22));
    this.animDrag(from, to);
  }

  private start(frames: Keyframe[], duration: number): void {
    this.hand.classList.add('show');
    if (typeof this.hand.animate !== 'function') return;
    this.anim = this.hand.animate(frames, { duration, iterations: Infinity, easing: 'ease-in-out' });
  }

  private animDrag(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const at = (p: { x: number; y: number }, sc: number) => `translate(${p.x}px, ${p.y}px) scale(${sc})`;
    this.start(
      [
        { transform: at(a, 1), opacity: 0, offset: 0 },
        { transform: at(a, 1), opacity: 1, offset: 0.1 },
        { transform: at(a, 0.8), opacity: 1, offset: 0.2 },
        { transform: at(b, 0.8), opacity: 1, offset: 0.7 },
        { transform: at(b, 1), opacity: 1, offset: 0.8 },
        { transform: at(b, 1), opacity: 0, offset: 1 },
      ],
      1600,
    );
  }

  private animTap(p: { x: number; y: number }, times: number): void {
    const at = (sc: number) => `translate(${p.x}px, ${p.y}px) scale(${sc})`;
    const frames: Keyframe[] = [{ transform: at(1), opacity: 0.9, offset: 0 }];
    for (let k = 0; k < times; k++) {
      const o = (k + 0.5) / (times + 0.5);
      frames.push({ transform: at(0.7), opacity: 1, offset: o - 0.12 / times });
      frames.push({ transform: at(1), opacity: 1, offset: o });
    }
    frames.push({ transform: at(1), opacity: 0.9, offset: 1 });
    this.start(frames, 1200);
  }

  private animTapSeq(points: { x: number; y: number }[]): void {
    const frames: Keyframe[] = [];
    const n = points.length;
    points.forEach((p, k) => {
      const at = (sc: number) => `translate(${p.x}px, ${p.y}px) scale(${sc})`;
      const o0 = k / n;
      frames.push({ transform: at(1), opacity: 1, offset: o0 });
      frames.push({ transform: at(0.7), opacity: 1, offset: o0 + 0.3 / n });
      frames.push({ transform: at(1), opacity: 1, offset: o0 + 0.6 / n });
      frames.push({ transform: at(1), opacity: 1, offset: o0 + 0.95 / n });
    });
    frames.push({ ...frames[frames.length - 1], offset: 1 });
    this.start(frames, 900 * n);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.destroy();
    this.onDone();
  }

  destroy(): void {
    this.hideHand();
    this.setPulse(null);
    this.host.setFocusSlot(null);
    this.hand.remove();
    this.bubble.remove();
  }
}
