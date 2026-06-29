import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import {
  createVoxelMaterial,
  updateVoxelMaterial,
  applyTerrainProfileToMaterial,
  applyVoxelWindProfileToMaterial
} from '../utils/voxelMaterial';
import { buildTerrainProfile } from '../utils/terrainProfile';
import { buildWindProfile } from '../utils/windProfile';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { getWorldTerrainData } from '../utils/worldGenCache';
import { restoreVoxelEditsForWorld, saveVoxelEdits } from '../game/systems/persistence';
import type { WorldIdentity } from '../game/worldIdentity.ts';
import {
  applyPendingReplicatedTerrainDiff,
  clearActiveReplicatedTerrainWorld,
  setActiveReplicatedTerrainWorld
} from '../game/multiplayerReplication.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import { markTerrainPopulated, resetSceneReady } from '../state/appState';
import { FACE_NORMALS } from '../utils/surfaceControls';
import {
  COLLIDER_HALF_EXTENT,
  COLLISION_MIN_DISTANCE_FROM_PLAYER,
  COLLISION_STREAM_RANGE,
  voxelCoordToWorld
} from '../utils/cubeGravityConstants';
import { getMoonDirection, getSunDirection } from './SkyController';

export const efficientPlanetMesh = { current: null as THREE.InstancedMesh | null };

const voxelMaterial = createVoxelMaterial();

export interface PlanetStats {
  worldId: number;
  exposedVoxels: number;
  activeColliders: number;
  pendingColliders: number;
  activeSlots: number;
}

interface EfficientPlanetProps {
  size: number;
  playerPosition?: THREE.Vector3;
  surfaceUp?: THREE.Vector3;
  terrainSeed?: number;
  persistenceWorld?: WorldIdentity;
  debugColliders?: boolean;
  onStatsChange?: (stats: PlanetStats) => void;
}

interface CollisionBody {
  x: number;
  y: number;
  z: number;
  key: string;
  worldId: number;
}

interface PendingCollisionBody {
  x: number;
  y: number;
  z: number;
  worldId: number;
}

function coordKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function VoxelCollisionBody({
  x,
  y,
  z,
  debug,
  onRef
}: {
  x: number;
  y: number;
  z: number;
  debug: boolean;
  onRef: (ref: { setEnabled?: (enabled: boolean) => void } | null) => void;
}) {
  const ref = useRef<RapierRigidBody | null>(null);
  const voxelData = voxelSystem.getVoxel(x, y, z);

  useEffect(() => {
    if (!voxelData) return undefined;
    onRef(ref.current);
    return () => onRef(null);
  }, [onRef, voxelData]);

  if (!voxelData) return null;

  const position = voxelCoordToWorld(x, y, z);

  return (
    <RigidBody ref={ref} type="fixed" position={[position.x, position.y, position.z]} colliders={false}>
      <CuboidCollider args={[COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT]} />
      <mesh visible={debug}>
        <boxGeometry args={[1.98, 1.98, 1.98]} />
        <meshBasicMaterial color={voxelData.color} transparent opacity={0.28} />
      </mesh>
    </RigidBody>
  );
}

