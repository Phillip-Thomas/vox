import React, { useEffect, useState } from 'react';
import {
  DOCK_SPEED_LIMIT,
  type ApproachReadout
} from '../../game/spaceStation/spaceStationApproach.ts';
import { useSpaceFlight } from '../../state/spaceFlight.ts';
import { getShipFlightFeedback } from '../../state/shipFlightFeedback.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { spaceStationContact } from '../SpaceStationApproachDriver.tsx';
import { hudSurface } from '../../ui/hudSurfaces.ts';

interface CockpitReadoutProps {
  coordinateLabel: string;
  /** A durable story objective owns route guidance; retain neutral flight telemetry only. */
  suppressedByStoryRoute?: boolean;
}

interface Telemetry {
  speed: number;
  throttle: number;
  boost: number;
  limited: boolean;
  approach: CockpitApproachPresentation | null;
}

export interface CockpitApproachPresentation {
  status: string;
  advisory: string;
  range: string;
  alignment: string;
  closing: string;
  canDock: boolean;
  tone: 'nominal' | 'warning' | 'ready';
  rangeWarning: boolean;
  alignmentWarning: boolean;
  closingWarning: boolean;
}

function cockpitApproachStatus(readout: ApproachReadout): string {
  if (readout.canDock) return 'CLEARANCE AVAILABLE';
  if (readout.blocker === 'speed') return 'CLOSING SPEED HIGH';
  if (readout.blocker === 'alignment') {
    return readout.phase === 'berth' ? 'DOCK MOUTH \u00b7 ALIGN' : 'LIT APPROACH \u00b7 ALIGN';
  }
  if (readout.phase === 'approach') return 'CORRIDOR HELD';
  if (readout.phase === 'unknown') return 'REACQUIRE STATION';
  return 'HOLD FOR APPROACH';
}

/**
 * The station procedure expressed in the Kestrel's own instrument language.
 * Gate math and advisory copy remain owned by evaluateApproach; this only
 * formats that one authoritative readout for the cockpit rail.
 */
export function presentCockpitApproach(readout: ApproachReadout): CockpitApproachPresentation {
  const alignmentWarning = readout.blocker === 'alignment';
  const closingWarning = readout.blocker === 'speed' || readout.closingSpeed > DOCK_SPEED_LIMIT;

  return {
    status: cockpitApproachStatus(readout),
    advisory: readout.advisory.toUpperCase(),
    range: `${Math.max(0, Math.round(readout.distance))} U`,
    alignment: readout.insideCorridor
      ? 'ON CORRIDOR'
      : `${Math.round(readout.offAxis * 180 / Math.PI)}\u00b0 OFF`,
    closing: `${Math.round(readout.closingSpeed)} / ${DOCK_SPEED_LIMIT}`,
    canDock: readout.canDock,
    tone: readout.canDock
      ? 'ready'
      : alignmentWarning || readout.blocker === 'speed'
        ? 'warning'
        : 'nominal',
    rangeWarning: readout.blocker === 'range',
    alignmentWarning,
    closingWarning
  };
}

const initialTelemetry: Telemetry = {
  speed: 0,
  throttle: 0,
  boost: 0,
  limited: false,
  approach: null
};

