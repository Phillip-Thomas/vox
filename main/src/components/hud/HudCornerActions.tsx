import React from 'react';
import { hudIconButtonStyle, hudTopRightClusterStyle } from './hudChrome.ts';

interface HudCornerActionsProps {
  controlMode: 'fps' | 'flight';
  buildModeOpen: boolean;
  onToggleBuild: () => void;
  onOpenCrafting: () => void;
  onPause: () => void;
}

const HudCornerActions: React.FC<HudCornerActionsProps> = ({
  controlMode,
  buildModeOpen,
  onToggleBuild,
  onOpenCrafting,
  onPause
}) => {
  const showFootActions = controlMode === 'fps';

  return (
    <div aria-label="HUD quick actions" style={hudTopRightClusterStyle()}>
      {showFootActions && (
        <button
          type="button"
          onClick={onToggleBuild}
          aria-label={buildModeOpen ? 'Close build editor' : 'Open build editor'}
          title={buildModeOpen ? 'Close build editor' : 'Open build editor'}
          style={hudIconButtonStyle(buildModeOpen)}
        >
          B
        </button>
      )}
      {showFootActions && (
        <button
          type="button"
          onClick={onOpenCrafting}
          aria-label="Open fabricator"
          title="Open fabricator"
          style={hudIconButtonStyle()}
        >
          C
        </button>
      )}
      <button
        type="button"
        onClick={onPause}
        aria-label="Pause and open star map"
        title="Pause and open star map"
        style={hudIconButtonStyle()}
      >
        M
      </button>
    </div>
  );
};

export default HudCornerActions;
