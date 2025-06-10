// Performance configuration for voxel rendering

export interface PerformanceConfig {
  // LOD (Level of Detail) settings
  lodDistances: number[];
  lodFactors: number[];
  
  // Chunk settings
  chunkSize: number;
  maxVoxelsPerFrame: number;
  
  // Culling settings
  enableFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
  
  // Physics settings
  physicsEnabled: boolean;
  maxPhysicsObjects: number;
  
  // Rendering settings
  shadowsEnabled: boolean;
  maxDrawCalls: number;
}

// Predefined performance profiles
export const PERFORMANCE_PROFILES: Record<string, PerformanceConfig> = {
  // Maximum quality - for high-end systems
  ULTRA: {
    lodDistances: [30, 60, 120, 200],
    lodFactors: [1, 2, 3, 4],
    chunkSize: 4,
    maxVoxelsPerFrame: 10000,
    enableFrustumCulling: true,
    enableOcclusionCulling: true,
    physicsEnabled: true,
    maxPhysicsObjects: 5000,
    shadowsEnabled: true,
    maxDrawCalls: 1000,
  },
  
  // High quality with good performance
  HIGH: {
    lodDistances: [20, 50, 100, 150],
    lodFactors: [1, 2, 3, 4],
    chunkSize: 8,
    maxVoxelsPerFrame: 7500,
    enableFrustumCulling: true,
    enableOcclusionCulling: true,
    physicsEnabled: true,
    maxPhysicsObjects: 3000,
    shadowsEnabled: true,
    maxDrawCalls: 750,
  },
  
  // Balanced performance and quality
  MEDIUM: {
    lodDistances: [15, 30, 60, 100],
    lodFactors: [1, 2, 3, 4],
    chunkSize: 8,
    maxVoxelsPerFrame: 5000,
    enableFrustumCulling: true,
    enableOcclusionCulling: true,
    physicsEnabled: true,
    maxPhysicsObjects: 2000,
    shadowsEnabled: false,
    maxDrawCalls: 500,
  },
  
  // Performance focused - for lower-end systems
  LOW: {
    lodDistances: [10, 20, 40, 80],
    lodFactors: [1, 2, 4, 6],
    chunkSize: 16,
    maxVoxelsPerFrame: 2500,
    enableFrustumCulling: true,
    enableOcclusionCulling: false,
    physicsEnabled: true,
    maxPhysicsObjects: 1000,
    shadowsEnabled: false,
    maxDrawCalls: 250,
  },
  
  // Minimum quality for maximum performance
  POTATO: {
    lodDistances: [5, 15, 30, 60],
    lodFactors: [2, 4, 6, 8],
    chunkSize: 32,
    maxVoxelsPerFrame: 1000,
    enableFrustumCulling: true,
    enableOcclusionCulling: false,
    physicsEnabled: false,
    maxPhysicsObjects: 500,
    shadowsEnabled: false,
    maxDrawCalls: 100,
  },
};

// Auto-detect performance level based on system capabilities
export function detectPerformanceLevel(): keyof typeof PERFORMANCE_PROFILES {
  // Basic performance detection
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  if (!gl) return 'POTATO';
  
  // Check for WebGL2 support
  const hasWebGL2 = !!canvas.getContext('webgl2');
  
  // Check renderer info
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
  
  // Simple GPU detection (this is very basic - you might want to improve this)
  const isHighEnd = /RTX|GTX 10[6-9]0|GTX 16[0-9]0|GTX 20[0-9]0|GTX 30[0-9]0|Radeon RX [5-7][0-9]00/i.test(renderer);
  const isMidRange = /GTX [9][0-9]0|GTX 10[0-5]0|Radeon RX [4][0-9]0|Radeon RX 5[0-4]00/i.test(renderer);
  
  // Check available memory (rough estimate)
  const memoryInfo = (gl as any).getExtension?.('WEBGL_debug_renderer_info');
  
  if (isHighEnd && hasWebGL2) return 'ULTRA';
  if (isMidRange && hasWebGL2) return 'HIGH';
  if (hasWebGL2) return 'MEDIUM';
  return 'LOW';
}

// Dynamic performance adjustment based on FPS
export class AdaptivePerformance {
  private currentProfile: keyof typeof PERFORMANCE_PROFILES = 'MEDIUM';
  private fpsHistory: number[] = [];
  private adjustmentCooldown = 0;
  
  constructor(initialProfile?: keyof typeof PERFORMANCE_PROFILES) {
    this.currentProfile = initialProfile || detectPerformanceLevel();
  }
  
  update(fps: number): keyof typeof PERFORMANCE_PROFILES {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift(); // Keep last 60 frames
    }
    
    if (this.adjustmentCooldown > 0) {
      this.adjustmentCooldown--;
      return this.currentProfile;
    }
    
    // Calculate average FPS over last 60 frames
    const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    
    const profiles = Object.keys(PERFORMANCE_PROFILES) as (keyof typeof PERFORMANCE_PROFILES)[];
    const currentIndex = profiles.indexOf(this.currentProfile);
    
    // Adjust performance level based on FPS
    if (avgFPS < 20 && currentIndex < profiles.length - 1) {
      // Performance too low, reduce quality
      this.currentProfile = profiles[currentIndex + 1];
      this.adjustmentCooldown = 300; // Wait 5 seconds before next adjustment
      console.log(`Performance adjusted to ${this.currentProfile} (FPS: ${avgFPS.toFixed(1)})`);
    } else if (avgFPS > 50 && currentIndex > 0) {
      // Performance good, try increasing quality
      this.currentProfile = profiles[currentIndex - 1];
      this.adjustmentCooldown = 300;
      console.log(`Performance adjusted to ${this.currentProfile} (FPS: ${avgFPS.toFixed(1)})`);
    }
    
    return this.currentProfile;
  }
  
  getCurrentConfig(): PerformanceConfig {
    return PERFORMANCE_PROFILES[this.currentProfile];
  }
  
  setProfile(profile: keyof typeof PERFORMANCE_PROFILES): void {
    this.currentProfile = profile;
    this.fpsHistory = []; // Reset history when manually changing
  }
} 