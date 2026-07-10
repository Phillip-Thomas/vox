import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VOYAGE_DECK, VOYAGE_SETTINGS, type LedgerStat } from '../storyScript.ts';
import { applyChoice, createDeckRun, nextCard, type VoyageCard } from '../voyageDeck.ts';
import { applyVoyageOutcome } from '../voyageOutcome.ts';
import { recordStoryChoice } from '../storyState.ts';
import { addItem } from '../../game/systems/inventorySystem.ts';
import { feed } from '../../game/systems/survivalVitals.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { isMovieMode } from '../autopilot.ts';
import VoyageWireframe from './VoyageWireframe.tsx';
import { PHOSPHOR, PHOSPHOR_DIM, PHOSPHOR_FAINT, TERMINAL_BG } from './TerminalPrologue.tsx';
import { theme } from '../../ui/theme.ts';

// --- The voyage (Oregon Trail, played straight — now a branching deck) ----------------
//
// The hauler's transit: four ledger rows, two standing protocols (pace/rations),
// a Maze-War wireframe of the commute itself, and a DECK of event cards — three
// spine cards every run, situational draws, and follow-ups your own choices
// unlock. Choices persist as milestones (echoed by Ch1's paperwork) and carry
// real consequences (items, vitals, harvester cell). The final ledger becomes
// the crash: hull → debris field, rations → arrival hunger, compliance → tone.
// The last card is always the nav anomaly — the ORDER that sends you to the
// intake shield station (the Pong game is a duty, not a scene change).

const LEG_SECONDS = 5;
const BAR_CELLS = 36;
const MOVIE_CARD_MS = 6000;

interface LedgerState {
  rations: number;
  hull: number;
  compliance: number;
  transit: number;
}

