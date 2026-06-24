// --- Build pieces (shelter structure parts) ----------------------------------
//
// A piece is a SHAPE + placement family; it is material-AGNOSTIC (cost/colour/stats
// come from buildMaterials.ts). Pieces are either a `panel` (thin, on one of a
// cell's 6 faces) or a `volume` (fills the cell with an orientation — stairs,
// sloped roofs; added in Part 2). `family` drives placement+snapping; `seals` is the
// enclosure-flood-fill hook (S3). `costUnits` is abstract — the material turns it
// into a real resource quantity.

export type BuildPieceType =
  | 'foundation' | 'wall' | 'ceiling'   // structural (S1)
  | 'doorway' | 'window' | 'gable';     // panel variants (Part 1)
  // | 'stairs' | 'sloped_roof'         // volume (Part 2)

export type BuildShape = 'panel' | 'volume';
export type BuildFamily = 'foundation' | 'wall' | 'ceiling';

export interface BuildPieceDef {
  type: BuildPieceType;
  name: string;
  shape: BuildShape;
  /** Placement family — wall variants (wall/doorway/window/gable) snap like a wall. */
  family: BuildFamily;
  /** Abstract build cost; material × costUnits = resource quantity. */
  costUnits: number;
  hp: number;
  /** Hazard insulation 0..1 (designed hook for the survival layer). */
  insulation: number;
  /** Does it seal its primary face for enclosure detection (S3)? */
  seals: boolean;
}

export const BUILD_PIECES: Record<BuildPieceType, BuildPieceDef> = {
  foundation: { type: 'foundation', name: 'Foundation', shape: 'panel', family: 'foundation', costUnits: 4, hp: 240, insulation: 0.35, seals: true },
  wall:       { type: 'wall',       name: 'Wall',       shape: 'panel', family: 'wall',       costUnits: 2, hp: 140, insulation: 0.5,  seals: true },
  ceiling:    { type: 'ceiling',    name: 'Ceiling',    shape: 'panel', family: 'ceiling',    costUnits: 3, hp: 140, insulation: 0.5,  seals: true },
  doorway:    { type: 'doorway',    name: 'Doorway',    shape: 'panel', family: 'wall',       costUnits: 2, hp: 130, insulation: 0.1,  seals: false },
  window:     { type: 'window',     name: 'Window',     shape: 'panel', family: 'wall',       costUnits: 2, hp: 130, insulation: 0.2,  seals: false },
  gable:      { type: 'gable',      name: 'Gable Wall', shape: 'panel', family: 'wall',       costUnits: 1, hp: 120, insulation: 0.5,  seals: true }
};

export const BUILD_PIECE_ORDER: BuildPieceType[] = ['foundation', 'wall', 'ceiling', 'doorway', 'window', 'gable'];

export function getBuildPiece(type: BuildPieceType): BuildPieceDef {
  return BUILD_PIECES[type];
}
