import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { globalVegetationSystem } from '../../systems/VegetationSystem';

export const VegetationRenderer = ({ chunkData, position }) => {
  const groupRef = useRef();
  const [vegetationMeshes, setVegetationMeshes] = useState([]);
  const [isVisible, setIsVisible] = useState(true);
  const cameraRef = useRef();
  
  // LOD system parameters
  const LOD_DISTANCES = {
    HIGH: 50,
    MEDIUM: 100,
    LOW: 200,
  };

  useEffect(() => {
    console.log(`🎨 VegetationRenderer: Received chunk data:`, chunkData);
    
    if (!chunkData || !chunkData.trees || chunkData.trees.length === 0) {
      console.log(`🚫 No vegetation data for chunk (${chunkData?.chunkX},${chunkData?.chunkZ})`);
      setVegetationMeshes([]);
      return;
    }

    console.log(`🎨 Rendering ${chunkData.trees.length} trees for chunk (${chunkData.chunkX},${chunkData.chunkZ})`);

    // Generate meshes for all trees in this chunk
    const meshes = chunkData.trees.map(tree => createTreeMeshData(tree));
    setVegetationMeshes(meshes);

    // Update vegetation system stats
    const totalVertices = meshes.reduce((sum, mesh) => sum + (mesh.userData.vertexCount || 0), 0);
    globalVegetationSystem.stats.totalVertices += totalVertices;

  }, [chunkData]);

  // LOD and visibility culling
  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    cameraRef.current = camera;
    const chunkCenter = new THREE.Vector3(...position);
    const distance = camera.position.distanceTo(chunkCenter);

    // Simple visibility culling
    const maxDistance = LOD_DISTANCES.LOW * 1.5;
    const shouldBeVisible = distance < maxDistance;
    
    if (shouldBeVisible !== isVisible) {
      setIsVisible(shouldBeVisible);
    }

    // Apply LOD to individual meshes
    if (shouldBeVisible && vegetationMeshes.length > 0) {
      vegetationMeshes.forEach(mesh => {
        if (mesh.ref && mesh.ref.current) {
          const meshDistance = camera.position.distanceTo(mesh.ref.current.position);
          updateMeshLOD(mesh.ref.current, meshDistance);
        }
      });
    }
  });

  const createTreeMeshData = (tree) => {
    const { components, position: treePosition } = tree;

    // Create mesh group for the tree
    const treeMeshes = [];

    // Create trunk mesh
    if (components.trunk) {
      const trunkMesh = new THREE.Mesh(components.trunk.geometry, components.trunk.material);
      trunkMesh.position.copy(components.trunk.position);
      trunkMesh.userData = { component: 'trunk', tree: tree };
      treeMeshes.push(trunkMesh);
    }

    // Create branches mesh
    if (components.branches && components.branches.geometry) {
      const branchesMesh = new THREE.Mesh(components.branches.geometry, components.branches.material);
      branchesMesh.userData = { component: 'branches', tree: tree };
      treeMeshes.push(branchesMesh);
    }

    // Create foliage mesh
    if (components.foliage && components.foliage.geometry) {
      const foliageMesh = new THREE.Mesh(components.foliage.geometry, components.foliage.material);
      foliageMesh.userData = { component: 'foliage', tree: tree };
      treeMeshes.push(foliageMesh);
    }

    return {
      treeData: tree,
      meshes: treeMeshes,
      position: treePosition,
      userData: {
        vertexCount: tree.metadata.vertexCount,
        treeId: tree.id,
      },
    };
  };

  const updateMeshLOD = (meshGroup, distance) => {
    if (!meshGroup || !meshGroup.children) return;

    let lodLevel = 'HIGH';
    if (distance > LOD_DISTANCES.LOW) {
      lodLevel = 'LOW';
    } else if (distance > LOD_DISTANCES.MEDIUM) {
      lodLevel = 'MEDIUM';
    }

    // Apply LOD modifications
    meshGroup.children.forEach(child => {
      if (child.userData.component === 'foliage') {
        // Reduce foliage complexity at distance
        switch (lodLevel) {
          case 'LOW':
            child.visible = false; // Hide foliage at long distance
            break;
          case 'MEDIUM':
            child.visible = true;
            child.material.transparent = true;
            child.material.opacity = 0.7;
            break;
          case 'HIGH':
            child.visible = true;
            child.material.transparent = false;
            child.material.opacity = 1.0;
            break;
        }
      } else if (child.userData.component === 'branches') {
        // Simplify branches at distance
        switch (lodLevel) {
          case 'LOW':
            child.visible = distance < LOD_DISTANCES.LOW * 1.2; // Hide very distant branches
            break;
          case 'MEDIUM':
          case 'HIGH':
            child.visible = true;
            break;
        }
      }
      // Trunk is always visible (main structure)
    });
  };

  if (!isVisible || vegetationMeshes.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef} position={position}>
      {vegetationMeshes.map((treeMesh, index) => (
        <TreeMeshGroup 
          key={`tree-${index}-${treeMesh.treeData.id}`}
          treeMesh={treeMesh}
        />
      ))}
    </group>
  );
};

// Individual tree mesh component
const TreeMeshGroup = ({ treeMesh }) => {
  const groupRef = useRef();

  useEffect(() => {
    // Assign the ref to the treeMesh for LOD processing
    treeMesh.ref = groupRef;
  }, [treeMesh]);

  return (
    <group 
      ref={groupRef}
      position={[treeMesh.position.x, treeMesh.position.y, treeMesh.position.z]}
    >
      {treeMesh.meshes.map((mesh, meshIndex) => (
        <primitive 
          key={`mesh-${meshIndex}-${mesh.userData.component}`}
          object={mesh}
        />
      ))}
    </group>
  );
};

// Enhanced vegetation statistics component
export const VegetationStats = ({ visible = false }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!visible) return;

    const updateStats = () => {
      const vegetationStats = globalVegetationSystem.getStats();
      setStats(vegetationStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible || !stats) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '120px',
      left: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000,
    }}>
      <div><strong>VEGETATION STATS</strong></div>
      <div>Trees: {stats.totalTrees}</div>
      <div>Chunks: {stats.chunksProcessed}</div>
      <div>Vertices: {stats.totalVertices.toLocaleString()}</div>
      <div>Placement Rate: {stats.placementSuccessRate}</div>
      <div>Attempts: {stats.placementAttempts}</div>
      <div>Successful: {stats.successfulPlacements}</div>
    </div>
  );
};

export default VegetationRenderer; 