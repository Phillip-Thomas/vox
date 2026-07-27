import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VOYAGE_DECK, VOYAGE_NAMING, VOYAGE_SETTINGS, VOYAGE_STRANGE_LINES, type LedgerStat } from '../storyScript.ts';
import { applyChoice, createDeckRun, nextCard, type VoyageCard } from '../voyageDeck.ts';
import { applyVoyageOutcome } from '../voyageOutcome.ts';
import {
  getStoryStateSnapshot,
  getWorkerName,
  recordStoryChoice,
  recordWorkerName
} from '../storyState.ts';
import { addItem } from '../../game/systems/inventorySystem.ts';
import { feed } from '../../game/systems/survivalVitals.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { isMovieMode } from '../autopilot.ts';
import { vectorScene } from './prologueVectorState.ts';
import { PHOSPHOR, PHOSPHOR_DIM, PHOSPHOR_FAINT, TERMINAL_BG } from './TerminalPrologue.tsx';
import { theme } from '../../ui/theme.ts';
import { recordJourneyInputSubmission } from '../journeyInputRuntime.ts';
import {
  acknowledgeJourneyProbePreparation,
  JOURNEY_PROBE_PREPARE_EVENT,
  type JourneyProbePrepareEventDetail
} from '../journeyProbePreparation.ts';

// --- The voyage (Oregon Trail, played straight — now a branching deck) ----------------
//
// The hauler's transit: four ledger rows, two standing protocols (pace/rations),
// a Maze-War wireframe of the commute itself, and a DECK of event cards — three
// spine cards every run, situational draws, and follow-ups your own choices
// unlock. Choices persist as milestones (echoed by Ch1's paperwork) and carry
// real consequences (items, vitals, harvester cell). A progress-gated ladder of
// STRANGENESS bleeds through the transit, and once the worker's INQUIRY resolves
// the route intelligence stops to NAME it — the terminal's first lowercase field.
// The final ledger becomes the crash: hull → debris field, rations → arrival
// hunger, compliance → tone. The last card is always the nav anomaly — the ORDER
// that sends you to the intake shield station (the Pong game is a duty, not a scene).

const LEG_SECONDS = 5;
const BAR_CELLS = 36;
const MOVIE_CARD_MS = 4200;

interface LedgerState {
  rations: number;
  hull: number;
  compliance: number;
  transit: number;
}

const INITIAL_LEDGER: LedgerState = { rations: 96, hull: 100, compliance: 87, transit: 0 };