/** Compact live avionics; detailed geometry remains inside the physical cockpit. */
const CockpitReadout: React.FC<CockpitReadoutProps> = ({
  coordinateLabel,
  suppressedByStoryRoute = false
}) => {
  const flight = useSpaceFlight();
  const [telemetry, setTelemetry] = useState(initialTelemetry);

  useEffect(() => {
    if (flight.controlMode !== 'flight') return undefined;
    const read = () => {
      const next = getShipFlightFeedback();
      const station = suppressedByStoryRoute ? null : spaceStationContact();
      setTelemetry({
        speed: Math.round(next.speed),
        throttle: Math.round(next.throttle * 100),
        boost: Math.round(next.boost * 100),
        limited: next.approachLimited,
        approach: station ? presentCockpitApproach(station.readout) : null
      });
    };
    read();
    const timer = window.setInterval(read, 80);
    return () => window.clearInterval(timer);
  }, [flight.controlMode, suppressedByStoryRoute]);

  if (flight.controlMode !== 'flight') return null;
  const touch = isTouchDevice();
  const mode = flight.phase === 'deep_space'
    ? (touch ? 'SPACE' : 'LOCAL SPACE')
    : flight.phase === 'surface'
      ? 'GROUNDED'
      : flight.phase.toUpperCase();
  const throttle = `${telemetry.throttle >= 0 ? '+' : ''}${telemetry.throttle}%`;
  const approach = telemetry.approach;
  const approachAlignment = touch && approach?.alignment === 'ON CORRIDOR'
    ? 'ALIGNED'
    : approach?.alignment;
  const approachAccent = approach?.tone === 'ready'
    ? '#46ff8c'
    : approach?.tone === 'warning'
      ? '#ff7b57'
      : '#ffbd70';

  const cell = (
    label: string,
    value: string,
    accent: string | false = false,
    options: { wide?: boolean; hideOnTouch?: boolean } = {}
  ) => (
    <div style={{
      display: options.hideOnTouch && touch ? 'none' : 'block',
      minWidth: touch && approach ? 0 : options.wide ? (touch ? 112 : 200) : (touch ? 48 : 78),
      padding: touch ? '4px 6px' : '5px 11px',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }}>
      <div style={{ color: 'rgba(190,213,226,0.58)', fontSize: 8, lineHeight: 1.1 }}>{label}</div>
      <div style={{
        color: accent || '#e6f1f5',
        fontSize: touch ? (approach && options.wide ? 9 : 10) : 12,
        lineHeight: 1.35,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {value}
      </div>
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

      <div
        data-testid="cockpit-readout"
      {...hudSurface('cockpit-readout', 'informational')}
        data-station-approach={approach ? 'integrated' : undefined}
        data-story-route-mode={suppressedByStoryRoute ? 'flight-telemetry-only' : undefined}
        aria-label={approach ? `Kestrel station approach: ${approach.advisory}` : 'Kestrel flight telemetry'}
        style={{
          position: 'absolute',
          ...(suppressedByStoryRoute
            ? touch
              ? {
                  top: 'calc(72px + env(safe-area-inset-top, 0px))',
                  left: 'calc(12px + env(safe-area-inset-left, 0px))'
                }
              : { top: 18, left: '50%' }
            : touch && approach
              ? {
                  top: 10,
                  left: 'calc(12px + env(safe-area-inset-left, 0px))'
                }
              : touch ? { top: 10, left: '50%' } : { bottom: 14, left: '50%' }),
          transform: touch && (suppressedByStoryRoute || approach) ? undefined : 'translateX(-50%)',
          display: touch && approach ? 'grid' : 'flex',
          gridTemplateColumns: touch && approach
            ? 'minmax(0, 1.7fr) repeat(3, minmax(0, 0.8fr))'
            : undefined,
          alignItems: 'stretch',
          color: '#d9edf5',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          background: 'linear-gradient(90deg, rgba(5,13,18,0), rgba(5,13,18,0.84) 12%, rgba(5,13,18,0.84) 88%, rgba(5,13,18,0))',
          borderTop: `1px solid ${approach ? approachAccent : 'rgba(118,224,244,0.3)'}`,
          borderBottom: '1px solid rgba(118,224,244,0.16)',
          clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
          fontSize: 12,
          textAlign: 'left',
          letterSpacing: 0,
          pointerEvents: 'none',
          maxWidth: touch
            ? (approach
                ? 'calc(100vw - 70px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))'
                : '76vw')
            : approach ? 'min(900px, calc(100vw - 48px))' : 'min(760px, 80vw)',
          width: touch && approach
            ? 'calc(100vw - 70px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))'
            : undefined,
          paddingInline: approach ? (touch ? 4 : 10) : 0,
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {approach ? (
          <>
            {cell('ISSUING STATION', approach.status, approachAccent, { wide: true })}
            {cell('RANGE', approach.range, approach.rangeWarning ? '#ffbd70' : false)}
            {cell('ALIGNMENT', approachAlignment ?? approach.alignment, approach.alignmentWarning ? '#ff7b57' : false)}
            {cell('CLOSING', approach.closing, approach.closingWarning ? '#ff7b57' : false)}
            {cell('THRUST', throttle, false, { hideOnTouch: true })}
            {cell('DRIVE', drive, telemetry.boost > 20 ? '#8eeaff' : false, { hideOnTouch: true })}
          </>
        ) : (
          <>
            {cell('MODE', mode, '#8eeaff')}
            {!touch && cell('SYSTEM', coordinateLabel)}
            {cell('VELOCITY', `${telemetry.speed} U/S`)}
            {cell('THRUST', throttle)}
            {cell('DRIVE', drive, telemetry.boost > 20 ? '#8eeaff' : false)}
          </>
        )}
      </div>

      {approach?.canDock && (
        <div
          data-testid="spaceStation-dock-prompt"
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            left: '50%',
            top: '58%',
            transform: 'translateX(-50%)',
            padding: '6px 13px',
            font: '13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#46ff8c',
            background: 'rgba(6,8,10,0.76)',
            border: '1px solid rgba(70,255,140,0.34)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 12
          }}
        >
          {touch ? 'LAND \u00b7 request docking clearance' : '[F] request docking clearance'}
        </div>
      )}
    </>
  );
};

export default CockpitReadout;
