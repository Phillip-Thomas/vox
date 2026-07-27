import React from 'react';
import { theme } from '../../ui/theme.ts';
import { setMapViewOpen, useMapViewOpen } from '../../game/mapView.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';

// --- Survey chart chrome --------------------------------------------------------------
//
// DOM dressing over the [M] overhead camera: grid, title, center mark, close
// hint. The world underneath is the REAL render — this is only the frame. Kept
// deliberately in the nav era's visual language (the story rung that taught it).

const INK = 'rgba(228,236,231,0.9)';
const INK_DIM = 'rgba(228,236,231,0.5)';

const MapOverlay: React.FC = () => {
  const open = useMapViewOpen();
  const touch = isTouchDevice();
  if (!open) return null;

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: theme.z.hud + 3, pointerEvents: 'none', fontFamily: theme.font.mono, letterSpacing: '0.14em' }}>
      {/* grid */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(228,236,231,0.08) 0 1px, transparent 1px 64px),'
            + ' repeating-linear-gradient(90deg, rgba(228,236,231,0.08) 0 1px, transparent 1px 64px)'
        }}
      />
      {/* edge vignette so the chart reads as an instrument, not a glitch */}
      <div style={{ position: 'fixed', inset: 0, boxShadow: 'inset 0 0 140px rgba(0,0,0,0.55)' }} />
      {/* corner brackets */}
      <div style={{ position: 'fixed', top: 14, left: 14, width: 26, height: 26, borderTop: `2px solid ${INK_DIM}`, borderLeft: `2px solid ${INK_DIM}` }} />
      <div style={{ position: 'fixed', top: 14, right: 14, width: 26, height: 26, borderTop: `2px solid ${INK_DIM}`, borderRight: `2px solid ${INK_DIM}` }} />
      <div style={{ position: 'fixed', bottom: 14, left: 14, width: 26, height: 26, borderBottom: `2px solid ${INK_DIM}`, borderLeft: `2px solid ${INK_DIM}` }} />
      <div style={{ position: 'fixed', bottom: 14, right: 14, width: 26, height: 26, borderBottom: `2px solid ${INK_DIM}`, borderRight: `2px solid ${INK_DIM}` }} />
      {/* title + hints */}
      <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: INK }}>
        — SURVEY CHART · GRID 64 —
      </div>
      {touch ? (
        <button
          type="button"
          onClick={() => setMapViewOpen(false)}
          style={{
            position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: '50%',
            transform: 'translateX(-50%)', minHeight: 44, padding: '11px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: theme.font.mono, fontSize: 10, letterSpacing: '0.14em', color: INK,
            border: `1px solid ${INK_DIM}`, borderRadius: theme.radius.md,
            background: 'rgba(2,6,4,0.72)', pointerEvents: 'auto',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', cursor: 'pointer'
          }}
        >
          YOU ARE THE SMALL MARK · TAP TO CLOSE
        </button>
      ) : (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: INK_DIM }}>
          YOU ARE THE SMALL MARK · [M] CLOSE
        </div>
      )}
      {/* center mark (the player) */}
      <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 16, color: INK }}>
        ◆
      </div>
    </div>
  );
};

export default MapOverlay;
