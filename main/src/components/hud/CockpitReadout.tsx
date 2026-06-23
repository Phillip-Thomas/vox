import React from 'react';
import { useSpaceFlight } from '../../state/spaceFlight.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';

interface CockpitReadoutProps {
  coordinateLabel: string;
  seed: number;
}

/**
 * Cockpit status line, shown only while flying the ship (controlMode === 'flight').
 *
 * On desktop it sits bottom-centre with keyboard hints. On touch it moves to the
 * TOP (the bottom is full of the joystick + thrust/roll buttons) and shows compact
 * touch hints instead of keyboard ones, kept narrow so it clears the top-left
 * inventory and the top-right pause button.
 */
const CockpitReadout: React.FC<CockpitReadoutProps> = ({ coordinateLabel, seed }) => {
  const flight = useSpaceFlight();
  if (flight.controlMode !== 'flight') return null;
  const touch = isTouchDevice();

  const hint = touch
    ? (flight.phase === 'surface'
        ? 'THR to launch · F to exit'
        : flight.phase === 'descent'
          ? 'stick thrust · drag to look · F to land'
          : 'stick thrust · drag to look · aim at a planet')
    : (flight.phase === 'surface'
        ? 'LANDED - SPACE to launch - F to exit ship'
        : flight.phase === 'descent'
          ? 'W/S thrust - mouse look - Q/E roll - fly low over ground, then F to land'
          : 'W/S thrust - mouse look - Q/E roll - Shift boost - fly down to a planet');

  return (
    <div style={{
      position: 'absolute',
      ...(touch ? { top: 12 } : { bottom: 16 }),
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#cfe8ff',
      fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.6)',
      padding: touch ? '7px 12px' : '10px 16px',
      borderRadius: 8,
      fontSize: touch ? 11 : 13,
      textAlign: 'center',
      lineHeight: 1.5,
      border: '1px solid rgba(125,211,252,0.35)',
      pointerEvents: 'none',
      maxWidth: touch ? '60vw' : undefined,
      boxSizing: 'border-box'
    }}>
      <div style={{ color: '#7dd3fc', fontWeight: 'bold', letterSpacing: 1 }}>
        COCKPIT - {flight.phase.toUpperCase()}
      </div>
      <div>{coordinateLabel} · Seed {seed}</div>
      <div style={{ opacity: 0.75, marginTop: 4 }}>{hint}</div>
    </div>
  );
};

export default CockpitReadout;
