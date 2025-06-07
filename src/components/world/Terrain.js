import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { TerrainGenerator } from '../../generators/TerrainGenerator';
import { PlanetTerrainGenerator } from '../../generators/PlanetTerrainGenerator';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../../constants/world';
import { globalCollisionSystem } from '../../utils/VoxelCollisionSystem';
import { globalVegetationSystem } from '../../systems/VegetationSystem';
import { globalTerrainVegetationIntegrator } from '../../systems/TerrainVegetationIntegrator';
import { VegetationRenderer } from './VegetationRenderer';

const Terrain = ({ chunkX = 0, chunkZ = 0, terrainParameters }) => {
  const meshRef = useRef();
  const terrainGenerator = useMemo(() => new PlanetTerrainGenerator(), []);
  const [regenerationTrigger, setRegenerationTrigger] = useState(0);
  const [vegetationData, setVegetationData] = useState(null);

  // Update terrain generator when parameters change and trigger regeneration
  useEffect(() => {
    if (terrainParameters) {
  
      
      terrainGenerator.updateParameters(terrainParameters);
      setRegenerationTrigger(prev => prev + 1); // Force geometry regeneration
    }
  }, [terrainParameters, terrainGenerator, chunkX, chunkZ]);

  // Generate terrain geometry using the new generator system
  const geometry = useMemo(() => {

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    const colors = [];
    const indices = [];

    // Generate voxel data using the terrain generator
    const voxelData = terrainGenerator.generateChunkData(chunkX, chunkZ);
    
    // Register this chunk's voxel data with the collision system
    globalCollisionSystem.registerChunk(chunkX, chunkZ, voxelData);
    
    // Generate vegetation for this chunk if enabled - using integrated system
    if (WORLD_CONFIG.VEGETATION.ENABLED && WORLD_CONFIG.VEGETATION.CHUNK_GENERATION) {
      // Use integrated terrain-vegetation system for coordinate matching
      globalTerrainVegetationIntegrator.generateIntegratedVegetation(chunkX, chunkZ, voxelData)
        .then(vegetation => {
    
          setVegetationData(vegetation);
        })
        .catch(error => {
          console.error(`❌ Error generating integrated vegetation for chunk (${chunkX},${chunkZ}):`, error);
          // Fallback to basic system
          const vegetation = globalVegetationSystem.generateVegetationForChunk(chunkX, chunkZ, voxelData);
          setVegetationData(vegetation);
        });
    }
    
    // Generate mesh from voxel data
    let vertexIndex = 0;
    
    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
          const materialType = voxelData[x][z][y];
          
          if (materialType !== MATERIAL_TYPES.AIR) {
            // Check if voxel should be rendered (has at least one exposed face)
            const shouldRender = 
              (x === 0 || voxelData[x - 1][z][y] === MATERIAL_TYPES.AIR) ||
              (x === WORLD_CONFIG.CHUNK_SIZE - 1 || voxelData[x + 1][z][y] === MATERIAL_TYPES.AIR) ||
              (z === 0 || voxelData[x][z - 1][y] === MATERIAL_TYPES.AIR) ||
              (z === WORLD_CONFIG.CHUNK_SIZE - 1 || voxelData[x][z + 1][y] === MATERIAL_TYPES.AIR) ||
              (y === 0 || voxelData[x][z][y - 1] === MATERIAL_TYPES.AIR) ||
              (y === WORLD_CONFIG.CHUNK_HEIGHT - 1 || voxelData[x][z][y + 1] === MATERIAL_TYPES.AIR);

            if (shouldRender) {
              // Create a cube at this position
              // Account for chunk offset in world space
              const chunkWorldOffsetX = chunkX * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
              const chunkWorldOffsetZ = chunkZ * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
              
              const px = (x - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
              const py = y * WORLD_CONFIG.VOXEL_SIZE;
              const pz = (z - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;

              const halfVoxel = WORLD_CONFIG.VOXEL_SIZE / 2;

              // Define cube vertices
              const cubeVertices = [
                // Front face
                px - halfVoxel, py - halfVoxel, pz + halfVoxel,
                px + halfVoxel, py - halfVoxel, pz + halfVoxel,
                px + halfVoxel, py + halfVoxel, pz + halfVoxel,
                px - halfVoxel, py + halfVoxel, pz + halfVoxel,
                // Back face
                px - halfVoxel, py - halfVoxel, pz - halfVoxel,
                px - halfVoxel, py + halfVoxel, pz - halfVoxel,
                px + halfVoxel, py + halfVoxel, pz - halfVoxel,
                px + halfVoxel, py - halfVoxel, pz - halfVoxel,
              ];

              // Add vertices
              vertices.push(...cubeVertices);

              // Add normals (simplified)
              for (let i = 0; i < 8; i++) {
                normals.push(0, 1, 0);
              }

              // Get color based on material type
              const color = getMaterialColor(materialType, y);
              
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
    
    // Log rendering summary for comparison with collision system
    const renderedVoxels = vertexIndex / 8; // 8 vertices per voxel

    
    return geometry;
  }, [terrainGenerator, chunkX, chunkZ, regenerationTrigger]); // Use regenerationTrigger instead of terrainParameters

  return (
    <>
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      {WORLD_CONFIG.VEGETATION.ENABLED && vegetationData && (
        <VegetationRenderer 
          chunkData={vegetationData}
          position={[0, 0, 0]}
        />
      )}
    </>
  );
};

// Helper function to get material color
function getMaterialColor(materialType, height) {
  const { COLORS } = WORLD_CONFIG;
  const colorIntensity = Math.min(1, height / WORLD_CONFIG.TERRAIN_MAX_HEIGHT + 0.3);
  
  switch (materialType) {
    case MATERIAL_TYPES.GRASS:
      return COLORS.GRASS.map(c => c * colorIntensity);
    case MATERIAL_TYPES.STONE:
      return COLORS.STONE.map(c => c * colorIntensity);
    case MATERIAL_TYPES.DIRT:
      return COLORS.DIRT.map(c => c * colorIntensity);
    case MATERIAL_TYPES.SAND:
      return COLORS.SAND.map(c => c * colorIntensity);
    default:
      return COLORS.STONE.map(c => c * colorIntensity);
  }
}

export default Terrain; 