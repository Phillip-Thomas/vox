import React from 'react';
import { useSpaceFlight } from '../../state/spaceFlight.ts';

interface CockpitReadoutProps {
  coordinateLabel: string;
  seed: number;
}

/**
 * Bottom-centre cockpit status line, shown only while flying the ship
 * (controlMode === 'flight'). Mirrors the phase-specific control hints.
 */
const CockpitReadout: React.FC<CockpitReadoutProps> = ({ coordinateLabel, seed }) => {
  const flight = useSpaceFlight();
  if (flight.controlMode !== 'flight') return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#cfe8ff',
      fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.6)',
      padding: '10px 16px',
      borderRadius: 8,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 1.5,
      border: '1px solid rgba(125,211,252,0.35)',
      pointerEvents: 'none'
    }}>
      <div style={{ color: '#7dd3fc', fontWeight: 'bold', letterSpacing: 1 }}>
        COCKPIT - {flight.phase.toUpperCase()}
      </div>
      <div>Coordinate {coordinateLabel} - Seed {seed}</div>
      <div style={{ opacity: 0.75, marginTop: 4 }}>
        {flight.phase === 'surface'
          ? 'LANDED - SPACE to launch - F to exit ship'
          : flight.phase === 'descent'
            ? 'W/S thrust - mouse look - Q/E roll - fly low over ground, then F to land'
            : 'W/S thrust - mouse look - Q/E roll - Shift boost - fly down to a planet'}
      </div>
    </div>
  );
};

export default CockpitReadout;
