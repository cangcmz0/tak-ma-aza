// Booster bar under the tray (GDD §10.1 / §15): Yenile / Kepçe / Elek with a count badge
// (or the gold price when none is left) + the gold balance. Kepçe: tap a column → confirm.
// Elek: tap a grain. Both can be cancelled (button or back key). Max 3 uses each per level.
import { grainLen } from '../config';
import { FLAG_STATIC, JOKER } from '../engine/grid';
import { BOOSTER_IDS, BOOSTERS, boosterUnlocked, MAX_BOOSTER_USES_PER_LEVEL, SCOOP_WIDTH, type BoosterId } from '../game/economy';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import type { App } from './app';
import { h } from './dom';
import { boosterIcon, coinIcon, goldBadge, openGoldInfo } from './econWidgets';
import { BoosterOfferScene } from './boosterOffer';

/** What the bar needs from the play scene. */
export interface BoosterHost {
  readonly session: Session;
  /** Level id, or progress level in endless (booster unlocks). */
  readonly unlockLevel: number;
  /** Targeting layer goes here (positioned container over the board). */
  readonly boardArea: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** The play scene is on top and the attempt is running. */
  isActive(): boolean;
  toast(text: string, ms: number): void;
  /** Tray changed (shuffle): redraw it. */
  trayChanged(): void;
}

/** Elek picks the nearest grain within this many grains of the tap. */
const SIEVE_REACH = grainLen(3); // cells (3 design grains)

type Targeting = { id: 'scoop'; x0: number | null } | { id: 'sieve' };

export class BoosterBar {
  readonly el: HTMLElement;
  private readonly buttons = new Map<BoosterId, { btn: HTMLButtonElement; badge: HTMLElement }>();
  private readonly uses: Record<BoosterId, number> = { shuffle: 0, scoop: 0, sieve: 0 };
  private targeting: Targeting | null = null;
  private layer: HTMLElement | null = null;
  private strip: HTMLElement | null = null;
  private confirmBtn: HTMLButtonElement | null = null;
  private readonly offEconomy: () => void;

  constructor(
    private readonly app: App,
    private readonly host: BoosterHost,
  ) {
    const s = strings().boosters;
    const row = h('div', { class: 'booster-row' });
    for (const id of BOOSTER_IDS) {
      if (!boosterUnlocked(id, host.unlockLevel)) continue; // locked boosters are hidden (GDD §15)
      const badge = h('span', { class: 'booster-badge' });
      const btn = h(
        'button',
        { class: 'booster-btn', type: 'button', 'data-testid': `booster-${id}`, onclick: () => this.tap(id) },
        boosterIcon(id),
        h('span', { class: 'booster-name', text: s.short[id] }),
        badge,
      );
      this.buttons.set(id, { btn, badge });
      row.append(btn);
    }
    this.el = h(
      'div',
      { class: 'booster-bar', role: 'toolbar', 'aria-label': s.barAria, 'data-testid': 'booster-bar' },
      row,
      goldBadge(app, () => {
        if (!this.host.isActive()) return;
        this.cancel();
        openGoldInfo(app);
      }),
    );
    this.offEconomy = app.meta.economy.events.on(() => this.paint());
    this.paint();
    this.explainNew();
  }

  /**
   * One-time bubble over a booster the player sees for the first time (level 4 / 7 / 12):
   * its name and what it does. Goes away when tapped, when the booster is used or after
   * two drops.
   */
  private explainNew(): void {
    const id = [...this.buttons.keys()].find((b) => !this.app.save.hasSeenIntro(`booster:${b}`));
    if (!id) return;
    this.app.save.markIntroSeen(`booster:${id}`);
    const s = strings();
    const btn = this.buttons.get(id)?.btn;
    if (!btn) return;
    const tip = h(
      'button',
      { class: 'booster-tip', type: 'button', 'data-testid': 'booster-tip' },
      h('b', { text: fmt(s.goldInfo.boosterNew, { name: s.boosters.names[id] }) }),
      h('span', { text: s.boosters.desc[id] }),
      h('small', { text: s.goldInfo.gotIt }),
    );
    let drops = 0;
    const close = () => {
      tip.remove();
      this.el.classList.remove('explaining');
      off();
      btn.removeEventListener('click', close);
    };
    const off = this.host.session.events.on((e) => {
      if (e.type === 'placed' && ++drops >= 2) close();
    });
    tip.addEventListener('click', close);
    btn.addEventListener('click', close);
    btn.classList.add('is-new');
    this.el.classList.add('explaining'); // hide what the tip would cover (QA-021)
    this.el.append(tip);
    // Sit beside the button inside the bar (never over the tray above it).
    const place = () => {
      if (!tip.isConnected) return;
      if (!btn.offsetWidth) return void requestAnimationFrame(place);
      tip.style.left = `${btn.offsetLeft + btn.offsetWidth + 12}px`;
    };
    requestAnimationFrame(place);
  }

