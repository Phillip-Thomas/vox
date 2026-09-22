import * as THREE from 'three';
import type { TreePickTarget } from '../../components/TreeField.tsx';
import { dominantFaceForPosition, FACE_NORMALS } from '../../utils/surfaceControls.ts';
import { voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';
import { planAgentSurfaceRoute } from '../../utils/agentSurfaceNavigation.ts';
import type { SpawnTerrainQuery } from '../../utils/spawnValidation.ts';
import { interactionApproachGoal } from './interactionApproach.ts';

export interface ConstructionTreePlan {
  coord: readonly [number, number, number];
  root: THREE.Vector3;
  aim: THREE.Vector3;
  approach: THREE.Vector3;
}

const trunkAimCache = new WeakMap<THREE.BufferGeometry, THREE.Vector3>();

/** Centre a real low trunk ring; generated stems may bend away from local Y. */
function lowerTrunkAim(geometry: THREE.BufferGeometry): THREE.Vector3 {
  const cached = trunkAimCache.get(geometry);
  if (cached) return cached;
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let aim = new THREE.Vector3(0, 1.1, 0);
  let best = Infinity;
  if (positions && uv) {
    for (let start = 0; start < positions.count; start++) {
      if (Math.abs(uv.getX(start)) > 1e-5) continue;
      const center = new THREE.Vector3();
      let count = 0;
      for (let i = start; i < positions.count; i++) {
        if (i > start && Math.abs(uv.getX(i)) < 1e-5) break;
        if (uv.getX(i) >= .99999) break; // duplicate seam vertex
        center.add(new THREE.Vector3().fromBufferAttribute(positions, i));
        count++;
      }
      if (count < 3) continue;
      center.divideScalar(count);
      if (center.y < .35 || center.y > 3) continue;
      const cost = Math.abs(center.y - 1.1) + Math.hypot(center.x, center.z) * .5;
      if (cost < best) { best = cost; aim = center; }
    }
  }
  trunkAimCache.set(geometry, aim);
  return aim;
}

/** A real tree and dry local return route, chosen around the site being built. */
export function planConstructionTree(
  targets: readonly TreePickTarget[],
  player: THREE.Vector3,
  home: THREE.Vector3,
  terrain: SpawnTerrainQuery,
  planetSize: number,
  harvested: (x: number, y: number, z: number) => boolean
): ConstructionTreePlan | null {
  const face = dominantFaceForPosition(home);
  const up = FACE_NORMALS[face];
  const seen = new Set<string>();
  const candidates: Array<{ coord: [number, number, number]; root: THREE.Vector3; aim: THREE.Vector3; cost: number }> = [];
  for (const { mesh, slotVoxel } of targets) {
    for (const [slot, coord] of slotVoxel.entries()) {
      const key = coord.join(',');
      if (seen.has(key) || harvested(...coord)) continue;
      seen.add(key); // TreeField publishes trunk before leaves for each variant.
      const root = voxelCoordToWorld(...coord);
      if (dominantFaceForPosition(root) !== face || root.distanceTo(home) > 40) continue;
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(slot, matrix);
      // Read the rendered trunk's own transform (including tilt/scale), above
      // ground flora. The old root+up1.2 target often selected stone or flowers.
      const aim = lowerTrunkAim(mesh.geometry).clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
      candidates.push({ coord: [...coord], root, aim,
        cost: player.distanceTo(root) + root.distanceTo(home) });
    }
  }
  candidates.sort((a, b) => a.cost - b.cost);
  const navigationTerrain = {
    isSolidVoxel: terrain.shouldVoxelExist,
    isWaterVoxel: terrain.isWaterVoxel,
    isHazardousVoxel: (x: number, y: number, z: number) => terrain.generateBlockForPosition(x, y, z) === 'lava'
  };
  for (const candidate of candidates.slice(0, 12)) {
    const approach = interactionApproachGoal(player, candidate.root, up, 5.5, terrain, planetSize);
    if (!approach) continue;
    const options = { face, allowJetpackCrossing: false, maxVisitedCells: 800 } as const;
    const outward = planAgentSurfaceRoute(navigationTerrain, planetSize, player, approach, options);
    if (outward.mode !== 'walk') continue;
    const returning = planAgentSurfaceRoute(navigationTerrain, planetSize, approach, home, options);
    if (returning.mode !== 'walk') continue;
    return { ...candidate, approach };
  }
  return null;
}
