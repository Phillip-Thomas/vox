import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { VEGETATION_CONFIG } from '../constants/vegetation';

export class TreeGenerator {
  constructor() {
    this.treeConfig = VEGETATION_CONFIG.TREE;
    this.geometry = {
      trunk: null,
      branches: null,
      foliage: null,
    };
  }

  /**
   * Generate a complete tree with trunk, branches, and foliage
   * @param {Object} params - Tree generation parameters
   * @returns {Object} - Complete tree data
   */
  generateTree(params) {
    const { position, suitability, localPosition } = params;
    
    // Generate tree parameters based on suitability and randomness
    const treeParams = this.generateTreeParameters(suitability);
    
    // Generate tree components
    const trunk = this.generateTrunk(treeParams);
    const branches = this.generateBranches(treeParams, trunk);
    const foliage = this.generateFoliage(treeParams, trunk, branches);
    
    return {
      id: this.generateTreeId(position),
      position: position.clone(),
      localPosition,
      suitability,
      parameters: treeParams,
      components: {
        trunk,
        branches,
        foliage,
      },
      boundingBox: this.calculateBoundingBox(trunk, branches, foliage),
      metadata: {
        generated: Date.now(),
        vertexCount: trunk.vertexCount + branches.vertexCount + foliage.vertexCount,
      },
    };
  }

  /**
   * Generate tree parameters based on environmental factors
   */
  generateTreeParameters(suitability) {
    const config = this.treeConfig;
    const random = this.createSeededRandom(suitability.flatness * 1000);
    
    // Base trunk parameters
    const trunkHeight = this.lerp(
      config.BASE.MIN_HEIGHT,
      config.BASE.MAX_HEIGHT,
      random() * suitability.flatness
    );
    
    const trunkRadius = this.lerp(
      config.BASE.MIN_RADIUS,
      config.BASE.MAX_RADIUS,
      random() * 0.8 + 0.2
    );
    
    // Branch parameters
    const branchCount = Math.floor(this.lerp(
      config.BRANCHES.MIN_BRANCHES,
      config.BRANCHES.MAX_BRANCHES,
      random()
    ));
    
    // Foliage parameters
    const canopyRadius = trunkHeight * config.FOLIAGE.CANOPY_RADIUS_FACTOR * (0.8 + random() * 0.4);
    const canopyHeight = trunkHeight * config.FOLIAGE.CANOPY_HEIGHT_FACTOR * (0.8 + random() * 0.4);
    
    return {
      trunk: {
        height: trunkHeight,
        baseRadius: trunkRadius,
        topRadius: trunkRadius * config.BASE.TAPER_FACTOR,
        segments: config.BASE.SEGMENTS,
      },
      branches: {
        count: branchCount,
        lengthFactor: config.BRANCHES.BRANCH_LENGTH_FACTOR * (0.7 + random() * 0.6),
        radiusFactor: config.BRANCHES.BRANCH_RADIUS_FACTOR,
        angleRange: [config.BRANCHES.BRANCH_ANGLE_MIN, config.BRANCHES.BRANCH_ANGLE_MAX],
        subBranchProbability: config.BRANCHES.SUB_BRANCH_PROBABILITY,
        maxLevels: config.BRANCHES.MAX_BRANCH_LEVELS,
      },
      foliage: {
        canopyRadius,
        canopyHeight,
        density: config.FOLIAGE.LEAF_DENSITY * (0.7 + random() * 0.6),
        layers: config.FOLIAGE.FOLIAGE_LAYERS,
        layerOverlap: config.FOLIAGE.LAYER_OVERLAP,
        leafSize: {
          min: config.FOLIAGE.LEAF_SIZE.min,
          max: config.FOLIAGE.LEAF_SIZE.max,
        },
      },
      colors: {
        bark: this.addColorVariation(config.COLORS.BARK, 0.2),
        leaves: this.addColorVariation(config.COLORS.LEAVES, config.COLORS.LEAVES_VARIATION),
      },
      random, // Keep the random function for consistent generation
    };
  }

