import React from 'react';
import { hudIconButtonStyle, hudTopRightClusterStyle } from './hudChrome.ts';

interface HudCornerActionsProps {
  controlMode: 'fps' | 'flight';
  buildModeOpen: boolean;
  /** Story chapters hide the gated affordances (sandbox: always true). */
  allowBuild?: boolean;
  allowCraft?: boolean;
  onToggleBuild: () => void;
  onOpenCrafting: () => void;
  onPause: () => void;
  pauseLabel?: string;
}

const HudCornerActions: React.FC<HudCornerActionsProps> = ({
  controlMode,
  buildModeOpen,
  allowBuild = true,
  allowCraft = true,
  onToggleBuild,
  onOpenCrafting,
  onPause,
  pauseLabel = 'Pause and open star map'
}) => {
  const showFootActions = controlMode === 'fps';

  return (
    <div aria-label="HUD quick actions" style={hudTopRightClusterStyle()}>
      {showFootActions && allowBuild && (
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
      {showFootActions && allowCraft && (
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
        aria-label={pauseLabel}
        title={pauseLabel}
        style={hudIconButtonStyle()}
      >
        M
      </button>
    </div>
  );
};

export default HudCornerActions;
