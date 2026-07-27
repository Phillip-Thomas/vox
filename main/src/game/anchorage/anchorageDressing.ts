import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import type { AnchorageBox } from './anchorageShell.ts';
import type { AnchorageCell, AnchorageGraph } from './anchorageTypes.ts';

/**
 * Dressing: the clutter that makes a volume read as a place.
 *
 * Scale is not perceived from size, it is perceived from comparison. An empty 180m
 * hall reads as a grey void; the same hall with 0.75m desks, 1.0m handrails and
 * 1.2m crates in it reads as enormous. Every prop here is deliberately at human
 * dimensions for that reason, and the lamps exist so the market can read the way it
 * is meant to — a grid of small warm lights on a dark plain.
 *
 * All props are axis-aligned boxes, so they join the same instanced draw as the shell.
 */

const DESK_HEIGHT = 0.75;
const RAIL_HEIGHT = 1.0;
const CRATE = 1.2;
const LAMP_HEIGHT = 0.28;

/** Keeps the instance count bounded no matter how large a seed makes a cell. */
const MAX_PROPS_PER_CELL = 1_800;

export function buildAnchorageDressing(graph: AnchorageGraph, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  for (const [index, cell] of graph.cells.entries()) {
    if (!cell.enterable) continue;
    const cellSeed = (seed ^ Math.imul(index + 1, 2654435761)) >>> 0;
    for (const box of dressCell(cell, cellSeed)) {
      boxes.push({ ...box, cellId: cell.id });
    }
  }
  return boxes;
}

function dressCell(cell: AnchorageCell, seed: number): AnchorageBox[] {
  switch (cell.kind) {
    case 'apron':
      return dressApron(cell, seed);
    case 'counter':
      return dressCounter(cell, seed);
    case 'concourse':
      return dressConcourse(cell, seed);
    case 'floor':
      return dressFloor(cell, seed);
    case 'shelves':
      return dressShelves(cell, seed);
    default:
      return [];
  }
}

/** Dock: cargo stacked against the walls, a couple of gantry columns overhead. */
function dressApron(cell: AnchorageCell, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const floorY = cell.min[1];
  const length = cell.max[0] - cell.min[0];
  const stacks = Math.min(34, Math.floor(length / 3.4));

  for (let i = 0; i < stacks; i++) {
    const t = (i + 0.5) / stacks;
    const x = cell.min[0] + length * t;
    for (const side of [-1, 1]) {
      const z = side * (cell.max[2] - 3.2 - seededUnit(seed, 31 + i) * 2.5);
      const height = 1 + Math.floor(seededUnit(seed, 61 + i * 3 + side) * 3);
      for (let level = 0; level < height; level++) {
        const jitter = (seededUnit(seed, 97 + i * 7 + level) - 0.5) * 0.35;
        boxes.push({
          center: [x + jitter, floorY + CRATE * (level + 0.5), z + jitter],
          size: [CRATE, CRATE, CRATE],
          kind: 'prop',
          tone: 4 + (level % 2)
        });
      }
    }
  }

  // Wall fittings every ~11m. Without light landing on a wall the room has no
  // boundary and reads as an infinite void regardless of how big it actually is.
  const wallLamps = Math.max(4, Math.floor(length / 11));
  for (let i = 0; i < wallLamps; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / wallLamps;
    for (const side of [-1, 1]) {
      boxes.push({
        center: [x, floorY + 4.6, side * (cell.max[2] - 0.9)],
        size: [1.5, 0.4, 0.34],
        kind: 'lamp',
        tone: 1,
        radius: 13
      });
    }
  }

  // Two rows flanking the aisle rather than one down the centreline. A column on
  // the axis of a long room stands squarely in the only shot the room has, and a
  // real bay is framed by its supports rather than divided by them.
  const columns = Math.min(8, Math.max(2, Math.floor(length / 16)));
  const columnZ = (cell.max[2] - cell.min[2]) * 0.29;
  for (let i = 0; i < columns; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / columns;
    for (const bay of [-1, 1] as const) {
      boxes.push({
        center: [x, floorY + (cell.max[1] - floorY) / 2, bay * columnZ],
        size: [1.5, cell.max[1] - floorY, 1.5],
        kind: 'structure',
        tone: 2
      });
      // A strip up each column's aisle-facing edge. Unlit trim, so a support reads
      // as a lit object rather than a silhouette cut out of the room behind it.
      boxes.push({
        center: [x, floorY + (cell.max[1] - floorY) * 0.45, bay * (columnZ - 0.8)],
        size: [0.18, (cell.max[1] - floorY) * 0.72, 0.1],
        kind: 'lamp',
        tone: 1,
        radius: 9
      });
      // Collar at the base, so the column meets the floor rather than intersecting it.
      boxes.push({
        center: [x, floorY + 0.45, bay * columnZ],
        size: [2.2, 0.9, 2.2],
        kind: 'trim',
        tone: 3
      });
    }

    // Work lamps bracketed to the columns at working height. A fitting 25m up
    // cannot light a floor without blowing out everything near it, so the dock is
    // lit the way a real one is — from where the work actually happens.
  }

  boxes.push(...ceilingStrips(cell, seed, 9));
  return boxes.slice(0, MAX_PROPS_PER_CELL);
}

