// Tiny i18n helper. Strings live in tr.ts; t() fills {placeholders}.
import { tr, type Strings } from './tr';

let current: Strings = tr;

export function setStrings(s: Strings): void {
  current = s;
}

export function strings(): Strings {
  return current;
}

/** Locale used for numbers shown to the player (thousands separator "12.345"). */
export const NUMBER_LOCALE = 'tr-TR';

/** Player-facing number: grouped with the Turkish thousands separator (QA-011). */
export function num(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString(NUMBER_LOCALE) : String(n);
}

/** Fill {placeholders}; numeric values are formatted with num() (12345 → "12.345"). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in vars)) return `{${k}}`;
    const v = vars[k];
    return typeof v === 'number' ? num(v) : String(v);
  });
}

export function colorName(id: number): string {
  return current.colors[id] ?? `#${id}`;
}
