import React from 'react';

export function Crosshair() {
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 1000,
    }}>
      {/* Horizontal line */}
      <div style={{
        position: 'absolute',
        width: '16px',
        height: '2px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 2px rgba(0, 0, 0, 0.5)'
      }} />
      
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        width: '2px',
        height: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 2px rgba(0, 0, 0, 0.5)'
      }} />
    </div>
  );
}

export default Crosshair; 