const VoyageLedger: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [ledger, setLedger] = useState<LedgerState>({ rations: 96, hull: 100, compliance: 87, transit: 0 });
  const [card, setCard] = useState<VoyageCard | null>(null);
  const [legIndex, setLegIndex] = useState(0);
  const [progress, setProgress] = useState(0.06);
  const [pace, setPace] = useState<'standard' | 'overclocked'>('standard');
  const [rations, setRations] = useState<'full' | 'half'>('full');
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const rationsRef = useRef(rations);
  rationsRef.current = rations;
  const runRef = useRef(createDeckRun(VOYAGE_DECK));
  const cellDeltaRef = useRef(0);
  const atBridgeRef = useRef(false);
  const doneRef = useRef(false);
  // Live handles for the wireframe layer (rAF-read, no re-renders).
  const progressRef = useRef(progress);
  const anomalyRef = useRef(false);

  // Legs: progress creeps (pace-scaled); at each boundary the leg's standing
  // costs land and the next deck card interrupts; when the deck runs dry the
  // bridge card (the nav anomaly) arrives at ~full progress.
  useEffect(() => {
    if (card) return; // paused on a decision
    const startProgress = progress;
    const remaining = runRef.current.queue.length;
    const target = remaining > 0
      ? startProgress + (0.92 - startProgress) / (remaining + 0.6)
      : 1;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const paceOption = VOYAGE_SETTINGS.pace.options.find(o => o.id === paceRef.current)!;
      const legMs = (LEG_SECONDS * 1000) / paceOption.progressMul;
      const t = Math.min(1, (performance.now() - startedAt) / legMs);
      const now = startProgress + (target - startProgress) * t;
      setProgress(now);
      progressRef.current = now;
      setLedger(l => ({ ...l, transit: Math.round(11 * now * 4) / 4 }));
      if (t >= 1) {
        const rationOption = VOYAGE_SETTINGS.rations.options.find(o => o.id === rationsRef.current)!;
        setLedger(l => ({
          ...l,
          hull: Math.max(0, l.hull + paceOption.hullPerLeg),
          rations: Math.max(0, l.rations + rationOption.rationsPerLeg),
          compliance: Math.max(0, l.compliance + rationOption.compliancePerLeg)
        }));
        const drawn = nextCard(runRef.current, VOYAGE_DECK);
        if (drawn) {
          playSfx('terminalAdvance');
          setCard(drawn);
        } else if (!atBridgeRef.current) {
          // The deck is dry: the anomaly finds the hauler.
          atBridgeRef.current = true;
          anomalyRef.current = true;
          playSfx('terminalAlarm');
          setCard(VOYAGE_DECK.cards[VOYAGE_DECK.bridge]);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, legIndex]);

  const choose = (optionId: string) => {
    if (!card || doneRef.current) return;
    playSfx('terminalKey');
    const option = applyChoice(runRef.current, VOYAGE_DECK, card.id, optionId);
    if (!option) return;
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
    // Real consequences, through the real systems (persistence is free).
    if (option.effects?.items) {
      for (const grant of option.effects.items) addItem(grant.id as Parameters<typeof addItem>[0], grant.qty);
    }
    if (option.effects?.food || option.effects?.water) {
      feed(option.effects.food ?? 0, option.effects.water ?? 0);
    }
    if (option.effects?.mawCharge) cellDeltaRef.current += option.effects.mawCharge;

    if (atBridgeRef.current) {
      // The acknowledge: the ledger becomes the crash.
      doneRef.current = true;
      setLedger(l => {
        applyVoyageOutcome({
          rations: l.rations,
          hull: l.hull,
          compliance: l.compliance,
          cellDelta: cellDeltaRef.current
        });
        return l;
      });
      setCard(null);
      onDone();
      return;
    }
    setCard(null);
    setLegIndex(i => i + 1);
  };

  // Movie screenings answer each card after a readable pause; the pick varies
  // with the leg so pathways differ run to run.
  useEffect(() => {
    if (!card || !isMovieMode()) return;
    const timer = setTimeout(() => {
      const option = card.options[legIndex % card.options.length];
      choose(option.id);
    }, MOVIE_CARD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const bar = useMemo(() => {
    const filled = Math.round(progress * BAR_CELLS);
    return `[${'█'.repeat(filled)}${'·'.repeat(BAR_CELLS - filled)}]`;
  }, [progress]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* The commute itself: earliest-3D vectors behind the paperwork. */}
      <VoyageWireframe progressRef={progressRef} anomalyRef={anomalyRef} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 13, lineHeight: 2
      }}>
        <div style={{ color: PHOSPHOR_DIM, fontSize: 11, marginBottom: 10 }}>
          HAULER 7C-θ/EX · TRANSIT LEDGER · POD 4, BERTH 19 (YOU)
        </div>

        <div style={{ width: 'min(84vw, 560px)', background: 'rgba(2,6,4,0.55)', padding: '4px 10px' }}>
          <Row k="RATION UNITS" v={`${ledger.rations}%`} warn={ledger.rations < 82} />
          <Row k="HULL" v={`${ledger.hull}%`} warn={ledger.hull < 82} />
          <Row k="COMPLIANCE INDEX" v={`${ledger.compliance}%`} warn={ledger.compliance < 78} />
          <Row k="DAYS IN TRANSIT" v={`${ledger.transit.toFixed(2)}`} />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, letterSpacing: 0 }}>{bar}</div>
        <div style={{ color: PHOSPHOR_FAINT, fontSize: 10 }}>DESTINATION: CUBE SITE 7C-θ · PURPOSE: EXTRACTION</div>

        <div style={{ marginTop: 14, width: 'min(84vw, 560px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            border: `1px solid ${atBridgeRef.current ? PHOSPHOR : PHOSPHOR_DIM}`,
            boxShadow: `0 0 44px rgba(125,252,165,${atBridgeRef.current ? 0.3 : 0.14})`,
            padding: '22px 26px',
            animation: 'pvCardIn 240ms ease both'
          }}>
            <div style={{ fontSize: 11, color: atBridgeRef.current ? PHOSPHOR : PHOSPHOR_DIM, marginBottom: 10 }}>{card.title}</div>
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
