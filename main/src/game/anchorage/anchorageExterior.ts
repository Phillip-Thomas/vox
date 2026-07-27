import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import { anchorageFrame, toStationLocal, type AnchorageFrame } from './anchorageBody.ts';
import type { AnchorageCell, AnchorageCellKind, AnchorageGraph } from './anchorageTypes.ts';

/**
 * The station from outside.
 *
 * Built from the interior's own cell graph, which is the only rule here that
 * matters: the dock you fly into is the apron you walk out of, the lit band on the
 * flank is the concourse you buy things in, and the enormous dark mass at the far
 * end is the sealed volume you can never get into. Modelling an exterior by hand
 * and a floor plan by generation produces a hatch that opens onto solid hull.
 *
 * Everything is boxes with a rotation, so the whole station is two instanced draws
 * and the silhouette still has diagonals in it. That last part is deliberate — the
 * interior's weakest read is that every surface is square to every other, and a
 * station whose radiators and masts are canted breaks the grid without costing a
 * second material.
 *
 * Emitted in station-local space, centred on the graph's bounding box. Placing and
 * orienting it in system space is `anchorageBody`'s job.
 */

export type ExteriorTier =
  /** The big masses. The silhouette; always drawn. */
  | 'mass'
  /** Radiators, wings, masts, berth arms. The read at medium range. */
  | 'structure'
  /** Panel breaks, tanks, pipe runs. Only worth drawing up close. */
  | 'greeble';

export interface ExteriorBox {
  center: Vec3Tuple;
  size: Vec3Tuple;
  /** Euler XYZ, radians. Absent means axis-aligned. */
  rotation?: Vec3Tuple;
  tier: ExteriorTier;
  /** Index into the hull palette. */
  tone: number;
}

export interface ExteriorLight {
  center: Vec3Tuple;
  size: Vec3Tuple;
  rotation?: Vec3Tuple;
  /** Index into the emissive palette. */
  tone: number;
  /** Seconds per blink cycle. Absent or 0 is a steady light. */
  blink?: number;
  /** Offset into the blink cycle so a row of beacons does not pulse in unison. */
  phase?: number;
  /** Fraction of the cycle the light is lit. Only meaningful when blinking. */
  duty?: number;
}

export interface AnchorageExterior {
  boxes: ExteriorBox[];
  lights: ExteriorLight[];
  frame: AnchorageFrame;
  /**
   * Centre of the dock opening, in station space.
   *
   * Handed out so the renderer can hang a real light here. The key rakes along the
   * spine, which shows the station's length beautifully and leaves the dock face
   * edge-on and black — and the dock face is the one surface the player spends the
   * entire approach looking at. Emissive boxes make the opening glow; only an
   * actual light makes the hull around it exist.
   */
  mouth: Vec3Tuple;
}

/** How far the hull stands off the habitable volume it contains. */
const HULL_MARGIN = 5;
/** Machinery decks below the walkable floor. Stations are not one storey thick. */
const UNDERDECK = 12;
/** Plant and ducting above the ceiling. */
const OVERDECK = 8;

/**
 * Emissive palette. Window tones are lifted straight from the interior's district
 * colour script, so the light leaking out of a flank is the light that is actually
 * on in there. The nav tones are the standard ones, because a player who has seen
 * a boat knows which side they are looking at.
 */
export const EXTERIOR_LIGHT_TONE = {
  /** Apron work lighting. Cold, industrial. */
  dockWhite: 0,
  /** Counter/administration. Even, blue-grey. */
  officeBlue: 1,
  /** Concourse. Warm sodium — the only room that likes you. */
  marketWarm: 2,
  /** Warehouse. Dim amber. */
  storeAmber: 3,
  /** Port nav light. */
  navRed: 4,
  /** Starboard nav light. */
  navGreen: 5,
  /** Approach guide and mast strobes. */
  strobe: 6
} as const;

/** Which window tone a district shows the outside world. */
const WINDOW_TONE: Record<AnchorageCellKind, number | null> = {
  apron: EXTERIOR_LIGHT_TONE.dockWhite,
  counter: EXTERIOR_LIGHT_TONE.officeBlue,
  concourse: EXTERIOR_LIGHT_TONE.marketWarm,
  floor: EXTERIOR_LIGHT_TONE.officeBlue,
  shelves: EXTERIOR_LIGHT_TONE.storeAmber,
  // The sealed volume shows nothing. A vast unlit mass at the end of a lit station
  // says "there is more here and it is closed" without a line of dialogue.
  blank: null
};

