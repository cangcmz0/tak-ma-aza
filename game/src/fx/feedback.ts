// Maps gameplay events to sounds and haptics in one place (GDD §14.3 / §14.4).
//
// New event in core/events.ts → add a `case` here. New sound → add its name to SoundName /
// SOUND_NAMES (audio/audio.ts) and a recipe in audio/sounds.ts; try it in sound-lab.html.
import type { AudioService } from '../audio/audio';
import type { SessionEvent } from '../core/events';
import type { HapticsService } from './haptics';

/** Pepper (pul biber) colour id — Zerde sneezes on pepper chains ×3+ (GDD §3.3). */
export const PEPPER_COLOR = 1;
export const SNEEZE_MIN_CHAIN = 3;
/** Chain level from which clears get the heavy haptic (GDD §14.3). */
export const HEAVY_CHAIN = 3;
/** Delay before win stars ring (after the win jingle) and between stars (GDD: 0.35 s). */
export const STAR_START_DELAY = 1.0;
export const STAR_STEP_DELAY = 0.35;

export function feedbackFor(e: SessionEvent, audio: AudioService, haptics: HapticsService): void {
  switch (e.type) {
    case 'placed':
      audio.play('drop');
      audio.setFlow(1); // grains start pouring; faded on clearStart / settled (or auto-timeout)
      haptics.haptic('light');
      break;
    case 'blocked':
      audio.play('blocked');
      haptics.haptic('warning');
      break;
    case 'rotated':
      audio.play('rotate');
      break;
    case 'clearStart':
    case 'settled':
      audio.setFlow(0);
      break;
    case 'cleared': {
      // The clear event carries the chain, so the pitch-dependent sounds are all played
      // here; the separate `double` / `chainWord` events (same clear) are only for visuals.
      const chain = Math.max(1, e.chain);
      if (e.paths >= 2) audio.play('double', { chain });
      else if (e.paths >= 1) audio.play('clear', { chain });
      if (chain >= 2) audio.play('chainWord', { chain, delay: 0.14 });
      if (chain >= SNEEZE_MIN_CHAIN && e.colors?.includes(PEPPER_COLOR)) audio.play('sneeze', { delay: 0.3 });
      audio.setFlow(0.6); // grains above the hole fall
      haptics.haptic(chain >= HEAVY_CHAIN ? 'heavy' : 'medium');
      break;
    }
    case 'double':
    case 'chainWord':
    case 'grainsToGoal':
    case 'trayRefill':
      break;
    case 'bomb':
      audio.play('bomb');
      haptics.haptic('heavy');
      break;
    case 'joker':
      audio.play('joker', { delay: 0.05 });
      break;
    case 'sackHit':
      audio.play('sackHit');
      haptics.haptic('light');
      break;
    case 'sackBreak':
      audio.play('sackBreak');
      haptics.haptic('medium');
      break;
    case 'goalComplete':
      audio.play('goal', { delay: 0.2 });
      break;
    case 'danger':
      audio.setDanger(e.on);
      // GDD §14.3: warning haptic only on the first entry per attempt.
      if (e.on && e.first) haptics.haptic('warning');
      break;
    case 'toolCleared':
    case 'trayRerolled':
      // Booster use: "vuuş" + impact medium (GDD §14.3/14.4).
      audio.play('booster');
      haptics.haptic('medium');
      break;
    case 'piecesAdded':
      audio.play('coin');
      break;
    case 'revived':
      // "Devam et +5" (economy): the coin comes with the following piecesAdded.
      haptics.haptic('medium');
      break;
    case 'won': {
      audio.stopLoops();
      audio.play('win');
      const stars = Math.max(0, Math.min(3, e.stars));
      for (let i = 0; i < stars; i++) audio.play('star', { index: i, delay: STAR_START_DELAY + i * STAR_STEP_DELAY });
      haptics.haptic('success');
      break;
    }
    case 'lost':
      // GDD §14.1: losing is soft — no harsh effect, no haptic.
      audio.stopLoops();
      audio.play('lose');
      break;
    default:
      break;
  }
}
