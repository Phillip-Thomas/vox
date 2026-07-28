import { describe, expect, it } from 'vitest';
import { spaceStationBody, systemToStationLocal } from './spaceStationBody.ts';
import { buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import {
  buildSpaceStationExterior,
  EXTERIOR_LIGHT_TONE,
  type ExteriorBox
} from './spaceStationExterior.ts';

const ADDRESS = { system: { x: -19, y: -17 }, index: 0 };
const descriptor = buildSpaceStationDescriptor(ADDRESS);
const exterior = buildSpaceStationExterior(descriptor.graph, descriptor.seed);
const body = spaceStationBody(ADDRESS, descriptor.graph);

function spanOf(boxes: ExteriorBox[], axis: 0 | 1 | 2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const box of boxes) {
    min = Math.min(min, box.center[axis] - box.size[axis] / 2);
    max = Math.max(max, box.center[axis] + box.size[axis] / 2);
  }
  return [min, max];
}

describe('exterior massing', () => {
  it('is substantial without being unbounded', () => {
    expect(exterior.boxes.length).toBeGreaterThan(200);
    expect(exterior.boxes.length).toBeLessThan(4_000);
    expect(exterior.lights.length).toBeGreaterThan(400);
    expect(exterior.lights.length).toBeLessThan(8_000);
  });

  it('is deterministic from the seed', () => {
    const again = buildSpaceStationExterior(descriptor.graph, descriptor.seed);
    expect(again.boxes.length).toBe(exterior.boxes.length);
    expect(again.boxes[17]).toEqual(exterior.boxes[17]);
    expect(again.lights[42]).toEqual(exterior.lights[42]);
  });

  it('covers the whole length of the interior it wraps', () => {
    const [minX, maxX] = spanOf(exterior.boxes, 0);
    // Station-local space is centred, so the hull must reach both half-extents.
    expect(minX).toBeLessThan(-body.frame.half[0] * 0.9);
    expect(maxX).toBeGreaterThan(body.frame.half[0] * 0.9);
  });

  it('stands off the interior rather than sitting inside it', () => {
    const [, maxY] = spanOf(exterior.boxes, 1);
    const [, maxZ] = spanOf(exterior.boxes, 2);
    expect(maxY).toBeGreaterThan(body.frame.half[1]);
    expect(maxZ).toBeGreaterThan(body.frame.half[2]);
  });

  it('breaks the grid — not every box is axis-aligned', () => {
    const rotated = exterior.boxes.filter(box => box.rotation !== undefined);
    expect(rotated.length).toBeGreaterThan(20);
    const canted = rotated.filter(box =>
      box.rotation!.some(angle => Math.abs(angle) > 0.05)
    );
    expect(canted.length).toBeGreaterThan(10);
  });

  it('has all three detail tiers, biggest silhouette first', () => {
    const tiers = new Set(exterior.boxes.map(box => box.tier));
    expect(tiers).toEqual(new Set(['mass', 'structure', 'greeble']));
    // The mass tier alone has to hold the read at range.
    const mass = exterior.boxes.filter(box => box.tier === 'mass');
    const [minX, maxX] = spanOf(mass, 0);
    expect(maxX - minX).toBeGreaterThan(body.frame.half[0] * 1.8);
  });

  it('has no zero or negative dimensions anywhere', () => {
    for (const box of exterior.boxes) {
      for (const axis of [0, 1, 2] as const) {
        expect(box.size[axis], JSON.stringify(box)).toBeGreaterThan(0);
      }
    }
    for (const light of exterior.lights) {
      for (const axis of [0, 1, 2] as const) {
        expect(light.size[axis], JSON.stringify(light)).toBeGreaterThan(0);
      }
    }
  });
});

describe('what the lights say about the inside', () => {
  it('lights the market warm and the offices cold', () => {
    const tones = new Set(exterior.lights.map(light => light.tone));
    expect(tones.has(EXTERIOR_LIGHT_TONE.marketWarm)).toBe(true);
    expect(tones.has(EXTERIOR_LIGHT_TONE.officeBlue)).toBe(true);
  });

  it('leaves the sealed volume completely dark', () => {
    const blank = descriptor.graph.cells.find(cell => cell.kind === 'blank')!;
    const frame = body.frame;
    const low = blank.min[0] - frame.origin[0];
    const high = blank.max[0] - frame.origin[0];
    // Window rows are placed within a district's own span; nothing emissive from
    // the hull itself should sit inside the sealed section.
    const inside = exterior.lights.filter(
      light =>
        light.center[0] > low + 12 &&
        light.center[0] < high - 12 &&
        light.tone !== EXTERIOR_LIGHT_TONE.strobe
    );
    expect(inside).toEqual([]);
  });

  it('flies port red and starboard green', () => {
    const red = exterior.lights.filter(light => light.tone === EXTERIOR_LIGHT_TONE.navRed);
    const green = exterior.lights.filter(light => light.tone === EXTERIOR_LIGHT_TONE.navGreen);
    expect(red.length).toBeGreaterThan(0);
    expect(green.length).toBeGreaterThan(0);
    // Convention is a spatial claim, not a colour count: every green sits on the
    // opposite side of the spine from every red.
    expect(green.every(light => light.center[2] > 0)).toBe(true);
    expect(red.every(light => light.center[2] < 0)).toBe(true);
  });

  it('blinks its beacons out of step', () => {
    const blinking = exterior.lights.filter(light => light.blink);
    expect(blinking.length).toBeGreaterThan(8);
    expect(new Set(blinking.map(light => light.phase ?? 0)).size).toBeGreaterThan(3);
    for (const light of blinking) {
      expect(light.blink!).toBeGreaterThan(0);
      expect(light.duty ?? 0.25).toBeGreaterThan(0);
      expect(light.duty ?? 0.25).toBeLessThan(1);
    }
  });
});

