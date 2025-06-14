import React, { useMemo } from 'react';
import * as THREE from 'three';
import { calculateWorldOffset } from '../utils/voxelUtils';
import { CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z } from '../utils/voxelUtils';

interface QuadrantVisualizerProps {
  voxelSize: number;
  visible?: boolean;
}

export function QuadrantVisualizer({ voxelSize, visible = true }: QuadrantVisualizerProps) {
  const offset = calculateWorldOffset(voxelSize);
  
  // Calculate cube center in world coordinates
  const cubeCenter = useMemo(() => {
    // The calculateWorldOffset is designed to center the cube at the origin
    // Cube voxels go from 0 to (CUBE_SIZE-1)
    // With offset, the world positions go from offset[0] to offset[0] + (CUBE_SIZE-1)*voxelSize
    // The center is the midpoint of this range:
    // center = offset + (CUBE_SIZE-1)*voxelSize/2
    // But offset = -((CUBE_SIZE-1)*voxelSize)/2
    // So center = -((CUBE_SIZE-1)*voxelSize)/2 + (CUBE_SIZE-1)*voxelSize/2 = 0
    
    return new THREE.Vector3(0, 0, 0);
  }, []);

  // Create the 6 angular bisector planes using proper normal vectors
  const planes = useMemo(() => {
    const planeSize = 50; // Make planes large enough to see boundaries
    
    // Define the plane configurations with their correct normal vectors
    const planeConfigs = [
      // x = y plane: normal vector (1, -1, 0)
      { normal: new THREE.Vector3(1, -1, 0).normalize(), color: 0xff0000, name: 'x = y' },
      // x = -y plane: normal vector (1, 1, 0)  
      { normal: new THREE.Vector3(1, 1, 0).normalize(), color: 0xff4444, name: 'x = -y' },
      // x = z plane: normal vector (1, 0, -1)
      { normal: new THREE.Vector3(1, 0, -1).normalize(), color: 0x00ff00, name: 'x = z' },
      // x = -z plane: normal vector (1, 0, 1)
      { normal: new THREE.Vector3(1, 0, 1).normalize(), color: 0x44ff44, name: 'x = -z' },
      // y = z plane: normal vector (0, 1, -1)
      { normal: new THREE.Vector3(0, 1, -1).normalize(), color: 0x0000ff, name: 'y = z' },
      // y = -z plane: normal vector (0, 1, 1)
      { normal: new THREE.Vector3(0, 1, 1).normalize(), color: 0x4444ff, name: 'y = -z' }
    ];
    
    return planeConfigs.map(config => {
      const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
      
      // Create quaternion to orient plane according to normal vector
      const quaternion = new THREE.Quaternion();
      const defaultNormal = new THREE.Vector3(0, 0, 1); // PlaneGeometry default normal
      quaternion.setFromUnitVectors(defaultNormal, config.normal);
      
      return {
        geometry,
        position: cubeCenter.clone(),
        quaternion: quaternion.clone(),
        color: config.color,
        name: config.name
      };
    });
  }, [cubeCenter]);

  if (!visible) return null;

  return (
    <group>
      {planes.map((plane, index) => (
        <mesh
          key={index}
          geometry={plane.geometry}
          position={plane.position}
          quaternion={plane.quaternion}
        >
          <meshBasicMaterial
            color={plane.color}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      
      {/* Add text labels for debugging */}
      {planes.map((plane, index) => (
        <group key={`label-${index}`}>
          {/* You can add text sprites here if needed for labels */}
        </group>
      ))}
    </group>
  );
}

export default QuadrantVisualizer; 