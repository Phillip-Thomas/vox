import React, { useMemo, useContext } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { PlanetContext } from '../context/PlanetContext';

export default function Planet() {
  const { scene } = useThree();
  const { radius: RADIUS, voxelSize: VOXEL_SIZE } = useContext(PlanetContext);

  const instancedMesh = useMemo(() => {
    // Create a 3D array to store voxel positions
    const radVox = Math.round(RADIUS / VOXEL_SIZE);
    const size = 2 * radVox + 1;
    const voxels = new Array(size).fill(null)
      .map(() => new Array(size).fill(null)
        .map(() => new Array(size).fill(false)));

    // First pass: Mark all surface voxels
    for (let x = -radVox; x <= radVox; x++) {
      for (let y = -radVox; y <= radVox; y++) {
        for (let z = -radVox; z <= radVox; z++) {
          const dist2 = x * x + y * y + z * z;
          if (dist2 <= radVox * radVox && dist2 >= (radVox - 1) * (radVox - 1)) {
            voxels[x + radVox][y + radVox][z + radVox] = true;
          }
        }
      }
    }

    // Helper to check if a position is within bounds and contains a voxel
    const hasVoxel = (x, y, z) => {
      if (x < 0 || x >= size || y < 0 || y >= size || z < 0 || z >= size) return false;
      return voxels[x][y][z];
    };

    // Second pass: Generate geometry only for exposed faces
    const positions = [];
    const faceDirections = [ // Check 6 neighbors
      [1, 0, 0], [-1, 0, 0], // right, left
      [0, 1, 0], [0, -1, 0], // up, down
      [0, 0, 1], [0, 0, -1]  // front, back
    ];

    for (let x = -radVox; x <= radVox; x++) {
      for (let y = -radVox; y <= radVox; y++) {
        for (let z = -radVox; z <= radVox; z++) {
          const arrayX = x + radVox;
          const arrayY = y + radVox;
          const arrayZ = z + radVox;

          if (!voxels[arrayX][arrayY][arrayZ]) continue;

          // Check if any face is exposed
          const isExposed = faceDirections.some(([dx, dy, dz]) => 
            !hasVoxel(arrayX + dx, arrayY + dy, arrayZ + dz)
          );

          if (isExposed) {
            positions.push(new THREE.Vector3(
              x * VOXEL_SIZE,
              y * VOXEL_SIZE,
              z * VOXEL_SIZE
            ));
          }
        }
      }
    }

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
    return mesh;
  }, [scene, RADIUS, VOXEL_SIZE]);

  return null; // handled by three directly
} 