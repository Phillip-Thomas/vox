import * as THREE from 'three';
import {
  findValidSpawnSite,
  isDryClearResumePosition,
  type SpawnTerrainQuery
} from '../utils/spawnValidation.ts';
import type { PondPose } from './world/storyWorld.ts';

export const AUTHORED_DIVE_RELOAD_OXYGEN = 100 as const;

export interface AuthoredDiveReloadRecoveryPlan {
  /** Validated dry capsule position selected beside the pond or at arrival. */
  position: THREE.Vector3;
  /** Natural first look back into the medium the player was just recovered from. */
  lookDirection: THREE.Vector3;
  pitch: 0;
  oxygen: typeof AUTHORED_DIVE_RELOAD_OXYGEN;
  /** Explicit so recovery can never be mistaken for embodied wet-to-dry motion. */
  invalidateMotionContinuity: true;
  source: 'pond-shore' | 'arrival-fallback';
  shoreDistance: number | null;
}

export interface AuthoredDiveReloadRecoveryEffects {
  invalidateMotionContinuity(): void;
  setLook(direction: THREE.Vector3, pitch: number): void;
  restoreOxygen(oxygen: number): void;
  setWorldPosition(position: THREE.Vector3): void;
}

/**
 * Resolve the deterministic Chapter 6 reload landing without reading or writing
 * runtime stores. A null result means the live terrain no longer contains a dry,
 * clear player capsule site near the authored pond and must not be used.
 */
export function resolveAuthoredDiveReloadRecovery(input: {
  terrain: SpawnTerrainQuery;
  planetSize: number;
  pond: Pick<PondPose, 'shore' | 'surface'> | null;
  /** Canonical arrival/egress request used only when the live pond shore is gone. */
  fallbackPosition: THREE.Vector3;
  fallbackLookDirection?: THREE.Vector3;
  maxSearchRadius?: number;
  fallbackSearchRadius?: number;
}): AuthoredDiveReloadRecoveryPlan | null {
  const shoreSite = input.pond
    ? findValidSpawnSite(
        input.terrain,
        input.planetSize,
        input.pond.shore,
        {
          kind: 'player',
          maxSearchRadius: input.maxSearchRadius ?? 8
        }
      )
    : null;
  const validShorePosition = shoreSite
    && isDryClearResumePosition(input.terrain, input.planetSize, shoreSite.position)
    ? shoreSite.position
    : null;

  let position = validShorePosition?.clone() ?? null;
  let source: AuthoredDiveReloadRecoveryPlan['source'] = 'pond-shore';
  if (!position) {
    source = 'arrival-fallback';
    if (isDryClearResumePosition(input.terrain, input.planetSize, input.fallbackPosition)) {
      position = input.fallbackPosition.clone();
    } else {
      const fallbackSite = findValidSpawnSite(
        input.terrain,
        input.planetSize,
        input.fallbackPosition,
        {
          kind: 'player',
          maxSearchRadius: input.fallbackSearchRadius ?? 12
        }
      );
      if (
        fallbackSite
        && isDryClearResumePosition(input.terrain, input.planetSize, fallbackSite.position)
      ) {
        position = fallbackSite.position.clone();
      }
    }
  }
  if (!position) return null;

  const lookDirection = input.pond
    ? input.pond.surface.clone().sub(position)
    : input.fallbackLookDirection?.clone() ?? new THREE.Vector3(0, 0, -1);
  if (lookDirection.lengthSq() <= 1e-8) {
    if (input.pond) lookDirection.copy(input.pond.surface).sub(input.pond.shore);
  }
  if (lookDirection.lengthSq() <= 1e-8) lookDirection.set(0, 0, -1);
  lookDirection.normalize();

  return {
    position,
    lookDirection,
    pitch: 0,
    oxygen: AUTHORED_DIVE_RELOAD_OXYGEN,
    invalidateMotionContinuity: true,
    source,
    shoreDistance: input.pond ? position.distanceTo(input.pond.shore) : null
  };
}

/**
 * Apply a validated plan in safety order: continuity is invalidated before the
 * dry position is published, so the next body sample initializes a new motion
 * sequence instead of forging an authored surfacing receipt.
 */
export function applyAuthoredDiveReloadRecovery(
  plan: AuthoredDiveReloadRecoveryPlan,
  effects: AuthoredDiveReloadRecoveryEffects
): THREE.Vector3 {
  effects.invalidateMotionContinuity();
  effects.setLook(plan.lookDirection.clone(), plan.pitch);
  effects.restoreOxygen(plan.oxygen);
  effects.setWorldPosition(plan.position.clone());
  return plan.position.clone();
}