  /** Targeting mode active (pointer input on the board is off). */
  get busy(): boolean {
    return this.targeting !== null;
  }

  destroy(): void {
    this.offEconomy();
    this.closeLayer();
  }

  /** Cancel targeting. @returns true if something was cancelled (back key). */
  cancel(): boolean {
    if (!this.targeting) return false;
    this.closeLayer();
    this.paint();
    return true;
  }

  /** Re-read counts / limits (also after the session state changed). */
  paint(): void {
    const s = strings().boosters;
    const eco = this.app.meta.economy;
    for (const [id, { btn, badge }] of this.buttons) {
      const n = eco.count(id);
      const capped = this.uses[id] >= MAX_BOOSTER_USES_PER_LEVEL;
      const name = s.names[id];
      badge.replaceChildren();
      badge.className = 'booster-badge';
      if (n > 0) {
        badge.textContent = String(n);
        btn.setAttribute('aria-label', fmt(s.countAria, { name, n }));
      } else {
        const price = BOOSTERS[id].price;
        badge.classList.add('price');
        if (!eco.canAfford(price) && this.app.meta.ads.canShowRewarded('booster')) {
          badge.classList.add('ad');
          badge.textContent = '▶';
        } else badge.append(coinIcon(), h('span', { text: String(price) }));
        btn.setAttribute('aria-label', fmt(s.priceAria, { name, n: price }));
      }
      btn.classList.toggle('capped', capped);
      btn.classList.toggle('active', this.targeting?.id === id);
    }
  }

  private tap(id: BoosterId): void {
    if (!this.host.isActive()) return;
    const s = strings().boosters;
    if (this.targeting) {
      const same = this.targeting.id === id;
      this.cancel();
      if (same) return;
    }
    if (this.uses[id] >= MAX_BOOSTER_USES_PER_LEVEL) {
      this.host.toast(fmt(s.limit, { n: MAX_BOOSTER_USES_PER_LEVEL }), 1200);
      return;
    }
    this.app.audio.play('ui_tap');
    if (this.app.meta.economy.count(id) <= 0) {
      this.app.scenes.push(new BoosterOfferScene(this.app, id, () => this.activate(id)));
      return;
    }
    this.activate(id);
  }

  private activate(id: BoosterId): void {
    if (!this.host.isActive() || this.app.meta.economy.count(id) <= 0) return;
    const s = strings().boosters;
    if (id === 'shuffle') {
      if (this.host.session.rerollTray()) {
        this.spent(id);
        this.host.trayChanged();
      } else this.host.toast(s.noTray, 900);
      return;
    }
    this.openLayer(id === 'scoop' ? { id: 'scoop', x0: null } : { id: 'sieve' });
  }

  private spent(id: BoosterId): void {
    this.app.meta.economy.consumeBooster(id, `use_${id}`);
    this.uses[id]++;
    this.paint();
  }

  // --- targeting -------------------------------------------------------------

