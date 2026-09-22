import * as THREE from 'three';
import { FACE_DIRS, oppositeFace } from '../game/systems/structureSystem.ts';
import type { BuildPieceType } from '../game/data/buildPieces.ts';
import { VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';

export type ShelterCell = [number, number, number];
export interface ShelterPanel { cell: ShelterCell; face: number; type: BuildPieceType }

/** A two-cell floor gives the body room to see the grounded Core across the room. */
export function movieShelterLayout(core: ShelterCell, upFace: number, extensionFace: number) {
  const up = FACE_DIRS[upFace], extension = FACE_DIRS[extensionFace];
  const annex: ShelterCell = core.map((value, i) => value + extension[i]) as ShelterCell;
  const floors = [core, annex];
  const panels: ShelterPanel[] = [];
  for (const [index, lower] of floors.entries()) {
    const upper = lower.map((value, i) => value + up[i]) as ShelterCell;
    panels.push({ cell: lower, face: oppositeFace(upFace), type: 'foundation' });
    panels.push({ cell: upper, face: upFace, type: 'ceiling' });
    for (const face of [0, 1, 2, 3, 4, 5]) {
      if (face === upFace || face === oppositeFace(upFace)) continue;
      if (face === (index === 0 ? extensionFace : oppositeFace(extensionFace))) continue;
      if (index === 1 && face === extensionFace) {
        panels.push({ cell: lower, face, type: 'doorway' });
      } else {
        panels.push({ cell: lower, face, type: 'wall' }, { cell: upper, face, type: 'wall' });
      }
    }
  }
  return { panels, annex, door: { cell: annex, face: extensionFace } };
}

/** Stored core.position is a capsule approach; its rendered device stands on the floor. */
export function habitatCoreGroundPosition(cell: readonly number[], up: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(cell[0] * VOXEL_SCALE, cell[1] * VOXEL_SCALE, cell[2] * VOXEL_SCALE)
    .addScaledVector(new THREE.Vector3(up[0], up[1], up[2]), -VOXEL_SCALE / 2 + 0.08);
}
