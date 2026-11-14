// Kod Mavi: halka kalbe değdiği an basarak ritimli kalp masajı.
import type { Sfx } from './audio';

const BEATS = 10;
const INTERVAL = 0.56; // ~107/dk
const LEAD = 2.9;
const APPROACH = 0.95;
const WINDOW = 0.17;
const NEED = 7;

const $ = (id: string) => document.getElementById(id)!;

export function runCpr(sfx: Sfx, who: string): Promise<boolean> {
  const ov = $('ov-code');
  const rings = $('code-rings');
  const heart = $('code-heart');
  const msg = $('code-msg');
  const dots = $('code-dots');
  $('code-who').textContent = who;
  ov.hidden = false;
  ov.classList.remove('saved', 'lost');
  msg.textContent = 'Hazırlan… halka kalbe değdiği an bas';
  rings.innerHTML = '';
  dots.innerHTML = '';
  const ringEls: HTMLElement[] = [];
  const dotEls: HTMLElement[] = [];
  for (let i = 0; i < BEATS; i++) {
    const r = document.createElement('i');
    rings.appendChild(r);
    ringEls.push(r);
    const d = document.createElement('i');
    dots.appendChild(d);
    dotEls.push(d);
  }
  sfx.flat();
  sfx.vibrate([200, 80, 200]);

  return new Promise((resolve) => {
    let start = performance.now() / 1000 + LEAD;
    let times = Array.from({ length: BEATS }, (_, i) => start + i * INTERVAL);
    let judged: (boolean | null)[] = Array(BEATS).fill(null);
    let stray = 0;
    let tapped = false;
    let lastNow = performance.now() / 1000;
    // Uygulamadan çıkılıp dönülürse (kare arası uzun) masaj baştan başlar.
    const restart = (now: number) => {
      start = now + LEAD;
      times = Array.from({ length: BEATS }, (_, i) => start + i * INTERVAL);
      judged = Array(BEATS).fill(null);
      stray = 0;
      tapped = false;
      dotEls.forEach((d) => (d.className = ''));
      ringEls.forEach((r) => (r.style.opacity = '0'));
    };
    let ticked = -1;
    let finished = false;
    let raf = 0;

    const mark = (i: number, ok: boolean) => {
      judged[i] = ok;
      dotEls[i].className = ok ? 'hit' : 'miss';
      ringEls[i].style.opacity = '0';
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      if (finished) return;
      tapped = true;
      const now = performance.now() / 1000;
      let best = -1;
      let bestD = Infinity;
      times.forEach((t, i) => {
        const d = Math.abs(now - t);
        if (judged[i] === null && d < bestD) {
          best = i;
          bestD = d;
        }
      });
      heart.classList.remove('pump');
      void heart.offsetWidth;
      heart.classList.add('pump');
      if (best >= 0 && bestD <= WINDOW) {
        mark(best, true);
        sfx.hit();
        msg.textContent = bestD < 0.07 ? 'Tam ritim!' : 'İyi!';
      } else {
        stray++;
        sfx.miss();
        msg.textContent = 'Ritmi bekle…';
      }
    };

    const finish = () => {
      finished = true;
      cancelAnimationFrame(raf);
      const hits = judged.filter((j) => j === true).length;
      const saved = hits >= NEED && stray <= 4;
      ov.classList.add(saved ? 'saved' : 'lost');
      msg.textContent = saved ? `Nabız geldi! ${hits}/${BEATS} doğru bası` : `Olmadı… ${hits}/${BEATS} doğru bası`;
      if (saved) sfx.saved();
      else sfx.fail();
      window.setTimeout(() => {
        ov.removeEventListener('pointerdown', onDown);
        ov.hidden = true;
        resolve(saved);
      }, 1300);
    };

    const loop = () => {
      const now = performance.now() / 1000;
      if (now - lastNow > 0.4) restart(now);
      lastNow = now;
      if (now < start - APPROACH) msg.textContent = `Hazırlan… ${Math.ceil(start - APPROACH - now)}`;
      else if (!tapped) msg.textContent = 'Halka kalbe değince bas!';
      times.forEach((t, i) => {
        const ring = ringEls[i];
        if (i > ticked && now >= t) {
          ticked = i;
          sfx.tick();
        }
        if (judged[i] !== null) return;
        const k = (t - now) / APPROACH;
        if (k > 1) {
          ring.style.opacity = '0';
        } else if (now <= t + WINDOW) {
          ring.style.opacity = String(Math.min(1, 1.4 - Math.max(0, k)));
          ring.style.transform = `translate(-50%, -50%) scale(${1 + Math.max(0, k) * 2.2})`;
        } else {
          mark(i, false);
        }
      });
      if (judged.every((j) => j !== null)) finish();
      else raf = requestAnimationFrame(loop);
    };
    ov.addEventListener('pointerdown', onDown);
    raf = requestAnimationFrame(loop);
  });
}