/** Registry row: a counter down one side, a rail down the other, lit from above. */
function dressCounter(cell: AnchorageCell, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const floorY = cell.min[1];
  const length = cell.max[0] - cell.min[0];
  const stations = Math.min(14, Math.max(4, Math.floor(length / 7)));

  for (let i = 0; i < stations; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / stations;
    const z = cell.max[2] - 1.6;

    boxes.push({
      center: [x, floorY + DESK_HEIGHT / 2, z],
      size: [4.2, DESK_HEIGHT, 1.5],
      kind: 'prop',
      tone: 5
    });
    // A small warm lamp per station — the register desk reading of the corridor.
    boxes.push({
      center: [x + 1.3, floorY + DESK_HEIGHT + LAMP_HEIGHT / 2, z],
      size: [0.34, LAMP_HEIGHT, 0.34],
      kind: 'lamp',
      tone: 0,
      radius: 6.5
    });

    // Queue rail opposite, in segments so it reads as railing not a wall.
    boxes.push({
      center: [x, floorY + RAIL_HEIGHT, cell.min[2] + 1.4],
      size: [length / stations - 0.8, 0.12, 0.12],
      kind: 'trim',
      tone: 3
    });
    boxes.push({
      center: [x, floorY + RAIL_HEIGHT / 2, cell.min[2] + 1.4],
      size: [0.12, RAIL_HEIGHT, 0.12],
      kind: 'trim',
      tone: 3
    });
  }

  boxes.push(...ceilingStrips(cell, seed, stations));
  return boxes.slice(0, MAX_PROPS_PER_CELL);
}

/**
 * The concourse: the bustling common area.
 *
 * Bustle is density, not size. Two tight rows of vendor stalls face a central aisle
 * with barely enough room to pass, canopies bring the ceiling down over your head,
 * hanging signs break every long sightline, and there is a warm lamp roughly every
 * eight metres. Everything is scaled so a person is the unit of measure: 0.95m
 * counters, 2.3m canopies, 1.8m sign boards.
 */
const STALL_PITCH = 9.5;
/** Aisle half-width. Tight on purpose — you brush past people. */
const AISLE_HALF = 7.5;

/**
 * Where the vendor stalls stand.
 *
 * Shared by the geometry and the vendor entities so a counter you can see is always
 * a counter you can trade at. Deriving them twice is how a stall ends up with an
 * invisible shopkeeper standing two metres inside a wall.
 */
export interface StallSite {
  index: number;
  side: -1 | 1;
  /** Centre of the counter facing the aisle. */
  counter: Vec3Tuple;
  /** Where the trader stands, behind the counter. */
  stand: Vec3Tuple;
  /** Yaw so the trader faces the aisle. */
  facing: number;
  width: number;
  awningTone: number;
}

export function concourseStallSites(cell: AnchorageCell, seed: number): StallSite[] {
  const sites: StallSite[] = [];
  const floorY = cell.min[1];
  const length = cell.max[0] - cell.min[0];
  const centreZ = (cell.min[2] + cell.max[2]) / 2;
  const stalls = Math.max(6, Math.floor(length / STALL_PITCH));

  for (let i = 0; i < stalls; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / stalls;
    for (const side of [-1, 1] as const) {
      const salt = i * 37 + (side + 1) * 11;
      // A few empty pitches so the row reads as a market, not a wall of shops.
      if (seededUnit(seed, salt) < 0.12) continue;
      const front = centreZ + side * AISLE_HALF;
      sites.push({
        index: i,
        side,
        counter: [x, floorY, front],
        // Just behind the counter's back edge (the counter is 1.1m deep), which is
        // serving distance. Further back and the trader reads as someone loitering
        // in the booth rather than as the person you are buying from.
        stand: [x, floorY, front + side * 1.25],
        // Facing across the aisle, toward the opposite row.
        facing: side > 0 ? Math.PI : 0,
        width: STALL_PITCH - 1.4,
        awningTone: 7 + Math.floor(seededUnit(seed, salt + 3) * 3)
      });
    }
  }
  return sites;
}

