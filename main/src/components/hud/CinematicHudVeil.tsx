import React from 'react';
import { useCinematicHudHidden } from '../../story/ux/cinematicHud.ts';

// Fades (never unmounts) the informational HUD block while a letterboxed
// cinematic is in, so the sandbox chrome doesn't sit under the bars. Unmounting
// would churn layout and drop transient HUD state; an opacity fade + `inert`
// keeps the components mounted, invisible, and non-interactive during the shot,
// then restores them on decay. Critical safety warnings (crash flash, lava-heat
// vignette) are rendered OUTSIDE this veil so they stay immediate.
//
// The wrapper carries no layout of its own — every child is position:fixed/
// absolute and escapes it — so it can safely group the corner rail, minimap,
// vitals, inventory, crosshair, and the touch controls under one fade.

const FADE_MS = 260;

const CinematicHudVeil: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hidden = useCinematicHudHidden();
  return (
    <div
      data-testid="cinematic-hud-veil"
      data-hidden={hidden ? 'true' : 'false'}
      // React 19 `inert` fully removes the subtree from pointer + focus while
      // hidden; the child components' own pointer-events:auto can't override it.
      inert={hidden}
      style={{
        opacity: hidden ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: hidden ? 'none' : undefined
      }}
    >
      {children}
    </div>
  );
};

export default CinematicHudVeil;