  private openLayer(t: Targeting): void {
    const s = strings().boosters;
    this.closeLayer();
    this.targeting = t;
    this.strip = t.id === 'scoop' ? h('div', { class: 'scoop-strip', 'data-testid': 'scoop-strip' }) : null;
    this.confirmBtn =
      t.id === 'scoop'
        ? h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'booster-confirm', disabled: true, text: s.confirm, onclick: () => this.confirmScoop() })
        : null;
    const surface = h('div', { class: 'target-surface', 'data-testid': 'booster-target' });
    surface.addEventListener('pointerdown', (e) => this.onPoint(e, true));
    surface.addEventListener('pointermove', (e) => {
      if (e.buttons || e.pointerType === 'touch') this.onPoint(e, false);
    });
    this.layer = h(
      'div',
      { class: `booster-target target-${t.id}` },
      surface,
      this.strip,
      h('div', { class: 'target-hint', text: t.id === 'scoop' ? s.pickColumn : s.pickGrain }),
      h(
        'div',
        { class: 'target-actions' },
        h('button', { class: 'btn', type: 'button', 'data-testid': 'booster-cancel', text: s.cancel, onclick: () => this.cancel() }),
        this.confirmBtn,
      ),
    );
    this.host.boardArea.append(this.layer);
    this.paint();
  }

  private closeLayer(): void {
    this.layer?.remove();
    this.layer = null;
    this.strip = null;
    this.confirmBtn = null;
    this.targeting = null;
  }

  /** Client point → grain coordinates (null outside the board). */
  private toGrain(e: PointerEvent): { x: number; y: number } | null {
    const r = this.host.canvas.getBoundingClientRect();
    const g = this.host.session.grid;
    const x = ((e.clientX - r.left) / r.width) * g.w;
    const y = ((e.clientY - r.top) / r.height) * g.h;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
    return { x, y };
  }

  private onPoint(e: PointerEvent, down: boolean): void {
    const t = this.targeting;
    if (!t || !this.host.isActive()) return;
    e.preventDefault();
    const p = this.toGrain(e);
    if (!p) return;
    if (t.id === 'scoop') {
      const w = this.host.session.grid.w;
      t.x0 = Math.max(0, Math.min(w - SCOOP_WIDTH, Math.round(p.x - SCOOP_WIDTH / 2)));
      this.placeStrip(t.x0);
      if (this.confirmBtn) this.confirmBtn.disabled = false;
    } else if (down) this.sieveAt(Math.floor(p.x), Math.floor(p.y));
  }

  private placeStrip(x0: number): void {
    if (!this.strip || !this.layer) return;
    const r = this.host.canvas.getBoundingClientRect();
    const box = this.layer.getBoundingClientRect();
    const g = this.host.session.grid;
    const k = r.width / g.w;
    Object.assign(this.strip.style, {
      left: `${r.left - box.left + x0 * k}px`,
      top: `${r.top - box.top}px`,
      width: `${SCOOP_WIDTH * k}px`,
      height: `${r.height}px`,
      display: 'block',
    });
  }

  private confirmScoop(): void {
    const t = this.targeting;
    if (!t || t.id !== 'scoop' || t.x0 === null || !this.host.isActive()) return;
    const s = strings().boosters;
    const session = this.host.session;
    if (session.clearPending) return this.host.toast(s.wait, 800);
    const n = session.scoopColumns(t.x0, SCOOP_WIDTH);
    if (n <= 0) return this.host.toast(s.emptyColumn, 900);
    this.closeLayer();
    this.spent('scoop');
  }

  private sieveAt(x: number, y: number): void {
    const s = strings().boosters;
    const session = this.host.session;
    const g = session.grid;
    // Grains are tiny on a phone: take the nearest sand grain within a few grains of the finger.
    let hit = -1;
    let joker = false;
    let best = Infinity;
    for (let dy = -SIEVE_REACH; dy <= SIEVE_REACH; dy++)
      for (let dx = -SIEVE_REACH; dx <= SIEVE_REACH; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const i = yy * g.w + xx;
        const c = g.color[i];
        if (c === 0 || g.flags[i] & FLAG_STATIC) continue;
        const d = dx * dx + dy * dy;
        if (c >= JOKER) {
          if (d === 0) joker = c === JOKER;
          continue;
        }
        if (d < best) {
          best = d;
          hit = i;
        }
      }
    if (hit < 0) return this.host.toast(joker ? s.noJoker : s.tapGrain, 900);
    if (session.clearPending) return this.host.toast(s.wait, 800);
    if (session.sieveColor(g.color[hit]) <= 0) return;
    this.closeLayer();
    this.spent('sieve');
  }
}
