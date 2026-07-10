import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../../ui/theme.ts';
import { getItemCount, subscribeInventory } from '../../game/systems/inventorySystem.ts';
import { getInteraction, subscribeInteraction } from '../../game/systems/interactionSystem.ts';
import { getMawChargeFraction, subscribeMaw } from '../../game/systems/mawSystem.ts';
import { getFeedRuntime } from '../feedRuntime.ts';
import { getMiningProgress } from '../../game/systems/miningProgress.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from '../storyText.ts';
import { useStoryState } from '../storyState.ts';
import { CH1_QUOTA } from '../storyScript.ts';

// --- Regulation Feed HUD ----------------------------------------------------------
//
// The suit's compliance display: corner brackets, a frame counter that is very
// proud of itself, the standing work order, the quota ledger, and (Ch2) the
// redaction box. Structure renders via small store subscriptions; the per-frame
// bits (counter, garble, redaction transform) are rAF ref-mutations.

const FEED_INK = 'rgba(228,236,231,0.92)';
const FEED_INK_DIM = 'rgba(228,236,231,0.55)';

const GARBLE_CHARS = '█▓▒░#%@&';

function garbleText(text: string, amount: number): string {
  if (amount <= 0.01) return text;
  let out = '';
  for (const ch of text) {
    out += ch !== ' ' && Math.random() < amount * 0.6
      ? GARBLE_CHARS[Math.floor(Math.random() * GARBLE_CHARS.length)]
      : ch;
  }
  return out;
}

const bracket = (pos: React.CSSProperties): React.CSSProperties => ({
  position: 'fixed',
  width: 26,
  height: 26,
  pointerEvents: 'none',
  ...pos
});

