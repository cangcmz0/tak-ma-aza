// Haptics service: native / vibrate / none backends, settings, per-type cooldown.
import { describe, expect, it, vi } from 'vitest';
import { DeviceHaptics, HAPTIC_COOLDOWN_MS, NoopHaptics, VIBRATE_PATTERNS, type NativeHaptics } from '../src/fx/haptics';

describe('DeviceHaptics', () => {
  it('is a safe no-op in Node (no Capacitor native, no navigator.vibrate)', () => {
    const h = new DeviceHaptics({ vibrate: null });
    expect(h.backend).toBe('none');
    expect(() => {
      h.haptic('heavy');
      h.setEnabled(false);
      h.haptic('success');
    }).not.toThrow();
    expect(h.sent).toBe(0);
    expect(() => new DeviceHaptics().haptic('light')).not.toThrow();
    expect(() => new NoopHaptics().haptic('error')).not.toThrow();
  });

  it('uses navigator.vibrate patterns on the web', () => {
    const vib = vi.fn(() => true);
    let t = 0;
    const h = new DeviceHaptics({ native: false, vibrate: vib, now: () => t });
    expect(h.backend).toBe('vibrate');
    h.haptic('medium');
    t += 1000;
    h.haptic('success');
    expect(vib).toHaveBeenNthCalledWith(1, VIBRATE_PATTERNS.medium);
    expect(vib).toHaveBeenNthCalledWith(2, VIBRATE_PATTERNS.success);
  });

  it('does nothing when disabled in settings', () => {
    const vib = vi.fn(() => true);
    let t = 0;
    const h = new DeviceHaptics({ native: false, vibrate: vib, now: () => t });
    h.setEnabled(false);
    vib.mockClear();
    h.haptic('heavy');
    t += 1000;
    h.haptic('warning');
    expect(vib).not.toHaveBeenCalled();
    h.setEnabled(true);
    h.haptic('heavy');
    expect(vib).toHaveBeenCalledTimes(1);
  });

  it('rate-limits the same type, not different types', () => {
    const vib = vi.fn(() => true);
    let t = 0;
    const h = new DeviceHaptics({ native: false, vibrate: vib, now: () => t });
    h.haptic('light');
    t += HAPTIC_COOLDOWN_MS.light - 1;
    h.haptic('light');
    h.haptic('medium');
    expect(vib).toHaveBeenCalledTimes(2);
    t += 2;
    h.haptic('light');
    expect(vib).toHaveBeenCalledTimes(3);
  });

  it('maps types to Capacitor Haptics on native', async () => {
    const calls: string[] = [];
    const nat: NativeHaptics = {
      impact: async (o) => void calls.push(`impact:${o.style}`),
      notification: async (o) => void calls.push(`notification:${o.type}`),
      selectionStart: async () => void calls.push('selStart'),
      selectionChanged: async () => void calls.push('selChanged'),
      selectionEnd: async () => void calls.push('selEnd'),
    };
    let t = 0;
    const h = new DeviceHaptics({ native: true, loadNative: async () => nat, vibrate: null, now: () => t });
    expect(h.backend).toBe('native');
    for (const type of ['light', 'medium', 'heavy', 'success', 'warning', 'error', 'selection'] as const) {
      h.haptic(type);
      t += 1000;
    }
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([
      'impact:LIGHT',
      'impact:MEDIUM',
      'impact:HEAVY',
      'notification:SUCCESS',
      'notification:WARNING',
      'notification:ERROR',
      'selStart',
      'selChanged',
      'selEnd',
    ]);
  });

  it('survives a failing native plugin', async () => {
    const h = new DeviceHaptics({ native: true, loadNative: () => Promise.reject(new Error('missing')), vibrate: null });
    expect(() => h.haptic('heavy')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
