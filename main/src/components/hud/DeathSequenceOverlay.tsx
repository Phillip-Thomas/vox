import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEATH_TIMINGS,
  beginDeathSequence, notifyDeathRecovery, resetDeathSequence, getDeathView,
  inferDeathCause, deathLogLines, rewakeLogLines, visibleLog,
  type DeathSequenceView
} from '../../game/systems/deathSequence.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import { isFeetInLava } from '../../state/playerLavaImmersion.ts';
import { isPlayerSubmerged } from '../../state/playerSubmersion.ts';
import { getGraphicsQuality } from '../../config/graphicsSettings.ts';
import { theme } from '../../ui/theme.ts';
import DownedPanel from '../ui/DownedPanel.tsx';

// --- Death sequence overlay ----------------------------------------------------
//
// The DOM half of the death presentation. Owns the sequence machine's INPUT
// edges (vitals downed rise -> begin, fall -> rewake) and renders everything
// the composer pass cannot: the biomonitor log, the death-instant flash, the
// darkening scrim, and — on tiers WITHOUT the post composer — a canvas-2D
// phosphor rain that carries the substrate look on its own. On ULTRA/HIGH the
// DeathRenderEffect decompiles the actual framebuffer and this layer stays
// nearly transparent underneath the log.
//
// Client-only presentation (CrashFlash/LavaHeatVignette pattern): a rAF loop
// polls the sequence view; React re-renders only while a sequence is active.
// The DownedPanel is rendered as a SIBLING of the visual layer (fragment), so
// its inert/aria-hidden focus trap still covers the whole app subtree.

const PHOSPHOR = '#8dffa8';
const PHOSPHOR_DIM = 'rgba(141,255,168,0.55)';
const RAIN_CHARS = '0101.:+x#1';
const RAIN_COL_PX = 16;
const FLASH_MS = 220;

interface RainColumn { y: number; speed: number; }

interface DeathSequenceOverlayProps {
  playing: boolean;
  downed: boolean;
  onRecover: () => void;
  onReturnToMenu: () => void;
}

