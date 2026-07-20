// --- Build pieces (shelter structure parts) ----------------------------------
//
// Definitions are generated from the shared economy catalog; this module keeps
// the established client API and strongly typed placement vocabulary.

import { ECONOMY_CATALOG } from './generatedEconomyCatalog.ts';

export type BuildPieceType = (typeof ECONOMY_CATALOG.buildPieces)[number]['type'];
export type BuildShape = 'panel' | 'volume';
export type BuildFamily = 'foundation' | 'wall' | 'ceiling' | 'volume';

export interface BuildPieceDef {
  type: BuildPieceType;
  name: string;
  shape: BuildShape;
  /** Placement family — wall variants snap like a wall. */
  family: BuildFamily;
  /** Number of build-grid cells occupied along the stored build-up axis. */
  heightUnits?: 1 | 2;
  /** Abstract build cost; material x costUnits = resource quantity. */
  costUnits: number;
  hp: number;
  /** Hazard insulation 0..1 (designed hook for the survival layer). */
  insulation: number;
  /** Does it seal its primary face for enclosure detection? */
  seals: boolean;
  passable?: boolean;
  climb?: boolean;
  openable?: boolean;
}

export const BUILD_PIECES = Object.fromEntries(
  ECONOMY_CATALOG.buildPieces.map(piece => [piece.type, { ...piece } as BuildPieceDef])
) as Record<BuildPieceType, BuildPieceDef>;

export const BUILD_PIECE_ORDER: BuildPieceType[] = ECONOMY_CATALOG.buildPieces.map(piece => piece.type);

export function getBuildPiece(type: BuildPieceType): BuildPieceDef {
  return BUILD_PIECES[type];
}
