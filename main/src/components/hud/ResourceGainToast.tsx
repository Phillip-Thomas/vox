import React, { useEffect, useReducer, useRef, useState } from 'react';
import { subscribeFinalizedLocalGameplayCommand } from '../../game/commandDispatchAdapter.ts';
import { getItem, type ItemId } from '../../game/data/items.ts';
import { theme } from '../../ui/theme.ts';
import { hudGlassPanelStyle, hudNoSelect } from './hudChrome.ts';
import {
  RESOURCE_GAIN_LINGER_MS,
  createResourceGainToastState,
  formatResourceGainQty,
  getResourceGainDisplay,
  ingestResourceGain,
  normalizeResourceGainDeltas,
  pruneResourceGainRows,
  type ResourceGainToastState
} from './resourceGainToast.model.ts';

/**
 * Subtle "+4 STONE" collection feedback. Subscribes to the single finalized-
 * command choke point, aggregates gains through the pure model (window-merge,
 * multi-item rows, cap/overflow, linger), and renders a small top-center stack
 * BELOW the debug VantageToast (top:16) so it never collides with it, the
 * centre crosshair/mining ring, or the top-left inventory/vitals column.
 *
 * Informational only: it is mounted inside <CinematicHudVeil> in App.tsx, so it
 * fades with the rest of the HUD under a letterboxed cinematic instead of
 * floating over the shot. No audio — collection SFX is owned by another lane.
 */

const FADE_IN_MS = 140;
const FADE_OUT_MS = 420;

function itemLabel(id: string): string {
  // getItem resolves both resource and crafted ids; guard an unknown id so a
  // stray delta degrades to the raw token rather than throwing.
  const def = getItem(id as ItemId) as { name?: string } | undefined;
  return (def?.name ?? id).toUpperCase();
}

function rowOpacity(age: number): number {
  if (age <= 0) return 0;
  if (age < FADE_IN_MS) return age / FADE_IN_MS;
  const remaining = RESOURCE_GAIN_LINGER_MS - age;
  if (remaining < FADE_OUT_MS) return Math.max(0, remaining / FADE_OUT_MS);
  return 1;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

const ResourceGainToast: React.FC = () => {
  const stateRef = useRef<ResourceGainToastState>(createResourceGainToastState());
  const rafRef = useRef<number | null>(null);
  // Forces a re-render each animation frame so opacity (a function of elapsed
  // time, not of the row data) advances even while the rows themselves are
  // unchanged. Display is derived from `stateRef` at render time.
  const [, bumpFrame] = useReducer((n: number) => (n + 1) % 1_000_000, 0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // A self-cancelling rAF drives the fade-out/expiry while any row is live,
    // then parks itself (and prunes) the moment the stack empties so idle play
    // costs nothing.
    const tick = () => {
      const now = performance.now();
      const live = getResourceGainDisplay(stateRef.current, now).rows.length > 0;
      if (!live) {
        stateRef.current = pruneResourceGainRows(stateRef.current, now);
        rafRef.current = null;
        bumpFrame();
        return;
      }
      bumpFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    const ensureRunning = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };
    const unsubscribe = subscribeFinalizedLocalGameplayCommand(result => {
      const gains = normalizeResourceGainDeltas(result.deltas);
      if (gains.length === 0) return;
      stateRef.current = ingestResourceGain(stateRef.current, gains, performance.now());
      bumpFrame();
      ensureRunning();
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  const now = performance.now();
  const display = getResourceGainDisplay(stateRef.current, now);
  if (display.rows.length === 0) return null;

  return (
    <div
      data-testid="resource-gain-toast"
      aria-hidden
      style={{
        position: 'absolute',
        top: 'calc(54px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        zIndex: theme.z.hud + 3,
        pointerEvents: 'none',
        ...hudNoSelect
      }}
    >
      {display.rows.map(row => {
        const age = now - row.updatedAt;
        const opacity = rowOpacity(age);
        const lifting = !reducedMotion && age < FADE_IN_MS;
        return (
          <div
            key={row.id}
            data-testid="resource-gain-row"
            style={hudGlassPanelStyle({
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              padding: '3px 9px',
              borderRadius: theme.radius.pill,
              fontSize: 11,
              lineHeight: 1,
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
              opacity,
              transform: lifting ? 'translateY(-2px)' : 'translateY(0)',
              transition: reducedMotion ? 'none' : 'transform 140ms ease-out',
              background: 'linear-gradient(180deg, rgba(12,20,34,0.78), rgba(6,10,18,0.66))'
            })}
          >
            <span style={{ color: theme.color.accent, fontWeight: 800 }}>
              {formatResourceGainQty(row.qty)}
            </span>
            <span style={{ color: theme.color.text, opacity: 0.9 }}>{itemLabel(row.id)}</span>
          </div>
        );
      })}
      {display.overflowCount > 0 && (
        <div
          data-testid="resource-gain-overflow"
          style={hudGlassPanelStyle({
            padding: '2px 8px',
            borderRadius: theme.radius.pill,
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: 0.4,
            color: theme.color.textDim,
            opacity: 0.85,
            background: 'linear-gradient(180deg, rgba(12,20,34,0.66), rgba(6,10,18,0.56))'
          })}
        >
          {`+${display.overflowCount} MORE`}
        </div>
      )}
    </div>
  );
};

export default ResourceGainToast;