describe('the berth you fly into is the airlock you walk out of', () => {
  it('puts the lit dock mouth at the berth end of the station', () => {
    const berthLocal = systemToStationLocal(body, body.berth);
    const dockLights = exterior.lights.filter(
      light => light.tone === EXTERIOR_LIGHT_TONE.dockWhite
    );
    expect(dockLights.length).toBeGreaterThan(0);
    const nearest = dockLights.reduce((best, light) =>
      Math.abs(light.center[0] - berthLocal[0]) < Math.abs(best.center[0] - berthLocal[0])
        ? light
        : best
    );
    // The mouth is on the same side of the station's middle as the berth.
    expect(Math.sign(nearest.center[0])).toBe(Math.sign(berthLocal[0]));
  });

  it('runs the guide arms back out along the approach corridor, not into the hull', () => {
    const berthLocal = systemToStationLocal(body, body.berth);
    const guides = exterior.lights.filter(
      light =>
        light.tone === EXTERIOR_LIGHT_TONE.navGreen || light.tone === EXTERIOR_LIGHT_TONE.navRed
    );
    const beyondMouth = guides.filter(light => light.center[0] < -body.frame.half[0]);
    expect(beyondMouth.length).toBeGreaterThan(8);
    // And they stop well short of where a ship actually parks.
    for (const light of beyondMouth) {
      expect(light.center[0]).toBeGreaterThan(berthLocal[0]);
    }
  });

  it('parks the ship on the dock mouth axis, not the bounding-box axis', () => {
    // These are different lines. The station's box is dominated by the sealed mass
    // at the far end, which is four times the height of the dock, so its centre is
    // up in the roof of another district entirely — a berth placed there is a berth
    // above the roof. This is the assertion that catches that.
    const apron = descriptor.graph.cells.find(cell => cell.kind === 'apron')!;
    const apronCentreY = (apron.min[1] + apron.max[1]) / 2 - body.frame.origin[1];
    const apronCentreZ = (apron.min[2] + apron.max[2]) / 2 - body.frame.origin[2];
    expect(body.berthLocal[1]).toBeCloseTo(apronCentreY, 6);
    expect(body.berthLocal[2]).toBeCloseTo(apronCentreZ, 6);
    // And that really is off the box centre, or this test proves nothing.
    expect(Math.abs(apronCentreY)).toBeGreaterThan(20);
  });

  it('leaves the mouth itself open — no hull box blocking the way in', () => {
    // March the *actual* corridor: from the berth along +X to just inside the
    // mouth, at the berth's own height and lateral offset. Marching along local
    // (0, 0) instead tests a line that passes above the dock entirely and passes
    // no matter where the mouth is.
    const { berthLocal } = body;
    for (let x = berthLocal[0]; x < berthLocal[0] + 210; x += 4) {
      const obstructed = exterior.boxes.some(
        box =>
          box.tier === 'mass' &&
          Math.abs(box.center[0] - x) < box.size[0] / 2 &&
          Math.abs(box.center[1] - berthLocal[1]) < box.size[1] / 2 &&
          Math.abs(box.center[2] - berthLocal[2]) < box.size[2] / 2
      );
      expect(obstructed, `corridor blocked at local x=${x.toFixed(0)}`).toBe(false);
    }
  });

  it('frames the mouth without closing it', () => {
    // The jambs must straddle the corridor, not sit on it: four pieces around an
    // opening, none of them containing the axis a ship flies down.
    const { berthLocal } = body;
    const atMouth = exterior.boxes.filter(
      box =>
        box.tier === 'mass' &&
        Math.abs(box.center[0] - (berthLocal[0] + 210)) < 30
    );
    expect(atMouth.length).toBeGreaterThan(0);
    for (const box of atMouth) {
      const onAxis =
        Math.abs(box.center[1] - berthLocal[1]) < box.size[1] / 2 &&
        Math.abs(box.center[2] - berthLocal[2]) < box.size[2] / 2;
      expect(onAxis, `jamb sits on the corridor: ${JSON.stringify(box)}`).toBe(false);
    }
  });
});
