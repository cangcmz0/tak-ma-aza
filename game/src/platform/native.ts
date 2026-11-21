// Native shell glue (Capacitor). Everything is a no-op on the web.
// - Android hardware back → app.scenes.back(); when the top scene has no back action
//   (main menu) the app exits.
// - App goes to background → pause the game and flush the save.
import { Capacitor } from '@capacitor/core';
import type { App } from '../ui/app';

export async function bindNativeShell(app: App): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
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
