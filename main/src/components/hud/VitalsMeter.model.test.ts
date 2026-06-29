import { describe, expect, it } from 'vitest';
import {
  VITAL_BARS,
  VITALS_PANEL_TOP,
  VITALS_PANEL_HEIGHT,
  clampVitalsPercent,
  formatJetpackFuelFraction,
  formatMawChargeFraction,
  formatVitalsValue,
  formatVitalsWidth,
  getInventoryTopOffset,
  getVitalsPanelPlacement
} from './VitalsMeter.model.ts';

describe('vitals meter layout model', () => {
  it('defines suit-system bars with production labels', () => {
    expect(VITAL_BARS.map(bar => bar.label)).toEqual(['HEALTH', 'FOOD', 'WATER', 'TEMP', 'STAM', 'OXY']);
  });

  it('clamps and formats vitals values safely', () => {
    expect(clampVitalsPercent(-5)).toBe(0);
    expect(clampVitalsPercent(47.5)).toBe(47.5);
    expect(clampVitalsPercent(160)).toBe(100);
    expect(formatVitalsValue(47.5)).toBe('48%');
    expect(formatVitalsWidth(160)).toBe('100%');
    expect(formatMawChargeFraction(0.5)).toBe('50%');
    expect(formatJetpackFuelFraction(0.333)).toBe('33%');
  });

  it('places vitals at the top-left and offsets inventory below them', () => {
    expect(getVitalsPanelPlacement(false)).toMatchObject({ left: 14, top: 14 });
    expect(getVitalsPanelPlacement(true)).toMatchObject({ left: 12, top: 14 });
    expect(getInventoryTopOffset(false)).toBeGreaterThan(VITALS_PANEL_TOP + VITALS_PANEL_HEIGHT);
    expect(getInventoryTopOffset(true)).toBeGreaterThan(VITALS_PANEL_TOP + VITALS_PANEL_HEIGHT);
  });
});
