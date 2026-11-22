// Touch / mouse input for the play scene. Placement is drag & drop only:
// - Press a tray pouch, drag it over the board (it is drawn lifted above the finger) and
//   release to drop it there. Releasing outside the board returns it to the tray (no cost).
// - Tap the already-selected tray pouch to rotate it.
// - Touching the board itself does nothing (tap-to-drop was removed: players found it confusing).
// Only one pointer is tracked at a time (extra fingers are ignored).

export interface PointerTarget {
  /** Index of the selected tray slot or -1. */
  selected(): number;
  hasPiece(slot: number): boolean;
  select(slot: number): void;
  rotate(slot: number): void;
  /** Aim the ghost at a client X coordinate (null hides the ghost). */
  aim(clientX: number | null, clientY?: number): void;
  /** Drop the selected piece at the current aim. */
  drop(): void;
  enabled(): boolean;
  /** A tray piece is being dragged: finger position (draw the piece lifted above it). */
  drag?(clientX: number, clientY: number): void;
  /** The tray drag ended (dropped, cancelled or released elsewhere). */
  dragEnd?(): void;
}

/** Vertical slack above the board that still counts as "over the board" (CSS px). */
const BOARD_TOP_SLACK = 40;
/** Movement (CSS px) after which a press is a drag, not a tap. */
const TAP_SLOP = 10;

interface Gesture {
  id: number;
  source: 'tray';
  slot: number;
  wasSelected: boolean;
  x0: number;
  y0: number;
  moved: boolean;
}

export class PointerInput {
  private g: Gesture | null = null;
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly board: HTMLElement,
    slots: readonly HTMLElement[],
    private readonly target: PointerTarget,
  ) {
    const on = <K extends keyof WindowEventMap>(
      el: Window | HTMLElement,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.offs.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    slots.forEach((el, i) => on(el, 'pointerdown', (e) => this.downTray(e, i)));
    on(window, 'pointermove', (e) => this.move(e), { passive: true });
    on(window, 'pointerup', (e) => this.up(e));
    on(window, 'pointercancel', (e) => this.cancel(e));
    on(board, 'contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    if (this.g?.source === 'tray') this.target.dragEnd?.();
    this.offs.forEach((f) => f());
    this.offs.length = 0;
    this.g = null;
  }

  /** True while a gesture is in progress. */
  get active(): boolean {
    return this.g !== null;
  }

  private overBoard(x: number, y: number): boolean {
    const r = this.board.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top - BOARD_TOP_SLACK && y <= r.bottom;
  }

  private downTray(e: PointerEvent, slot: number): void {
    if (this.g || !this.target.enabled() || !this.target.hasPiece(slot)) return;
    e.preventDefault();
    const wasSelected = this.target.selected() === slot;
    this.target.select(slot);
    this.g = { id: e.pointerId, source: 'tray', slot, wasSelected, x0: e.clientX, y0: e.clientY, moved: false };
  }

  private move(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.id) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_SLOP) g.moved = true;
    if (g.source === 'tray' && g.moved) this.target.drag?.(e.clientX, e.clientY);
    if (this.overBoard(e.clientX, e.clientY)) this.target.aim(e.clientX, g.moved ? e.clientY : undefined);
    else if (g.moved) this.target.aim(null);
  }

  private up(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.id) return;
    this.g = null;
    if (g.source === 'tray') this.target.dragEnd?.();
    if (!this.target.enabled()) return;
    if (g.source === 'tray' && !g.moved) {
      if (g.wasSelected) this.target.rotate(g.slot);
      return;
    }
    if (this.overBoard(e.clientX, e.clientY)) {
      this.target.aim(e.clientX, e.clientY);
      this.target.drop();
    }
  }

  private cancel(e: PointerEvent): void {
    if (this.g && e.pointerId === this.g.id) {
      if (this.g.source === 'tray') this.target.dragEnd?.();
      this.g = null;
    }
  }
}
