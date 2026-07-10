import React, { useEffect, useRef, useState } from 'react';
import { MANIFEST_LINES } from '../storyScript.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { PHOSPHOR, PHOSPHOR_DIM, PHOSPHOR_FAINT } from './TerminalPrologue.tsx';

// --- The manifest (berthing/processing) ----------------------------------------------
//
// Connective tissue between the crawl (the universe) and the voyage (your
// particular commute): the Authority processes YOU. Lines type themselves with
// keystroke ticks; Enter fast-forwards; the hatch-seal line wipes to the ledger.

const LINE_MS = 1350;
const HOLD_AFTER_MS = 3200;

const ManifestScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [visibleLines, setVisibleLines] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    playSfx('terminalAdvance');
    setLeaving(true);
    setTimeout(onDone, 700);
  };

  useEffect(() => {
    if (visibleLines >= MANIFEST_LINES.length) {
      const hold = setTimeout(finish, HOLD_AFTER_MS);
      return () => clearTimeout(hold);
    }
    const timer = setTimeout(() => {
      if (MANIFEST_LINES[visibleLines]?.trim()) playSfx('terminalKey');
      setVisibleLines(n => n + 1);
    }, MANIFEST_LINES[visibleLines]?.trim() ? LINE_MS : LINE_MS * 0.35);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLines]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (visibleLines < MANIFEST_LINES.length) setVisibleLines(MANIFEST_LINES.length);
        else finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLines]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: leaving ? 0 : 1,
      transition: 'opacity 650ms ease'
    }}>
      <div style={{ width: 'min(88vw, 560px)', fontSize: 13, lineHeight: 1.9 }}>
        <div style={{ color: PHOSPHOR_DIM, fontSize: 11, letterSpacing: '0.2em', marginBottom: 14 }}>
          CONSOLIDATED EXTRACTION AUTHORITY · INTAKE
        </div>
        {MANIFEST_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} style={{
            color: line.startsWith('  ') ? PHOSPHOR_DIM : PHOSPHOR,
            whiteSpace: 'pre',
            minHeight: line === '' ? '0.9em' : undefined
          }}>
            {line}
          </div>
        ))}
        {visibleLines < MANIFEST_LINES.length && (
          <span style={{ color: PHOSPHOR, animation: 'pvTermFlicker 1s steps(2) infinite' }}>▮</span>
        )}
        <div style={{ marginTop: 16, fontSize: 10, color: PHOSPHOR_FAINT, letterSpacing: '0.18em' }}>
          [ENTER] EXPEDITE PROCESSING
        </div>
      </div>
    </div>
  );
};

export default ManifestScreen;