export function buildAnchorageExterior(graph: AnchorageGraph, seed: number): AnchorageExterior {
  const frame = anchorageFrame(graph);
  const boxes: ExteriorBox[] = [];
  const lights: ExteriorLight[] = [];

  const ordered = [...graph.cells].sort((a, b) => a.min[0] - b.min[0]);

  for (const [index, cell] of ordered.entries()) {
    hullForCell(cell, frame, seed, index, boxes, lights);
  }

  bulkheadCollars(ordered, frame, boxes);
  spineTrunk(ordered, frame, seed, boxes);
  radiatorBanks(ordered, frame, seed, boxes);
  collectorWings(ordered, frame, seed, boxes);
  masts(ordered, frame, seed, boxes, lights);
  const mouth = berthStructure(ordered, frame, boxes, lights);
  navLights(ordered, frame, lights);

  return { boxes, lights, frame, mouth };
}

/** The pressure hull around one district, plus its window bands. */
function hullForCell(
  cell: AnchorageCell,
  frame: AnchorageFrame,
  seed: number,
  index: number,
  boxes: ExteriorBox[],
  lights: ExteriorLight[]
): void {
  const salt = index * 137 + 11;
  const low = toStationLocal(frame, [cell.min[0], cell.min[1] - UNDERDECK, cell.min[2]]);
  const high = toStationLocal(frame, [cell.max[0], cell.max[1] + OVERDECK, cell.max[2]]);

  const center: Vec3Tuple = [
    (low[0] + high[0]) / 2,
    (low[1] + high[1]) / 2,
    (low[2] + high[2]) / 2
  ];
  const size: Vec3Tuple = [
    high[0] - low[0],
    high[1] - low[1] + HULL_MARGIN,
    high[2] - low[2] + HULL_MARGIN * 2
  ];

  boxes.push({ center, size, tier: 'mass', tone: hullToneFor(cell.kind) });

  // A chamfer block above and below, narrower than the hull, so a district reads
  // as a built section rather than as an extruded rectangle.
  for (const sign of [-1, 1]) {
    boxes.push({
      center: [center[0], center[1] + sign * (size[1] / 2 + 2), center[2]],
      size: [size[0] * 0.94, 6, size[2] * 0.78],
      tier: 'mass',
      tone: hullToneFor(cell.kind) === 0 ? 1 : 0
    });
  }

  // Belt courses: raised bands around the hull at intervals, which is what gives a
  // long mass a sense of length rather than of scale-free extrusion.
  const belts = Math.max(2, Math.round(size[0] / 44));
  for (let i = 0; i < belts; i++) {
    boxes.push({
      center: [low[0] + (size[0] * (i + 0.5)) / belts, center[1], center[2]],
      size: [3.5, size[1] + 3, size[2] + 3],
      tier: 'structure',
      tone: 2
    });
  }

  greebleFlank(cell, frame, seed, salt, center, size, boxes);
  windowBands(cell, frame, seed, salt, center, size, lights);
}

/**
 * Window rows down both flanks.
 *
 * Kept small and plentiful rather than large and few: at four kilometres a station
 * is a smear of light, and what makes that smear read as inhabited is the density
 * and the colour, not the shape of any one pane.
 */
