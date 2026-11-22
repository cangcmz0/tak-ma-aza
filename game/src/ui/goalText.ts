// Player-facing text for goals (one case per goal type).
import type { Goal } from '../game/goals';
import { colorName, fmt, strings } from '../i18n';

export function goalLabel(g: Goal): string {
  const s = strings().goals;
  const d = g.def;
  switch (d.type) {
    case 'clear_paths':
      return d.color === undefined
        ? fmt(s.clear_paths, { n: d.count })
        : fmt(s.clear_paths_color, { n: d.count, color: colorName(d.color) });
    case 'score':
      return fmt(s.score, { n: d.value });
    case 'clear_color_grains':
      return fmt(s.clear_color_grains, { n: d.count, color: colorName(d.color) });
    case 'clear_obstacles':
      return fmt(s.clear_obstacles, { n: d.count });
  }
}

/** Colour id to show as a swatch next to the goal, if any. */
export function goalColor(g: Goal): number | undefined {
  const d = g.def;
  return 'color' in d ? d.color : undefined;
}

/** Compact HUD label: the order card shows the numbers next to it ("Pul biber · 96/300 g"). */
export function goalShortLabel(g: Goal): string {
  const s = strings().hud.goalShort;
  const d = g.def;
  const cap = (t: string) => t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
  switch (d.type) {
    case 'clear_paths':
      return d.color === undefined ? s.paths : cap(fmt(s.pathsColor, { color: colorName(d.color) }));
    case 'score':
      return s.score;
    case 'clear_color_grains':
      return cap(colorName(d.color));
    case 'clear_obstacles':
      return s.obstacles;
  }
}

/** Narrow screens (≤ 340 px, QA-013): one word; the chip already shows path / colour. */
export function goalTinyLabel(g: Goal): string {
  const d = g.def;
  const cap = (t: string) => t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
  if (d.type === 'clear_paths') return d.color === undefined ? strings().hud.goalTiny.paths : cap(colorName(d.color));
  return goalShortLabel(g);
}
