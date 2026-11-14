// Oyun ekranı: simülasyonu her karede ilerletir, DOM'u günceller, dokunuşları işler.
import type { Sfx } from './audio';
import { runCpr } from './cpr';
import { COMPLAINT_BY_ID, TOOLS, ToolId, Zone, ZONE_INFO, ZONES, toolsFor } from './data';
import { Ecg } from './ecg';
import { BAL, Game, GameEvent, Patient, clockText } from './game';
import { VITAL_KEYS, VITAL_LABEL, fmtVital, levels, triageOf } from './triage';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
export const BED_PREFIX: Record<Zone, string> = { red: 'K', yellow: 'S', green: 'Y' };
const MAX_SLOTS = 3;

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export interface PlayHooks {
  onEnd(game: Game): void;
  onPauseRequest(): void;
}

interface TokenRefs {
  bar: HTMLElement;
  st: HTMLElement;
}

export class Play {
  game: Game | null = null;
  paused = false;
  private tokens = new Map<number, HTMLElement>();
  private refs = new WeakMap<HTMLElement, TokenRefs>();
  private slots: Record<Zone | 'wait', HTMLElement[]> = { red: [], yellow: [], green: [], wait: [] };
  private selected: number | null = null;
  private sheetKey = '';
  private raf = 0;
  private last = 0;
  private ecg: Ecg;
  private bannerUntil = 0;
  private tutorialOn = false;
  private alarmAt = 0;
  private inCode = false;
  private ending = false;

  constructor(private sfx: Sfx, private hooks: PlayHooks) {
    this.ecg = new Ecg($('ecg') as HTMLCanvasElement, '#57ff98', 70);
    $('board').addEventListener('click', (e) => this.onBoardClick(e));
    $('sh-close').addEventListener('click', () => this.closeSheet());
    $('sh-actions').addEventListener('click', (e) => this.onAction(e));
    $('btn-pause').addEventListener('click', () => this.hooks.onPauseRequest());
    window.addEventListener('resize', () => this.ecg.resize());
  }

  start(game: Game) {
    this.stop();
    this.game = game;
    this.paused = false;
    this.inCode = false;
    this.ending = false;
    this.tutorialOn = game.cfg.tutorial && game.s.stats.discharged < 3;
    this.bannerUntil = 0;
    this.closeSheet();
    this.tokens.forEach((el) => el.remove());
    this.tokens.clear();
    $('floats').innerHTML = '';
    this.buildSlots();
    $('hud-night').textContent = `Gece ${game.s.night}`;
    $('banner').hidden = true;
    this.ecg.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (game.s.activeCode !== null) this.startCode(game.s.activeCode);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
  }