function dressConcourse(cell: AnchorageCell, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const floorY = cell.min[1];
  const length = cell.max[0] - cell.min[0];
  const halfWidth = cell.max[2] - (cell.max[2] + cell.min[2]) / 2;
  const centreZ = (cell.min[2] + cell.max[2]) / 2;

  const aisleHalf = AISLE_HALF;

  for (const site of concourseStallSites(cell, seed)) {
    {
      const i = site.index;
      const side = site.side;
      const x = site.counter[0];
      const salt = i * 37 + (side + 1) * 11;
      const front = centreZ + side * aisleHalf;
      const back = centreZ + side * (aisleHalf + 4.4);
      const stallWidth = site.width;
      const awningTone = site.awningTone;

      // Counter facing the aisle.
      boxes.push({
        center: [x, floorY + 0.48, front],
        size: [stallWidth, 0.95, 1.1],
        kind: 'prop',
        tone: 5
      });
      // Back wall of the booth with shelving.
      boxes.push({
        center: [x, floorY + 1.5, back],
        size: [stallWidth, 3, 0.35],
        kind: 'prop',
        tone: 6
      });
      for (let shelf = 0; shelf < 3; shelf++) {
        boxes.push({
          center: [x, floorY + 0.9 + shelf * 0.75, back - side * 0.5],
          size: [stallWidth - 0.5, 0.08, 0.8],
          kind: 'trim',
          tone: 3
        });
      }
      // Goods on the counter and shelves — small, varied, plentiful.
      const goods = 5 + Math.floor(seededUnit(seed, salt + 5) * 6);
      for (let g = 0; g < goods; g++) {
        const gx = x + (seededUnit(seed, salt * 7 + g) - 0.5) * (stallWidth - 0.8);
        const onShelf = seededUnit(seed, salt * 13 + g) > 0.45;
        const gy = onShelf
          ? floorY + 0.98 + Math.floor(seededUnit(seed, salt + g) * 3) * 0.75
          : floorY + 1.05;
        const gz = onShelf ? back - side * 0.5 : front;
        const s = 0.22 + seededUnit(seed, salt * 3 + g) * 0.34;
        boxes.push({
          center: [gx, gy + s / 2, gz],
          size: [s, s, s],
          kind: 'prop',
          tone: 4 + (g % 2) * 3
        });
      }
      // Canopy over the stall — this is what brings the ceiling down.
      boxes.push({
        center: [x, floorY + 2.32, centreZ + side * (aisleHalf - 0.9)],
        size: [stallWidth + 0.6, 0.12, 3.6],
        kind: 'prop',
        tone: awningTone
      });
      boxes.push({
        center: [x - stallWidth / 2, floorY + 1.2, front - side * 0.6],
        size: [0.12, 2.4, 0.12],
        kind: 'trim',
        tone: 3
      });
      boxes.push({
        center: [x + stallWidth / 2, floorY + 1.2, front - side * 0.6],
        size: [0.12, 2.4, 0.12],
        kind: 'trim',
        tone: 3
      });
      // Hanging sign board, angled into the aisle so it breaks the sightline.
      boxes.push({
        center: [x, floorY + 3.1, centreZ + side * (aisleHalf - 1.6)],
        size: [stallWidth * 0.7, 0.9, 0.1],
        kind: 'prop',
        tone: awningTone
      });
      // Stall lamp, hung under the canopy over the counter.
      //
      // It used to sit at head height a metre inside the booth, which was fine
      // while the booth was empty and ruinous the moment a trader stood in it:
      // physical units with decay 2 mean illuminance is intensity/distance², and a
      // fitting sized to reach eight metres delivers roughly seventy times its
      // design value to anything standing a metre away. Over the counter it lights
      // the goods — which is what a stall light is for — and nothing gets closer
      // to it than the merchandise.
      boxes.push({
        center: [x, floorY + 2.24, centreZ + side * (aisleHalf - 0.2)],
        size: [0.3, 0.16, 0.3],
        kind: 'lamp',
        tone: 0,
        radius: 6
      });
      // Crates and barrels stacked at the stall edge.
      const clutter = Math.floor(seededUnit(seed, salt + 9) * 3);
      for (let c = 0; c < clutter; c++) {
        boxes.push({
          center: [
            x + (seededUnit(seed, salt * 5 + c) - 0.5) * stallWidth,
            floorY + 0.45 + c * 0.9,
            back + side * 1.1
          ],
          size: [0.9, 0.9, 0.9],
          kind: 'prop',
          tone: 4
        });
      }
    }
  }

  // Aisle furniture: seating clusters and kiosks, so the middle is not a runway.
  const clusters = Math.max(3, Math.floor(length / 26));
  for (let i = 0; i < clusters; i++) {
    const x = cell.min[0] + (length * (i + 0.7)) / clusters;
    const z = centreZ + (seededUnit(seed, 900 + i) - 0.5) * 6;
    if (seededUnit(seed, 950 + i) > 0.45) {
      // Bench pair around a low table.
      for (const offset of [-1.5, 1.5]) {
        boxes.push({
          center: [x, floorY + 0.22, z + offset],
          size: [2.6, 0.44, 0.6],
          kind: 'prop',
          tone: 6
        });
      }
      boxes.push({
        center: [x, floorY + 0.34, z],
        size: [1.4, 0.68, 1.0],
        kind: 'prop',
        tone: 5
      });
    } else {
      // Freestanding kiosk with its own light.
      boxes.push({
        center: [x, floorY + 1.15, z],
        size: [2.2, 2.3, 2.2],
        kind: 'prop',
        tone: 6
      });
      boxes.push({
        center: [x, floorY + 2.42, z],
        size: [2.5, 0.14, 2.5],
        kind: 'prop',
        tone: 7 + (i % 3)
      });
      boxes.push({
        center: [x, floorY + 2.6, z],
        size: [0.34, 0.18, 0.34],
        kind: 'lamp',
        tone: 0,
        radius: 9
      });
    }
  }

  // Banners strung overhead, and uplights on the side walls.
  const banners = Math.max(4, Math.floor(length / 18));
  for (let i = 0; i < banners; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / banners;
    boxes.push({
      center: [x, cell.max[1] - 1.6, centreZ],
      size: [0.5, 2.4, halfWidth * 1.2],
      kind: 'prop',
      tone: 7 + (i % 3)
    });
    boxes.push({
      center: [x, cell.max[1] - 0.6, centreZ],
      size: [1.2, 0.16, halfWidth * 1.3],
      kind: 'lamp',
      tone: 1,
      radius: Math.max(9, (cell.max[1] - cell.min[1]) * 1.2)
    });
  }

  return boxes.slice(0, MAX_PROPS_PER_CELL);
}

