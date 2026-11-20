// Audio service interface. No-op for now; the Sound agent provides a real one
// (e.g. WebAudio-synthesised effects) and registers it in main.ts.

export type SoundName =
  | 'ui_tap'
  | 'pick'
  | 'rotate'
  | 'drop'
  | 'blocked'
  | 'clear'
  | 'chain'
  | 'goal'
  | 'win'
  | 'lose';

export interface AudioService {
  play(name: SoundName, opts?: { chain?: number }): void;
  setEnabled(on: boolean): void;
  /** Called on the first user gesture (needed to unlock WebAudio on mobile). */
  unlock(): void;
}

export class NoopAudio implements AudioService {
  play(_name: SoundName, _opts?: { chain?: number }): void {}
  setEnabled(_on: boolean): void {}
  unlock(): void {}
}
