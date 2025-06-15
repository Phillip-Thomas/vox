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
        
        if (!isExposed) {
          // Hidden voxels: NO PHYSICS OBJECT - just visual mesh
          instances.push({
            key: `voxel_${x}_${y}_${z}`,
            position, // Keep at normal position for potential future exposure
            rotation: [0, 0, 0],
            userData: {
              material: materialType,
              coordinates: { x, y, z },
              voxelType: 'terrain',
              isExposed: false
            }
            // ⬇️ NO TYPE PROPERTY = no RigidBody/Collider created
          });
          hiddenVoxels.add(instanceIndex);
        } else {
          // Exposed voxels: OPTIMIZED FIXED PHYSICS OBJECT
          instances.push({
            key: `voxel_${x}_${y}_${z}`,
            position,
            rotation: [0, 0, 0],
            userData: {
              material: materialType,
              coordinates: { x, y, z },
              voxelType: 'terrain',
              isExposed: true
            },
            type: "fixed",
            // MINIMAL PHYSICS OPTIMIZATIONS (fixed bodies only need these)
            lockRotations: true,      // Prevent rotation calculations
            lockTranslations: true,   // Prevent translation calculations
            friction: 0,              // Skip tangent impulse calculations
          });
        }
        
        // Store original positions for all voxels
        positions.push(position);
        instanceIndex++;
      }
    }
  }
  
  // Add the additional cube (dynamic for interaction)
  const { x: centerX, y: topY, z: centerZ } = getCenterCubeCoordinates();
  const centerIsExposed = isVoxelExposed(centerX, topY, centerZ, voxelExists);
  const additionalPosition = voxelToWorldPosition(centerX, topY, centerZ, voxelSize, offset);
  
  if (!centerIsExposed) {
    // Hidden center cube
    instances.push({
      key: `voxel_${centerX}_${topY}_${centerZ}`,
      position: additionalPosition,
      rotation: [0, 0, 0],
      userData: {
        material: getRandomMaterialType(),
        coordinates: { x: centerX, y: topY, z: centerZ },
        voxelType: 'special',
        isExposed: false
      }
      // No type = no physics
    });
    hiddenVoxels.add(instanceIndex);
  } else {
    // Exposed center cube - dynamic body with minimal optimizations
    instances.push({
      key: `voxel_${centerX}_${topY}_${centerZ}`,
      position: additionalPosition,
      rotation: [0, 0, 0],
      userData: {
        material: getRandomMaterialType(),
        coordinates: { x: centerX, y: topY, z: centerZ },
        voxelType: 'special',
        isExposed: true
      },
      type: "dynamic",
      // DYNAMIC BODY OPTIMIZATIONS
      gravityScale: 1,          // Only dynamic bodies need gravity
      linearDamping: 0.05,      // Light damping for settling
      angularDamping: 0.05,     // Light angular damping
      canSleep: true,           // Allow sleeping when inactive
      // Don't use CCD unless needed for high-velocity impacts
    });
  }
  
  positions.push(additionalPosition);
  
  const exposedCount = instances.filter(inst => inst.userData?.isExposed).length;
  const physicsCount = instances.filter(inst => inst.type).length;
  
  // Minimal performance logging
  console.log(`🎯 VOXEL OPTIMIZATION: ${exposedCount} exposed, ${physicsCount} physics bodies, ${hiddenVoxels.size} visual-only`);
  
  return { instances, originalPositions: positions, hiddenVoxels };
} 