// Tiny i18n helper. Strings live in tr.ts; t() fills {placeholders}.
import { tr, type Strings } from './tr';

let current: Strings = tr;

export function setStrings(s: Strings): void {
  current = s;
}

export function strings(): Strings {
  return current;
}

export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function colorName(id: number): string {
  return current.colors[id] ?? `#${id}`;
}
