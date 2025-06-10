import React, { useMemo, useContext, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { useThree, useFrame } from '@react-three/fiber';
import { PlanetContext } from '../context/PlanetContext';
import { 
  createChunks, 
  isChunkVisible, 
  VoxelMap, 
  PerformanceMonitor,
  isVoxelOccluded,
  Chunk 
} from '../utils/voxelOptimizations';

const CUBE_SIZE_X = 50;
const CUBE_SIZE_Y = 10;
const CUBE_SIZE_Z = 50;

// Optimized LOD Settings
const LOD_DISTANCES = [15, 30, 60, 100];
const LOD_FACTORS = [1, 2, 3, 4];
const CHUNK_SIZE = 8; // Smaller chunks for better culling
const MAX_VOXELS_PER_FRAME = 5000; // Limit voxels rendered per frame

// Reuse materials and geometries
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#229922",
  roughness: 0.7,
  metalness: 0.1
});

// Create geometry cache for different LOD levels
const geometryCache = new Map<number, THREE.BoxGeometry>();

function getGeometry(voxelSize: number, lodLevel: number): THREE.BoxGeometry {
  const key = voxelSize * 1000 + lodLevel; // Create unique key
  if (!geometryCache.has(key)) {
    const size = voxelSize * 0.95;
    geometryCache.set(key, new THREE.BoxGeometry(size, size, size));
  }
  return geometryCache.get(key)!;
}

export default function PlanetOptimized() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const { camera } = useThree();
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const [planetReady, setPlanetReady] = useState(false);
  const [currentLOD, setCurrentLOD] = useState(0);
  const [visibleChunks, setVisibleChunks] = useState<Chunk[]>([]);
  const performanceMonitor = useRef(new PerformanceMonitor());
  const voxelMap = useRef(new VoxelMap());
  const [, get] = useKeyboardControls();

  // Store original positions for reset
  const originalPositions = useRef<[number, number, number][]>([]);

  // Initialize voxel map
  useEffect(() => {
    voxelMap.current.clear();
    for (let x = 0; x < CUBE_SIZE_X; x++) {
      for (let y = 0; y < CUBE_SIZE_Y; y++) {
        for (let z = 0; z < CUBE_SIZE_Z; z++) {
          voxelMap.current.add(x, y, z);
        }
      }
    }
  }, []);

  // Create chunks once
  const chunks = useMemo(() => {
    if (!VOXEL_SIZE) return [];
    
    const offset: [number, number, number] = [
      -((CUBE_SIZE_X - 1) * VOXEL_SIZE) / 2,
      -((CUBE_SIZE_Y - 1) * VOXEL_SIZE) / 2,
      -((CUBE_SIZE_Z - 1) * VOXEL_SIZE) / 2,
    ];

    return createChunks(
      VOXEL_SIZE,
      { x: CUBE_SIZE_X, y: CUBE_SIZE_Y, z: CUBE_SIZE_Z },
      CHUNK_SIZE,
      offset
    );
  }, [VOXEL_SIZE]);

  // Performance monitoring and LOD calculation
  useFrame(() => {
    performanceMonitor.current.update();
    
    const cameraPos = camera.position;
    const planetCenter = new THREE.Vector3(0, 0, 0);
    const distance = cameraPos.distanceTo(planetCenter);
    
    // Dynamic LOD based on performance
    const fps = performanceMonitor.current.getFPS();
    let lodOffset = 0;
    if (fps < 30) lodOffset = 1; // Reduce detail if FPS is low
    if (fps < 20) lodOffset = 2;
    
    let newLOD = 0;
    for (let i = 0; i < LOD_DISTANCES.length; i++) {
      if (distance > LOD_DISTANCES[i]) {
        newLOD = i + 1;
      }
    }
    newLOD = Math.min(newLOD + lodOffset, LOD_FACTORS.length - 1);
    
    if (newLOD !== currentLOD) {
      setCurrentLOD(newLOD);
    }

    // Frustum culling for chunks
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix, 
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraMatrix);

    const newVisibleChunks = chunks.filter(chunk => isChunkVisible(chunk, frustum));
    
    // Only update if chunks changed significantly
    if (newVisibleChunks.length !== visibleChunks.length || 
        newVisibleChunks.some(chunk => !visibleChunks.includes(chunk))) {
      setVisibleChunks(newVisibleChunks);
    }
  });

  // Create instances with advanced optimizations
  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    if (!VOXEL_SIZE || visibleChunks.length === 0) return [];
    
    const out: InstancedRigidBodyProps[] = [];
    const positions: [number, number, number][] = [];
    const lodFactor = LOD_FACTORS[currentLOD];
    let voxelCount = 0;

    for (const chunk of visibleChunks) {
      if (voxelCount >= MAX_VOXELS_PER_FRAME) break;
      
      for (const voxel of chunk.voxels) {
        if (voxelCount >= MAX_VOXELS_PER_FRAME) break;
        
        const { x, y, z, position } = voxel;
        
        // Skip voxels based on LOD
        if (x % lodFactor !== 0 || y % lodFactor !== 0 || z % lodFactor !== 0) {
          continue;
        }

        // Occlusion culling - skip completely surrounded voxels
        if (currentLOD === 0 && isVoxelOccluded(
          x, y, z, 
          voxelMap.current['data'], 
          { x: CUBE_SIZE_X, y: CUBE_SIZE_Y, z: CUBE_SIZE_Z }
        )) {
          continue;
        }

        out.push({
          key: `voxel_${x}_${y}_${z}_lod${currentLOD}`,
          position,
          rotation: [0, 0, 0],
          type: "fixed",
        });
        
        positions.push(position);
        voxelCount++;
      }
    }

    originalPositions.current = positions;
    setPlanetReady(true);
    
    return out;
  }, [VOXEL_SIZE, currentLOD, visibleChunks]);

  const totalVoxels = instances.length;
  const fps = performanceMonitor.current.getFPS();
  
  console.log(`Rendering ${totalVoxels} voxels at LOD ${currentLOD}, FPS: ${fps.toFixed(1)}, Visible chunks: ${visibleChunks.length}/${chunks.length}`);

  // Optimized reset function
  const resetVoxels = useCallback(() => {
    if (rigidBodies.current.length > 0 && originalPositions.current.length > 0) {
      rigidBodies.current.forEach((body, index) => {
        if (index < originalPositions.current.length) {
          const [x, y, z] = originalPositions.current[index];
          body.setTranslation({ x, y, z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      });
    }
  }, []);

  useEffect(() => {
    resetVoxels();
  }, [planetReady, resetVoxels]);

  // Handle reset key
  useEffect(() => {
    const keys = get();
    if (keys.reset) {
      resetVoxels();
    }
  }, [get, resetVoxels]);

  return (
    <group>
      {/* Performance HUD */}
      <group position={[-20, 10, 0]}>
        {/* You could add a Text component here to show performance stats */}
      </group>
      
      <InstancedRigidBodies
        key={`voxels-${VOXEL_SIZE}-lod${currentLOD}-chunks${visibleChunks.length}`} 
        instances={instances}
        ref={rigidBodies}
        colliders={false}
        type="fixed"
        gravityScale={0}
      >
        <CuboidCollider args={[VOXEL_SIZE * 0.4, VOXEL_SIZE * 0.4, VOXEL_SIZE * 0.4]} />
        <instancedMesh args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
          <primitive object={getGeometry(VOXEL_SIZE, currentLOD)} attach="geometry" />
          <primitive object={voxelMaterial} attach="material" />
        </instancedMesh>
      </InstancedRigidBodies>
    </group>
  );
} 