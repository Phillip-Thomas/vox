import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import SimplexNoise from '../utils/noise';

const CHUNK_SIZE = 16;
const VOXEL_SIZE = 1;
const MAX_HEIGHT = 20;

const Terrain = () => {
  const meshRef = useRef();
  const noise = useMemo(() => new SimplexNoise(42), []);

  // Generate terrain geometry
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    const colors = [];
    const indices = [];

    // Generate voxel data
    const voxelData = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      voxelData[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        voxelData[x][z] = [];
        
        // Get height from noise
        const height = Math.floor(
          noise.fractalNoise2D(x, z, 4, 0.5) * MAX_HEIGHT + 5
        );
        
        for (let y = 0; y < MAX_HEIGHT; y++) {
          voxelData[x][z][y] = y <= height ? 1 : 0;
        }
      }
    }

    // Generate mesh from voxel data
    let vertexIndex = 0;
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y < MAX_HEIGHT; y++) {
          if (voxelData[x][z][y] === 1) {
            // Check if voxel should be rendered (has at least one exposed face)
            const shouldRender = 
              (x === 0 || voxelData[x - 1][z][y] === 0) ||
              (x === CHUNK_SIZE - 1 || voxelData[x + 1][z][y] === 0) ||
              (z === 0 || voxelData[x][z - 1][y] === 0) ||
              (z === CHUNK_SIZE - 1 || voxelData[x][z + 1][y] === 0) ||
              (y === 0 || voxelData[x][z][y - 1] === 0) ||
              (y === MAX_HEIGHT - 1 || voxelData[x][z][y + 1] === 0);

            if (shouldRender) {
              // Create a cube at this position
              const px = (x - CHUNK_SIZE / 2) * VOXEL_SIZE;
              const py = y * VOXEL_SIZE;
              const pz = (z - CHUNK_SIZE / 2) * VOXEL_SIZE;

              // Define cube vertices
              const cubeVertices = [
                // Front face
                px - 0.5, py - 0.5, pz + 0.5,
                px + 0.5, py - 0.5, pz + 0.5,
                px + 0.5, py + 0.5, pz + 0.5,
                px - 0.5, py + 0.5, pz + 0.5,
                // Back face
                px - 0.5, py - 0.5, pz - 0.5,
                px - 0.5, py + 0.5, pz - 0.5,
                px + 0.5, py + 0.5, pz - 0.5,
                px + 0.5, py - 0.5, pz - 0.5,
              ];

              // Add vertices
              vertices.push(...cubeVertices);

              // Add normals (simplified)
              for (let i = 0; i < 8; i++) {
                normals.push(0, 1, 0);
              }

              // Add colors based on height
              const colorIntensity = Math.min(1, y / MAX_HEIGHT + 0.3);
              const grassColor = [0.2 * colorIntensity, 0.8 * colorIntensity, 0.3 * colorIntensity];
              const stoneColor = [0.6 * colorIntensity, 0.6 * colorIntensity, 0.7 * colorIntensity];
              
              const useGrass = y > MAX_HEIGHT * 0.3;
              const color = useGrass ? grassColor : stoneColor;
              
              for (let i = 0; i < 8; i++) {
                colors.push(...color);
              }

              // Add indices for the cube faces
              const baseIndex = vertexIndex;
              const cubeIndices = [
                0, 1, 2, 0, 2, 3, // front
                4, 5, 6, 4, 6, 7, // back
                0, 4, 7, 0, 7, 1, // bottom
                2, 6, 5, 2, 5, 3, // top
                0, 3, 5, 0, 5, 4, // left
                1, 7, 6, 1, 6, 2  // right
              ];

              cubeIndices.forEach(index => {
                indices.push(baseIndex + index);
              });

              vertexIndex += 8;
            }
          }
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    geometry.computeVertexNormals();
    
    return geometry;
  }, [noise]);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
};

export default Terrain; 