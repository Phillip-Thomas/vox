import React, { useRef, useEffect, useState } from 'react';
import { getCurrentPerformanceSettings, detectAndSetOptimalPerformance } from '../config/performanceSettings';

interface PerformanceStats {
  fps: number;
  frameTime: number;
  cpuUsage: number;
  memoryUsage: number;
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    cpuUsage: 0,
    memoryUsage: 0
  });
  
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const fpsHistory = useRef<number[]>([]);
  const animationId = useRef<number | null>(null);
  
  // Initialize performance settings on mount
  useEffect(() => {
    detectAndSetOptimalPerformance();
  }, []);
  
  useEffect(() => {
    const updateStats = () => {
      frameCount.current++;
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime.current;
      
      // MEMORY LEAK FIX: Update stats less frequently to reduce garbage collection
      if (frameCount.current % 120 === 0) { // Every 2 seconds instead of 1 second
        const fps = 1000 / deltaTime;
        fpsHistory.current.push(fps);
        
        // Keep only last 5 seconds of FPS data instead of 10
        if (fpsHistory.current.length > 5) {
          fpsHistory.current.shift();
        }
        
        // Calculate average FPS
        const avgFPS = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;
        
        // Get memory usage if available
        const memory = (performance as any).memory;
        const memoryUsage = memory ? memory.usedJSHeapSize / 1024 / 1024 : 0; // MB
        
        setStats({
          fps: Math.round(avgFPS),
          frameTime: Math.round(deltaTime * 100) / 100,
          cpuUsage: avgFPS < 30 ? 90 : avgFPS < 45 ? 70 : avgFPS < 55 ? 50 : 30, // Rough estimate
          memoryUsage: Math.round(memoryUsage)
        });
        
        // Auto-adjust performance if FPS is consistently low
        if (fpsHistory.current.length >= 3) { // Reduced from 5 to 3
          const recentAvgFPS = fpsHistory.current.slice(-3).reduce((a, b) => a + b, 0) / 3;
          if (recentAvgFPS < 25) {
            console.warn('🚨 Low FPS detected, consider switching to POTATO performance mode');
          }
        }
      }
      
      lastTime.current = currentTime;
      animationId.current = requestAnimationFrame(updateStats);
    };
    
    animationId.current = requestAnimationFrame(updateStats);
    
    return () => {
      if (animationId.current !== null) {
        cancelAnimationFrame(animationId.current);
        animationId.current = null; // Clear the ref
      }
      // Clear arrays to prevent memory leaks
      fpsHistory.current.length = 0;
    };
  }, []);
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000,
      minWidth: '200px'
    }}>
      <div><strong>Performance Monitor</strong></div>
      <div>FPS: <span style={{ color: stats.fps < 30 ? '#ff4444' : stats.fps < 45 ? '#ffaa44' : '#44ff44' }}>
        {stats.fps}
      </span></div>
      <div>Frame Time: {stats.frameTime}ms</div>
      <div>CPU Usage: <span style={{ color: stats.cpuUsage > 80 ? '#ff4444' : stats.cpuUsage > 60 ? '#ffaa44' : '#44ff44' }}>
        ~{stats.cpuUsage}%
      </span></div>
      <div>Memory: {stats.memoryUsage}MB</div>
      <div style={{ marginTop: '5px', fontSize: '10px', color: '#aaa' }}>
        Profile: {getCurrentPerformanceSettings().targetFPS}fps target
      </div>
    </div>
  );
}

export default PerformanceMonitor; 