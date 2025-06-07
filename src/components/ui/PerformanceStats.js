import React, { useState, useEffect } from 'react';
import { globalCollisionSystem } from '../../utils/VoxelCollisionSystem';

const PerformanceStats = ({ visible = false }) => {
  const [performanceStats, setPerformanceStats] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = globalCollisionSystem.getStats();
      setPerformanceStats(stats);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  if (!visible || !performanceStats) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      right: '20px',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '8px',
      borderRadius: '4px',
      zIndex: 1000,
      maxWidth: '200px'
    }}>
      <div>Collision Performance:</div>
      <div>Player Body: {performanceStats.playerBodySize}</div>
      <div>Voxels: {performanceStats.totalVoxels}</div>
      <div>Hash Buckets: {performanceStats.spatialHashBuckets}</div>
      <div>Checks/Frame: {performanceStats.checksPerFrame}</div>
      <div>Penetrations Fixed: {performanceStats.penetrationResolutions}</div>
      <div>Cache Hit Rate: {(performanceStats.cacheHitRatio * 100).toFixed(1)}%</div>
      <div>Cache Size: {performanceStats.collisionCacheSize + performanceStats.groundCacheSize}</div>
      <div style={{ marginTop: '4px', fontSize: '8px', opacity: 0.7 }}>
        Press P for detailed stats
      </div>
    </div>
  );
};

export default PerformanceStats; 