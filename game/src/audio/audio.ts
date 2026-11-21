// Audio service interface. The real implementation is WebAudioService (./webAudio.ts):
// every effect is synthesised with WebAudio, no sound files. Recipes: ./sounds.ts.
// NoopAudio is used in tests / when WebAudio is missing.

/** One-shot sound effects (GDD §14.4). Keep in sync with SOUND_NAMES and sounds.ts. */
export type SoundName =
  | 'ui_tap' // GDD `tap`
  | 'pick' // lifting a pouch from the tray
  | 'rotate'
  | 'drop' // "puf"
  | 'blocked' // GDD `invalid`
  | 'clear' // "tıng" arpeggio, pitch rises with the chain
  | 'chain' // alias of clear (kept for older callers)
  | 'chainWord' // sparkle under the "Güzel! / Harika!" text
  | 'double' // two paths in one check ("Çifte!")
  | 'goal' // GDD `goalTick`
  | 'star'
  | 'win'
  | 'lose'
  | 'bomb' // acı biber
  | 'danger' // one pair of low thumps (the loop is setDanger)
  | 'sneeze' // Zerde "Hapşu!"
  | 'joker'
  | 'sackHit'
  | 'sackBreak'
  | 'coin'
  | 'booster';

export const SOUND_NAMES: readonly SoundName[] = [
  'ui_tap',
  'pick',
  'rotate',
  'drop',
  'blocked',
  'clear',
  'chain',
  'chainWord',
  'double',
  'goal',
  'star',
  'win',
  'lose',
  'bomb',
  'danger',
  'sneeze',
  'joker',
  'sackHit',
  'sackBreak',
  'coin',
  'booster',
];

export interface PlayOptions {
  /** Chain step (1 = first clear). Raises the pitch of clear/chain/double/chainWord. */
  chain?: number;
  /** Index for sequenced sounds (star 0..2 → E5, G5, C6). */
  index?: number;
  /** Start this many seconds from now (scheduled on the audio clock). */
  delay?: number;
}

export interface AudioService {
  play(name: SoundName, opts?: PlayOptions): void;
  setEnabled(on: boolean): void;
  /** Master volume 0..1. */
  setVolume(v: number): void;
  /** Continuous sand "hiss" while grains move: 0 = silent, 1 = full. Auto-fades if not refreshed. */
  setFlow(level: number): void;
  /** Danger loop (two low thumps every 1.2 s) on/off. */
  setDanger(on: boolean): void;
  /** Stop all loops (flow, danger), e.g. when pausing or leaving a level. */
  stopLoops(): void;
  /** Called on the first user gesture (needed to unlock WebAudio on mobile). Safe to call often. */
  unlock(): void;
}

export class NoopAudio implements AudioService {
  play(_name: SoundName, _opts?: PlayOptions): void {}
  setEnabled(_on: boolean): void {}
  setVolume(_v: number): void {}
  setFlow(_level: number): void {}
  setDanger(_on: boolean): void {}
  stopLoops(): void {}
  unlock(): void {}
}
