import * as THREE from 'three';
import { findValidSpawnSite, type SpawnTerrainQuery } from '../../utils/spawnValidation.ts';
import { dominantFaceForPosition } from '../../utils/surfaceControls.ts';

/** Plan to dry ground within the player's interaction radius, not inside a prop. */
export function interactionApproachGoal(
  player: THREE.Vector3,
  subject: THREE.Vector3,
  up: THREE.Vector3,
  radius: number,
  terrain: SpawnTerrainQuery,
  planetSize: number
): THREE.Vector3 | null {
  const tangent = player.clone().sub(subject);
  tangent.addScaledVector(up, -tangent.dot(up));
  if (tangent.lengthSq() < 1e-6) tangent.set(Math.abs(up.x) < 0.9 ? 1 : 0, Math.abs(up.x) < 0.9 ? 0 : 1, 0);
  tangent.normalize();
  let best: THREE.Vector3 | null = null;
  let bestDistance = Infinity;
  for (let step = 0; step < 8; step++) {
    const angle = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * Math.PI / 4;
    const preferred = tangent.clone().applyAxisAngle(up, angle).multiplyScalar(radius * 0.7).add(subject);
    const site = findValidSpawnSite(terrain, planetSize, preferred, {
      kind: 'player', face: dominantFaceForPosition(subject), maxSearchRadius: 3
    });
    if (!site || site.position.distanceTo(subject) >= radius - 0.5) continue;
    const distance = site.position.distanceToSquared(player);
    if (distance < bestDistance) { best = site.position; bestDistance = distance; }
  }
  return best;
}
