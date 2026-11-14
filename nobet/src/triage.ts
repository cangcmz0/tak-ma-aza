// Triaj kuralları: yaşam bulgularından aciliyet rengi.
// Bunlar oyun kurallarıdır, gerçek tıbbi eşikleri basitleştirir.
import type { Zone } from './data';

export interface Vitals {
  nabiz: number;
  ates: number;
  spo2: number;
  sistolik: number;
  diastolik: number;
}

export type VitalKey = 'nabiz' | 'spo2' | 'sistolik' | 'ates';
export const VITAL_KEYS: VitalKey[] = ['nabiz', 'spo2', 'sistolik', 'ates'];
export type Level = 0 | 1 | 2;

export function levelOf(key: VitalKey, x: number): Level {
  switch (key) {
    case 'nabiz':
      return x > 130 || x < 45 ? 2 : x > 100 || x < 55 ? 1 : 0;
    case 'spo2':
      return x < 90 ? 2 : x < 95 ? 1 : 0;
    case 'sistolik':
      return x >= 190 || x < 90 ? 2 : x >= 160 || x < 100 ? 1 : 0;
    case 'ates':
      return x >= 40 ? 2 : x >= 38 ? 1 : 0;
  }
}

export function levels(v: Vitals): Record<VitalKey, Level> {
  return {
    nabiz: levelOf('nabiz', v.nabiz),
    spo2: levelOf('spo2', v.spo2),
    sistolik: levelOf('sistolik', v.sistolik),
    ates: levelOf('ates', v.ates),
  };
}

export function triageOf(v: Vitals): Zone {
  const m = Math.max(...VITAL_KEYS.map((k) => levelOf(k, v[k])));
  return m === 2 ? 'red' : m === 1 ? 'yellow' : 'green';
}

export const VITAL_LABEL: Record<VitalKey, string> = {
  nabiz: 'Nabız',
  spo2: 'SpO₂',
  sistolik: 'Tansiyon',
  ates: 'Ateş',
};

export function fmtVital(key: VitalKey, v: Vitals): { value: string; unit: string } {
  switch (key) {
    case 'nabiz':
      return { value: String(v.nabiz), unit: '/dk' };
    case 'spo2':
      return { value: `%${v.spo2}`, unit: '' };
    case 'sistolik':
      return { value: `${v.sistolik}/${v.diastolik}`, unit: 'mmHg' };
    case 'ates':
      return { value: v.ates.toFixed(1).replace('.', ','), unit: '°C' };
  }
}

export const RULES: { key: VitalKey; label: string; normal: string; yellow: string; red: string }[] = [
  { key: 'nabiz', label: 'Nabız /dk', normal: '55–100', yellow: '101–130<br>45–54', red: '&gt;130<br>&lt;45' },
  { key: 'spo2', label: 'SpO₂ %', normal: '≥95', yellow: '90–94', red: '&lt;90' },
  { key: 'sistolik', label: 'Büyük tansiyon', normal: '100–159', yellow: '160–189<br>90–99', red: '≥190<br>&lt;90' },
  { key: 'ates', label: 'Ateş °C', normal: '&lt;38', yellow: '38–39,9', red: '≥40' },
];
