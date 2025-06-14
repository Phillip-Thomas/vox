import { InstancedRigidBodyProps } from '@react-three/rapier';
import { getRandomMaterialType } from '../types/materials';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
  createVoxelPositionSet,
  isVoxelExposed,
  calculateWorldOffset,
  voxelToWorldPosition,
  getCenterCubeCoordinates
} from './voxelUtils';

/**
 * Generates instances data for InstancedRigidBodies
 */
export function generateVoxelInstances(voxelSize: number): {
  instances: InstancedRigidBodyProps[];
  originalPositions: [number, number, number][];
} {
  if (!voxelSize) return { instances: [], originalPositions: [] };
  
  const voxelExists = createVoxelPositionSet();
  const instances: InstancedRigidBodyProps[] = [];
  const positions: [number, number, number][] = [];
  const offset = calculateWorldOffset(voxelSize);

  // Generate instances only for exposed voxels
  let processedCount = 0;
  let exposedCount = 0;
  
  for (let x = 0; x < CUBE_SIZE_X; x++) {
    for (let y = 0; y < CUBE_SIZE_Y; y++) {
      for (let z = 0; z < CUBE_SIZE_Z; z++) {
        processedCount++;
        
        // Only create instance if voxel is exposed
        if (!isVoxelExposed(x, y, z, voxelExists)) {
          continue; // Skip this voxel - it's completely surrounded
        }
        
        exposedCount++;
        
        const position = voxelToWorldPosition(x, y, z, voxelSize, offset);
        const materialType = getRandomMaterialType();
        
        instances.push({
          key: `voxel_${x}_${y}_${z}`,
          position,
          rotation: [0, 0, 0],

          userData: {
            material: materialType,
            coordinates: { x, y, z },
            voxelType: 'terrain'
          },
          type: "fixed", // Changed back to dynamic so they can fall
        });
        
        // Store original positions for reset
        positions.push(position);
      }
    }
  }
  
  // Add the additional cube if it's exposed
  const { x: centerX, y: topY, z: centerZ } = getCenterCubeCoordinates();
  if (isVoxelExposed(centerX, topY, centerZ, voxelExists)) {
    const additionalPosition = voxelToWorldPosition(centerX, topY, centerZ, voxelSize, offset);
    
    instances.push({
      key: `voxel_${centerX}_${topY}_${centerZ}`,
      position: additionalPosition,
      rotation: [0, 0, 0],
      type: "dynamic",
      // args: {
      //   userData: {
      //     material: getRandomMaterialType(),
      //     coordinates: { x: centerX, y: topY, z: centerZ },
      //     voxelType: 'special',
      //     note: 'center cube'
      //   }
      // }
    });
    
    positions.push(additionalPosition);
  }
  
  console.log(`Generated ${instances.length} surface voxels from ${CUBE_SIZE_X}×${CUBE_SIZE_Y}×${CUBE_SIZE_Z} cube (culled ${(CUBE_SIZE_X * CUBE_SIZE_Y * CUBE_SIZE_Z + 1) - instances.length} interior voxels)`);
  
  return { instances, originalPositions: positions };
} 