// Haptics: @capacitor/haptics on native (Android/iOS), navigator.vibrate on the web
// where available, otherwise a no-op. Mapping of game moments → types: fx/feedback.ts.
import { Capacitor } from '@capacitor/core';

/** GDD §14.3 types. `selection` = picking up a pouch. */
export type HapticType = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface HapticsService {
  haptic(type: HapticType): void;
  setEnabled(on: boolean): void;
}

export class NoopHaptics implements HapticsService {
  haptic(_type: HapticType): void {}
  setEnabled(_on: boolean): void {}
}

/** Web vibration fallback patterns (ms). Android Chrome honours these; iOS Safari has no vibrate. */
export const VIBRATE_PATTERNS: Record<HapticType, number | number[]> = {
  selection: 6,
  light: 12,
  medium: 22,
  heavy: 40,
  success: [16, 60, 28],
  warning: [28, 50, 28],
  error: [45, 40, 45, 40, 45],
};

/** Minimum gap between two haptics of the same type (avoids a buzzing mess on chains). */
export const HAPTIC_COOLDOWN_MS: Record<HapticType, number> = {
  selection: 40,
  light: 50,
  medium: 70,
  heavy: 90,
  success: 400,
  warning: 250,
  error: 400,
};

/** Native bridge surface we use (subset of @capacitor/haptics HapticsPlugin). */
export interface NativeHaptics {
  impact(o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void>;
  notification(o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>;
  selectionStart(): Promise<void>;
  selectionChanged(): Promise<void>;
  selectionEnd(): Promise<void>;
}

export interface DeviceHapticsOptions {
  /** Force the native path (default Capacitor.isNativePlatform()). */
  native?: boolean;
  /** Native plugin loader (default dynamic import of @capacitor/haptics). */
  loadNative?: () => Promise<NativeHaptics>;
  /** Web vibrate function (default navigator.vibrate if present; null = none). */
  vibrate?: ((pattern: number | number[]) => boolean) | null;
  now?: () => number;
}

function defaultVibrate(): ((p: number | number[]) => boolean) | null {
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav || typeof nav.vibrate !== 'function') return null;
  return (p) => {
    try {
      return nav.vibrate(p);
    } catch {
      return false;
    }
  };
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export class DeviceHaptics implements HapticsService {
  private enabled = true;
  private hasVibrated = false;
  private readonly native: boolean;
  private nativeImpl: NativeHaptics | null = null;
  private nativeLoading: Promise<NativeHaptics | null> | null = null;
  private readonly loadNative: () => Promise<NativeHaptics>;
  private readonly vibrate: ((p: number | number[]) => boolean) | null;
  private readonly now: () => number;
  private readonly last = new Map<HapticType, number>();
  /** Haptics actually sent (for tests / debugging). */
  sent = 0;

  constructor(opts: DeviceHapticsOptions = {}) {
    this.native = opts.native ?? isNative();
    this.loadNative =
      opts.loadNative ?? (async () => (await import('@capacitor/haptics')).Haptics as unknown as NativeHaptics);
    this.vibrate = opts.vibrate !== undefined ? opts.vibrate : defaultVibrate();
    this.now = opts.now ?? (() => (globalThis.performance ? performance.now() : Date.now()));
    if (this.native) void this.getNative();
  }

  /** Which backend is used: 'native' | 'vibrate' | 'none'. */
  get backend(): 'native' | 'vibrate' | 'none' {
    return this.native ? 'native' : this.vibrate ? 'vibrate' : 'none';
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    // Only cancel when we have actually vibrated; calling vibrate() before any user
    // gesture logs a "Blocked call to navigator.vibrate" error in browsers.
    if (!on && this.hasVibrated && !this.native && this.vibrate) this.vibrate(0);
  }

  haptic(type: HapticType): void {
    if (!this.enabled) return;
    const now = this.now();
    const last = this.last.get(type);
    if (last !== undefined && now - last < (HAPTIC_COOLDOWN_MS[type] ?? 50)) return;
    this.last.set(type, now);
    if (this.native) {
      this.sent++;
      void this.fireNative(type);
    } else if (this.vibrate) {
      this.sent++;
      this.hasVibrated = true;
      this.vibrate(VIBRATE_PATTERNS[type] ?? 15);
    }
  }

  private getNative(): Promise<NativeHaptics | null> {
    if (this.nativeImpl) return Promise.resolve(this.nativeImpl);
    if (!this.nativeLoading) {
      this.nativeLoading = this.loadNative()
        .then((h) => (this.nativeImpl = h))
        .catch(() => null);
    }
    return this.nativeLoading;
  }

  private async fireNative(type: HapticType): Promise<void> {
    const h = this.nativeImpl ?? (await this.getNative());
    if (!h) return;
    try {
      switch (type) {
        case 'selection':
          await h.selectionStart();
          await h.selectionChanged();
          await h.selectionEnd();
          break;
        case 'light':
          await h.impact({ style: 'LIGHT' });
          break;
        case 'medium':
          await h.impact({ style: 'MEDIUM' });
          break;
        case 'heavy':
          await h.impact({ style: 'HEAVY' });
          break;
        case 'success':
          await h.notification({ type: 'SUCCESS' });
          break;
        case 'warning':
          await h.notification({ type: 'WARNING' });
          break;
        case 'error':
          await h.notification({ type: 'ERROR' });
          break;
      }
    } catch {
      /* plugin missing on this build: ignore */
    }
  }
}
