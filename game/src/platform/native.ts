// Native shell glue (Capacitor). Everything is a no-op on the web.
// - Android hardware back → app.scenes.back(). The main menu answers it with a
//   "Çıkılsın mı?" confirmation (QA-006); exitApp() closes the app only after "Çık".
//   If the top scene has no back action at all, the app exits directly.
// - App goes to background → pause the game and flush the save.
import { Capacitor } from '@capacitor/core';
import type { App } from '../ui/app';

/** True inside the Capacitor native shell (Android / iOS). */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Close the app (native only; no-op on the web). */
export async function exitApp(): Promise<void> {
  if (!isNative()) return;
  try {
    const { App: CapApp } = await import('@capacitor/app');
    await CapApp.exitApp();
  } catch {
    /* ignore */
  }
}

export async function bindNativeShell(app: App): Promise<void> {
  try {
    if (!isNative()) return;
    const { App: CapApp } = await import('@capacitor/app');
    await CapApp.addListener('backButton', () => {
      if (!app.scenes.back()) void CapApp.exitApp();
    });
    await CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) return;
      app.scenes.suspend();
      void app.save.flush();
    });
  } catch (err) {
    if (app.debug) console.info('[native] shell not bound', err);
  }
}