/**
 * The bureaucratic hall, staged as an open-plan office: a grid of desks each with
 * its own lamp, on a dark plain, under columns that disappear upward. Kept as the
 * cold administrative counterweight to the concourse.
 */
function dressFloor(cell: AnchorageCell, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const floorY = cell.min[1];
  const spanX = cell.max[0] - cell.min[0];
  const spanZ = cell.max[2] - cell.min[2];

  // Columns first: they read the height of the hall and must survive the prop cap.
  const pillars = Math.min(18, Math.max(3, Math.floor(spanX / 55)));
  const pillarRows = Math.min(10, Math.max(2, Math.floor(spanZ / 90)));
  for (let ix = 0; ix < pillars; ix++) {
    for (let iz = 0; iz < pillarRows; iz++) {
      boxes.push({
        center: [
          cell.min[0] + (spanX * (ix + 0.5)) / pillars,
          floorY + (cell.max[1] - floorY) / 2,
          cell.min[2] + (spanZ * (iz + 0.5)) / pillarRows
        ],
        size: [3.4, cell.max[1] - floorY, 3.4],
        kind: 'structure',
        tone: 2
      });

      // A work lamp clamped partway up each column. Without these the hall has no
      // light above desk height and its volume simply reads as black.
      boxes.push({
        center: [
          cell.min[0] + (spanX * (ix + 0.5)) / pillars + 1.9,
          floorY + 17,
          cell.min[2] + (spanZ * (iz + 0.5)) / pillarRows
        ],
        size: [0.5, 0.5, 1.9],
        kind: 'lamp',
        tone: 1,
        radius: 34
      });
    }
  }

  const SPACING = 16;
  const columnsX = Math.min(22, Math.max(4, Math.floor(spanX / SPACING)));
  const columnsZ = Math.min(26, Math.max(4, Math.floor(spanZ / SPACING)));

  for (let ix = 0; ix < columnsX; ix++) {
    for (let iz = 0; iz < columnsZ; iz++) {
      const salt = ix * 131 + iz * 17;
      // Leave occasional gaps so the grid reads as occupied rather than stamped.
      if (seededUnit(seed, salt) < 0.18) continue;

      const x = cell.min[0] + (spanX * (ix + 0.5)) / columnsX + (seededUnit(seed, salt + 1) - 0.5) * 2.2;
      const z = cell.min[2] + (spanZ * (iz + 0.5)) / columnsZ + (seededUnit(seed, salt + 2) - 0.5) * 2.2;

      boxes.push({
        center: [x, floorY + DESK_HEIGHT / 2, z],
        size: [2.6, DESK_HEIGHT, 1.4],
        kind: 'prop',
        tone: 5
      });
      boxes.push({
        center: [x + 0.9, floorY + DESK_HEIGHT + LAMP_HEIGHT / 2, z],
        size: [0.3, LAMP_HEIGHT, 0.3],
        kind: 'lamp',
        tone: 0,
        radius: 7.5
      });
      // A low partition — the cubicle, which is the thing this whole game is about.
      boxes.push({
        center: [x, floorY + 0.62, z - 0.85],
        size: [2.6, 1.24, 0.1],
        kind: 'prop',
        tone: 6
      });
    }
  }

  return boxes.slice(0, MAX_PROPS_PER_CELL);
}

