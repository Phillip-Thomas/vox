import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PROLOGUE_EVENTS, VOYAGE_SETTINGS, type LedgerStat, type PrologueEventCard } from '../storyScript.ts';
import { recordStoryChoice } from '../storyState.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { isMovieMode } from '../autopilot.ts';
import { PHOSPHOR, PHOSPHOR_DIM, PHOSPHOR_FAINT, TERMINAL_BG } from './TerminalPrologue.tsx';
import { theme } from '../../ui/theme.ts';

// --- The voyage ledger (Oregon Trail, played straight) ------------------------------
//
// The hauler's transit rendered as the only reality the worker is issued: four
// ledger rows and a progress bar. Between legs, event cards interrupt with real
// choices; choices persist as milestones and echo in Ch1's work order. The stats
// are theater — the point is that the SYSTEM is watching what you pick.

const LEG_SECONDS = 5;
const BAR_CELLS = 36;

interface LedgerState {
  rations: number;
  hull: number;
  compliance: number;
  transit: number;
}

const VoyageLedger: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [ledger, setLedger] = useState<LedgerState>({ rations: 96, hull: 100, compliance: 87, transit: 0 });
  const [eventIndex, setEventIndex] = useState(0);
  const [card, setCard] = useState<PrologueEventCard | null>(null);
  const [progress, setProgress] = useState(0.06);
  // Oregon-Trail standing settings: consulted per leg, changeable any time.
  const [pace, setPace] = useState<'standard' | 'overclocked'>('standard');
  const [rations, setRations] = useState<'full' | 'half'>('full');
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const rationsRef = useRef(rations);
  rationsRef.current = rations;
  const doneRef = useRef(false);

  // Legs: progress creeps (pace-scaled); at each leg boundary the leg's
  // pace/ration costs land and the next card interrupts; after the final card
  // the "arrival" leg runs a beat longer, then the nav anomaly.
  useEffect(() => {
    if (card) return; // paused on a decision
    const startProgress = progress;
    const target = eventIndex < PROLOGUE_EVENTS.length
      ? 0.12 + (eventIndex + 1) * (0.62 / (PROLOGUE_EVENTS.length + 0.5))
      : 1;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const paceOption = VOYAGE_SETTINGS.pace.options.find(o => o.id === paceRef.current)!;
      const legMs = (LEG_SECONDS * 1000) / paceOption.progressMul;
      const t = Math.min(1, (performance.now() - startedAt) / legMs);
      setProgress(startProgress + (target - startProgress) * t);
      setLedger(l => ({ ...l, transit: Math.round(11 * (startProgress + (target - startProgress) * t) * 4) / 4 }));
      if (t >= 1) {
        // The leg's standing costs land in the ledger.
        const rationOption = VOYAGE_SETTINGS.rations.options.find(o => o.id === rationsRef.current)!;
        setLedger(l => ({
          ...l,
          hull: Math.max(0, l.hull + paceOption.hullPerLeg),
          rations: Math.max(0, l.rations + rationOption.rationsPerLeg),
          compliance: Math.max(0, l.compliance + rationOption.compliancePerLeg)
        }));
        if (eventIndex < PROLOGUE_EVENTS.length) {
          playSfx('terminalAdvance');
          setCard(PROLOGUE_EVENTS[eventIndex]);
        } else if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, eventIndex]);

  // Movie screenings answer each card after a readable pause (the card index
  // varies which option gets picked, so echo lines differ run to run).
  useEffect(() => {
    if (!card || !isMovieMode()) return;
    const timer = setTimeout(() => {
      const option = card.options[eventIndex % card.options.length];
      choose(option.id);
    }, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const choose = (optionId: string) => {
    if (!card) return;
    const option = card.options.find(o => o.id === optionId);
    if (!option) return;
    playSfx('terminalKey');
    recordStoryChoice(card.id, option.id);
    if (option.ledgerDelta) {
      setLedger(l => {
        const next = { ...l };
        for (const [stat, delta] of Object.entries(option.ledgerDelta!) as [LedgerStat, number][]) {
          if (stat === 'transit') continue;
          next[stat] = Math.max(0, Math.min(120, next[stat] + delta));
        }
        return next;
      });
    }
    setCard(null);
    setEventIndex(i => i + 1);
  };

  const bar = useMemo(() => {
    const filled = Math.round(progress * BAR_CELLS);
    return `[${'█'.repeat(filled)}${'·'.repeat(BAR_CELLS - filled)}]`;
  }, [progress]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 13, lineHeight: 2
    }}>
      <div style={{ color: PHOSPHOR_DIM, fontSize: 11, marginBottom: 10 }}>
        HAULER 7C-θ/EX · TRANSIT LEDGER · POD 4, BERTH 19 (YOU)
      </div>

      <div style={{ width: 'min(84vw, 560px)' }}>
        <Row k="RATION UNITS" v={`${ledger.rations}%`} warn={ledger.rations < 90} />
        <Row k="HULL" v={`${ledger.hull}%`} warn={ledger.hull < 90} />
        <Row k="COMPLIANCE INDEX" v={`${ledger.compliance}%`} warn={ledger.compliance < 82} />
        <Row k="DAYS IN TRANSIT" v={`${ledger.transit.toFixed(2)}`} />
      </div>

      <div style={{ marginTop: 16, fontSize: 12, letterSpacing: 0 }}>{bar}</div>
      <div style={{ color: PHOSPHOR_FAINT, fontSize: 10 }}>DESTINATION: CUBE SITE 7C-θ · PURPOSE: EXTRACTION</div>

      {/* standing prompts (Oregon Trail pace/rations, changeable between legs) */}
      <div style={{ marginTop: 18, width: 'min(84vw, 560px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SettingRow
          label={VOYAGE_SETTINGS.pace.label}
          options={VOYAGE_SETTINGS.pace.options.map(o => ({ id: o.id, label: o.label }))}
          selected={pace}
          onSelect={id => { playSfx('terminalKey'); setPace(id as 'standard' | 'overclocked'); }}
        />
        <SettingRow
          label={VOYAGE_SETTINGS.rations.label}
          options={VOYAGE_SETTINGS.rations.options.map(o => ({ id: o.id, label: o.label }))}
          selected={rations}
          onSelect={id => { playSfx('terminalKey'); setRations(id as 'full' | 'half'); }}
        />
      </div>

      {card && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(88vw, 520px)',
          background: TERMINAL_BG,
          border: `1px solid ${PHOSPHOR_DIM}`,
          boxShadow: `0 0 44px rgba(125,252,165,0.14)`,
          padding: '22px 26px',
          animation: 'pvCardIn 240ms ease both'
        }}>
          <div style={{ fontSize: 11, color: PHOSPHOR_DIM, marginBottom: 10 }}>{card.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.9, marginBottom: 18 }}>{card.body}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {card.options.map((option, i) => (
              <button
                key={option.id}
                onClick={() => choose(option.id)}
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  textAlign: 'left',
                  color: PHOSPHOR,
                  background: 'transparent',
                  border: `1px solid ${PHOSPHOR_FAINT}`,
                  padding: '10px 14px',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(125,252,165,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {i + 1}. {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pvCardIn {
          from { opacity: 0; transform: translate(-50%, -49%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
};

const Row: React.FC<{ k: string; v: string; warn?: boolean }> = ({ k, v, warn }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: PHOSPHOR_DIM }}>{k}</span>
    <span style={{ color: warn ? '#ffd28a' : PHOSPHOR }}>{v}</span>
  </div>
);

const SettingRow: React.FC<{
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string;
  onSelect: (id: string) => void;
}> = ({ label, options, selected, onSelect }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
    <span style={{ color: PHOSPHOR_DIM }}>{label}</span>
    <span style={{ display: 'flex', gap: 8 }}>
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          style={{
            fontFamily: theme.font.mono,
            fontSize: 11,
            letterSpacing: '0.12em',
            padding: '4px 12px',
            cursor: 'pointer',
            color: selected === option.id ? TERMINAL_BG : PHOSPHOR_DIM,
            background: selected === option.id ? PHOSPHOR : 'transparent',
            border: `1px solid ${selected === option.id ? PHOSPHOR : PHOSPHOR_FAINT}`
          }}
        >
          {option.label}
        </button>
      ))}
    </span>
  </div>
);

export default VoyageLedger;