const RegulationFeedHud: React.FC = () => {
  const story = useStoryState();
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  const text = getStoryText();
  const inventoryTick = useSyncExternalStore(subscribeInventory, inventoryVersion, inventoryVersion);
  void inventoryTick;
  const interaction = useSyncExternalStore(subscribeInteraction, getInteraction, getInteraction);
  const mawFraction = useSyncExternalStore(subscribeMaw, getMawChargeFraction, getMawChargeFraction);

  const counterRef = useRef<HTMLDivElement>(null);
  const harvestRef = useRef<HTMLDivElement>(null);
  const redactionRef = useRef<HTMLDivElement>(null);
  const redactionLabelRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const markerChevronRef = useRef<HTMLDivElement>(null);
  const markerLabelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = getFeedRuntime();
      const counter = counterRef.current;
      if (counter) {
        const stamp = `FRM ${String(r.frame).padStart(7, '0')}`;
        counter.textContent = garbleText(stamp, r.garble);
      }
      // Hold-to-harvest readout (the sandbox crosshair ring is hidden in the feed):
      // a flat ledger percentage — extraction as data entry.
      const harvest = harvestRef.current;
      if (harvest) {
        const mining = getMiningProgress();
        if (mining.active) {
          harvest.style.display = 'block';
          harvest.textContent = mining.blocked
            ? 'TOOL CLASS INSUFFICIENT'
            : `EXTRACTING ${String(Math.round(mining.pct * 100)).padStart(2, '0')}%`;
        } else {
          harvest.style.display = 'none';
        }
      }
      // Survey marker: bracket in frame / edge chevron out of frame.
      const marker = markerRef.current;
      const chevron = markerChevronRef.current;
      const markerLabel = markerLabelRef.current;
      if (marker && chevron && markerLabel) {
        const m = r.marker;
        if (m.visible && r.treatment > 0.05) {
          marker.style.display = 'flex';
          marker.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%)`;
          marker.style.borderStyle = m.offscreen ? 'none' : 'solid';
          chevron.style.display = m.offscreen ? 'block' : 'none';
          chevron.style.transform = `rotate(${m.angle}rad)`;
          markerLabel.textContent = m.label;
        } else {
          marker.style.display = 'none';
        }
      }

      const box = redactionRef.current;
      const label = redactionLabelRef.current;
      if (box && label) {
        const red = r.redaction;
        if (red.visible && r.treatment > 0.05) {
          const jx = (Math.random() - 0.5) * 6 * red.stress;
          const jy = (Math.random() - 0.5) * 6 * red.stress;
          box.style.display = 'flex';
          box.style.transform = `translate(${red.x + jx}px, ${red.y + jy}px)`;
          box.style.width = `${red.w}px`;
          box.style.height = `${red.h}px`;
          label.textContent = garbleText(red.label, red.stress * 0.4);
        } else {
          box.style.display = 'none';
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const quotaVisible = story.beat === 'ch1-raster' || story.beat === 'ch1-anomaly';
  const fiber = Math.min(getItemCount('biofiber'), CH1_QUOTA.biofiber);
  const stone = Math.min(getItemCount('stone'), CH1_QUOTA.stone);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.z.hud + 2,
        pointerEvents: 'none',
        fontFamily: theme.font.mono,
        color: FEED_INK,
        letterSpacing: '0.1em'
      }}
    >
      {/* corner brackets */}
      <div style={bracket({ top: 16, left: 16, borderTop: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` })} />
      <div style={bracket({ top: 16, right: 16, borderTop: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` })} />
      <div style={bracket({ bottom: 16, left: 16, borderBottom: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` })} />
      <div style={bracket({ bottom: 16, right: 16, borderBottom: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` })} />

      {/* header + standing work order */}
      <div style={{ position: 'fixed', top: 26, left: 56, fontSize: 11, lineHeight: 1.75, maxWidth: 460 }}>
        <div style={{ color: FEED_INK_DIM, marginBottom: 6 }}>
          CONSOLIDATED EXTRACTION AUTHORITY · SUIT FEED
        </div>
        {text.workorder.map((line, i) => (
          <div key={`${i}-${line}`}>{line}</div>
        ))}
      </div>

      {/* REC + frame counter */}
      <div style={{ position: 'fixed', top: 26, right: 56, textAlign: 'right', fontSize: 11, lineHeight: 1.8 }}>
        <div>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: FEED_INK, marginRight: 8,
            animation: 'pvFeedRec 1.6s steps(2, jump-none) infinite'
          }} />
          REC
        </div>
        <div ref={counterRef}>FRM 0000000</div>
        <div style={{ color: FEED_INK_DIM }}>SITE 7C-θ · LIVE</div>
      </div>

      {/* violation flood (A2 opening) */}
      {text.violation.length > 0 && (
        <div style={{
          position: 'fixed', right: 56, bottom: 30, textAlign: 'right',
          fontSize: 12, lineHeight: 1.9, color: '#ffd28a'
        }}>
          {text.violation.map((line, i) => (
            <div key={`${i}-${line}`} style={{ opacity: 0.45 + (0.55 * (i + 1)) / text.violation.length }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* quota ledger */}
      {quotaVisible && (
        <div style={{ position: 'fixed', bottom: 30, left: 56, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>QUOTA</div>
          <div>FIBER {fiber}/{CH1_QUOTA.biofiber} · STONE {stone}/{CH1_QUOTA.stone}</div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>
            HARVESTER CELL {Math.round(mawFraction * 100)}% · TRICKLE FEED
          </div>
        </div>
      )}

      {/* feed reticle */}
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        fontSize: 16, color: FEED_INK_DIM
      }}>
        +
      </div>

      {/* hold-to-harvest readout */}
      <div
        ref={harvestRef}
        style={{
          position: 'fixed', left: '50%', top: '56%', transform: 'translateX(-50%)',
          display: 'none', fontSize: 11, letterSpacing: '0.24em', color: FEED_INK
        }}
      />

      {/* context interaction (the sandbox prompt is hidden during the feed) */}
      {interaction && (
        <div style={{
          position: 'fixed', left: '50%', bottom: '18%', transform: 'translateX(-50%)',
          fontSize: 12, letterSpacing: '0.2em',
          border: `1px solid ${FEED_INK_DIM}`, padding: '7px 14px',
          background: 'rgba(2,4,3,0.55)'
        }}>
          [F] {interaction.verb.toUpperCase()}
        </div>
      )}

      {/* survey marker (ch1 objective designator, driver-projected) */}
      <div
        ref={markerRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          width: 54,
          height: 54,
          justifyContent: 'center',
          border: `1px dashed ${FEED_INK_DIM}`,
          willChange: 'transform',
          animation: 'pvFeedRec 1.6s steps(2, jump-none) infinite'
        }}
      >
        <div ref={markerChevronRef} style={{ display: 'none', fontSize: 24, color: FEED_INK, textShadow: '0 0 6px rgba(0,0,0,0.9)' }}>▶</div>
        <div ref={markerLabelRef} style={{
          fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap', color: FEED_INK,
          background: 'rgba(2,4,3,0.66)', padding: '3px 7px'
        }} />
      </div>

      {/* redaction box (driven by the driver's screen-space projection) */}
      <div
        ref={redactionRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2,4,3,0.96)',
          border: '2px solid rgba(228,236,231,0.85)',
          outline: '2px dashed rgba(228,236,231,0.35)',
          outlineOffset: 3,
          willChange: 'transform'
        }}
      >
        <div ref={redactionLabelRef} style={{ fontSize: 10, letterSpacing: '0.16em', padding: 10, textAlign: 'center' }} />
      </div>

      <style>{`
        @keyframes pvFeedRec {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
};

// Inventory subscription just needs a changing token; counts are re-read in render.
let invVersion = 0;
subscribeInventory(() => { invVersion++; });
function inventoryVersion(): number {
  return invVersion;
}

export default RegulationFeedHud;
