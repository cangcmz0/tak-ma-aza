// Tiny helper to turn static SVG markup (strings authored in src/art/*) into elements.
// Markup is compile-time constant art; never pass user text into it.

export function svgEl(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild;
  if (!el || el.tagName.toLowerCase() !== 'svg') throw new Error('svgEl: markup must be a single <svg>');
  return el as SVGSVGElement;
}

/** Wrap inner SVG markup in a <span class=…> (for icons inside buttons). */
export function iconEl(markup: string, cls = 'ico'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = markup;
  return s;
}