function windowBands(
  cell: AnchorageCell,
  frame: AnchorageFrame,
  seed: number,
  salt: number,
  center: Vec3Tuple,
  size: Vec3Tuple,
  lights: ExteriorLight[]
): void {
  const tone = WINDOW_TONE[cell.kind];
  if (tone === null) return;
  void frame;

  const columns = Math.max(6, Math.round(size[0] / 5.5));
  const rows = Math.max(1, Math.min(7, Math.round(size[1] / 13)));

  for (let row = 0; row < rows; row++) {
    const y = center[1] - size[1] / 2 + (size[1] * (row + 0.6)) / (rows + 0.4);
    for (let column = 0; column < columns; column++) {
      // Dark panes are what stop a window grid reading as printed wallpaper.
      if (seededUnit(seed, salt + row * 97 + column * 13) < 0.26) continue;
      const x = center[0] - size[0] / 2 + (size[0] * (column + 0.5)) / columns;
      for (const side of [-1, 1] as const) {
        lights.push({
          center: [x, y, center[2] + side * (size[2] / 2 + 0.4)],
          size: [3.1, 1.5, 0.5],
          tone
        });
      }
    }
  }

  // A brighter band at the deck line of the public rooms: the light spilling from
  // a concourse is the thing you steer toward from a long way out.
  if (cell.kind === 'concourse') {
    for (const side of [-1, 1] as const) {
      lights.push({
        center: [center[0], center[1] - size[1] * 0.06, center[2] + side * (size[2] / 2 + 0.5)],
        size: [size[0] * 0.82, 2.6, 0.6],
        tone: EXTERIOR_LIGHT_TONE.marketWarm
      });
    }
  }
}

/** Tanks, pipe runs and panel breaks on the flanks. Only drawn up close. */
function greebleFlank(
  cell: AnchorageCell,
  frame: AnchorageFrame,
  seed: number,
  salt: number,
  center: Vec3Tuple,
  size: Vec3Tuple,
  boxes: ExteriorBox[]
): void {
  void cell;
  void frame;
  const count = Math.min(46, Math.max(8, Math.round(size[0] / 9)));
  for (let i = 0; i < count; i++) {
    const t = seededUnit(seed, salt + i * 29);
    const x = center[0] - size[0] / 2 + size[0] * t;
    const y = center[1] + (seededUnit(seed, salt + i * 31 + 3) - 0.5) * size[1] * 0.78;
    const side = seededUnit(seed, salt + i * 37 + 5) > 0.5 ? 1 : -1;
    const kind = seededUnit(seed, salt + i * 41 + 7);

    if (kind < 0.4) {
      // Cylinder-ish tank, canted.
      const radius = 1.6 + seededUnit(seed, salt + i * 43) * 2.6;
      boxes.push({
        center: [x, y, center[2] + side * (size[2] / 2 + radius * 0.7)],
        size: [radius * 2, radius * 2, radius * 2.6],
        rotation: [0, 0, (seededUnit(seed, salt + i * 47) - 0.5) * 0.8],
        tier: 'greeble',
        tone: 3
      });
    } else if (kind < 0.75) {
      // Pipe run along the flank.
      const run = 8 + seededUnit(seed, salt + i * 53) * 26;
      boxes.push({
        center: [x, y, center[2] + side * (size[2] / 2 + 1.1)],
        size: [run, 1.1, 1.1],
        rotation: [(seededUnit(seed, salt + i * 59) - 0.5) * 0.25, 0, 0],
        tier: 'greeble',
        tone: 2
      });
    } else {
      // Recessed panel plate.
      boxes.push({
        center: [x, y, center[2] + side * (size[2] / 2 + 0.5)],
        size: [6 + seededUnit(seed, salt + i * 61) * 10, 4 + seededUnit(seed, salt + i * 67) * 7, 0.9],
        tier: 'greeble',
        tone: 1
      });
    }
  }
}

/** A raised ring at each district junction, so the spine reads as assembled. */
function bulkheadCollars(cells: AnchorageCell[], frame: AnchorageFrame, boxes: ExteriorBox[]): void {
  for (let i = 0; i < cells.length - 1; i++) {
    const a = cells[i];
    const b = cells[i + 1];
    const joint = toStationLocal(frame, [a.max[0], (a.min[1] + a.max[1]) / 2, 0]);
    const reach = Math.max(a.max[2] - a.min[2], b.max[2] - b.min[2]) / 2;
    boxes.push({
      center: [joint[0], joint[1], toStationLocal(frame, [0, 0, 0])[2]],
      size: [9, Math.min(a.max[1], b.max[1]) + UNDERDECK + 22, reach * 0.7],
      tier: 'mass',
      tone: 2
    });
  }
}

/**
 * A continuous structural trunk under the whole station.
 *
 * Without it the districts read as separate buildings floating in formation. The
 * trunk is what makes them one object.
 */
