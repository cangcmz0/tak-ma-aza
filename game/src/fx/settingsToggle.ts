// Sound / haptics on-off toggle buttons (used by the pause overlay; same look as the menu).
import { strings } from '../i18n';
import type { App } from '../ui/app';
import { h } from '../ui/dom';

export function feedbackToggle(app: App, key: 'sound' | 'haptics'): HTMLButtonElement {
  const s = strings().menu;
  const label = key === 'sound' ? s.sound : s.haptics;
  const btn = h('button', { class: 'btn btn-ghost', type: 'button', 'data-testid': `toggle-${key}` });
  const paint = () => {
    const on = app.save.settings[key];
    btn.textContent = `${label}: ${on ? s.on : s.off}`;
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('click', () => {
    const v = !app.save.settings[key];
    app.save.setSetting(key, v);
    if (key === 'sound') app.audio.setEnabled(v);
    else {
      app.haptics.setEnabled(v);
      if (v) app.haptics.haptic('selection');
    }
    app.audio.play('ui_tap');
    paint();
  });
  paint();
  return btn;
}

/** Two-column row with both toggles. */
export function feedbackToggles(app: App): HTMLElement {
  return h('div', { class: 'menu-toggles' }, feedbackToggle(app, 'sound'), feedbackToggle(app, 'haptics'));
}
