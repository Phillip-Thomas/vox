import { RapierRigidBody } from '@react-three/rapier';

/**
 * Physics optimization utilities for voxel game performance
 */

export interface PhysicsOptimizationConfig {
  enableSleeping: boolean;
  maxSleepingBodies: number;
  disableCCD: boolean;
  optimizeDamping: boolean;
  monitorPerformance: boolean;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsOptimizationConfig = {
  enableSleeping: true,
  maxSleepingBodies: 10000,
  disableCCD: true,
  optimizeDamping: true,
  monitorPerformance: true,
};

/**
 * Monitor physics performance of rigid bodies
 */
export function monitorPhysicsPerformance(rigidBodies: RapierRigidBody[]): {
  totalBodies: number;
  sleepingBodies: number;
  activeBodies: number;
  performanceRatio: number;
} {
  const totalBodies = rigidBodies.length;
  let sleepingBodies = 0;
  
  rigidBodies.forEach(body => {
    if (body.isSleeping && body.isSleeping()) {
      sleepingBodies++;
    }
  });
  
  const activeBodies = totalBodies - sleepingBodies;
  const performanceRatio = totalBodies > 0 ? sleepingBodies / totalBodies : 0;
  
  return {
    totalBodies,
    sleepingBodies,
    activeBodies,
    performanceRatio
  };
}

/**
 * Apply optimal physics settings to rigid bodies for maximum performance
 */
export function applyPhysicsOptimizations(
  rigidBodies: RapierRigidBody[], 
  config: PhysicsOptimizationConfig = DEFAULT_PHYSICS_CONFIG
): void {
  let optimizedCount = 0;
  
  rigidBodies.forEach((body, index) => {
    try {
      // Disable CCD for performance (unless specifically needed)
      if (config.disableCCD && body.enableCcd) {
        body.enableCcd(false);
      }
      
      // Optimize damping for faster settling
      if (config.optimizeDamping) {
        if (body.setLinearDamping) {
          body.setLinearDamping(0.8); // Higher damping for faster settling
        }
        if (body.setAngularDamping) {
          body.setAngularDamping(0.8); // Higher angular damping
        }
      }
      
      // Enable sleeping and configure sleep thresholds for kinematic bodies
      if (config.enableSleeping) {
        // Force bodies to sleep immediately if they're static terrain
        const userData = body.userData as any;
        if (userData?.voxelType === 'terrain' || body.bodyType() !== 0) { // 0 = Dynamic
          body.sleep();
        }
      }
      
      optimizedCount++;
    } catch (error) {
      console.warn(`Failed to optimize rigid body ${index}:`, error);
    }
  });
  
  if (config.monitorPerformance) {
    console.log(`🚀 PHYSICS OPTIMIZATION: Successfully optimized ${optimizedCount}/${rigidBodies.length} rigid bodies`);
  }
}

/**
 * Wake up sleeping bodies in a specific region (for dynamic interactions)
 */
export function wakeUpBodiesInRegion(
  rigidBodies: RapierRigidBody[],
  center: [number, number, number],
  radius: number
): number {
  let awakened = 0;
  
  rigidBodies.forEach(body => {
    if (body.isSleeping && body.isSleeping()) {
      const translation = body.translation();
      const distance = Math.sqrt(
        Math.pow(translation.x - center[0], 2) +
        Math.pow(translation.y - center[1], 2) +
        Math.pow(translation.z - center[2], 2)
      );
      
      if (distance <= radius) {
        body.wakeUp();
        awakened++;
      }
    }
  });
  
  return awakened;
}

/**
 * Get performance statistics for debugging
 */
export function getPhysicsPerformanceStats(rigidBodies: RapierRigidBody[]): string {
  const stats = monitorPhysicsPerformance(rigidBodies);
  
  return `
🎯 PHYSICS PERFORMANCE STATS:
📊 Total Bodies: ${stats.totalBodies}
😴 Sleeping Bodies: ${stats.sleepingBodies}
⚡ Active Bodies: ${stats.activeBodies}
📈 Performance Ratio: ${(stats.performanceRatio * 100).toFixed(1)}% sleeping
💡 CPU Savings: ~${((stats.performanceRatio * 100) / 2).toFixed(1)}% estimated
  `.trim();
}

/**
 * Apply critical collider optimizations to disable collision detection phases
 */
export function optimizeTerrainColliders(rigidBodies: RapierRigidBody[], instances: any[]): number {
  let optimizedColliders = 0;
  
  rigidBodies.forEach((body, index) => {
    // Get all colliders attached to this body
    const numColliders = body.numColliders();
    for (let i = 0; i < numColliders; i++) {
      const collider = body.collider(i);
      if (collider && instances[index]?.userData?.voxelType === 'terrain') {
        try {
          // Disable collision detection phases for terrain voxels
          if (collider.setActiveEvents) collider.setActiveEvents(0);           // No contact/intersection events
        //   if (collider.setCollisionGroups) collider.setCollisionGroups(0);     // Won't collide with anything
          optimizedColliders++;
        } catch (error) {
          console.warn('Could not optimize collider:', error);
        }
      }
    }
  });
  
  return optimizedColliders;
} 