const DeathSequenceOverlay: React.FC<DeathSequenceOverlayProps> = ({ playing, downed, onRecover, onReturnToMenu }) => {
  // Composer tiers get the real framebuffer decompile; others lean on the rain.
  const postProcess = useMemo(() => getGraphicsQuality().postProcess, []);
  const [view, setView] = useState<DeathSequenceView>(() => getDeathView());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainCols = useRef<RainColumn[]>([]);
  const rainLastMs = useRef(0);
  const rainInked = useRef(false);
  // null = first observation this session (a save can load already downed).
  const prevDowned = useRef<boolean | null>(null);

  // Sequence input edges. Cause is sampled AT the moment of death — the hazard
  // state that put the body down, not whatever is true when the panel opens.
  useEffect(() => {
    if (!playing) {
      resetDeathSequence();
      prevDowned.current = null;
      return;
    }
    if (downed) {
      const vitals = getVitals();
      const cause = inferDeathCause({
        feetInLava: isFeetInLava(),
        submerged: isPlayerSubmerged(),
        oxygen: vitals.oxygen,
        warmth: vitals.warmth
      });
      // Already downed when the session mounted (loaded save): skip the
      // collapse the player never saw and land on the panel.
      beginDeathSequence(cause, { skipIntro: prevDowned.current === null });
    } else if (prevDowned.current === true) {
      // The recovery teleport landed (or health returned): re-render the world.
      notifyDeathRecovery();
    }
    prevDowned.current = downed;
  }, [playing, downed]);

  // rAF poll (CrashFlash pattern). The functional set bails while idle, so the
  // steady-state cost is one view derivation + one compare per frame.
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    const tick = () => {
      const next = getDeathView();
      setView(prev => (prev.phase === 'idle' && next.phase === 'idle') ? prev : next);
      drawRain(canvasRef.current, rainCols.current, rainLastMs, rainInked, next, postProcess);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, postProcess]);

  if (!playing || view.phase === 'idle') return null;

  const dying = view.phase !== 'rewake';
  const logLines = dying
    ? visibleLog(deathLogLines(view.cause), view.elapsedMs)
    : visibleLog(rewakeLogLines(), view.elapsedMs);
  const cursorOn = Math.floor(view.elapsedMs / 530) % 2 === 0;
  // Dying: the log fades IN with the collapse. Rewake: it must NOT follow the
  // ramp-out (the stamped resume line lands on a nearly-clean frame), so it
  // holds and only dissolves over the final stretch of the rewake window.
  const logOpacity = dying
    ? Math.min(1, view.intensity * 2.5)
    : Math.max(0, Math.min(1, (1 - view.elapsedMs / DEATH_TIMINGS.rewakeMs) * 6));
  // Death-instant flash: one white blink as the signal drops.
  const flash = view.phase === 'collapse' && view.elapsedMs < FLASH_MS
    ? (1 - view.elapsedMs / FLASH_MS) * 0.45
    : 0;
  // Composer tiers barely need the scrim (the pass darkens the frame itself);
  // fallback tiers use it to sink the world under the rain.
  const scrim = view.intensity * (postProcess ? 0.22 : 0.82);

  return (
    <>
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: theme.z.menu + 2, pointerEvents: 'none',
        fontFamily: theme.font.mono
      }}>
        <div style={{ position: 'absolute', inset: 0, background: '#010402', opacity: scrim }} />
        {!postProcess && (
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        )}
        {flash > 0 && (
          <div style={{ position: 'absolute', inset: 0, background: '#eafff0', opacity: flash }} />
        )}
        {/* Biomonitor log — terminal tail, lower left. */}
        <div style={{
          position: 'absolute', left: 'max(24px, 4.5vw)', bottom: 'max(64px, 14vh)',
          maxWidth: 'min(560px, 86vw)', fontSize: 13, lineHeight: 1.9,
          color: PHOSPHOR, textShadow: `0 0 8px rgba(141,255,168,0.45)`,
          opacity: logOpacity
        }}>
          {logLines.map((line, i) => (
            <div key={i} style={line.stamp
              ? { color: '#c9ffd8', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(141,255,168,0.7)' }
              : undefined}>
              <span style={{ color: PHOSPHOR_DIM, marginRight: 10 }}>▸</span>
              {line.text}
              {i === logLines.length - 1 && cursorOn && <span style={{ color: '#c9ffd8' }}>▍</span>}
            </div>
          ))}
        </div>
      </div>
      {/* Sibling, not child: DownedPanel inerts its PARENT's other children, so
          it must sit beside the app's overlays to trap focus correctly. */}
      <DownedPanel open={view.panelOpen} cause={view.cause} onRecover={onRecover} onReturnToMenu={onReturnToMenu} />
    </>
  );
};

/** Canvas-2D phosphor rain for tiers without the post composer. Trails via
 *  destination-out fade; column count and alpha follow sequence intensity. */
function drawRain(
  canvas: HTMLCanvasElement | null,
  cols: RainColumn[],
  lastMs: React.MutableRefObject<number>,
  inked: React.MutableRefObject<boolean>,
  view: DeathSequenceView,
  postProcess: boolean
): void {
  if (postProcess || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (view.intensity <= 0.02) {
    if (inked.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      inked.current = false;
    }
    lastMs.current = 0;
    return;
  }

  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    cols.length = 0;
  }
  const now = performance.now();
  const dt = lastMs.current > 0 ? Math.min(64, now - lastMs.current) / 1000 : 1 / 60;
  lastMs.current = now;

  const colCount = Math.max(8, Math.floor(w / RAIN_COL_PX));
  while (cols.length < colCount) {
    cols.push({ y: -Math.random() * h, speed: 90 + Math.random() * 160 });
  }

  // Fade previous glyphs toward transparent (leaves drifting trails).
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  ctx.font = `14px ${theme.font.mono}`;
  for (let i = 0; i < colCount; i++) {
    // Deterministic subset of columns activates as intensity rises.
    if (((i * 0.61803) % 1) > view.intensity) continue;
    const col = cols[i];
    col.y += col.speed * dt;
    if (col.y > h + 40) {
      col.y = -Math.random() * 220;
      col.speed = 90 + Math.random() * 160;
    }
    const ch = RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0];
    ctx.globalAlpha = (0.35 + Math.random() * 0.55) * view.intensity;
    ctx.fillStyle = Math.random() < 0.12 ? '#c9ffd8' : PHOSPHOR;
    ctx.fillText(ch, i * RAIN_COL_PX + 2, col.y);
  }
  ctx.globalAlpha = 1;
  inked.current = true;
}

export default DeathSequenceOverlay;
