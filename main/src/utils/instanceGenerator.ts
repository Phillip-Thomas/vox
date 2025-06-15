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
 * Generates instances data for InstancedRigidBodies - includes ALL voxels
 */
export function generateVoxelInstances(voxelSize: number): {
  instances: InstancedRigidBodyProps[];
  originalPositions: [number, number, number][];
  hiddenVoxels: Set<number>; // Track which instances should be hidden initially
} {
  if (!voxelSize) return { instances: [], originalPositions: [], hiddenVoxels: new Set() };
  
  const voxelExists = createVoxelPositionSet();
  const instances: InstancedRigidBodyProps[] = [];
  const positions: [number, number, number][] = [];
  const hiddenVoxels = new Set<number>();
  const offset = calculateWorldOffset(voxelSize);

  // Generate instances for ALL voxels, but track which should be hidden
  let instanceIndex = 0;
  
  for (let x = 0; x < CUBE_SIZE_X; x++) {
    for (let y = 0; y < CUBE_SIZE_Y; y++) {
      for (let z = 0; z < CUBE_SIZE_Z; z++) {
        const isExposed = isVoxelExposed(x, y, z, voxelExists);
        const position = voxelToWorldPosition(x, y, z, voxelSize, offset);
        const materialType = getRandomMaterialType();
        
        // Create instance for every voxel
        instances.push({
          key: `voxel_${x}_${y}_${z}`,
          position: isExposed ? position : [100000 + x, 100000 + y, 100000 + z], // Hide non-exposed voxels far away
          rotation: [0, 0, 0],
          userData: {
            material: materialType,
            coordinates: { x, y, z },
            voxelType: 'terrain',
            isExposed: isExposed
          },
          type: "fixed",
        });
        
        // Track hidden voxels
        if (!isExposed) {
          hiddenVoxels.add(instanceIndex);
        }
        
        // Store original positions (visible position for all)
        positions.push(position);
        instanceIndex++;
      }
    }
  }
  
  // Add the additional cube if it's exposed
  const { x: centerX, y: topY, z: centerZ } = getCenterCubeCoordinates();
  const centerIsExposed = isVoxelExposed(centerX, topY, centerZ, voxelExists);
  const additionalPosition = voxelToWorldPosition(centerX, topY, centerZ, voxelSize, offset);
  
  instances.push({
    key: `voxel_${centerX}_${topY}_${centerZ}`,
    position: centerIsExposed ? additionalPosition : [100000 + centerX, 100000 + topY, 100000 + centerZ],
    rotation: [0, 0, 0],
    userData: {
      material: getRandomMaterialType(),
      coordinates: { x: centerX, y: topY, z: centerZ },
      voxelType: 'special',
      isExposed: centerIsExposed
    },
    type: "dynamic",
  });
  
  if (!centerIsExposed) {
    hiddenVoxels.add(instanceIndex);
  }
  
  positions.push(additionalPosition);
  
  const exposedCount = instances.length - hiddenVoxels.size;
  console.log(`Generated ${instances.length} total voxels (${exposedCount} exposed, ${hiddenVoxels.size} hidden initially)`);
  
  return { instances, originalPositions: positions, hiddenVoxels };
} 