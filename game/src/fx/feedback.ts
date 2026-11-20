// Maps gameplay events to sounds and haptics in one place (GDD §14.3 / §14.4).
//
// Adding a sound for a new event: add a `case` below (unknown event types are handled
// through the string switch, so names like 'bomb', 'danger', 'sneeze', 'sackHit',
// 'sackBreak', 'joker', 'coin', 'booster' already work once session.ts emits them).
// New sound? Add it to SoundName/SOUND_NAMES (audio/audio.ts) + a recipe (audio/sounds.ts).
import type { AudioService } from '../audio/audio';
import type { SessionEvent } from '../game/session';
import type { HapticsService } from './haptics';

/** Pepper (pul biber) colour id — Zerde sneezes on pepper chains ×3+ (GDD §3.3). */
export const PEPPER_COLOR = 1;
export const SNEEZE_MIN_CHAIN = 3;
/** Chain level from which clears get the heavy haptic (GDD §14.3). */
export const HEAVY_CHAIN = 3;
/** Delay before win stars ring (after the win jingle) and between stars (GDD: 0.35 s). */
export const STAR_START_DELAY = 1.0;
export const STAR_STEP_DELAY = 0.35;
/** "First entry into the danger zone" warning haptic: at most once in this window. */
export const DANGER_HAPTIC_WINDOW_MS = 20000;

/** Optional fields gameplay may add to events later (read defensively). */
interface LooseEvent {
  type: string;
  chain?: number;
  paths?: number;
  /** Bomb grains/explosions in this clear. */
  bombs?: number;
  bomb?: boolean;
  /** Colour ids of the cleared paths. */
  colors?: readonly number[];
  /** Danger zone on/off. */
  on?: boolean;
  index?: number;
  stars?: number;
}

let lastDangerHaptic = -Infinity;
const clock = () => (globalThis.performance ? performance.now() : Date.now());

export function feedbackFor(e: SessionEvent, audio: AudioService, haptics: HapticsService): void {
  const ev = e as unknown as LooseEvent;
  switch (ev.type) {
    case 'placed':
      audio.play('drop');
      audio.setFlow(1); // grains start pouring; faded on settle / clearStart
      haptics.haptic('light');
      break;
    case 'blocked':
      audio.play('blocked');
      haptics.haptic('warning');
      break;
    case 'rotated':
      audio.play('rotate');
      break;
    case 'pick':
    case 'picked':
      audio.play('pick');
      haptics.haptic('selection');
      break;
    case 'clearStart':
    case 'settled':
      audio.setFlow(0);
      break;
    case 'cleared': {
      const chain = Math.max(1, ev.chain ?? 1);
      const paths = ev.paths ?? 1;
      const bomb = !!ev.bomb || (ev.bombs ?? 0) > 0;
      if (paths >= 2) audio.play('double', { chain });
      else if (paths >= 1) audio.play('clear', { chain });
      if (chain >= 2) audio.play('chainWord', { chain, delay: 0.14 });
      if (bomb) audio.play('bomb');
      if (chain >= SNEEZE_MIN_CHAIN && ev.colors?.includes(PEPPER_COLOR)) audio.play('sneeze', { delay: 0.3 });
      audio.setFlow(0.6); // grains above the hole fall
      haptics.haptic(chain >= HEAVY_CHAIN || bomb ? 'heavy' : 'medium');
      break;
    }
    case 'goalComplete':
      audio.play('goal', { delay: 0.2 });
      break;
    case 'won': {
      audio.stopLoops();
      audio.play('win');
      const stars = Math.max(0, Math.min(3, ev.stars ?? 0));
      for (let i = 0; i < stars; i++) audio.play('star', { index: i, delay: STAR_START_DELAY + i * STAR_STEP_DELAY });
      haptics.haptic('success');
      break;
    }
    case 'lost':
      // GDD §14.1: losing is soft — no harsh effect, no haptic.
      audio.stopLoops();
      audio.play('lose');
      break;

    // --- events gameplay may add later (names are the contract) ---
    case 'bomb':
      audio.play('bomb');
      haptics.haptic('heavy');
      break;
    case 'sneeze':
      audio.play('sneeze');
      break;
    case 'danger': {
      const on = ev.on !== false;
      audio.setDanger(on);
      const now = clock();
      if (on && now - lastDangerHaptic > DANGER_HAPTIC_WINDOW_MS) {
        lastDangerHaptic = now;
        haptics.haptic('warning');
      }
      break;
    }
    case 'joker':
      audio.play('joker');
      break;
    case 'sackHit':
      audio.play('sackHit');
      haptics.haptic('light');
      break;
    case 'sackBreak':
      audio.play('sackBreak');
      haptics.haptic('medium');
      break;
    case 'coin':
      audio.play('coin');
      break;
    case 'booster':
      audio.play('booster');
      haptics.haptic('medium');
      break;
    case 'star':
      audio.play('star', { index: ev.index ?? 0 });
      break;
    default:
      break;
  }
}

/** Test helper: forget the danger-haptic window. */
export function resetFeedbackState(): void {
  lastDangerHaptic = -Infinity;
}
