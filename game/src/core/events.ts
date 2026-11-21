// Minimal typed event emitter + the gameplay event catalogue.
import type { Piece } from '../engine/pieces';

export class Emitter<E extends { type: string }> {
  private listeners: Array<(e: E) => void> = [];

  on(fn: (e: E) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(e: E): void {
    for (const l of this.listeners) l(e);
  }

  clear(): void {
    this.listeners = [];
  }
}

export type LoseReason = 'out_of_pieces' | 'no_space';

/**
 * Everything a Session announces (sound, haptics, juice, analytics, tutorial listen here).
 * Coordinates are in grains (x right, y down, origin top-left of the board); `cells` are
 * grain indices (i = y * grid.w + x).
 *
 * Order within one resolved clear: grainsToGoal* → joker? → bomb? → cleared →
 * double? → chainWord? → sackHit/sackBreak* → goalComplete*.
 */
export type SessionEvent =
  | { type: 'placed'; slot: number; piece: Piece; x: number }
  | { type: 'blocked'; slot: number; x: number }
  | { type: 'rotated'; slot: number }
  | { type: 'trayRefill' }
  /** Paths found; the blink starts (session.clear.marked is valid until `cleared`). */
  | { type: 'clearStart'; paths: number; grains: number }
  /**
   * Paths removed. Session always sets the optional fields (optional only so tools/tests can
   * build events by hand): cx/cy = centre of the path grains (score popup anchor),
   * colors = path colours largest first (JOKER = 15 for a joker-only path).
   * Bombs are announced separately by a `bomb` event.
   */
  | { type: 'cleared'; paths: number; grains: number; chain: number; points: number; cx?: number; cy?: number; colors?: number[] }
  /** Two or more paths in one check ("Çifte!"). */
  | { type: 'double'; paths: number }
  /** Chain reached ≥ 2 in this clear (×2 "Güzel!" … ×5 "Maşallah!"). */
  | { type: 'chainWord'; chain: number }
  /** Grains of a grain-goal colour are about to fly into the order bag (sampled cells, ≤ 24). */
  | { type: 'grainsToGoal'; goal: number; color: number; total: number; cells: number[] }
  /** Joker grains were part of the cleared paths. */
  | { type: 'joker'; grains: number }
  /** A bomb went off: `grains` removed by blasts; x/y = first bomb grain. */
  | { type: 'bomb'; grains: number; x: number; y: number }
  /** A sack took damage but is still standing. Rect in grains. */
  | { type: 'sackHit'; index: number; hp: number; maxHp: number; x: number; y: number; w: number; h: number }
  /** A sack was torn open (counts for clear_obstacles). */
  | { type: 'sackBreak'; index: number; x: number; y: number; w: number; h: number; points: number }
  | { type: 'goalComplete'; index: number }
  /** Danger zone entered/left (settled sand within DANGER_ROWS of the top). `first` = first time this attempt. */
  | { type: 'danger'; on: boolean; first: boolean }
  | { type: 'settled' }
  /** External tools (scoop / booster) removed grains. */
  | { type: 'toolCleared'; grains: number; points: number }
  /** Extra pieces granted (continue / booster). */
  | { type: 'piecesAdded'; n: number }
  /** Tray pieces were replaced (shuffle booster). */
  | { type: 'trayRerolled' }
  /**
   * A lost attempt was resumed ("Devam et +5", economy). `pieces` extra pieces were granted
   * (a `piecesAdded` follows); `rows` top grain rows were emptied (lost with no space).
   */
  | { type: 'revived'; pieces: number; rows: number; grains: number }
  | { type: 'won'; score: number; stars: number; bonus: number }
  | { type: 'lost'; reason: LoseReason; score: number };

export type SessionEventType = SessionEvent['type'];
