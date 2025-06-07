import React, { useState, useEffect } from 'react';
import './ClickToPlay.css';

const ClickToPlay = ({ isPointerLocked, isGamePaused }) => {
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    // Show overlay only when game is paused or on initial load (when never locked)
    if (isGamePaused) {
      setShowOverlay(true);
    } else {
      setShowOverlay(!isPointerLocked);
    }
  }, [isPointerLocked, isGamePaused]);

  useEffect(() => {
    const handlePointerLockError = () => {
      console.warn('Pointer lock failed');
      setShowOverlay(true);
    };

    document.addEventListener('pointerlockerror', handlePointerLockError);

    return () => {
      document.removeEventListener('pointerlockerror', handlePointerLockError);
    };
  }, []);

  const handleClick = () => {
    const canvas = document.querySelector('canvas');
    if (canvas && !isPointerLocked) {
      canvas.requestPointerLock();
    }
  };

  if (!showOverlay) {
    return null;
  }

  return (
    <div className="click-to-play-overlay" onClick={handleClick}>
      <div className="click-to-play-content">
        <div className="play-icon">{isGamePaused ? '⏸️' : '🎮'}</div>
        <h2>{isGamePaused ? 'Game Paused' : 'Click to Play'}</h2>
        <p>{isGamePaused ? 'Click anywhere to resume exploring' : 'Click anywhere to start exploring your voxel world'}</p>
        <div className="play-instructions">
          <div>• WASD to move around</div>
          <div>• Mouse to look around</div>
          <div>• Q/E to fly up/down (dev mode)</div>
          <div>• F to toggle player/dev mode</div>
          <div>• T to open terrain controls</div>
          <div>• ESC to {isGamePaused ? 'resume' : 'pause'}</div>
        </div>
      </div>
    </div>
  );
};

export default ClickToPlay; 