/** Warehousing: tall racks in rows with aisles between them. */
function dressShelves(cell: AnchorageCell, seed: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const floorY = cell.min[1];
  const spanX = cell.max[0] - cell.min[0];
  const spanZ = cell.max[2] - cell.min[2];
  const rows = Math.min(9, Math.max(3, Math.floor(spanX / 14)));
  const bays = Math.min(14, Math.max(4, Math.floor(spanZ / 9)));

  for (let row = 0; row < rows; row++) {
    const x = cell.min[0] + (spanX * (row + 0.5)) / rows;
    for (let bay = 0; bay < bays; bay++) {
      const z = cell.min[2] + (spanZ * (bay + 0.5)) / bays;
      const levels = 3 + Math.floor(seededUnit(seed, row * 29 + bay) * 4);
      for (let level = 0; level < levels; level++) {
        boxes.push({
          center: [x, floorY + 1.4 + level * 2.6, z],
          size: [3.2, 0.18, 6.4],
          kind: 'trim',
          tone: 3
        });
        if (seededUnit(seed, row * 53 + bay * 7 + level) > 0.35) {
          boxes.push({
            center: [x, floorY + 1.4 + level * 2.6 + 0.7, z + (seededUnit(seed, level + bay) - 0.5) * 3],
            size: [2.2, 1.3, 2.2],
            kind: 'prop',
            tone: 4
          });
        }
      }
      boxes.push({
        center: [x, floorY + 1.4 + (levels * 2.6) / 2, z - 3.1],
        size: [0.22, levels * 2.6, 0.22],
        kind: 'structure',
        tone: 2
      });
    }
  }

  boxes.push(...ceilingStrips(cell, seed, 7));
  return boxes.slice(0, MAX_PROPS_PER_CELL);
}

/** Emissive strips just under the ceiling. Cheap, and they give a room a top. */
function ceilingStrips(cell: AnchorageCell, seed: number, count: number): AnchorageBox[] {
  const boxes: AnchorageBox[] = [];
  const spanX = cell.max[0] - cell.min[0];
  const y = cell.max[1] - 0.5;
  const halfZ = Math.min(cell.max[2] - cell.min[2], 18) / 2;

  for (let i = 0; i < count; i++) {
    if (seededUnit(seed, 401 + i) < 0.12) continue; // a few dead fittings
    boxes.push({
      center: [cell.min[0] + (spanX * (i + 0.5)) / count, y, (cell.min[2] + cell.max[2]) / 2],
      size: [1.1, 0.14, halfZ * 1.5],
      kind: 'lamp',
      tone: 1,
      radius: Math.max(7, (cell.max[1] - cell.min[1]) * 1.25)
    });
  }
  return boxes;
}

export function boxCenterInside(box: AnchorageBox, cell: AnchorageCell): boolean {
  const inside = (axis: 0 | 1 | 2): boolean =>
    box.center[axis] >= cell.min[axis] && box.center[axis] <= cell.max[axis];
  return inside(0) && inside(1) && inside(2);
}

export type { Vec3Tuple };
