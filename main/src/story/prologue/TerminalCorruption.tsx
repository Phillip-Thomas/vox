import React, { useEffect, useRef } from 'react';
import { CRASH_LINES } from '../storyScript.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { PHOSPHOR, TERMINAL_BG } from './TerminalPrologue.tsx';

// --- The crash, rendered as the terminal failing -------------------------------------
//
// The player never sees the hauler break apart. They see the ONLY reality they
// have been issued — the ledger — stop being able to describe what is happening:
// nav advisories repeating, characters scrambling, scan rows tearing sideways,
// two frames of white, black. An imperative canvas (the WarpOverlay pattern).

const DURATION_MS = 7200;
const GARBLE_CHARS = '█▓▒░@#%&$?';

const TerminalCorruption: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startedAt = performance.now();
    let raf = 0;
    let done = false;
    playSfx('terminalCorrupt');
    const alarmTimers = [800, 2100, 3600].map(ms => window.setTimeout(() => playSfx('terminalAlarm'), ms));

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      const t = (performance.now() - startedAt) / DURATION_MS;
      if (t >= 1) {
        if (!done) {
          done = true;
          cancelAnimationFrame(raf);
          onDone();
        }
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Endgame: two hard white frames, then black.
      if (t > 0.94) {
        ctx.fillStyle = t < 0.965 ? '#eafff0' : TERMINAL_BG;
        ctx.fillRect(0, 0, w, h);
        return;
      }

      ctx.fillStyle = TERMINAL_BG;
      ctx.fillRect(0, 0, w, h);

      const severity = Math.min(1, t * 1.5);
      const fontSize = Math.max(13, Math.round(w / 64));
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';

      // Phosphor flicker deepens with severity.
      ctx.globalAlpha = Math.random() < severity * 0.25 ? 0.4 + Math.random() * 0.4 : 1;

      const visibleLines = Math.min(CRASH_LINES.length, 1 + Math.floor(t * 9));
      const lineHeight = fontSize * 2.1;
      const originY = h * 0.32;
      for (let i = 0; i < visibleLines; i++) {
        const line = CRASH_LINES[i];
        let text = '';
        for (const ch of line) {
          text += ch !== ' ' && Math.random() < severity * 0.5
            ? GARBLE_CHARS[Math.floor(Math.random() * GARBLE_CHARS.length)]
            : ch;
        }
        const tear = Math.random() < severity * 0.6 ? (Math.random() - 0.5) * w * 0.12 * severity : 0;
        ctx.fillStyle = PHOSPHOR;
        ctx.fillText(text, w * 0.14 + tear, originY + i * lineHeight);
      }

      // Row tears: shift horizontal slices of what was just drawn.
      const tears = Math.floor(severity * 6);
      for (let i = 0; i < tears; i++) {
        const y = Math.random() * h;
        const sliceH = 3 + Math.random() * 22 * severity;
        const off = (Math.random() - 0.5) * w * 0.2 * severity;
        const slice = ctx.getImageData(0, y, w, Math.max(1, Math.floor(sliceH)));
        ctx.putImageData(slice, off, y);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      alarmTimers.forEach(t => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

export default TerminalCorruption;
