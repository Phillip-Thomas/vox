import React, { useEffect, useRef } from 'react';
import { DEFLECTION } from '../storyScript.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { isMovieMode } from '../autopilot.ts';
import { PHOSPHOR, TERMINAL_BG } from './TerminalPrologue.tsx';

// --- Manual debris deflection (the Pong rung, 1972) ----------------------------------
//
// When the nav anomaly hits, the terminal drops to its oldest surviving
// subsystem: an oscilloscope and a paddle. The player deflects incoming debris
// — genuinely playable for DEFLECTION.fairSeconds — and then the anomaly
// multiplies the field beyond any paddle. The crash is something you fought.
// Imperative canvas with phosphor trails (paint-over with low-alpha fills).

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  wobble: number;
}

const PADDLE_X = 70;
const PADDLE_HALF = 52;
const KEY_SPEED = 420; // px/s for W/S control

const DebrisDeflection: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startedAt = performance.now();
    let lastAt = startedAt;
    let raf = 0;
    let done = false;
    let paddleY = 0.5; // normalized
    let keyDir = 0;
    let mouseY: number | null = null;
    const debris: Debris[] = [];
    let deflected = 0;
    let missed = 0;
    let hullHits = 0;
    let spawnAccum = 0;
    let anomalyAnnounced = false;

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      onDone();
    };

    const onMouse = (e: MouseEvent) => {
      mouseY = e.clientY / window.innerHeight;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keyDir = -1;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') keyDir = 1;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') keyDir = 0;
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastAt) / 1000);
      lastAt = now;
      const t = (now - startedAt) / 1000;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        ctx.fillStyle = TERMINAL_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const w = canvas.width;
      const h = canvas.height;
      const anomaly = t >= DEFLECTION.fairSeconds;

      // Phosphor trails: translucent paint-over instead of a clear.
      ctx.fillStyle = 'rgba(2,6,4,0.32)';
      ctx.fillRect(0, 0, w, h);

      // Paddle control (mouse wins while it moves; W/S otherwise). Movie mode
      // plays a competent-but-human paddle: track the nearest incoming debris
      // with capped speed — it holds its own until the anomaly, then loses.
      if (isMovieMode()) {
        let nearest: Debris | null = null;
        for (const b of debris) {
          if (b.vx < 0 && (!nearest || b.x < nearest.x)) nearest = b;
        }
        if (nearest) {
          const want = nearest.y / h;
          const maxStep = (KEY_SPEED * 0.85 * dt) / h;
          paddleY += Math.max(-maxStep, Math.min(maxStep, want - paddleY));
        }
      } else if (keyDir !== 0) {
        paddleY += (keyDir * KEY_SPEED * dt) / h;
        mouseY = null;
      } else if (mouseY != null) {
        paddleY += (mouseY - paddleY) * Math.min(1, dt * 14);
      }
      paddleY = Math.min(0.94, Math.max(0.06, paddleY));
      const py = paddleY * h;

      // Spawning: gentle stream, then the anomaly multiplies it.
      const rate = anomaly ? 6 + (t - DEFLECTION.fairSeconds) * 1.6 : 0.9 + t * 0.06;
      spawnAccum += rate * dt;
      while (spawnAccum >= 1) {
        spawnAccum -= 1;
        debris.push({
          x: w + 20,
          y: (0.08 + Math.random() * 0.84) * h,
          vx: -(120 + Math.random() * 80 + (anomaly ? 140 : 0)),
          vy: (Math.random() - 0.5) * (anomaly ? 90 : 24),
          r: 3 + Math.random() * 4,
          wobble: Math.random() * Math.PI * 2
        });
      }

      // Debris update + paddle/hull collisions.
      ctx.strokeStyle = PHOSPHOR;
      ctx.fillStyle = PHOSPHOR;
      for (let i = debris.length - 1; i >= 0; i--) {
        const b = debris[i];
        b.wobble += dt * 3;
        b.x += b.vx * dt;
        b.y += (b.vy + (anomaly ? Math.sin(b.wobble) * 70 : 0)) * dt;
        if (b.y < 6 || b.y > h - 6) b.vy = -b.vy;
        if (b.x <= PADDLE_X + 8 && b.x >= PADDLE_X - 10 && Math.abs(b.y - py) <= PADDLE_HALF + b.r) {
          b.vx = Math.abs(b.vx) * 1.05;
          b.vy += ((b.y - py) / PADDLE_HALF) * 90;
          deflected++;
          playSfx('terminalKey');
        } else if (b.x < -10) {
          debris.splice(i, 1);
          missed++;
          hullHits++;
          playSfx('terminalAlarm');
          continue;
        } else if (b.x > w + 60) {
          debris.splice(i, 1);
          continue;
        }
        ctx.fillRect(b.x - b.r / 2, b.y - b.r / 2, b.r, b.r);
      }

      // Paddle + hull line.
      ctx.fillRect(PADDLE_X - 4, py - PADDLE_HALF, 6, PADDLE_HALF * 2);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(24, 0, 2, h);
      ctx.globalAlpha = 1;

      // Scope chrome + readouts.
      const fontSize = Math.max(11, Math.round(w / 92));
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      const efficiency = deflected + missed > 0 ? Math.round((deflected / (deflected + missed)) * 100) : 100;
      ctx.fillText(DEFLECTION.title, w * 0.06, h * 0.08);
      ctx.globalAlpha = 0.6;
      ctx.fillText(DEFLECTION.subtitle, w * 0.06, h * 0.08 + fontSize * 1.7);
      ctx.fillText(`${DEFLECTION.efficiencyLabel}: ${efficiency}%`, w * 0.72, h * 0.08);
      ctx.globalAlpha = 1;

      if (anomaly) {
        if (!anomalyAnnounced) {
          anomalyAnnounced = true;
          playSfx('terminalCorrupt');
        }
        const line = DEFLECTION.anomalyLines[Math.min(DEFLECTION.anomalyLines.length - 1, Math.floor((t - DEFLECTION.fairSeconds) / 3))];
        ctx.fillText(line, w * 0.06, h * 0.92);
      }

      // Endings: hull breached during the anomaly (the intended loss), a slow
      // bleed of early misses, or the hard time cap.
      const out = (anomaly && hullHits > 0 && missed >= DEFLECTION.hullHitsAllowed)
        || hullHits >= DEFLECTION.hullHitsAllowed * 2
        || t >= DEFLECTION.maxSeconds;
      if (out) finish();
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

export default DebrisDeflection;
