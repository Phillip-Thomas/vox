import { describe, expect, it } from 'vitest';
import { stationMarkerPosition, stationMarkerSurfaceReserved } from './stationMarkerLayout.ts';
const portrait = { left: 24, top: 24, right: 366, bottom: 820 };
const workOrder = { left: 16, top: 16, right: 374, bottom: 169 };
const controls = { left: 150, top: 672, right: 376, bottom: 824 };
describe('station marker playable frame', () => {
  it('reserves the reticle even though it shares the marker layer, without reserving hidden or decorative markers', () => {
    expect(stationMarkerSurfaceReserved({ dataset: { hudLayer: 'marker', hudSurface: 'station-crosshair' } })).toBe(true);
    expect(stationMarkerSurfaceReserved({ hidden: true, dataset: { hudLayer: 'marker', hudSurface: 'station-crosshair' } })).toBe(false);
    expect(stationMarkerSurfaceReserved({ dataset: { hudLayer: 'marker', hudSurface: 'station-marker' } })).toBe(false);
    expect(stationMarkerSurfaceReserved({ dataset: { hudLayer: 'modal' } })).toBe(false);
    expect(stationMarkerSurfaceReserved({ dataset: { hudLayer: 'guidance' } })).toBe(true);
  });
  it('clears the measured landscape reticle after its top bearing is inset below the HUD', () => {
    const field = { left: 24, right: 820, top: 24, bottom: 366 };
    const hud = { left: 16, right: 436, top: 16, bottom: 169 };
    const crosshair = { left: 419.5, right: 424.5, top: 192.5, bottom: 197.5 };
    const previous = stationMarkerPosition(0, 1, field, [hud]);
    expect(previous).toEqual({ x: 422, y: 186 });
    const result = stationMarkerPosition(0, 1, field, [hud, crosshair]);
    expect(result.x).toBe(422);
    expect(result.y - 9).toBeGreaterThanOrEqual(crosshair.bottom + 8);
    expect(result.y - 9).toBeGreaterThanOrEqual(hud.bottom + 8);
    expect(result.y + 9).toBeLessThan(field.bottom);
  });
  it('reads browser DOMRect prototype getters rather than assuming enumerable coordinates', () => {
    // getBoundingClientRect returns DOMRect: its public coordinates need not
    // be own enumerable properties, unlike an object-literal test fixture.
    class BrowserRect {
      get left() { return 24; }
      get top() { return 24; }
      get right() { return 366; }
      get bottom() { return 820; }
    }
    const field = new BrowserRect();
    expect(Object.keys(field)).toEqual([]);
    const result = stationMarkerPosition(0, 1, field, [workOrder, controls]);
    expect(result).toEqual(stationMarkerPosition(0, 1, portrait, [workOrder, controls]));
    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
    expect(result.y - 9).toBeGreaterThanOrEqual(workOrder.bottom + 8);
  });
  it('clears the measured G3 portrait work order without changing a top bearing', () => {
    const result = stationMarkerPosition(0, 1, portrait, [workOrder, controls]);
    expect(result.x).toBe(195);
    expect(result.y - 9).toBeGreaterThanOrEqual(workOrder.bottom + 8);
  });
  it('keeps bottom bearings above the actual touch action cluster', () => {
    const result = stationMarkerPosition(0, -1, portrait, [workOrder, controls]);
    expect(result.x).toBe(195);
    expect(result.y + 9).toBeLessThanOrEqual(controls.top - 8);
  });
  it('preserves unaffected desktop and portrait bearings exactly', () => {
    expect(stationMarkerPosition(-1, 0, portrait, [workOrder, controls])).toEqual({ x: 24, y: 422 });
    const desktop = { left: 24, right: 1576, top: 24, bottom: 876 };
    expect(stationMarkerPosition(0, 1, desktop, [workOrder])).toEqual({ x: 800, y: 24 });
  });
  it('clears a wide landscape HUD with a diagonal bearing', () => {
    const field = { left: 24, right: 820, top: 24, bottom: 366 };
    const hud = { left: 16, right: 470, top: 16, bottom: 154 };
    const result = stationMarkerPosition(-0.5, 1, field, [hud]);
    expect(result.y - 9).toBeGreaterThanOrEqual(hud.bottom + 8);
    expect(result.x).toBeLessThan((field.left + field.right) / 2);
  });
});