function spineTrunk(
  cells: AnchorageCell[],
  frame: AnchorageFrame,
  seed: number,
  boxes: ExteriorBox[]
): void {
  if (cells.length === 0) return;
  const first = cells[0];
  const last = cells[cells.length - 1];
  const start = toStationLocal(frame, [first.min[0], first.min[1], 0])[0];
  const end = toStationLocal(frame, [last.max[0], last.min[1], 0])[0];
  const baseY = toStationLocal(frame, [0, first.min[1] - UNDERDECK, 0])[1];

  const segments = 26;
  for (let i = 0; i < segments; i++) {
    const x = start + ((end - start) * (i + 0.5)) / segments;
    boxes.push({
      center: [x, baseY - 9, 0],
      size: [(end - start) / segments + 1, 13, 15],
      rotation: [(seededUnit(seed, 811 + i) - 0.5) * 0.06, 0, 0],
      tier: 'mass',
      tone: 2
    });
  }

  // Truss legs tying the trunk up into each district.
  for (const cell of cells) {
    const mid = toStationLocal(frame, [(cell.min[0] + cell.max[0]) / 2, cell.min[1], 0]);
    for (const side of [-1, 1] as const) {
      boxes.push({
        center: [mid[0], baseY - 2, side * 7],
        size: [Math.min(60, (cell.max[0] - cell.min[0]) * 0.5), 2.4, 2.4],
        rotation: [0, 0, side * 0.5],
        tier: 'structure',
        tone: 2
      });
    }
  }
}

/**
 * Radiator banks.
 *
 * Every station that generates power has to throw the heat away, and the fins are
 * the cheapest possible way to make a silhouette look engineered rather than
 * sculpted. Canted, and canted differently per bank, because a row of parallel
 * panels reads as a texture and a row of splayed ones reads as hardware.
 */
function radiatorBanks(
  cells: AnchorageCell[],
  frame: AnchorageFrame,
  seed: number,
  boxes: ExteriorBox[]
): void {
  const industrial = cells.filter(cell => cell.kind === 'counter' || cell.kind === 'shelves');
  for (const [bank, cell] of industrial.entries()) {
    const span = cell.max[0] - cell.min[0];
    const panels = Math.max(3, Math.min(7, Math.round(span / 26)));
    const mid = toStationLocal(frame, [0, (cell.min[1] + cell.max[1]) / 2, 0])[1];

    for (let i = 0; i < panels; i++) {
      const x = toStationLocal(frame, [cell.min[0] + (span * (i + 0.5)) / panels, 0, 0])[0];
      const cant = 0.24 + seededUnit(seed, 901 + bank * 31 + i) * 0.5;
      for (const side of [-1, 1] as const) {
        const reach = 46 + seededUnit(seed, 941 + bank * 37 + i) * 34;
        boxes.push({
          center: [x, mid + 6, side * (reach / 2 + 10)],
          size: [22, 1.4, reach],
          rotation: [side * cant, 0, side * 0.16],
          tier: 'structure',
          tone: 4
        });
        // Root fitting, so a fin does not appear to be stuck on with nothing.
        boxes.push({
          center: [x, mid + 6, side * 10],
          size: [7, 5, 7],
          tier: 'structure',
          tone: 2
        });
      }
    }
  }
}

/** Two large collector panels off the administrative block — the widest gesture. */
function collectorWings(
  cells: AnchorageCell[],
  frame: AnchorageFrame,
  seed: number,
  boxes: ExteriorBox[]
): void {
  const block = cells.find(cell => cell.kind === 'floor');
  if (!block) return;
  const mid = toStationLocal(frame, [
    (block.min[0] + block.max[0]) / 2,
    block.max[1],
    0
  ]);
  const half = (block.max[2] - block.min[2]) / 2;

  for (const side of [-1, 1] as const) {
    const cant = 0.34 + seededUnit(seed, 1001 + (side + 1)) * 0.3;
    const boom = half + 46;
    boxes.push({
      center: [mid[0], mid[1] + 26, side * (boom * 0.55)],
      size: [5, 4, boom],
      rotation: [side * cant * 0.5, 0, 0],
      tier: 'structure',
      tone: 2
    });
    boxes.push({
      center: [mid[0], mid[1] + 26 + side * 0 + 14, side * boom],
      size: [104, 1.6, 62],
      rotation: [side * cant, 0.1 * side, 0],
      tier: 'structure',
      tone: 5
    });
  }
}

