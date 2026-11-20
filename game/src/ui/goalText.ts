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
  }
}

/** Colour id to show as a swatch next to the goal, if any. */
export function goalColor(g: Goal): number | undefined {
  const d = g.def;
  return 'color' in d ? d.color : undefined;
}