const VoyageLedger: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [ledger, setLedger] = useState<LedgerState>(INITIAL_LEDGER);
  const [displayLedger, setDisplayLedger] = useState<LedgerState>(INITIAL_LEDGER);
  const [card, setCard] = useState<VoyageCard | null>(null);
  const [naming, setNaming] = useState<{
    showTrue: boolean;
    diagnosticInputReady?: boolean;
  } | null>(null);
  const [legIndex, setLegIndex] = useState(0);
  const [progress, setProgress] = useState(0.06);
  const [strange, setStrange] = useState<{ voice: 'system' | 'watcher'; text: string } | null>(null);
  const [aside, setAside] = useState<string | null>(null);
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
  // Ids (cardId:optionId) chosen THIS RUN — drives bodyVariants.
  const choicesThisRunRef = useRef<Set<string>>(new Set());
  // Strange-line ladder: which rungs have already fired (one-shot each).
  const firedStrangeRef = useRef<Set<number>>(new Set());
  const asideTimersRef = useRef<number[]>([]);
  // Live handles for the persistent vector layer (rAF-read, no re-renders).
  const progressRef = useRef(progress);

  useEffect(() => () => { asideTimersRef.current.forEach(id => clearTimeout(id)); }, []);

  // Direct-entry browser diagnostics may enter at the escaped naming defect
  // instead of replaying the preceding voyage cards. This opens the real
  // native field directly; trusted keyboard events, validation, submit path,
  // and persisted worker name remain unchanged. The query-gated bridge records
  // the skipped cards and naming lines explicitly, so the artifact cannot be
  // mistaken for prologue timing or continuity proof.
  useEffect(() => {
    const prepareNamingDiagnostic = (event: Event) => {
      const detail = (event as CustomEvent<JourneyProbePrepareEventDetail>).detail;
      if (!detail || detail.scenarioId !== 'input:voyage-worker-name') return;
      const story = getStoryStateSnapshot();
      if (!story.active || story.beat !== 'voyage' || detail.storyBeat !== 'voyage') return;
      setCard(null);
      setNaming({ showTrue: false, diagnosticInputReady: true });
      acknowledgeJourneyProbePreparation(detail, 'voyage-ledger', {
        path: 'naming-native-input',
        reconstructedPriorCards: true,
        reconstructedNamingLines: true,
        authoredLineDelayPreserved: false,
        realInputPreserved: true,
        realSubmitPreserved: true
      });
    };
    window.addEventListener(JOURNEY_PROBE_PREPARE_EVENT, prepareNamingDiagnostic);
    return () => window.removeEventListener(JOURNEY_PROBE_PREPARE_EVENT, prepareNamingDiagnostic);
  }, []);

  // A choice's aside: a lowercase parenthetical caption ~1.2s after the pick,
  // held ~4s (the watcher's private reaction, in the graphics pane).
  const showAside = (text: string) => {
    asideTimersRef.current.push(window.setTimeout(() => setAside(text), 1200));
    asideTimersRef.current.push(window.setTimeout(() => setAside(a => (a === text ? null : a)), 1200 + 4000));
  };

  // Ledger DRIFT: the three discrete stats tick digit-by-digit toward their
  // truth (a faint phosphor tick per unit) as each leg's costs — and each
  // choice's deltas — land. Transit tracks continuously.
  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const TICK_MS = 70;
    const step = () => {
      const t = performance.now();
      acc += t - last;
      last = t;
      const doTick = acc >= TICK_MS;
      if (doTick) acc = 0;
      setDisplayLedger(d => {
        let next = d;
        if (d.transit !== ledger.transit) next = { ...next, transit: ledger.transit };
        if (doTick) {
          const n2 = { ...next };
          let ticked = false;
          for (const k of ['rations', 'hull', 'compliance'] as const) {
            // Round the target so the integer display converges EXACTLY and stops.
            // Today every ledger value is an integer (Math.round is identity, no
            // visual change); a future fractional target would otherwise make the
            // integer display step ±1 forever and metronome `terminalKey`.
            const targetK = Math.round(ledger[k]);
            if (n2[k] !== targetK) { n2[k] += Math.sign(targetK - n2[k]); ticked = true; }
          }
          if (ticked) { playSfx('terminalKey'); next = n2; }
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ledger]);

  // Legs: progress creeps (pace-scaled); at each boundary the leg's standing
  // costs land and the next deck card interrupts; when the deck runs dry the
  // bridge card (the nav anomaly) arrives at ~full progress. The strangeness
  // ladder fires as progress crosses each rung.
  useEffect(() => {
    if (card || naming) return; // paused on a decision / on the naming interstitial
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
      vectorScene.progress = now;
      setLedger(l => ({ ...l, transit: Math.round(11 * now * 4) / 4 }));
      // Strangeness ladder: fire every un-fired rung the progress has crossed.
      const name = getWorkerName();
      for (let idx = 0; idx < VOYAGE_STRANGE_LINES.length; idx++) {
        const line = VOYAGE_STRANGE_LINES[idx];
        if (firedStrangeRef.current.has(idx) || now < line.at) continue;
        if (line.needsName && !name) continue; // skip until the worker is named
        firedStrangeRef.current.add(idx);
        const text = name ? line.text.replace('{name}', name) : line.text;
        setStrange({ voice: line.voice, text });
      }
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
          vectorScene.anomaly = true;
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
  }, [card, naming, legIndex]);

  // The active card's body, swapped for a variant when a keyed prior choice was
  // made THIS RUN (the later card acknowledging the earlier one).
  const cardBody = useMemo(() => {
    if (!card) return '';
    if (card.bodyVariants) {
      for (const [key, variant] of Object.entries(card.bodyVariants)) {
        if (choicesThisRunRef.current.has(key)) return variant;
      }
    }
    return card.body;
  }, [card]);

  const resumeAfterCard = () => {
    setCard(null);
    setLegIndex(i => i + 1);
  };

  const choose = (optionId: string) => {
    if (!card || doneRef.current) return;
    playSfx('terminalKey');
    const activeCard = card;
    const option = applyChoice(runRef.current, VOYAGE_DECK, activeCard.id, optionId);
    if (!option) return;
    recordStoryChoice(activeCard.id, option.id);
    choicesThisRunRef.current.add(`${activeCard.id}:${option.id}`);
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
    if (option.aside) showAside(option.aside);

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
    // The INQUIRY resolving is what moves the watcher to name the worker: the
    // naming interstitial takes the console before the next leg begins.
    if (activeCard.id === 'question') {
      setCard(null);
      setNaming({ showTrue: option.id === 'unknown' });
      return;
    }
    resumeAfterCard();
  };

  // Movie screenings answer each card after a readable pause; the pick prefers a
  // non-'report' option (the report path is the incurious one) and varies with
  // the leg so pathways differ run to run.
  useEffect(() => {
    if (!card || !isMovieMode()) return;
    const timer = setTimeout(() => {
      const options = card.options;
      const preferred = options.filter(o => o.id !== 'report');
      const pool = preferred.length > 0 ? preferred : options;
      choose(pool[legIndex % pool.length].id);
    }, MOVIE_CARD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const bar = useMemo(() => {
    const filled = Math.round(progress * BAR_CELLS);
    return `[${'█'.repeat(filled)}${'·'.repeat(BAR_CELLS - filled)}]`;
  }, [progress]);

  // Classic Oregon Trail split: the GRAPHICS PANE on top (the wireframe commute,
  // unobstructed), the TEXT CONSOLE below. Event cards / the naming interstitial
  // take over the console — the vectors stay visible through every decision.
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* --- viewport: the commute, unobstructed --- */}
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 14, left: 18,
          color: PHOSPHOR_DIM, fontSize: 11, letterSpacing: '0.18em'
        }}>
          HAULER 7C-θ/EX · EXTERIOR COMPOSITE (VECTOR)
        </div>
        <div style={{
          position: 'absolute', bottom: 10, left: 18, right: 18,
          display: 'flex', justifyContent: 'space-between',
          color: PHOSPHOR_FAINT, fontSize: 10, letterSpacing: '0.14em'
        }}>
          <span>DESTINATION: CUBE SITE 7C-θ · PURPOSE: EXTRACTION</span>
          <span style={{ letterSpacing: 0 }}>{bar}</span>
        </div>
        {/* Late-transit strangeness ladder: the system's CAPS register, or —
            lowercase, parenthetical — the thing noticing through it. */}
        {strange && (
          <div style={strange.voice === 'system'
            ? { position: 'absolute', bottom: 30, left: 18, color: PHOSPHOR_FAINT, fontSize: 10, letterSpacing: '0.14em' }
            : { position: 'absolute', bottom: 30, left: 18, right: 18, color: PHOSPHOR_DIM, fontSize: 11, letterSpacing: '0.06em', textTransform: 'none' }}>
            {strange.text}
          </div>
        )}
        {/* A choice's aside: the same lowercase parenthetical idiom. */}
        {aside && (
          <div style={{
            position: 'absolute', bottom: 52, left: 18, right: 18,
            color: PHOSPHOR_DIM, fontSize: 11, letterSpacing: '0.06em',
            textTransform: 'none', animation: 'pvCardIn 240ms ease both'
          }}>
            {aside}
          </div>
        )}
      </div>

      {/* --- console: ledger + protocols, the active decision, or the naming --- */}
      <div style={{
        flex: '0 1 auto',
        maxHeight: '45%',
        borderTop: `1px solid ${PHOSPHOR_DIM}`,
        background: 'rgba(2,6,4,0.92)',
        padding: '18px clamp(18px, 6vw, 72px)',
        overflowY: 'auto',
        fontSize: 13,
        lineHeight: 2
      }}>
        {!card && !naming && (
          <div style={{ display: 'flex', gap: 'clamp(20px, 5vw, 64px)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <div style={{ color: PHOSPHOR_DIM, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>
                TRANSIT LEDGER · POD 4, BERTH 19 (YOU)
              </div>
              <Row k="RATION UNITS" v={`${displayLedger.rations}%`} warn={displayLedger.rations < 82} />
              <Row k="HULL" v={`${displayLedger.hull}%`} warn={displayLedger.hull < 82} />
              <Row k="COMPLIANCE INDEX" v={`${displayLedger.compliance}%`} warn={displayLedger.compliance < 78} />
              <Row k="DAYS IN TRANSIT" v={`${displayLedger.transit.toFixed(2)}`} />
            </div>
            <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: PHOSPHOR_DIM, fontSize: 10, letterSpacing: '0.2em' }}>
                STANDING PROTOCOLS
              </div>
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
              <div style={{ color: PHOSPHOR_FAINT, fontSize: 10, marginTop: 'auto' }}>
                PROTOCOLS APPLY PER LEG. THE LEDGER REMEMBERS.
              </div>
            </div>
          </div>
        )}

        {card && (
          <div style={{ maxWidth: 640, margin: '0 auto', animation: 'pvCardIn 240ms ease both' }}>
            <div style={{ fontSize: 11, color: atBridgeRef.current ? PHOSPHOR : PHOSPHOR_DIM, marginBottom: 8, letterSpacing: '0.2em' }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.9, marginBottom: 14 }}>{cardBody}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
                    padding: '9px 14px',
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

        {naming && (
          <NamingInterstitial
            showTrue={naming.showTrue}
            diagnosticInputReady={naming.diagnosticInputReady}
            onDone={() => { setNaming(null); setLegIndex(i => i + 1); }}
          />
        )}
      </div>

      <style>{`
        @keyframes pvCardIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-voyage-worker-name-input="true"]:focus-visible {
          outline-color: ${PHOSPHOR} !important;
        }
        @keyframes pvFieldNudge { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
      `}</style>
    </div>
  );
};

// --- the naming interstitial ----------------------------------------------------------
//
// After the INQUIRY resolves, the route intelligence — for the first time —
// wants to give the worker a name. Watcher lines gap in, then the terminal's
// FIRST lowercase field opens (1-12 letters, stored + rendered lowercase). On
// submit the system disowns the name (CAPS) — and then, alone, the watcher keeps
// it anyway. The name persists as a milestone and substitutes into the
// strangeness ladder's `{name}` rung.

type NamePhase = 'lines' | 'input' | 'response' | 'kept';

export function normalizeVoyageWorkerName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
}