/** Antenna masts with strobes at the tips. The station's highest points. */
function masts(
  cells: AnchorageCell[],
  frame: AnchorageFrame,
  seed: number,
  boxes: ExteriorBox[],
  lights: ExteriorLight[]
): void {
  const candidates = cells.filter(cell => cell.kind !== 'blank');
  for (const [index, cell] of candidates.entries()) {
    if (seededUnit(seed, 1101 + index * 17) < 0.45) continue;
    const height = 34 + seededUnit(seed, 1103 + index * 19) * 58;
    const base = toStationLocal(frame, [
      cell.min[0] + (cell.max[0] - cell.min[0]) * (0.3 + seededUnit(seed, 1107 + index) * 0.4),
      cell.max[1] + OVERDECK,
      0
    ]);
    const lean = (seededUnit(seed, 1109 + index * 23) - 0.5) * 0.34;

    boxes.push({
      center: [base[0], base[1] + height / 2, 0],
      size: [1.8, height, 1.8],
      rotation: [lean, 0, lean * 0.6],
      tier: 'structure',
      tone: 2
    });
    // Cross spar, so the mast is an aerial and not a stick.
    boxes.push({
      center: [base[0], base[1] + height * 0.78, 0],
      size: [2, 1.4, 18],
      rotation: [lean, 0, 0],
      tier: 'structure',
      tone: 2
    });
    lights.push({
      center: [base[0] + Math.sin(lean) * height * 0.5, base[1] + height + 1.5, 0],
      size: [2.4, 2.4, 2.4],
      tone: EXTERIOR_LIGHT_TONE.strobe,
      blink: 2.6,
      phase: seededUnit(seed, 1113 + index * 29) * 2.6,
      duty: 0.13
    });
  }
}

/**
 * The dock: a mouth you can actually fly into, with guide arms running back out
 * along the approach corridor.
 *
 * The arms are the reason this reads as a berth rather than as a hole. They give
 * the approach a foreshortening cue, which is the only depth information a pilot
 * gets when closing on a large object against a black sky.
 */
