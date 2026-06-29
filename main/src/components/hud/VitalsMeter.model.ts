import type { VitalsState } from '../../game/systems/survivalVitals.ts';

export const VITALS_PANEL_WIDTH = 222;
export const VITALS_PANEL_TOP = 14;
export const VITALS_PANEL_LEFT = 14;
export const VITALS_PANEL_HEIGHT = 178;
export const VITALS_INVENTORY_GAP = 12;

export type VitalBarSpec = {
  key: keyof VitalsState;
  label: string;
  tone: string;
  glow: string;
};

export const VITAL_BARS: VitalBarSpec[] = [
  { key: 'health', label: 'HEALTH', tone: '#fb7185', glow: 'rgba(251,113,133,0.32)' },
  { key: 'hunger', label: 'FOOD', tone: '#f59e0b', glow: 'rgba(245,158,11,0.28)' },
  { key: 'thirst', label: 'WATER', tone: '#38bdf8', glow: 'rgba(56,189,248,0.30)' },
  { key: 'warmth', label: 'TEMP', tone: '#fbbf24', glow: 'rgba(251,191,36,0.24)' },
  { key: 'stamina', label: 'STAM', tone: '#34d399', glow: 'rgba(52,211,153,0.28)' },
  { key: 'oxygen', label: 'OXY', tone: '#7dd3fc', glow: 'rgba(125,211,252,0.30)' }
];

export function clampVitalsPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function formatVitalsValue(value: number): string {
  return `${Math.round(clampVitalsPercent(value))}%`;
}

export function formatVitalsWidth(value: number): string {
  return `${clampVitalsPercent(value)}%`;
}

export function formatMawChargeFraction(fraction: number): string {
  return formatVitalsValue(fraction * 100);
}

export function formatJetpackFuelFraction(fraction: number): string {
  return formatVitalsValue(fraction * 100);
}

export function getVitalsPanelPlacement(touch: boolean) {
  return {
    left: touch ? 12 : VITALS_PANEL_LEFT,
    top: VITALS_PANEL_TOP,
    width: touch ? 216 : VITALS_PANEL_WIDTH
  } as const;
}

export function getInventoryTopOffset(touch: boolean): number {
  return VITALS_PANEL_TOP + VITALS_PANEL_HEIGHT + (touch ? 10 : VITALS_INVENTORY_GAP);
}
