// Maps gameplay events to sounds and haptics in one place (Sound agent edits this).
import type { AudioService } from '../audio/audio';
import type { SessionEvent } from '../game/session';
import type { HapticsService } from './haptics';

export function feedbackFor(e: SessionEvent, audio: AudioService, haptics: HapticsService): void {
  switch (e.type) {
    case 'placed':
      audio.play('drop');
      haptics.haptic('light');
      break;
    case 'blocked':
      audio.play('blocked');
      haptics.haptic('warning');
      break;
    case 'rotated':
      audio.play('rotate');
      break;
    case 'cleared':
      audio.play(e.chain > 1 ? 'chain' : 'clear', { chain: e.chain });
      haptics.haptic(e.chain > 1 ? 'heavy' : 'medium');
      break;
    case 'goalComplete':
      audio.play('goal');
      break;
    case 'won':
      audio.play('win');
      haptics.haptic('success');
      break;
    case 'lost':
      audio.play('lose');
      haptics.haptic('error');
      break;
    default:
      break;
  }
}
