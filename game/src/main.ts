// Boot: theme, save data, services, scene stack, main loop.
import './styles/main.css';
import { createAudio } from './audio/webAudio';
import { DeviceHaptics } from './fx/haptics';
import { LEVEL_ERRORS } from './levels/levels';
import { bindNativeShell } from './platform/native';
import { createStorageBackend } from './platform/preferencesBackend';
import { SaveStore } from './platform/storage';
import { applyCssVars } from './render/theme';
import { SceneManager, type App } from './ui/app';
import { MenuScene } from './ui/menu';

declare const __APP_VERSION__: string;

async function boot(): Promise<void> {
  applyCssVars();
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');

  const params = new URLSearchParams(location.search);
  const save = await SaveStore.load(await createStorageBackend()); // Preferences on native, localStorage on web
  const audio = createAudio(); // WebAudio synth; unlocks itself on the first tap
  const haptics = new DeviceHaptics(); // Capacitor Haptics on native, navigator.vibrate on web
  audio.setEnabled(save.settings.sound);
  audio.setVolume(save.settings.volume);
  haptics.setEnabled(save.settings.haptics);

  const app: App = {
    root,
    save,
    audio,
    haptics,
    scenes: new SceneManager(root),
    debug: import.meta.env.DEV || params.has('debug'),
    version: __APP_VERSION__,
  };
  if (LEVEL_ERRORS.length && app.debug) console.warn('Level validation errors', LEVEL_ERRORS);

  app.scenes.replace(new MenuScene(app));
  void bindNativeShell(app); // Android back button + background save (no-op on web)

  // Resize / orientation.
  let resizeQueued = false;
  const onResize = () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      app.scenes.resize();
    });
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  // Pause when the app goes to background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      app.scenes.suspend();
      void app.save.flush();
    }
  });

  // Block pinch / double-tap zoom and long-press menus inside the game.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // Main loop: dt is clamped so a long stall does not fast-forward the sim.
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(100, now - last);
    last = now;
    app.scenes.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  if (app.debug) (window as unknown as { __app: App }).__app = app;
}

void boot();