function berthStructure(
  cells: AnchorageCell[],
  frame: AnchorageFrame,
  boxes: ExteriorBox[],
  lights: ExteriorLight[]
): Vec3Tuple {
  const apron = cells.find(cell => cell.kind === 'apron') ?? cells[0];
  if (!apron) return [0, 0, 0];

  const mouth = toStationLocal(frame, [apron.min[0], (apron.min[1] + apron.max[1]) / 2, 0]);
  const halfWidth = (apron.max[2] - apron.min[2]) / 2 + HULL_MARGIN;
  const halfHeight = (apron.max[1] - apron.min[1]) / 2 + HULL_MARGIN;

  // Frame around the opening, in four pieces so the middle stays open.
  const jamb = 7;
  for (const side of [-1, 1] as const) {
    boxes.push({
      center: [mouth[0] - 3, mouth[1], mouth[2] + side * (halfWidth + jamb / 2)],
      size: [14, halfHeight * 2 + jamb * 2, jamb],
      tier: 'mass',
      tone: 1
    });
    boxes.push({
      center: [mouth[0] - 3, mouth[1] + side * (halfHeight + jamb / 2), mouth[2]],
      size: [14, jamb, halfWidth * 2 + jamb * 2],
      tier: 'mass',
      tone: 1
    });
  }

  // Guide arms, splayed outward down the corridor.
  const ARMS = 4;
  for (let i = 0; i < ARMS; i++) {
    const angle = (Math.PI * 2 * i) / ARMS + Math.PI / 4;
    const dy = Math.sin(angle);
    const dz = Math.cos(angle);
    const reach = 132;
    boxes.push({
      center: [
        mouth[0] - reach / 2 - 6,
        mouth[1] + dy * (halfHeight + 16),
        mouth[2] + dz * (halfWidth + 16)
      ],
      size: [reach, 3.4, 3.4],
      rotation: [0, dy * 0.09, dz * 0.09],
      tier: 'structure',
      tone: 2
    });

    // Sequenced approach lights running back toward the mouth. Nav convention:
    // port red, starboard green, so a pilot can see which way up they are.
    const lamps = 7;
    for (let l = 0; l < lamps; l++) {
      const t = l / (lamps - 1);
      lights.push({
        center: [
          mouth[0] - 6 - reach * (1 - t),
          mouth[1] + dy * (halfHeight + 16),
          mouth[2] + dz * (halfWidth + 16)
        ],
        size: [2.6, 2.6, 2.6],
        tone: dz > 0 ? EXTERIOR_LIGHT_TONE.navGreen : EXTERIOR_LIGHT_TONE.navRed,
        blink: 1.5,
        // Phase runs with distance, so the lights chase inward toward the mouth.
        phase: (1 - t) * 1.5,
        duty: 0.3
      });
    }
  }

  /*
    The mouth itself.

    Sat flush *outside* the hull face rather than a couple of units inside it. Two
    units in is two units behind a solid box, so the one thing the whole approach is
    aimed at was invisible from every angle a pilot ever sees it from. A station's
    dock is the brightest thing on it — it is a lit hangar seen through a hole — and
    at three hundred metres this rectangle is the shot.
  */
  lights.push({
    center: [mouth[0] - 0.8, mouth[1], mouth[2]],
    size: [1.2, halfHeight * 1.55, halfWidth * 1.55],
    tone: EXTERIOR_LIGHT_TONE.dockWhite
  });
  // A recessed inner glow just behind it, so the opening has depth rather than
  // reading as a decal painted on the end of the station.
  lights.push({
    center: [mouth[0] - 2.6, mouth[1], mouth[2]],
    size: [0.8, halfHeight * 1.1, halfWidth * 1.1],
    tone: EXTERIOR_LIGHT_TONE.marketWarm
  });

  // Threshold strips down the jambs, like the edge lighting on a runway. They give
  // the opening a hard rectangular edge that survives at any range and any exposure.
  const STRIP_COUNT = 9;
  for (let i = 0; i < STRIP_COUNT; i++) {
    const t = (i + 0.5) / STRIP_COUNT - 0.5;
    for (const side of [-1, 1] as const) {
      lights.push({
        center: [mouth[0] - 3.4, mouth[1] + t * halfHeight * 2, mouth[2] + side * (halfWidth + 1)],
        size: [1.4, 2.2, 1.4],
        tone: EXTERIOR_LIGHT_TONE.dockWhite
      });
      lights.push({
        center: [mouth[0] - 3.4, mouth[1] + side * (halfHeight + 1), mouth[2] + t * halfWidth * 2],
        size: [1.4, 1.4, 2.6],
        tone: EXTERIOR_LIGHT_TONE.dockWhite
      });
    }
  }

  return mouth;
}

/** Port and starboard running lights at the station's widest points. */
function navLights(cells: AnchorageCell[], frame: AnchorageFrame, lights: ExteriorLight[]): void {
  for (const cell of cells) {
    if (cell.kind === 'blank') continue;
    const half = (cell.max[2] - cell.min[2]) / 2 + HULL_MARGIN;
    if (half < 20) continue;
    const mid = toStationLocal(frame, [
      (cell.min[0] + cell.max[0]) / 2,
      (cell.min[1] + cell.max[1]) / 2,
      0
    ]);
    for (const side of [-1, 1] as const) {
      lights.push({
        center: [mid[0], mid[1], side * (half + 3)],
        size: [3.4, 3.4, 3.4],
        tone: side > 0 ? EXTERIOR_LIGHT_TONE.navGreen : EXTERIOR_LIGHT_TONE.navRed,
        blink: 3.4,
        phase: 0,
        duty: 0.22
      });
    }
  }
}

/** Hull palette index for a district. Structural, not decorative. */
function hullToneFor(kind: AnchorageCellKind): number {
  switch (kind) {
    case 'apron':
      return 1;
    case 'concourse':
      return 0;
    case 'floor':
      return 0;
    case 'shelves':
      return 3;
    case 'blank':
      // The sealed mass is a different, darker material. It does not match, and
      // that is the point of it.
      return 6;
    default:
      return 2;
  }
}
