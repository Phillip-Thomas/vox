import React, { useEffect, useState } from 'react';
import {
  cycleBuildRotation,
  getBuildRotation,
  getSelectedMaterial,
  getSelectedPiece,
  isBuildEnabled,
  setBuildEnabled,
  setSelectedMaterial,
  setSelectedPiece,
  subscribeBuildState
} from '../../game/systems/buildState.ts';
import { BUILD_PIECES, BUILD_PIECE_ORDER } from '../../game/data/buildPieces.ts';
import { ALL_BUILD_MATERIALS, BUILD_MATERIALS, pieceCost } from '../../game/data/buildMaterials.ts';
import { getItem } from '../../game/data/items.ts';
import { isTouchDevice, KEY_CODES, pressKey, releaseKey } from '../../utils/mobileInput.ts';

/**
 * Build-mode HUD. Desktop keeps the pointer-transparent keyboard legend. Touch
 * gets a real palette tray because number-key hints and hoverless text are not
 * usable mobile controls.
 */
const BuildIndicator: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => subscribeBuildState(() => force(n => n + 1)), []);
  if (!isBuildEnabled()) return null;

  if (isTouchDevice()) return <MobileBuildEditor />;

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

function tapKey(code: string): void {
  pressKey(code);
  window.setTimeout(() => releaseKey(code), 90);
}

const mobileNoSelect: React.CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent'
};

const mobileButtonBase: React.CSSProperties = {
  minHeight: 40,
  border: '1px solid rgba(125,211,252,0.22)',
  borderRadius: 8,
  color: '#d8f3ff',
  background: 'rgba(8,13,24,0.68)',
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  cursor: 'pointer',
  touchAction: 'manipulation',
  ...mobileNoSelect
};

const MobileBuildEditor: React.FC = () => {
  const selected = getSelectedPiece();
  const selectedMaterial = getSelectedMaterial();
  const rotation = getBuildRotation();
  const piece = BUILD_PIECES[selected];
  const material = BUILD_MATERIALS[selectedMaterial];
  const costLabel = pieceCost(selected, selectedMaterial)
    .map(item => `${item.qty} ${getItem(item.id).name}`)
    .join(' + ');

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(66px + env(safe-area-inset-top, 0px))',
      left: 'calc(10px + env(safe-area-inset-left, 0px))',
      right: 'calc(10px + env(safe-area-inset-right, 0px))',
      zIndex: 28,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
      fontFamily: 'monospace',
      color: '#e6eef7',
      textShadow: '0 1px 3px rgba(0,0,0,0.8)'
    }}>
      <section
        aria-label="Mobile build editor"
        style={{
          width: 'min(620px, 100%)',
          maxHeight: 'min(176px, calc(100svh - 252px))',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 10,
          overflow: 'hidden',
          pointerEvents: 'auto',
          background: 'linear-gradient(180deg, rgba(9,17,30,0.92), rgba(5,8,15,0.82))',
          border: '1px solid rgba(125,211,252,0.28)',
          borderRadius: 8,
          boxShadow: '0 16px 46px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px) saturate(125%)',
          WebkitBackdropFilter: 'blur(16px) saturate(125%)',
          touchAction: 'pan-x pan-y',
          ...mobileNoSelect
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 900, letterSpacing: 1.6 }}>
              BUILD
            </div>
            <div style={{
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              color: '#e6eef7',
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              <span title={`Cost: ${costLabel}`}>{piece.name}</span>
              <span style={{ color: 'rgba(207,224,255,0.48)' }}>·</span>
              <span style={{ color: '#bfffd6' }}>{material.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={cycleBuildRotation}
            aria-label={`Rotate build piece. Current rotation ${rotation * 90} degrees`}
            title="Rotate"
            style={{
              ...mobileButtonBase,
              flex: '0 0 40px',
              width: 40,
              padding: 0,
              fontSize: 16,
              color: '#bfffd6',
              borderColor: 'rgba(125,255,160,0.34)',
              background: 'rgba(21,128,61,0.24)'
            }}
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => tapKey(KEY_CODES.mine)}
            style={{
              ...mobileButtonBase,
              flex: '0 0 auto',
              minWidth: 70,
              padding: '0 12px',
              color: '#061014',
              borderColor: 'rgba(125,211,252,0.75)',
              background: 'linear-gradient(180deg, #7dd3fc, #38bdf8)',
              boxShadow: '0 6px 18px rgba(56,189,248,0.28)'
            }}
          >
            Place
          </button>
          <button
            type="button"
            onClick={() => tapKey(KEY_CODES.deconstruct)}
            style={{
              ...mobileButtonBase,
              flex: '0 0 auto',
              minWidth: 72,
              padding: '0 12px',
              color: '#ffd8d8',
              borderColor: 'rgba(252,165,165,0.32)',
              background: 'rgba(127,29,29,0.28)'
            }}
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setBuildEnabled(false)}
            aria-label="Close build editor"
            title="Close"
            style={{
              ...mobileButtonBase,
              flex: '0 0 40px',
              width: 40,
              padding: 0,
              color: 'rgba(207,224,255,0.72)',
              background: 'rgba(8,13,24,0.42)'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 2,
          overscrollBehaviorX: 'contain',
          scrollbarWidth: 'none',
          touchAction: 'pan-x'
        }}>
          {BUILD_PIECE_ORDER.map((type, index) => {
            const active = type === selected;
            const def = BUILD_PIECES[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedPiece(type)}
                aria-pressed={active}
                aria-label={`Select ${def.name}`}
                style={{
                  flex: '0 0 112px',
                  minHeight: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: 3,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'rgba(125,255,160,0.66)' : 'rgba(125,211,252,0.20)'}`,
                  background: active
                    ? 'linear-gradient(180deg, rgba(21,128,61,0.42), rgba(8,47,73,0.42))'
                    : 'rgba(8,13,24,0.48)',
                  color: active ? '#d7ffe4' : '#cfe0ff',
                  boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px rgba(125,255,160,0.11)' : 'none',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  ...mobileNoSelect
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {def.name}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: active ? 'rgba(215,255,228,0.72)' : 'rgba(207,224,255,0.52)', fontSize: 9, lineHeight: 1.1 }}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{def.family}</span>
                </span>
              </button>
            );
          })}
        </div>

        {ALL_BUILD_MATERIALS.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', touchAction: 'pan-x' }}>
            {ALL_BUILD_MATERIALS.map(id => {
              const active = id === selectedMaterial;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedMaterial(id)}
                  aria-pressed={active}
                  style={{
                    ...mobileButtonBase,
                    minHeight: 34,
                    padding: '0 10px',
                    color: active ? '#061014' : '#cfe0ff',
                    background: active ? 'linear-gradient(180deg, #bfffd6, #7dffb0)' : 'rgba(8,13,24,0.48)',
                    borderColor: active ? 'rgba(125,255,160,0.75)' : 'rgba(125,211,252,0.20)'
                  }}
                >
                  {BUILD_MATERIALS[id].name}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default BuildIndicator;
