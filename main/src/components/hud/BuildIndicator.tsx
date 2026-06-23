import React, { useEffect, useState } from 'react';
import { isBuildEnabled, getSelectedPiece, subscribeBuildState } from '../../game/systems/buildState.ts';
import { BUILD_PIECES, BUILD_PIECE_ORDER } from '../../game/data/buildPieces.ts';

/**
 * Build-mode HUD. Shown only while build mode is on (toggle B). Lists the buildable
 * pieces with the active one highlighted, plus the controls. Pointer-transparent.
 */
const BuildIndicator: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => subscribeBuildState(() => force(n => n + 1)), []);
  if (!isBuildEnabled()) return null;
  const selected = getSelectedPiece();

  return (
    <div style={{
      position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      fontFamily: 'monospace', color: '#dfe7ee', pointerEvents: 'none', zIndex: 25,
      textShadow: '0 1px 3px rgba(0,0,0,0.9)'
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {BUILD_PIECE_ORDER.map((type, i) => {
          const active = type === selected;
          return (
            <div key={type} style={{
              fontSize: 12, padding: '5px 10px', borderRadius: 6,
              background: active ? 'rgba(125,255,160,0.18)' : 'rgba(8,13,24,0.55)',
              border: `1px solid ${active ? 'rgba(125,255,160,0.6)' : 'rgba(125,211,252,0.25)'}`,
              color: active ? '#bfffd6' : '#aab6c2'
            }}>
              <b style={{ opacity: 0.6 }}>{i + 1}</b> {BUILD_PIECES[type].name}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>
        BUILD MODE · [E] place · [X] remove · [1–{BUILD_PIECE_ORDER.length}] select · [B] exit
      </div>
    </div>
  );
};

export default BuildIndicator;