  /**
   * Generate trunk geometry
   */
  generateTrunk(treeParams) {
    const { trunk } = treeParams;
    const geometry = new THREE.CylinderGeometry(
      trunk.topRadius,
      trunk.baseRadius,
      trunk.height,
      trunk.segments,
      1, // height segments
      false, // open ended
      0, // theta start
      Math.PI * 2 // theta length
    );
    
    // Add slight irregularity to make it more natural
    this.addTrunkIrregularity(geometry, treeParams.random);
    
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...treeParams.colors.bark),
    });
    
    return {
      geometry,
      material,
      position: new THREE.Vector3(0, trunk.height / 2, 0),
      vertexCount: geometry.attributes.position.count,
    };
  }

  /**
   * Generate branch system - emergency simplified to prevent crashes
   */
  generateBranches(treeParams, trunk) {
    const { branches, trunk: trunkParams } = treeParams;
    
    // Emergency: Skip all branch generation if count is 0
    if (branches.count === 0) {
      const emptyGeometry = new THREE.BufferGeometry();
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(...treeParams.colors.bark),
      });
      
      return {
        geometry: emptyGeometry,
        material,
        branches: [],
        vertexCount: 0,
      };
    }
    
    const branchData = [];
    
    // Generate primary branches
    for (let i = 0; i < branches.count; i++) {
      const branchAngle = (i / branches.count) * Math.PI * 2;
      const heightRatio = 0.4 + (i / branches.count) * 0.5; // Branches higher up the trunk
      const startHeight = trunkParams.height * heightRatio;
      
      const branch = this.generateSingleBranch({
        level: 0,
        startPosition: new THREE.Vector3(0, startHeight, 0),
        direction: new THREE.Vector3(
          Math.cos(branchAngle),
          0.3 + treeParams.random() * 0.4, // Upward angle
          Math.sin(branchAngle)
        ).normalize(),
        length: trunkParams.height * branches.lengthFactor * (0.7 + treeParams.random() * 0.6),
        radius: trunkParams.baseRadius * branches.radiusFactor,
        treeParams,
      });
      
      branchData.push(branch);
      
      // Generate sub-branches
      if (treeParams.random() < branches.subBranchProbability && branches.maxLevels > 1) {
        const subBranches = this.generateSubBranches(branch, treeParams, 1);
        branchData.push(...subBranches);
      }
    }
    
    // Combine all branch geometries
    const combinedGeometry = this.combineBranchGeometries(branchData);
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...treeParams.colors.bark),
    });
    
    return {
      geometry: combinedGeometry,
      material,
      branches: branchData,
      vertexCount: combinedGeometry.attributes.position ? combinedGeometry.attributes.position.count : 0,
    };
  }

  /**
   * Generate a single branch
   */
  generateSingleBranch(params) {
    const { startPosition, direction, length, radius, level, treeParams } = params;
    
    const endPosition = startPosition.clone().add(direction.clone().multiplyScalar(length));
    
    // Create branch geometry as a tapered cylinder
    const segments = Math.max(4, 8 - level * 2); // Fewer segments for higher level branches
    const geometry = new THREE.CylinderGeometry(
      radius * 0.3, // Top radius (tapered)
      radius, // Bottom radius
      length,
      segments,
      1
    );
    
    // Position and orient the branch
    const midPoint = startPosition.clone().add(endPosition).multiplyScalar(0.5);
    const orientation = new THREE.Matrix4().lookAt(startPosition, endPosition, new THREE.Vector3(0, 1, 0));
    
    return {
      geometry,
      startPosition: startPosition.clone(),
      endPosition: endPosition.clone(),
      midPoint,
      direction: direction.clone(),
      length,
      radius,
      level,
      orientation,
    };
  }

  /**
   * Generate sub-branches recursively
   */
  generateSubBranches(parentBranch, treeParams, level) {
    if (level >= treeParams.branches.maxLevels) return [];
    
    const subBranches = [];
    const subBranchCount = Math.floor(2 + treeParams.random() * 3); // 2-4 sub-branches
    
    for (let i = 0; i < subBranchCount; i++) {
      const t = 0.4 + (i / subBranchCount) * 0.5; // Position along parent branch
      const startPos = parentBranch.startPosition.clone().lerp(parentBranch.endPosition, t);
      
      // Generate sub-branch direction with some randomness
      const baseDirection = parentBranch.direction.clone();
      const randomOffset = new THREE.Vector3(
        (treeParams.random() - 0.5) * 2,
        treeParams.random() * 0.5,
        (treeParams.random() - 0.5) * 2
      ).multiplyScalar(0.5);
      
      const subDirection = baseDirection.add(randomOffset).normalize();
      
      const subBranch = this.generateSingleBranch({
        level,
        startPosition: startPos,
        direction: subDirection,
        length: parentBranch.length * (0.4 + treeParams.random() * 0.3), // Shorter than parent
        radius: parentBranch.radius * 0.6, // Thinner than parent
        treeParams,
      });
      
      subBranches.push(subBranch);
      
      // Recursive sub-branching with decreasing probability
      if (treeParams.random() < treeParams.branches.subBranchProbability * 0.5) {
        const nestedSubBranches = this.generateSubBranches(subBranch, treeParams, level + 1);
        subBranches.push(...nestedSubBranches);
      }
    }
    
    return subBranches;
  }

  /**
   * Generate foliage system - emergency simplified version
   */
  generateFoliage(treeParams, trunk, branches) {
    const { foliage, trunk: trunkParams } = treeParams;
    
    // Emergency: Generate only a single simple crown to reduce geometry
    const crownGeometry = new THREE.SphereGeometry(
      foliage.canopyRadius * 0.5, // Much smaller
      6, // Low detail sphere
      4   // Very low detail
    );
    
    // Position at top of trunk
    crownGeometry.translate(0, trunkParams.height + foliage.canopyRadius * 0.3, 0);
    
    const foliageMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...treeParams.colors.leaves),
    });
    
    return {
      geometry: crownGeometry,
      material: foliageMaterial,
      clusters: [{ position: new THREE.Vector3(0, trunkParams.height, 0), radius: foliage.canopyRadius }],
      vertexCount: crownGeometry.attributes.position.count,
    };

  }

  /**
   * Generate a cluster of foliage
   */
  generateFoliageCluster(params) {
    const { position, radius, density, treeParams } = params;
    const leafCount = Math.floor(radius * radius * density * 100); // Density-based leaf count
    const leafGeometries = [];
    
    for (let i = 0; i < leafCount; i++) {
      // Random position within sphere
      const theta = treeParams.random() * Math.PI * 2;
      const phi = Math.acos(2 * treeParams.random() - 1);
      const r = Math.cbrt(treeParams.random()) * radius; // Cubic root for more natural distribution
      
      const leafPos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.7, // Flatten vertically
        r * Math.sin(phi) * Math.sin(theta)
      ).add(position);
      
      // Create simple leaf geometry (plane)
      const leafSize = this.lerp(
        treeParams.foliage.leafSize.min,
        treeParams.foliage.leafSize.max,
        treeParams.random()
      );
      
      const leafGeometry = new THREE.PlaneGeometry(leafSize, leafSize);
      
      // Random rotation for natural look
      leafGeometry.rotateX((treeParams.random() - 0.5) * Math.PI);
      leafGeometry.rotateY(treeParams.random() * Math.PI * 2);
      leafGeometry.rotateZ((treeParams.random() - 0.5) * Math.PI);
      
      // Position the leaf
      leafGeometry.translate(leafPos.x, leafPos.y, leafPos.z);
      
      leafGeometries.push(leafGeometry);
    }
    
    return {
      position: position.clone(),
      radius,
      leafCount,
      geometries: leafGeometries,
    };
  }

  /**
   * Utility functions
   */
  
  generateTreeId(position) {
    return `tree_${Math.floor(position.x)}_${Math.floor(position.y)}_${Math.floor(position.z)}`;
  }

  createSeededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  addColorVariation(baseColor, variation) {
    return baseColor.map(component => 
      Math.max(0, Math.min(1, component + (Math.random() - 0.5) * variation * 2))
    );
  }

  addTrunkIrregularity(geometry, random) {
    const position = geometry.attributes.position;
    const array = position.array;
    
    for (let i = 0; i < array.length; i += 3) {
      const x = array[i];
      const y = array[i + 1];
      const z = array[i + 2];
      
      // Add slight random offset to vertices
      const offset = 0.05 * (random() - 0.5);
      array[i] = x + offset * Math.abs(x);
      array[i + 2] = z + offset * Math.abs(z);
    }
    
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  combineBranchGeometries(branches) {
    if (branches.length === 0) return new THREE.BufferGeometry();
    
    const geometries = branches.map(branch => {
      const geo = branch.geometry.clone();
      // Apply branch transformation
      geo.translate(branch.midPoint.x, branch.midPoint.y, branch.midPoint.z);
      return geo;
    });
    
    return this.mergeBufferGeometries(geometries);
  }

  combineFoliageGeometries(clusters) {
    if (clusters.length === 0) return new THREE.BufferGeometry();
    
    const allGeometries = [];
    for (const cluster of clusters) {
      allGeometries.push(...cluster.geometries);
    }
    
    return this.mergeBufferGeometries(allGeometries);
  }

  mergeBufferGeometries(geometries) {
    if (geometries.length === 0) return new THREE.BufferGeometry();
    if (geometries.length === 1) return geometries[0];
    
    try {
      // Try mergeGeometries first (newer API)
      if (BufferGeometryUtils.mergeGeometries) {
        return BufferGeometryUtils.mergeGeometries(geometries);
      }
      // Fallback to old API without console spam
      if (BufferGeometryUtils.mergeBufferGeometries) {
        return BufferGeometryUtils.mergeBufferGeometries(geometries);
      }
      throw new Error('No merge function available');
    } catch (error) {
      console.warn('Geometry merge failed, using manual merge fallback');
      // Manual merge fallback for very simple cases
      const mergedGeometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];
      
      let indexOffset = 0;
      const indices = [];
      
      for (const geometry of geometries) {
        const pos = geometry.attributes.position;
        const norm = geometry.attributes.normal;
        const uv = geometry.attributes.uv;
        
        if (pos) positions.push(...pos.array);
        if (norm) normals.push(...norm.array);
        if (uv) uvs.push(...uv.array);
        
        if (geometry.index) {
          const geomIndices = geometry.index.array;
          for (let i = 0; i < geomIndices.length; i++) {
            indices.push(geomIndices[i] + indexOffset);
          }
          indexOffset += pos.count;
        }
      }
      
      if (positions.length > 0) {
        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      }
      if (normals.length > 0) {
        mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      }
      if (uvs.length > 0) {
        mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      }
      if (indices.length > 0) {
        mergedGeometry.setIndex(indices);
      }
      
      return mergedGeometry;
    }
  }

  calculateBoundingBox(trunk, branches, foliage) {
    const box = new THREE.Box3();
    
    // Add trunk bounds - use setFromBufferAttribute instead of setFromObject
    if (trunk.geometry && trunk.geometry.attributes.position) {
      const trunkBox = new THREE.Box3().setFromBufferAttribute(trunk.geometry.attributes.position);
      box.union(trunkBox);
    }
    
    // Add branch bounds
    if (branches.geometry && branches.geometry.attributes.position) {
      const branchBox = new THREE.Box3().setFromBufferAttribute(branches.geometry.attributes.position);
      box.union(branchBox);
    }
    
    // Add foliage bounds
    if (foliage.geometry && foliage.geometry.attributes.position) {
      const foliageBox = new THREE.Box3().setFromBufferAttribute(foliage.geometry.attributes.position);
      box.union(foliageBox);
    }
    
    return box;
  }
} 