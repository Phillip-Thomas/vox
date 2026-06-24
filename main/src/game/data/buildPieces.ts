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
  | 'doorway' | 'window' | 'gable'      // panel variants (Part 1)
  | 'stairs' | 'sloped_roof'            // volume, oriented (Part 2)
  | 'ladder' | 'door';                  // wall panels w/ behaviour (Part 3)

export type BuildShape = 'panel' | 'volume';
// 'volume' pieces fill a cell with an orientation (stairs/roof), placed like a
// foundation but oriented to the player's facing.
export type BuildFamily = 'foundation' | 'wall' | 'ceiling' | 'volume';

export interface BuildPieceDef {
  type: BuildPieceType;
  name: string;
  shape: BuildShape;
  /** Placement family — wall variants (wall/doorway/window/gable/ladder/door) snap like a wall. */
  family: BuildFamily;
  /** Abstract build cost; material × costUnits = resource quantity. */
  costUnits: number;
  hp: number;
  /** Hazard insulation 0..1 (designed hook for the survival layer). */
  insulation: number;
  /** Does it seal its primary face for enclosure detection (S3)? */
  seals: boolean;
  /** Walk/see-through (no solid collider): doorway, window, ladder, open door. */
  passable?: boolean;
  /** Climbable — drives the ladder climb controller. */
  climb?: boolean;
  /** Openable — toggles between solid+sealing (closed) and passable (open). */
  openable?: boolean;
}

export const BUILD_PIECES: Record<BuildPieceType, BuildPieceDef> = {
  foundation:  { type: 'foundation',  name: 'Foundation',  shape: 'panel',  family: 'foundation', costUnits: 4, hp: 240, insulation: 0.35, seals: true },
  wall:        { type: 'wall',        name: 'Wall',        shape: 'panel',  family: 'wall',       costUnits: 2, hp: 140, insulation: 0.5,  seals: true },
  ceiling:     { type: 'ceiling',     name: 'Ceiling',     shape: 'panel',  family: 'ceiling',    costUnits: 3, hp: 140, insulation: 0.5,  seals: true },
  doorway:     { type: 'doorway',     name: 'Doorway',     shape: 'panel',  family: 'wall',       costUnits: 2, hp: 130, insulation: 0.1,  seals: false, passable: true },
  window:      { type: 'window',      name: 'Window',      shape: 'panel',  family: 'wall',       costUnits: 2, hp: 130, insulation: 0.2,  seals: false, passable: true },
  gable:       { type: 'gable',       name: 'Gable Wall',  shape: 'panel',  family: 'wall',       costUnits: 1, hp: 120, insulation: 0.5,  seals: true },
  stairs:      { type: 'stairs',      name: 'Stairs',      shape: 'volume', family: 'volume',     costUnits: 4, hp: 160, insulation: 0.1,  seals: false },
  sloped_roof: { type: 'sloped_roof', name: 'Sloped Roof', shape: 'volume', family: 'volume',     costUnits: 3, hp: 150, insulation: 0.5,  seals: true },
  ladder:      { type: 'ladder',      name: 'Ladder',      shape: 'panel',  family: 'wall',       costUnits: 1, hp: 80,  insulation: 0,    seals: false, passable: true, climb: true },
  door:        { type: 'door',        name: 'Door',        shape: 'panel',  family: 'wall',       costUnits: 2, hp: 130, insulation: 0.5,  seals: true,  openable: true }
};

export const BUILD_PIECE_ORDER: BuildPieceType[] = [
  'foundation', 'wall', 'ceiling', 'doorway', 'window', 'gable', 'stairs', 'sloped_roof', 'ladder', 'door'
];

export function getBuildPiece(type: BuildPieceType): BuildPieceDef {
  return BUILD_PIECES[type];
}
