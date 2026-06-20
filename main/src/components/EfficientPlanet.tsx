import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { MATERIALS } from '../types/materials';
import { createVoxelMaterial, updateVoxelMaterial } from '../utils/voxelMaterial';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { ProceduralWorldGenerator } from '../utils/proceduralWorldGenerator';
import { createTerrainConfig } from '../utils/terrainConfig';
import { TerrainVoxel, voxelSystem } from '../utils/efficientVoxelSystem';
import { FACE_NORMALS } from '../utils/surfaceControls';
import {
  COLLIDER_HALF_EXTENT,
  COLLISION_MIN_DISTANCE_FROM_PLAYER,
  COLLISION_STREAM_RANGE,
  voxelCoordToWorld
} from '../utils/cubeGravityConstants';

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
  debugColliders = false,
  onStatsChange
}: EfficientPlanetProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rigidBodyRefs = useRef<Map<string, { setEnabled?: (enabled: boolean) => void }>>(new Map());
  const pendingCollisionBodies = useRef<Map<string, PendingCollisionBody>>(new Map());
  const batchTimeout = useRef<number | null>(null);
  const lastUpdatePosition = useRef<THREE.Vector3 | null>(null);
  const latestPlayerPosition = useRef<THREE.Vector3 | undefined>(playerPosition);
  const latestSurfaceUp = useRef<THREE.Vector3>(surfaceUp?.clone() ?? FACE_NORMALS.top.clone());
  const lastSurfaceUpKey = useRef('');

  const [collisionBodies, setCollisionBodies] = useState<CollisionBody[]>([]);

  useFrame(({ clock }) => {
    updateVoxelMaterial(voxelMaterial, clock.elapsedTime, getGraphicsQuality());
  });

  useEffect(() => {
    latestPlayerPosition.current = playerPosition;
  }, [playerPosition]);

  useEffect(() => {
    latestSurfaceUp.current.copy(surfaceUp ?? FACE_NORMALS.top);
  }, [surfaceUp]);

  const originalTerrain = useMemo<TerrainVoxel[]>(() => {
    const planetRadius = size / 2;
    const generator = new ProceduralWorldGenerator(
      {
        planetRadius,
        coreRadiusPercent: 0.15
      },
      createTerrainConfig(terrainSeed, planetRadius)
    );

    return generator.getAllVoxelPositions().map(position => {
      const material = generator.generateMaterialForPosition(position.x, position.y, position.z);
      return {
        ...position,
        material,
        color: MATERIALS[material].color.clone()
      };
    });
  }, [size, terrainSeed]);

  const initialVoxels = useMemo(() => {
    const terrainPositions = new Set(originalTerrain.map(voxel => coordKey(voxel.x, voxel.y, voxel.z)));
    return originalTerrain.filter(voxel => isVoxelExposedInTerrain(voxel.x, voxel.y, voxel.z, terrainPositions));
  }, [originalTerrain]);

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

    voxelSystem.reset();
    voxelSystem.expandCapacity(dynamicBufferSize);
    voxelSystem.setMesh(meshRef.current);
    voxelSystem.setCollisionCallbacks({ request: requestCollisionBody, remove: removeCollisionBody });
    voxelSystem.setOriginalTerrain(originalTerrain);
    efficientPlanetMesh.current = meshRef.current;

    for (const voxel of initialVoxels) {
      voxelSystem.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
    }

    flushPendingCollisionBodies();
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
      voxelSystem.reset();
    };
  }, [dynamicBufferSize, flushPendingCollisionBodies, initialVoxels, originalTerrain, removeCollisionBody, requestCollisionBody]);

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
        <boxGeometry args={[1.98, 1.98, 1.98]} />
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

function isVoxelExposedInTerrain(x: number, y: number, z: number, terrainPositions: Set<string>) {
  const neighbors = [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1]
  ];

  return neighbors.some(([nx, ny, nz]) => !terrainPositions.has(coordKey(nx, ny, nz)));
}
