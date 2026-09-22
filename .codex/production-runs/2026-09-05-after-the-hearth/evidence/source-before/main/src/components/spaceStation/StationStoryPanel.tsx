import { useState } from 'react';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { hasMilestone } from '../../game/systems/progressionSystem.ts';
import {
  BONDED_CELL_ITEM_ID,
  STATION_STORY_MILESTONES,
  commitDesignationPresented,
  commitHabitatFaultPresented,
  commitRegistryRecorded,
  issueBondedCell,
  type StationStoryCommit
} from '../../game/spaceStation/spaceStationStory.ts';
import type { Vendor } from '../../game/spaceStation/spaceStationVendors.ts';

const INK = 'rgba(232,238,234,0.96)';
const DIM = 'rgba(232,238,234,0.58)';
const WARM = '#ffb45a';
const GREEN = '#77f0a1';

export interface StationStoryPanelProps {
  kind: 'registry' | 'issuer';
  vendor?: Vendor | null;
  onReceipt: (receipt: StationStoryCommit) => void;
  onClose: () => void;
}

/**
 * Required station dialogue is finite, authored, and receipt-producing. It never
 * enters the optional vendor model path: a network failure or improvised answer
 * cannot strand the story or decide who Terra is.
 */
export function StationStoryPanel({ kind, vendor, onReceipt, onClose }: StationStoryPanelProps) {
  const [revision, setRevision] = useState(0);
  const [askedBond, setAskedBond] = useState(false);

  const commit = (run: () => StationStoryCommit) => {
    const receipt = run();
    onReceipt(receipt);
    setRevision(value => value + 1);
  };
  void revision;

  const designationPresented = hasMilestone(STATION_STORY_MILESTONES.designationPresented);
  const registryRecorded = hasMilestone(STATION_STORY_MILESTONES.registryRecorded);
  const faultPresented = hasMilestone(STATION_STORY_MILESTONES.habitatFaultPresented);
  const acquired = hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired)
    && getItemCount(BONDED_CELL_ITEM_ID) > 0;

  return (
    <div style={backdrop} data-testid={`spaceStation-${kind}-panel`} role="dialog" aria-modal="true">
      <section style={panel}>
        <header style={header}>
          <div>
            <div style={eyebrow}>{kind === 'registry' ? 'ISSUING STATION · COUNTER' : 'CERTIFIED COMPONENTS'}</div>
            <div style={title}>
              {kind === 'registry' ? 'DESIGNATION RECORD' : `${vendor?.designation ?? 'B-7073'} · ${vendor?.name ?? 'Bell'}`}
            </div>
          </div>
          <button style={closeButton} onClick={onClose} aria-label="Close conversation">CLOSE</button>
        </header>

        {kind === 'registry' ? (
          <div style={transcript} data-testid="spaceStation-registry-transcript">
            <Line register>PRESENT DESIGNATION.</Line>
            {!designationPresented && (
              <Action
                testId="spaceStation-present-suit-record"
                label="PRESENT SUIT RECORD"
                onClick={() => commit(commitDesignationPresented)}
              />
            )}
            {designationPresented && (
              <>
                <Line register>DESIGNATION: W-7743 · RECORD ACCEPTED.</Line>
                <Line register>DECLARE PURPOSE OF ENTRY.</Line>
              </>
            )}
            {designationPresented && !registryRecorded && (
              <Action
                testId="spaceStation-declare-issued-component"
                label="DECLARE: ISSUED COMPONENT"
                onClick={() => commit(commitRegistryRecorded)}
              />
            )}
            {registryRecorded && (
              <>
                <Line register>NEED RECORDED · BONDED CELL / HABITAT GRADE.</Line>
                <Line register>CONCOURSE ACCESS ISSUED.</Line>
                <Line low>(the suit is accepted before you are.)</Line>
                <Action testId="spaceStation-registry-continue" label="CONTINUE TO CONCOURSE" onClick={onClose} />
              </>
            )}
          </div>
        ) : (
          <div style={transcript} data-testid="spaceStation-issuer-transcript">
            <Line>{vendor?.persona.greeting ?? 'i can attest to all of it. i can attest to the attestation, if you like.'}</Line>
            {!faultPresented && (
              <Action
                testId="spaceStation-present-habitat-fault"
                label="PRESENT HABITAT FAULT"
                onClick={() => commit(commitHabitatFaultPresented)}
              />
            )}
            {faultPresented && (
              <Line>bonded cell. habitat grade. one left with a clean seal.</Line>
            )}
            {faultPresented && !askedBond && !acquired && (
              <Action
                testId="spaceStation-ask-bond"
                label="ASK WHAT THE BOND IS"
                onClick={() => setAskedBond(true)}
              />
            )}
            {askedBond && (
              <Line>the cell carries an issuance record. break the record and the core will not take it.</Line>
            )}
            {faultPresented && !acquired && (
              <Action
                testId="spaceStation-accept-bonded-cell"
                label="ACCEPT ISSUED BONDED CELL"
                onClick={() => commit(issueBondedCell)}
              />
            )}
            {acquired && (
              <>
                <Line>the seal follows the designation the counter recorded. keep it intact until the core takes it.</Line>
                <div style={receipt} data-testid="spaceStation-bonded-cell-receipt">
                  <div>CARGO RECEIPT</div>
                  <strong>BONDED CELL (HABITAT) · SEAL INTACT</strong>
                </div>
                <Line low>(the first thing a world could not give fits beneath one arm.)</Line>
                <Action testId="spaceStation-issuer-continue" label="STOW RECEIPT · RETURN TO SHIP" onClick={onClose} />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Line({ children, register = false, low = false }: {
  children: React.ReactNode;
  register?: boolean;
  low?: boolean;
}) {
  return (
    <div style={{ ...line, color: low ? DIM : register ? INK : 'rgba(255,238,214,0.92)' }}>
      {register ? <span style={{ color: WARM, marginRight: 9 }}>REGULATION</span> : null}
      {children}
    </div>
  );
}

function Action({ label, onClick, testId }: { label: string; onClick: () => void; testId: string }) {
  return (
    <button style={action} onClick={onClick} data-testid={testId}>
      <span style={{ color: WARM }}>[</span> {label} <span style={{ color: WARM }}>]</span>
    </button>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 140,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(2,4,6,0.76)',
  backdropFilter: 'blur(5px)'
};

const panel: React.CSSProperties = {
  width: 'min(720px, 100%)',
  maxHeight: 'min(760px, calc(100vh - 32px))',
  overflowY: 'auto',
  border: '1px solid rgba(255,180,90,0.38)',
  borderTop: '2px solid rgba(255,180,90,0.8)',
  background: 'linear-gradient(180deg, rgba(10,14,16,0.985), rgba(5,8,10,0.99))',
  color: INK,
  boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 18px',
  borderBottom: '1px solid rgba(232,238,234,0.14)'
};

const eyebrow: React.CSSProperties = {
  color: DIM,
  fontSize: 10,
  letterSpacing: '0.18em'
};

const title: React.CSSProperties = {
  marginTop: 4,
  color: WARM,
  fontSize: 16,
  letterSpacing: '0.08em'
};

const transcript: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '18px',
  lineHeight: 1.55
};

const line: React.CSSProperties = {
  padding: '10px 12px',
  borderLeft: '1px solid rgba(232,238,234,0.2)',
  fontSize: 13
};

const action: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '11px 14px',
  border: '1px solid rgba(255,180,90,0.34)',
  borderRadius: 0,
  background: 'rgba(255,180,90,0.065)',
  color: INK,
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  letterSpacing: '0.05em'
};

const closeButton: React.CSSProperties = {
  minWidth: 72,
  minHeight: 44,
  border: '1px solid rgba(232,238,234,0.26)',
  borderRadius: 0,
  background: 'transparent',
  color: DIM,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 11
};

const receipt: React.CSSProperties = {
  padding: '14px',
  border: `1px solid ${GREEN}`,
  color: GREEN,
  display: 'grid',
  gap: 5,
  letterSpacing: '0.05em'
};