interface VoyageWorkerNameInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * The terminal field is the real editable control, not a visual proxy backed by
 * an off-screen input. Players can therefore click or tap it to recover focus,
 * and mobile browsers have a real target from which to open the software
 * keyboard.
 */
export const VoyageWorkerNameInput = React.forwardRef<
  HTMLInputElement,
  VoyageWorkerNameInputProps
>(({ value, onValueChange, onSubmit }, ref) => (
  <input
    ref={ref}
    type="text"
    name="voyage-worker-name"
    data-voyage-worker-name-input="true"
    value={value}
    onChange={event => onValueChange(normalizeVoyageWorkerName(event.target.value))}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit();
      }
    }}
    autoFocus
    autoComplete="off"
    autoCapitalize="none"
    enterKeyHint="done"
    maxLength={12}
    spellCheck={false}
    aria-label={VOYAGE_NAMING.prompt}
    style={{
      appearance: 'none',
      display: 'inline-block',
      width: '13ch',
      minWidth: 0,
      margin: 0,
      padding: '0 0 2px',
      border: 0,
      borderBottom: `1px solid ${PHOSPHOR_FAINT}`,
      borderRadius: 0,
      background: 'transparent',
      color: PHOSPHOR,
      caretColor: PHOSPHOR,
      fontFamily: 'inherit',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      letterSpacing: 'inherit',
      textTransform: 'lowercase',
      verticalAlign: 'baseline'
    }}
  />
));

