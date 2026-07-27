import { useEffect, useState } from 'react';
import { DOCK_SPEED_LIMIT, SCAN_RANGE } from '../../game/anchorage/anchorageApproach.ts';
import { anchorageContact, type AnchorageContact } from '../AnchorageApproachDriver.tsx';

/**
 * The station instrument, in the shipped HUD.
 *
 * Reads the driver's contact on its own animation frame rather than through React
 * state, so an instrument that updates continuously does not re-render the game.
 * Absent entirely when there is no station in range, which is most of the time in
 * most systems — an always-present readout showing nothing trains players to stop
 * looking at it.
 *
 * Terminal register, matching every other surface in the game.
 */

const INK = 'rgba(228,236,231,0.92)';
const DIM = 'rgba(228,236,231,0.5)';
const WARM = '#ffb45a';
const GO = '#46ff8c';
const WARN = '#ff5a3c';

export default function AnchorageApproachHud() {
  const [contact, setContact] = useState<AnchorageContact | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setContact(anchorageContact());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!contact) return null;
  const { readout } = contact;

  return (
    <>
      <div style={panel} data-testid="anchorage-approach-hud">
        <div style={{ color: readout.canDock ? GO : WARM, letterSpacing: '0.1em' }}>
          {readout.advisory.toUpperCase()}
        </div>
        <div style={{ color: DIM, fontSize: 10, letterSpacing: '0.08em', marginTop: 2 }}>
          {contact.body.worldId}
        </div>
        <div style={{ height: 8 }} />
        <Line
          label="range"
          value={`${Math.round(readout.distance)}`}
          fill={1 - readout.distance / SCAN_RANGE}
        />
        <Line
          label="bearing"
          value={readout.insideCorridor ? 'on corridor' : `${(readout.offAxis * 57.3).toFixed(0)}° off`}
          fill={1 - Math.min(1, readout.offAxis / 0.9)}
          warn={!readout.insideCorridor}
        />
        <Line
          label="closing"
          value={`${readout.closingSpeed.toFixed(0)} / ${DOCK_SPEED_LIMIT}`}
          fill={1 - Math.min(1, readout.closingSpeed / (DOCK_SPEED_LIMIT * 3))}
          warn={readout.closingSpeed > DOCK_SPEED_LIMIT}
        />
      </div>
      {readout.canDock && (
        <div style={prompt} data-testid="anchorage-dock-prompt">
          [F] request docking clearance
        </div>
      )}
    </>
  );
}

function Line({
  label,
  value,
  fill,
  warn = false
}: {
  label: string;
  value: string;
  fill: number;
  warn?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
      <span style={{ width: 58, color: DIM }}>{label}</span>
      <span style={{ width: 122, height: 3, background: 'rgba(228,236,231,0.14)' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%`,
            background: warn ? WARN : WARM
          }}
        />
      </span>
      <span style={{ color: warn ? WARN : INK, fontSize: 11 }}>{value}</span>
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 16,
  padding: '10px 13px',
  font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: INK,
  background: 'rgba(6,8,10,0.66)',
  border: '1px solid rgba(228,236,231,0.14)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  zIndex: 12
};

const prompt: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '58%',
  transform: 'translateX(-50%)',
  padding: '6px 13px',
  font: '13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: GO,
  background: 'rgba(6,8,10,0.76)',
  border: '1px solid rgba(70,255,140,0.34)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  zIndex: 12
};
