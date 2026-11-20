// Haptics interface. No-op for now; later backed by @capacitor/haptics.

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface HapticsService {
  haptic(type: HapticType): void;
  setEnabled(on: boolean): void;
}

export class NoopHaptics implements HapticsService {
  haptic(_type: HapticType): void {}
  setEnabled(_on: boolean): void {}
}
