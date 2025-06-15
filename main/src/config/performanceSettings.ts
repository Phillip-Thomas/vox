// Performance settings to reduce CPU usage
export interface PerformanceSettings {
  // Frame rate limits
  targetFPS: number;
  frameSkipping: {
    raycast: number; // Skip raycasting every N frames
    boundaryCheck: number; // Skip boundary checks every N frames
    voxelUpdates: number; // Skip voxel updates every N frames
  };
  
  // Visual quality settings
  shadows: boolean;
  antialiasing: boolean;
  animation: {
    enableGlowPulsing: boolean;
    enableMetallicPulsing: boolean;
  };
  
  // Physics settings
  physicsUpdatesPerSecond: number;
  
  // Render distance
  maxRenderDistance: number;
}

// Performance profiles
export const PERFORMANCE_PROFILES = {
  ULTRA: {
    targetFPS: 60,
    frameSkipping: {
      raycast: 1, // Every frame
      boundaryCheck: 1, // Every frame
      voxelUpdates: 1, // Every frame
    },
    shadows: true,
    antialiasing: true,
    animation: {
      enableGlowPulsing: true,
      enableMetallicPulsing: true,
    },
    physicsUpdatesPerSecond: 60,
    maxRenderDistance: 100,
  } as PerformanceSettings,

  HIGH: {
    targetFPS: 60,
    frameSkipping: {
      raycast: 2, // Every 2 frames
      boundaryCheck: 2, // Every 2 frames
      voxelUpdates: 1, // Every frame
    },
    shadows: false,
    antialiasing: true,
    animation: {
      enableGlowPulsing: true,
      enableMetallicPulsing: true,
    },
    physicsUpdatesPerSecond: 60,
    maxRenderDistance: 80,
  } as PerformanceSettings,

  MEDIUM: {
    targetFPS: 45,
    frameSkipping: {
      raycast: 3, // Every 3 frames
      boundaryCheck: 3, // Every 3 frames
      voxelUpdates: 2, // Every 2 frames
    },
    shadows: false,
    antialiasing: false,
    animation: {
      enableGlowPulsing: true,
      enableMetallicPulsing: false,
    },
    physicsUpdatesPerSecond: 45,
    maxRenderDistance: 60,
  } as PerformanceSettings,

  LOW: {
    targetFPS: 30,
    frameSkipping: {
      raycast: 4, // Every 4 frames
      boundaryCheck: 5, // Every 5 frames
      voxelUpdates: 3, // Every 3 frames
    },
    shadows: false,
    antialiasing: false,
    animation: {
      enableGlowPulsing: false,
      enableMetallicPulsing: false,
    },
    physicsUpdatesPerSecond: 30,
    maxRenderDistance: 40,
  } as PerformanceSettings,

  POTATO: {
    targetFPS: 20,
    frameSkipping: {
      raycast: 6, // Every 6 frames
      boundaryCheck: 8, // Every 8 frames
      voxelUpdates: 5, // Every 5 frames
    },
    shadows: false,
    antialiasing: false,
    animation: {
      enableGlowPulsing: false,
      enableMetallicPulsing: false,
    },
    physicsUpdatesPerSecond: 20,
    maxRenderDistance: 25,
  } as PerformanceSettings,
} as const;

// Default to LOW performance for CPU-heavy systems
export const DEFAULT_PERFORMANCE_PROFILE = 'LOW';

// Get current performance settings
export function getCurrentPerformanceSettings(): PerformanceSettings {
  const profile = localStorage.getItem('performanceProfile') || DEFAULT_PERFORMANCE_PROFILE;
  return PERFORMANCE_PROFILES[profile as keyof typeof PERFORMANCE_PROFILES] || PERFORMANCE_PROFILES.LOW;
}

// Save performance profile
export function setPerformanceProfile(profile: keyof typeof PERFORMANCE_PROFILES) {
  localStorage.setItem('performanceProfile', profile);
}

// Auto-detect performance level based on system
export function detectAndSetOptimalPerformance() {
  // Simple heuristic based on available cores and memory
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4; // GB
  
  let recommendedProfile: keyof typeof PERFORMANCE_PROFILES;
  
  if (cores >= 8 && memory >= 8) {
    recommendedProfile = 'HIGH';
  } else if (cores >= 4 && memory >= 4) {
    recommendedProfile = 'MEDIUM';
  } else {
    recommendedProfile = 'LOW';
  }
  
  setPerformanceProfile(recommendedProfile);
  console.log(`🎯 Auto-detected performance profile: ${recommendedProfile} (${cores} cores, ${memory}GB RAM)`);
  
  return PERFORMANCE_PROFILES[recommendedProfile];
} 