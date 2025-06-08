import React, { useMemo, useContext, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { PlanetContext } from '../context/PlanetContext';

const CHUNK_SIZE = 16; // Size of each chunk
const INNER_SPHERE_RATIO = 0.8; // Inner sphere takes up 80% of radius

export default function Planet() {
  const { scene, camera } = useThree();
  const { radius: RADIUS, voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const [chunks, setChunks] = useState(new Map());
  
  // Create the inner sphere once
  const innerSphere = useMemo(() => {
    const innerRadius = RADIUS * INNER_SPHERE_RATIO;
    const geometry = new THREE.SphereGeometry(innerRadius, 64, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x229922,
      roughness: 0.7,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return mesh;
  }, [scene, RADIUS]);

  const generateChunk = (chunkX, chunkY, chunkZ) => {
    const key = `${chunkX},${chunkY},${chunkZ}`;
    if (chunks.has(key)) return chunks.get(key);

    const positions = [];
    const worldOffset = new THREE.Vector3(
      chunkX * CHUNK_SIZE * VOXEL_SIZE,
      chunkY * CHUNK_SIZE * VOXEL_SIZE,
      chunkZ * CHUNK_SIZE * VOXEL_SIZE
    );

    // Only store voxels that exist (sparse storage)
    const chunkVoxels = new Map();

    // Calculate the inner and outer radius bounds for the shell
    const innerRadiusVox = Math.round((RADIUS * INNER_SPHERE_RATIO) / VOXEL_SIZE);
    const outerRadiusVox = Math.round(RADIUS / VOXEL_SIZE);

    // Generate voxels only for the outer shell
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldY = chunkY * CHUNK_SIZE + y;
          const worldZ = chunkZ * CHUNK_SIZE + z;

          const dist2 = worldX * worldX + worldY * worldY + worldZ * worldZ;
          
          // Only create voxels in the shell between inner and outer radius
          if (dist2 <= outerRadiusVox * outerRadiusVox && 
              dist2 >= innerRadiusVox * innerRadiusVox) {
            chunkVoxels.set(`${x},${y},${z}`, true);
          }
        }
      }
    }

    // Helper to check if a position has a voxel
    const hasVoxel = (x, y, z) => {
      if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
        // Check neighboring chunks
        const neighborChunkX = chunkX + Math.floor(x / CHUNK_SIZE);
        const neighborChunkY = chunkY + Math.floor(y / CHUNK_SIZE);
        const neighborChunkZ = chunkZ + Math.floor(z / CHUNK_SIZE);
        
        // Calculate world position to check against inner sphere
        const worldX = (neighborChunkX * CHUNK_SIZE + ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE) * VOXEL_SIZE;
        const worldY = (neighborChunkY * CHUNK_SIZE + ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE) * VOXEL_SIZE;
        const worldZ = (neighborChunkZ * CHUNK_SIZE + ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE) * VOXEL_SIZE;
        const dist2 = worldX * worldX + worldY * worldY + worldZ * worldZ;
        
        // If inside inner sphere radius, treat as solid
        if (dist2 <= (RADIUS * INNER_SPHERE_RATIO) * (RADIUS * INNER_SPHERE_RATIO)) {
          return true;
        }

        const neighborKey = `${neighborChunkX},${neighborChunkY},${neighborChunkZ}`;
        const neighborChunk = chunks.get(neighborKey);
        if (!neighborChunk) return false;
        
        const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return neighborChunk.voxels.has(`${localX},${localY},${localZ}`);
      }

      // Calculate world position to check against inner sphere
      const worldX = (chunkX * CHUNK_SIZE + x) * VOXEL_SIZE;
      const worldY = (chunkY * CHUNK_SIZE + y) * VOXEL_SIZE;
      const worldZ = (chunkZ * CHUNK_SIZE + z) * VOXEL_SIZE;
      const dist2 = worldX * worldX + worldY * worldY + worldZ * worldZ;
      
      // If inside inner sphere radius, treat as solid
      if (dist2 <= (RADIUS * INNER_SPHERE_RATIO) * (RADIUS * INNER_SPHERE_RATIO)) {
        return true;
      }

      return chunkVoxels.has(`${x},${y},${z}`);
    };

    // Generate geometry only for exposed faces
    for (const [posKey] of chunkVoxels) {
      const [x, y, z] = posKey.split(',').map(Number);
      
      // Check if any face is exposed
      const faceDirections = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
      ];

      const isExposed = faceDirections.some(([dx, dy, dz]) => 
        !hasVoxel(x + dx, y + dy, z + dz)
      );

      if (isExposed) {
        positions.push(new THREE.Vector3(
          (x * VOXEL_SIZE) + worldOffset.x,
          (y * VOXEL_SIZE) + worldOffset.y,
          (z * VOXEL_SIZE) + worldOffset.z
        ));
      }
    }

    const chunk = {
      voxels: chunkVoxels,
      mesh: null
    };

    if (positions.length > 0) {
      const geo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0x229922,
        roughness: 0.7,
        metalness: 0.1
      });
      
      const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
      const dummy = new THREE.Object3D();
      positions.forEach((p, i) => {
        dummy.position.copy(p);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      chunk.mesh = mesh;
    }

    return chunk;
  };

  useEffect(() => {
    // Generate only visible chunks
    const updateVisibleChunks = () => {
      const cameraPos = camera.position;
      const renderDistance = 32; // chunks
      
      const centerChunkX = Math.floor(cameraPos.x / (CHUNK_SIZE * VOXEL_SIZE));
      const centerChunkY = Math.floor(cameraPos.y / (CHUNK_SIZE * VOXEL_SIZE));
      const centerChunkZ = Math.floor(cameraPos.z / (CHUNK_SIZE * VOXEL_SIZE));

      const newChunks = new Map();

      for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let y = -renderDistance; y <= renderDistance; y++) {
          for (let z = -renderDistance; z <= renderDistance; z++) {
            const chunkX = centerChunkX + x;
            const chunkY = centerChunkY + y;
            const chunkZ = centerChunkZ + z;
            
            const dist = Math.sqrt(x * x + y * y + z * z);
            if (dist <= renderDistance) {
              const key = `${chunkX},${chunkY},${chunkZ}`;
              const chunk = generateChunk(chunkX, chunkY, chunkZ);
              newChunks.set(key, chunk);
            }
          }
        }
      }

      // Remove old chunks
      for (const [key, chunk] of chunks) {
        if (!newChunks.has(key) && chunk.mesh) {
          scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh.material.dispose();
        }
      }

      setChunks(newChunks);
    };

    updateVisibleChunks();
    window.addEventListener('visibilitychange', updateVisibleChunks);
    return () => {
      window.removeEventListener('visibilitychange', updateVisibleChunks);
      // Cleanup all chunks and inner sphere
      for (const chunk of chunks.values()) {
        if (chunk.mesh) {
          scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh.material.dispose();
        }
      }
      if (innerSphere) {
        scene.remove(innerSphere);
        innerSphere.geometry.dispose();
        innerSphere.material.dispose();
      }
    };
  }, [camera.position]);

  return null;
} 