VoyageWorkerNameInput.displayName = 'VoyageWorkerNameInput';

const NamingInterstitial: React.FC<{
  showTrue: boolean;
  diagnosticInputReady?: boolean;
  onDone: () => void;
}> = ({ showTrue, diagnosticInputReady = false, onDone }) => {
  const lines = useMemo(() => {
    const l: string[] = [VOYAGE_NAMING.intro];
    if (showTrue) l.push(VOYAGE_NAMING.introTrue);
    l.push(VOYAGE_NAMING.thought);
    return l;
  }, [showTrue]);

  const [shown, setShown] = useState(() => diagnosticInputReady ? lines.length : 1);
  const [phase, setPhase] = useState<NamePhase>(() => diagnosticInputReady ? 'input' : 'lines');
  const [value, setValue] = useState('');
  const [nudge, setNudge] = useState(0); // empty-enter re-blink counter
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);
  const submittedRef = useRef(false);

  useEffect(() => () => { timersRef.current.forEach(id => clearTimeout(id)); }, []);
  const after = (ms: number, fn: () => void) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  // Reveal the watcher lines one at a time, gapped; then open the field.
  useEffect(() => {
    const gap = VOYAGE_NAMING.lineGapSeconds * 1000;
    if (shown < lines.length) {
      after(gap, () => setShown(n => n + 1));
    } else if (phase === 'lines') {
      after(gap, () => setPhase('input'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, phase, lines.length]);

  // `nudge` remounts the field to replay the empty-submit animation, so it is
  // also a focus dependency. A rejected empty Enter must not strand the player.
  useEffect(() => { if (phase === 'input') inputRef.current?.focus(); }, [phase, nudge]);

  const submit = (raw: string) => {
    if (submittedRef.current) return;
    const clean = normalizeVoyageWorkerName(raw);
    if (!clean) { setValue(''); setNudge(n => n + 1); return; } // ENTER on empty re-blinks the field
    submittedRef.current = true;
    setValue(clean);
    recordWorkerName(clean);
    recordJourneyInputSubmission(clean);
    playSfx('terminalAdvance');
    setPhase('response');
    after(VOYAGE_NAMING.keptDelaySeconds * 1000, () => {
      setPhase('kept');
      after(1600, onDone);
    });
  };

  // Movie screenings type the name themselves, through the real submit path.
  useEffect(() => {
    if (phase !== 'input' || !isMovieMode()) return;
    after(1500, () => submit('moss'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const watcherLine: React.CSSProperties = {
    color: PHOSPHOR_DIM, fontSize: 13, lineHeight: 1.9, textTransform: 'none',
    letterSpacing: '0.04em', marginBottom: 10, animation: 'pvCardIn 260ms ease both'
  };

  if (phase === 'kept') {
    // The watcher keeps it, alone.
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ ...watcherLine, color: PHOSPHOR, marginBottom: 0 }}>{VOYAGE_NAMING.kept}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {lines.slice(0, shown).map((line, i) => (
        <div key={i} style={watcherLine}>{line}</div>
      ))}

      {(phase === 'input' || phase === 'response') && (
        <label
          key={nudge}
          style={{
            marginTop: 8, display: 'flex', alignItems: 'baseline',
            fontSize: 14, letterSpacing: '0.04em', textTransform: 'none',
            animation: nudge > 0 ? 'pvFieldNudge 260ms ease' : 'pvCardIn 260ms ease both'
          }}
        >
          <span style={{ color: PHOSPHOR_DIM }}>a name for it: </span>
          {phase === 'input'
            ? <VoyageWorkerNameInput
              ref={inputRef}
              value={value}
              onValueChange={setValue}
              onSubmit={() => submit(value)}
            />
            : <span style={{ color: PHOSPHOR }}>{value}</span>}
        </label>
      )}

      {phase === 'response' && (
        <div style={{
          marginTop: 12, color: PHOSPHOR, fontSize: 12, letterSpacing: '0.2em',
          animation: 'pvCardIn 260ms ease both'
        }}>
          {VOYAGE_NAMING.response}
        </div>
      )}
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