  private frame = (now: number) => {
    const g = this.game;
    if (!g) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused && !this.inCode) g.tick(dt);
    for (const e of g.events.splice(0)) this.onEvent(e);
    this.render(now);
    const crit = g.s.patients.filter((p) => p.critical && p.severity !== 'green').length;
    this.ecg.flat = g.s.activeCode !== null;
    this.ecg.bpm = Math.min(150, 70 + 22 * crit);
    if (!this.paused) this.ecg.step(dt);
    if (this.ending) {
      this.ending = false;
      this.stop();
      this.closeSheet();
      this.hooks.onEnd(g);
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  // ---------- Olaylar ----------

  private onEvent(e: GameEvent) {
    const g = this.game!;
    switch (e.type) {
      case 'arrive':
        if (e.amb) this.flashBanner('🚑 112 hastası salonda!', 'alert', 2600);
        else this.sfx.arrive();
        break;
      case 'ambWarn':
        this.flashBanner(`🚑 Ambulans geliyor · ${e.inSec} sn`, 'alert', e.inSec * 1000);
        this.sfx.siren();
        break;
      case 'overflow':
        this.floatAt($('wait-count'), 'Salon dolu, hasta başka hastaneye gitti', 'bad');
        this.sfx.wrong();
        break;
      case 'assign': {
        const p = g.get(e.pid);
        const slot = p ? this.slotFor(p) : null;
        if (!slot) break;
        if (e.result === 'correct') {
          this.floatAt(slot, 'Doğru triaj +5', 'good');
          this.sfx.good();
        } else if (e.result === 'over') {
          this.floatAt(slot, `Gereksiz ${ZONE_INFO[e.zone].name.toLocaleLowerCase('tr')} yatak`, 'warn');
          this.sfx.tap();
        } else if (e.result === 'under') {
          this.floatAt(slot, 'Hafife aldın, durumu ağır!', 'bad');
          this.sfx.wrong();
          this.sfx.vibrate(80);
        } else this.sfx.tap();
        break;
      }
      case 'treat':
        if (e.ok) {
          this.sfx.tap();
          if (this.selected === e.pid) this.closeSheet();
        } else {
          this.floatAtPid(e.pid, 'Yanlış tedavi!', 'bad');
          this.shake(e.pid);
          this.sfx.wrong();
          this.sfx.vibrate(120);
        }
        break;
      case 'ready':
        this.sfx.ready();
        break;
      case 'discharge':
        this.floatAtPid(e.pid, `${e.zone === 'red' ? 'Servise yatırıldı' : 'Taburcu'} +${e.points}`, 'good');
        this.sfx.discharge();
        if (this.selected === e.pid) this.closeSheet();
        break;
      case 'left':
        this.floatAtPid(e.pid, 'CİMER’e yazacağım! 😤', 'bad');
        this.sfx.complaint();
        if (this.selected === e.pid) this.closeSheet();
        break;
      case 'critical':
        this.sfx.alarm();
        this.sfx.vibrate(60);
        break;
      case 'code':
        this.startCode(e.pid);
        break;
      case 'codeEnd':
        if (e.saved) this.floatAtPid(e.pid, 'Nabız geldi ❤️ +20', 'good');
        else {
          this.floatAtPid(e.pid, 'Yoğun bakıma sevk edildi', 'bad');
          if (this.selected === e.pid) this.closeSheet();
        }
        break;
      case 'end':
        this.ending = true;
        break;
    }
  }

  private startCode(pid: number) {
    const g = this.game!;
    const p = g.get(pid);
    if (!p) {
      g.resolveCode(false);
      return;
    }
    this.inCode = true;
    this.closeSheet();
    const c = COMPLAINT_BY_ID[p.complaintId];
    const where = p.zone ? `${BED_PREFIX[p.zone]}${p.bed + 1} yatak` : 'bekleme salonu';
    runCpr(this.sfx, `${p.name} · ${c.title} · ${where}`).then((saved) => {
      if (this.game !== g) return;
      this.inCode = false;
      g.resolveCode(saved);
      this.last = performance.now();
    });
  }

  // ---------- Çizim ----------

  private buildSlots() {
    const cfg = this.game!.cfg;
    for (const z of ZONES) {
      const box = $(`slots-${z}`);
      box.innerHTML = '';
      this.slots[z] = [];
      for (let i = 0; i < MAX_SLOTS; i++) {
        const slot = document.createElement('div');
        const label = `${BED_PREFIX[z]}${i + 1}`;
        if (i < cfg.beds[z]) {
          slot.className = 'slot bed';
          slot.dataset.zone = z;
          slot.dataset.bed = String(i);
          slot.innerHTML = `<span class="slot-label">${label}</span>`;
          this.slots[z].push(slot);
        } else {
          slot.className = 'slot locked';
          slot.innerHTML = `<span class="slot-label">${label}</span><span class="slot-lock">4. gecede açılır</span>`;
        }
        box.appendChild(slot);
      }
    }
    const wait = $('slots-wait');
    wait.innerHTML = '';
    this.slots.wait = [];
    for (let i = 0; i < BAL.waitSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot chair';
      wait.appendChild(slot);
      this.slots.wait.push(slot);
    }
  }

  private slotFor(p: Patient): HTMLElement | null {
    if (p.status === 'waiting') return this.slots.wait[this.game!.s.waiting.indexOf(p.id)] ?? null;
    if (!p.zone) return null;
    return this.slots[p.zone][p.bed] ?? null;
  }

  private render(now: number) {
    const g = this.game!;
    const s = g.s;
    $('hud-clock').textContent = clockText(s.t, s.duration);
    $('hud-score').textContent = String(s.score);
    const rep = $('hud-rep');
    rep.style.width = `${s.rep}%`;
    rep.dataset.l = s.rep >= 60 ? 'ok' : s.rep >= 30 ? 'warn' : 'crit';
    $('hud-face').textContent = s.rep >= 85 ? '😄' : s.rep >= 65 ? '🙂' : s.rep >= 45 ? '😐' : s.rep >= 25 ? '😟' : '😡';
    $('wait-count').textContent = `${s.waiting.length}/${BAL.waitSlots}`;

    const alive = new Set<number>();
    for (const p of s.patients) {
      alive.add(p.id);
      let el = this.tokens.get(p.id);
      if (!el) {
        el = this.makeToken(p);
        this.tokens.set(p.id, el);
      }
      const slot = this.slotFor(p);
      if (slot && el.parentElement !== slot) {
        const loc = p.status === 'waiting' ? 'wait' : p.zone!;
        slot.appendChild(el);
        if (el.dataset.loc !== loc) {
          el.dataset.loc = loc;
          el.classList.remove('enter');
          void el.offsetWidth;
          el.classList.add('enter');
        }
      }
      this.updateToken(el, p);
    }
    for (const [id, el] of this.tokens) {
      if (alive.has(id)) continue;
      this.tokens.delete(id);
      el.classList.add('leave');
      window.setTimeout(() => el.remove(), 420);
    }

    const crit = s.patients.some((p) => p.critical && p.severity !== 'green');
    if (crit && !this.paused && !this.inCode && now > this.alarmAt) {
      this.sfx.alarm();
      this.alarmAt = now + 2600;
    }

    if (this.selected !== null) this.renderSheet();
    if (now >= this.bannerUntil) {
      if (this.tutorialOn) this.renderTutorial();
      else $('banner').hidden = true;
    }
  }

  private makeToken(p: Patient): HTMLElement {
    const c = COMPLAINT_BY_ID[p.complaintId];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pt';
    el.dataset.id = String(p.id);
    el.setAttribute('aria-label', `${p.name}, ${c.title}`);
    el.innerHTML =
      `<span class="pt-av">${p.avatar}</span>` +
      `<span class="pt-cx">${c.emoji}</span>` +
      (p.amb ? '<span class="pt-amb">112</span>' : '') +
      `<span class="pt-name">${esc(p.name)}</span>` +
      `<span class="pt-bar"><i></i></span>` +
      `<span class="pt-st"></span>`;
    this.refs.set(el, { bar: el.querySelector('.pt-bar i') as HTMLElement, st: el.querySelector('.pt-st') as HTMLElement });
    return el;
  }

  private updateToken(el: HTMLElement, p: Patient) {
    const r = this.refs.get(el)!;
    const val = p.severity === 'green' ? p.patience : p.hp;
    r.bar.style.width = `${val.toFixed(1)}%`;
    r.bar.dataset.l = val > 60 ? 'ok' : val > 30 ? 'warn' : 'crit';
    el.classList.toggle('crit', p.critical && p.severity !== 'green');
    el.classList.toggle('angry', p.critical && p.severity === 'green');
    el.classList.toggle('sel', this.selected === p.id);
    if (el.dataset.st !== p.status) {
      el.dataset.st = p.status;
      r.st.innerHTML =
        p.status === 'bed' ? '<b>?</b>' : p.status === 'treating' ? `<em>${TOOLS[p.tool!].emoji}</em>` : p.status === 'done' ? '<b>✓</b>' : '';
    }
    if (p.status === 'treating') r.st.style.setProperty('--p', p.progress.toFixed(3));
  }

  private floatAt(target: Element, text: string, kind: 'good' | 'bad' | 'warn') {
    const box = $('play').getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = `float ${kind}`;
    f.textContent = text;
    const x = Math.max(70, Math.min(box.width - 70, r.left + r.width / 2 - box.left));
    f.style.left = `${x}px`;
    f.style.top = `${Math.max(56, r.top - box.top + 6)}px`;
    $('floats').appendChild(f);
    window.setTimeout(() => f.remove(), 1500);
  }

  private floatAtPid(pid: number, text: string, kind: 'good' | 'bad' | 'warn') {
    const el = this.tokens.get(pid);
    if (el) this.floatAt(el, text, kind);
  }

  private shake(pid: number) {
    const el = this.tokens.get(pid);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  // ---------- Bant ----------

  private showBanner(html: string, kind: 'info' | 'alert' | 'good') {
    const b = $('banner');
    if (b.dataset.html !== html) {
      b.innerHTML = html;
      b.dataset.html = html;
    }
    b.dataset.kind = kind;
    b.hidden = false;
  }

  private flashBanner(html: string, kind: 'info' | 'alert' | 'good', ms: number) {
    this.showBanner(html, kind);
    this.bannerUntil = performance.now() + ms;
  }

  private renderTutorial() {
    const g = this.game!;
    const s = g.s;
    if (s.stats.discharged >= 3) {
      this.tutorialOn = false;
      this.flashBanner('Harika! Kırmızıları asla bekletme.', 'good', 4000);
      return;
    }
    const sel = this.selected !== null ? g.get(this.selected) : undefined;
    let html: string;
    if (sel && sel.status === 'waiting') {
      const z = triageOf(sel.vitals);
      html =
        z === 'green'
          ? 'Bulgular normal → <i class="chip green"></i> Yeşil alana'
          : z === 'yellow'
            ? 'Bir bulgu sarı → <i class="chip yellow"></i> Sarı alana'
            : 'Kırmızı bulgu var → <i class="chip red"></i> Hemen Kırmızı alana';
    } else if (sel && sel.status === 'bed') {
      const c = COMPLAINT_BY_ID[sel.complaintId];
      html = `${c.emoji} ${c.title} → ${TOOLS[c.tool].emoji} ${TOOLS[c.tool].name}`;
    } else if (s.patients.some((p) => p.status === 'done')) {
      html = 'Tedavisi biten ✓ hastaya dokun: taburcu';
    } else if (s.patients.some((p) => p.status === 'bed')) {
      html = 'Yataktaki ? hastaya dokun, tedavi seç';
    } else if (s.waiting.length) {
      html = 'Bekleme salonundaki hastaya dokun';
    } else if (s.patients.length) {
      html = 'Tedavi sürüyor, gözün salonda olsun';
    } else {
      html = 'Kapı açıldı, ilk hasta geliyor…';
    }
    this.showBanner(html, 'info');
  }

  // ---------- Hasta kartı ----------

  private openSheet(pid: number) {
    this.selected = pid;
    this.sheetKey = '';
    $('sheet').hidden = false;
    this.renderSheet();
    this.sfx.tap();
  }

  closeSheet() {
    this.selected = null;
    this.sheetKey = '';
    $('sheet').hidden = true;
  }

  private renderSheet() {
    const g = this.game!;
    const p = this.selected !== null ? g.get(this.selected) : undefined;
    if (!p) {
      this.closeSheet();
      return;
    }
    const free = ZONES.map((z) => g.freeBeds(z)).join(',');
    const key = `${p.id}|${p.status}|${p.zone}|${p.bed}|${free}`;
    if (key !== this.sheetKey) {
      this.sheetKey = key;
      this.buildSheet(p);
    }
    const waitEl = $('sh-wait');
    const waiting = g.s.waiting.length;
    waitEl.hidden = waiting === 0 || p.status === 'waiting';
    waitEl.textContent = `Salonda ${waiting}`;
    waitEl.classList.toggle('hot', g.s.waiting.some((id) => g.get(id)?.critical));
    const val = p.severity === 'green' ? p.patience : p.hp;
    const bar = $('sh-bar');
    bar.style.width = `${val.toFixed(1)}%`;
    bar.dataset.l = val > 60 ? 'ok' : val > 30 ? 'warn' : 'crit';
    if (p.status === 'treating') {
      const pr = document.getElementById('sh-progress');
      if (pr) pr.style.width = `${(p.progress * 100).toFixed(1)}%`;
    }
  }

  private buildSheet(p: Patient) {
    const g = this.game!;
    const hints = g.cfg.hints;
    const c = COMPLAINT_BY_ID[p.complaintId];
    $('sh-av').textContent = p.avatar;
    $('sh-name').textContent = p.name;
    $('sh-meta').textContent = `${p.age} yaş · ${c.emoji} ${c.title}`;
    $('sh-quote').textContent = `“${p.line}”`;
    const tag = $('sh-tag');
    if (p.zone) {
      tag.hidden = false;
      tag.dataset.zone = p.zone;
      tag.textContent = `${BED_PREFIX[p.zone]}${p.bed + 1}`;
    } else if (p.amb) {
      tag.hidden = false;
      tag.dataset.zone = 'amb';
      tag.textContent = '112';
    } else tag.hidden = true;

    const lv = levels(p.vitals);
    $('sh-vitals').innerHTML = VITAL_KEYS.map((k) => {
      const f = fmtVital(k, p.vitals);
      const l = hints >= 1 ? lv[k] : -1;
      return `<div class="vt vt-${k}" data-l="${l}"><small>${VITAL_LABEL[k]}</small><b>${f.value}</b><em>${f.unit}</em></div>`;
    }).join('');

    const actions = $('sh-actions');
    const prompt = $('sh-prompt');
    if (p.status === 'waiting') {
      prompt.textContent = 'Hangi alana yatıralım?';
      const suggest = hints >= 2 ? triageOf(p.vitals) : null;
      actions.innerHTML =
        '<div class="zone-btns">' +
        ZONES.map((z) => {
          const free = g.freeBeds(z);
          return `<button type="button" class="zbtn${suggest === z ? ' suggest' : ''}" data-zone="${z}"${free ? '' : ' disabled'}><span>${ZONE_INFO[z].name}</span><small>${free ? `${free} boş yatak` : 'dolu'}</small></button>`;
        }).join('') +
        '</div>';
    } else if (p.status === 'bed') {
      prompt.textContent = 'Tedaviyi seç';
      const suggest = hints >= 2 ? c.tool : null;
      const moves = ZONES.filter((z) => z !== p.zone && g.freeBeds(z) > 0);
      actions.innerHTML =
        '<div class="tools">' +
        toolsFor(g.s.night)
          .map(
            (t: ToolId) =>
              `<button type="button" class="tool${suggest === t ? ' suggest' : ''}" data-tool="${t}"><span>${TOOLS[t].emoji}</span><small>${TOOLS[t].name}</small></button>`,
          )
          .join('') +
        '</div>' +
        (moves.length
          ? `<div class="moves"><small>Alanı değiştir</small>${moves
              .map((z) => `<button type="button" class="move" data-zone="${z}"><i class="chip ${z}"></i>${ZONE_INFO[z].name}</button>`)
              .join('')}</div>`
          : '');
    } else if (p.status === 'treating') {
      prompt.textContent = `${TOOLS[p.tool!].emoji} ${TOOLS[p.tool!].name} uygulanıyor…`;
      actions.innerHTML = '<div class="meter big"><i id="sh-progress"></i></div>';
    } else {
      prompt.textContent = 'Tedavi bitti.';
      actions.innerHTML = `<button type="button" class="btn primary wide" data-discharge="1">${p.severity === 'red' ? 'Servise yatır' : 'Taburcu et'}</button>`;
    }
  }

  // ---------- Dokunuşlar ----------

  private onBoardClick(e: MouseEvent) {
    const g = this.game;
    if (!g || this.paused || this.inCode || g.s.over) return;
    this.sfx.unlock();
    const t = e.target as HTMLElement;
    const tok = t.closest('.pt') as HTMLElement | null;
    if (tok) {
      const pid = Number(tok.dataset.id);
      const p = g.get(pid);
      if (!p) return;
      if (p.status === 'done') {
        g.discharge(pid);
        return;
      }
      if (this.selected === pid) this.closeSheet();
      else this.openSheet(pid);
      return;
    }
    const slot = t.closest('.slot.bed') as HTMLElement | null;
    if (slot && this.selected !== null) {
      const p = g.get(this.selected);
      if (p && (p.status === 'waiting' || p.status === 'bed') && !slot.querySelector('.pt:not(.leave)')) {
        g.assign(p.id, slot.dataset.zone as Zone, Number(slot.dataset.bed));
        return;
      }
    }
    this.closeSheet();
  }

  private onAction(e: MouseEvent) {
    const g = this.game;
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!g || !b || b.disabled || this.selected === null || this.paused || this.inCode) return;
    this.sfx.unlock();
    if (b.dataset.zone) g.assign(this.selected, b.dataset.zone as Zone);
    else if (b.dataset.tool) g.treat(this.selected, b.dataset.tool as ToolId);
    else if (b.dataset.discharge) g.discharge(this.selected);
  }
}
