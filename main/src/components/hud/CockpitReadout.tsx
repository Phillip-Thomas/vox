import React, { useEffect, useState } from 'react';
import { useSpaceFlight } from '../../state/spaceFlight.ts';
import { getShipFlightFeedback } from '../../state/shipFlightFeedback.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';

interface CockpitReadoutProps {
  coordinateLabel: string;
}

interface Telemetry {
  speed: number;
  throttle: number;
  boost: number;
  limited: boolean;
}

const initialTelemetry: Telemetry = { speed: 0, throttle: 0, boost: 0, limited: false };

/** Compact live avionics; detailed geometry remains inside the physical cockpit. */
const CockpitReadout: React.FC<CockpitReadoutProps> = ({ coordinateLabel }) => {
  const flight = useSpaceFlight();
  const [telemetry, setTelemetry] = useState(initialTelemetry);

  useEffect(() => {
    if (flight.controlMode !== 'flight') return undefined;
    const read = () => {
      const next = getShipFlightFeedback();
      setTelemetry({
        speed: Math.round(next.speed),
        throttle: Math.round(next.throttle * 100),
        boost: Math.round(next.boost * 100),
        limited: next.approachLimited
      });
    };
    read();
    const timer = window.setInterval(read, 80);
    return () => window.clearInterval(timer);
  }, [flight.controlMode]);

  if (flight.controlMode !== 'flight') return null;
  const touch = isTouchDevice();
  const mode = flight.phase === 'deep_space'
    ? (touch ? 'SPACE' : 'LOCAL SPACE')
    : flight.phase === 'surface'
      ? 'GROUNDED'
      : flight.phase.toUpperCase();
  const throttle = `${telemetry.throttle >= 0 ? '+' : ''}${telemetry.throttle}%`;

  const cell = (label: string, value: string, accent = false) => (
    <div style={{ minWidth: touch ? 48 : 78, padding: touch ? '4px 6px' : '5px 11px', whiteSpace: 'nowrap' }}>
      <div style={{ color: 'rgba(190,213,226,0.58)', fontSize: 8, lineHeight: 1.1 }}>{label}</div>
      <div style={{ color: accent ? '#8eeaff' : '#e6f1f5', fontSize: touch ? 10 : 12, lineHeight: 1.35 }}>{value}</div>
    </div>
  );

  const drive = telemetry.boost > 20
    ? (touch ? `B${telemetry.boost}%` : `BOOST ${telemetry.boost}%`)
    : telemetry.limited ? 'LIMIT' : 'NOMINAL';

  return (
    <>
      {/* Dedicated flight boresight: stable through FOV changes and visible
          before a target lock supplies its own brackets. */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: touch ? 30 : 38,
        height: touch ? 30 : 38,
        transform: 'translate(-50%, -50%) rotate(45deg)',
        border: '1px solid rgba(139, 235, 255, 0.48)',
        clipPath: 'polygon(0 0, 28% 0, 28% 5%, 5% 5%, 5% 28%, 0 28%, 0 0, 72% 0, 100% 0, 100% 28%, 95% 28%, 95% 5%, 72% 5%, 72% 0, 100% 72%, 100% 100%, 72% 100%, 72% 95%, 95% 95%, 95% 72%, 100% 72%, 28% 100%, 0 100%, 0 72%, 5% 72%, 5% 95%, 28% 95%, 28% 100%)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 3px rgba(64, 206, 255, 0.45))'
      }} />

      <div style={{
      position: 'absolute',
      ...(touch ? { top: 10 } : { bottom: 14 }),
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'stretch',
      color: '#d9edf5',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      background: 'linear-gradient(90deg, rgba(5,13,18,0), rgba(5,13,18,0.84) 12%, rgba(5,13,18,0.84) 88%, rgba(5,13,18,0))',
      borderTop: '1px solid rgba(118,224,244,0.3)',
      borderBottom: '1px solid rgba(118,224,244,0.16)',
      clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
      fontSize: 12,
      textAlign: 'left',
      letterSpacing: 0,
      pointerEvents: 'none',
      maxWidth: touch ? '76vw' : 'min(760px, 80vw)',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {cell('MODE', mode, true)}
      {!touch && cell('SYSTEM', coordinateLabel)}
      {cell('VELOCITY', `${telemetry.speed} U/S`)}
      {cell('THRUST', throttle)}
      {cell('DRIVE', drive, telemetry.boost > 20)}
      </div>
    </>
  );
};

export default CockpitReadout;