export default function EfficientPlanet({
  size,
  playerPosition,
  surfaceUp,
  terrainSeed = 12345,
  persistenceWorld,
  debugColliders = false,
  onStatsChange
}: EfficientPlanetProps) {
  const worldPersistenceRef = persistenceWorld ?? terrainSeed;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rigidBodyRefs = useRef<Map<string, { setEnabled?: (enabled: boolean) => void }>>(new Map());
  const pendingCollisionBodies = useRef<Map<string, PendingCollisionBody>>(new Map());
  const batchTimeout = useRef<number | null>(null);
  const lastUpdatePosition = useRef<THREE.Vector3 | null>(null);
  const latestPlayerPosition = useRef<THREE.Vector3 | undefined>(playerPosition);
  const latestSurfaceUp = useRef<THREE.Vector3>(surfaceUp?.clone() ?? FACE_NORMALS.top.clone());
  const lastSurfaceUpKey = useRef('');

  const [collisionBodies, setCollisionBodies] = useState<CollisionBody[]>([]);

  // Per-planet biome tint for the organic ground, derived from the shared biome.
  // Applied to the shared voxel material's uniforms once the shader has compiled
  // and re-applied when the planet seed changes (the material is a singleton, so
  // we drive uniforms rather than rebuild it).
  const terrainProfile = useMemo(() => buildTerrainProfile(terrainSeed), [terrainSeed]);
  const windProfile = useMemo(() => buildWindProfile(terrainSeed), [terrainSeed]);
  const terrainTintAppliedRef = useRef(false);
  useEffect(() => {
    terrainTintAppliedRef.current = false;
  }, [terrainProfile, windProfile]);

  useFrame(({ clock }) => {
    if (!terrainTintAppliedRef.current && voxelMaterial.userData.shader) {
      applyTerrainProfileToMaterial(terrainProfile, voxelMaterial);
      applyVoxelWindProfileToMaterial(windProfile, voxelMaterial);
      terrainTintAppliedRef.current = true;
    }
    updateVoxelMaterial(voxelMaterial, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects(), getSunDirection(), getMoonDirection());
  });

  useEffect(() => {
    latestPlayerPosition.current = playerPosition;
  }, [playerPosition]);

  useEffect(() => {
    latestSurfaceUp.current.copy(surfaceUp ?? FACE_NORMALS.top);
  }, [surfaceUp]);

  const { originalTerrain, originalTerrainByCoord, initialVoxels, initialTerrainMeshData } = useMemo(
    () => getWorldTerrainData(size, terrainSeed),
    [size, terrainSeed]
  );

  const dynamicBufferSize = useMemo(() => {
    return Math.max(originalTerrain.length, initialVoxels.length, 5000);
  }, [initialVoxels.length, originalTerrain.length]);

  const isWithinCollisionRange = useCallback((x: number, y: number, z: number) => {
    const position = latestPlayerPosition.current;
    if (!position) return true;

    const voxelWorld = voxelCoordToWorld(x, y, z);
    const offset = voxelWorld.sub(position);
    const distanceSq = offset.lengthSq();
    if (distanceSq > COLLISION_STREAM_RANGE * COLLISION_STREAM_RANGE) return false;

    const distance = Math.sqrt(distanceSq);
    if (distance >= COLLISION_MIN_DISTANCE_FROM_PLAYER) return true;

    const gravityDirection = latestSurfaceUp.current.clone().multiplyScalar(-1);
    const supportDistance = offset.dot(gravityDirection);
    return supportDistance > 0.4 && supportDistance < 5;
  }, []);

  const removeCollisionBody = useCallback((x: number, y: number, z: number, worldId: number) => {
    const key = coordKey(x, y, z);
    const pending = pendingCollisionBodies.current.get(key);
    if (pending?.worldId === worldId) {
      pendingCollisionBodies.current.delete(key);
    }

    const rigidBodyRef = rigidBodyRefs.current.get(key);
    try {
      rigidBodyRef?.setEnabled?.(false);
    } catch (error) {
      console.warn(`Failed to disable collision body ${key}:`, error);
    }
    rigidBodyRefs.current.delete(key);

    setCollisionBodies(prev => prev.filter(body => !(body.worldId === worldId && body.x === x && body.y === y && body.z === z)));
  }, []);

  const flushPendingCollisionBodies = useCallback(() => {
    const pending = Array.from(pendingCollisionBodies.current.values());
    pendingCollisionBodies.current.clear();

    setCollisionBodies(prev => {
      const activeWorldId = voxelSystem.getWorldId();
      const existing = new Set(prev.map(body => `${body.worldId}:${coordKey(body.x, body.y, body.z)}`));
      const next = [...prev];

      for (const body of pending) {
        const key = coordKey(body.x, body.y, body.z);
        const identity = `${body.worldId}:${key}`;
        const voxelData = voxelSystem.getVoxel(body.x, body.y, body.z);

        if (body.worldId !== activeWorldId || existing.has(identity) || !voxelData || voxelData.worldId !== body.worldId) {
          continue;
        }

        if (!isWithinCollisionRange(body.x, body.y, body.z)) {
          continue;
        }

        next.push({
          ...body,
          key: `collision-${body.worldId}-${body.x}-${body.y}-${body.z}`
        });
        existing.add(identity);
      }

      return next;
    });
  }, [isWithinCollisionRange]);

  const requestCollisionBody = useCallback((x: number, y: number, z: number, worldId: number) => {
    if (worldId !== voxelSystem.getWorldId()) return;
    if (!voxelSystem.hasVoxel(x, y, z)) return;
    if (!isWithinCollisionRange(x, y, z)) return;

    const key = coordKey(x, y, z);
    pendingCollisionBodies.current.set(key, { x, y, z, worldId });

    if (batchTimeout.current !== null) {
      window.clearTimeout(batchTimeout.current);
    }

    batchTimeout.current = window.setTimeout(flushPendingCollisionBodies, 10);
  }, [flushPendingCollisionBodies, isWithinCollisionRange]);

  const queueInitialCollisionBodies = useCallback(() => {
    const activeWorldId = voxelSystem.getWorldId();
    let queued = 0;

    for (const [key, voxelData] of voxelSystem.getAllVoxels()) {
      if (voxelData.worldId !== activeWorldId) continue;
      const [x, y, z] = voxelData.position;
      if (!isWithinCollisionRange(x, y, z)) continue;

      pendingCollisionBodies.current.set(key, { x, y, z, worldId: activeWorldId });
      queued++;
    }

    return queued;
  }, [isWithinCollisionRange]);

  useEffect(() => {
    if (!meshRef.current) return undefined;

    const activeMesh = meshRef.current;

    if (batchTimeout.current !== null) {
      window.clearTimeout(batchTimeout.current);
      batchTimeout.current = null;
    }

    pendingCollisionBodies.current.clear();
    rigidBodyRefs.current.clear();
    setCollisionBodies([]);

    measureWarpMetric(
      'planet:voxel_system_populate',
      () => {
        voxelSystem.reset();
        voxelSystem.expandCapacity(dynamicBufferSize);
        voxelSystem.setMesh(activeMesh);
        voxelSystem.setCollisionCallbacks({ request: requestCollisionBody, remove: removeCollisionBody });
        efficientPlanetMesh.current = activeMesh;

        const added = voxelSystem.populateInitialTerrain(
          originalTerrain,
          initialVoxels,
          {
            initialTerrainMeshData,
            originalTerrainByCoord,
            requestCollisions: false
          }
        );
        if (persistenceWorld) setActiveReplicatedTerrainWorld(persistenceWorld.worldId);
        // Replay this world's saved terrain edits (digging) onto the freshly
        // generated shell, BEFORE colliders are queued — so removed voxels get no
        // collider and revealed interiors do. Refused if the gen fingerprint differs.
        restoreVoxelEditsForWorld(worldPersistenceRef);
        const replicatedTerrain = persistenceWorld
          ? applyPendingReplicatedTerrainDiff(persistenceWorld.worldId)
          : { applied: 0, queued: 0 };
        const queuedColliders = queueInitialCollisionBodies();
        flushPendingCollisionBodies();
        return { added, queuedColliders, replicatedTerrain };
      },
      result => ({
        buffer: dynamicBufferSize,
        original: originalTerrain.length,
        exposed: initialVoxels.length,
        added: result.added,
        queuedColliders: result.queuedColliders,
        replicatedTerrainApplied: result.replicatedTerrain.applied,
        replicatedTerrainQueued: result.replicatedTerrain.queued
      })
    );
    // The voxel mesh now has instances (count > 0); tell the app shell so the
    // loading gate / Play button can reveal once a few frames have also painted.
    markTerrainPopulated();
    return () => {
      if (batchTimeout.current !== null) {
        window.clearTimeout(batchTimeout.current);
        batchTimeout.current = null;
      }
      pendingCollisionBodies.current.clear();
      rigidBodyRefs.current.clear();
      voxelSystem.clearCollisionCallbacks();
      voxelSystem.clearMesh(activeMesh);
      if (efficientPlanetMesh.current === activeMesh) {
        efficientPlanetMesh.current = null;
      }
      // Persist this world's dig BEFORE reset() clears deletedTerrain (App-level
      // autosave cleanup races this child cleanup, so save here where ordering holds).
      saveVoxelEdits(worldPersistenceRef);
      if (persistenceWorld) clearActiveReplicatedTerrainWorld(persistenceWorld.worldId);
      voxelSystem.reset();
      // World swap / unmount: the next world must re-prove readiness.
      resetSceneReady();
    };
  }, [
    dynamicBufferSize,
    flushPendingCollisionBodies,
    initialVoxels,
    initialTerrainMeshData,
    originalTerrain,
    originalTerrainByCoord,
    persistenceWorld,
    queueInitialCollisionBodies,
    removeCollisionBody,
    requestCollisionBody,
    terrainSeed,
    worldPersistenceRef
  ]);

  const syncCollisionBodies = useCallback(() => {
    const activeWorldId = voxelSystem.getWorldId();
    const allVoxels = voxelSystem.getAllVoxels();
    const shouldHaveCollision = new Set<string>();

    for (const [key, voxelData] of allVoxels) {
      const [x, y, z] = key.split(',').map(Number);
      if (voxelData.worldId === activeWorldId && isWithinCollisionRange(x, y, z)) {
        shouldHaveCollision.add(key);
      }
    }

    setCollisionBodies(prev => {
      const next = prev.filter(body => {
        const keep = body.worldId === activeWorldId && shouldHaveCollision.has(coordKey(body.x, body.y, body.z));
        if (!keep) {
          rigidBodyRefs.current.delete(coordKey(body.x, body.y, body.z));
        }
        return keep;
      });

      const existing = new Set(next.map(body => coordKey(body.x, body.y, body.z)));
      for (const key of shouldHaveCollision) {
        if (existing.has(key)) continue;
        const [x, y, z] = key.split(',').map(Number);
        next.push({ x, y, z, worldId: activeWorldId, key: `collision-${activeWorldId}-${x}-${y}-${z}` });
      }

      return next;
    });

  }, [isWithinCollisionRange]);

  useEffect(() => {
    if (!onStatsChange) return;
    const stats = voxelSystem.getStats();
    onStatsChange({
      worldId: stats.worldId,
      exposedVoxels: stats.exposedVoxels,
      activeSlots: stats.activeSlots,
      activeColliders: collisionBodies.length,
      pendingColliders: pendingCollisionBodies.current.size
    });
  }, [collisionBodies.length, onStatsChange]);

  useEffect(() => {
    if (!playerPosition) return;

    const surfaceKey = `${latestSurfaceUp.current.x.toFixed(3)},${latestSurfaceUp.current.y.toFixed(3)},${latestSurfaceUp.current.z.toFixed(3)}`;
    const surfaceChanged = surfaceKey !== lastSurfaceUpKey.current;
    const hasMovedSignificantly = !lastUpdatePosition.current || lastUpdatePosition.current.distanceTo(playerPosition) > 1;
    if (!hasMovedSignificantly && !surfaceChanged) return;

    lastUpdatePosition.current = playerPosition.clone();
    lastSurfaceUpKey.current = surfaceKey;
    syncCollisionBodies();
  }, [playerPosition, surfaceUp, syncCollisionBodies]);

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, dynamicBufferSize]} count={0} frustumCulled={false}>
        {/* Full cell size (2.0) so adjacent voxels meet edge-to-edge — the old
            1.98 left a 0.02-unit seam you could see through. Interior faces sit
            between two solids (never visible) so no z-fighting is introduced. */}
        <boxGeometry args={[2, 2, 2]} />
        <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>

      {collisionBodies.map(body => (
        <VoxelCollisionBody
          key={body.key}
          x={body.x}
          y={body.y}
          z={body.z}
          debug={debugColliders}
          onRef={ref => {
            const key = coordKey(body.x, body.y, body.z);
            if (ref) {
              rigidBodyRefs.current.set(key, ref);
              const voxelData = voxelSystem.getVoxel(body.x, body.y, body.z);
              if (voxelData && voxelData.worldId === body.worldId) {
                voxelData.rigidBodyRef = ref;
              }
            } else {
              rigidBodyRefs.current.delete(key);
              const voxelData = voxelSystem.getVoxel(body.x, body.y, body.z);
              if (voxelData) {
                voxelData.rigidBodyRef = undefined;
              }
            }
          }}
        />
      ))}
    </>
  );
}
