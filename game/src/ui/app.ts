// Shared app context + scene stack.
import type { AudioService } from '../audio/audio';
import type { HapticsService } from '../fx/haptics';
import type { SaveStore } from '../platform/storage';

export interface Scene {
  readonly el: HTMLElement;
  /** Overlays keep the scene below visible (but frozen). */
  readonly overlay?: boolean;
  enter?(): void;
  exit?(): void;
  frame?(dtMs: number): void;
  resize?(): void;
  /** Hardware back / Escape. */
  back?(): void;
  /** App went to background. */
  suspend?(): void;
}

export interface App {
  root: HTMLElement;
  save: SaveStore;
  audio: AudioService;
  haptics: HapticsService;
  scenes: SceneManager;
  debug: boolean;
  version: string;
}

export class SceneManager {
  private stack: Scene[] = [];

  constructor(private readonly root: HTMLElement) {}

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Clear the stack and show `s`. */
  replace(s: Scene): void {
    while (this.stack.length) this.popInternal();
    this.push(s);
  }

  push(s: Scene): void {
    this.stack.push(s);
    this.root.append(s.el);
    s.enter?.();
    s.resize?.();
  }

  pop(): void {
    if (this.stack.length > 1) this.popInternal();
  }

  private popInternal(): void {
    const s = this.stack.pop();
    if (!s) return;
    s.exit?.();
    s.el.remove();
  }

  frame(dtMs: number): void {
    this.top?.frame?.(dtMs);
  }

  resize(): void {
    for (const s of this.stack) s.resize?.();
  }

  back(): void {
    this.top?.back?.();
  }

  suspend(): void {
    this.top?.suspend?.();
  }
}
