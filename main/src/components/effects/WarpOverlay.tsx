import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getGraphicsQuality } from '../../config/graphicsSettings.ts';
import { getWarp, tickWarp, warpOpacity } from '../../state/spaceFlight.ts';

/**
 * In-Canvas driver: advances the warp each rendered frame. Mounted once in the
 * persistent App/Canvas layer (OUTSIDE the remounting EfficientScene) so the
 * warp keeps advancing across the world swap it triggers at its midpoint.
 *
 * The visual is the DOM <WarpFlash> below — a screen-space hyperspace effect that
 * is camera-independent and cheap, and survives the EfficientScene remount it
 * masks.
 */
export function WarpDriver() {
  useFrame((_, dt) => {
    // Clamp dt so a long frame (e.g. the regen spike hidden under the flash)
    // cannot teleport the warp past its midpoint swap.
    tickWarp(Math.min(dt, 0.05));
  });
  return null;
}

interface Streak {
  angle: number;
  speed: number;
  offset: number;
}

/**
 * DOM hyperspace warp overlay driven by warp progress. A 2D canvas paints radial
 * star-streaks flying outward from the center plus a building white core; the
 * whole thing peaks at the warp's white-out midpoint (where the world swap is
 * hidden) and recedes after. Updated imperatively each animation frame (warp
 * progress lives in a mutable runtime object, not React state) so it never forces
 * a React re-render. On non-animated profiles it degrades to a plain white flash.
 */
export function WarpFlash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Deterministic streak field (Math.random at mount is fine — only the relative
  // layout matters, and it stays stable for the session).
  const streaks = useMemo<Streak[]>(
    () => Array.from({ length: 170 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 1.15,
      offset: Math.random()
    })),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let last = performance.now();
    let visible = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      const warp = getWarp();
      if (!warp.active) {
        if (visible) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.opacity = '0';
          visible = false;
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!visible) {
        canvas.style.opacity = '1';
        visible = true;
      }

      const op = warpOpacity(); // 0 at ends, 1 at the white-out midpoint
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(cx, cy);
      ctx.clearRect(0, 0, w, h);

      const animated = getGraphicsQuality().animatedShaders;
      if (animated) {
        // Radial star-streaks accelerating outward — the "jump to lightspeed" look.
        ctx.lineCap = 'round';
        for (let i = 0; i < streaks.length; i++) {
          const s = streaks[i];
          const r = ((t * s.speed + s.offset) % 1);   // 0..1 along the radius
          const dist = r * maxR;
          const ca = Math.cos(s.angle);
          const sa = Math.sin(s.angle);
          // Streaks lengthen toward the edge and with warp intensity.
          const len = (10 + dist * 0.16) * (0.35 + op);
          const x1 = cx + ca * dist;
          const y1 = cy + sa * dist;
          const x2 = cx + ca * (dist - len);
          const y2 = cy + sa * (dist - len);
          const a = op * Math.min(1, r * 2.2);        // fade in from center
          ctx.strokeStyle = `rgba(${200 + ((1 - r) * 55) | 0}, ${225 + (r * 30) | 0}, 255, ${a})`;
          ctx.lineWidth = 1 + r * 2.2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // White core bloom that builds to the opaque midpoint (hides the swap).
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      const coreA = op * op; // sharper peak so the midpoint is fully white
      core.addColorStop(0, `rgba(255,255,255,${Math.min(1, coreA * 1.15)})`);
      core.addColorStop(0.55, `rgba(234,242,255,${coreA * 0.9})`);
      core.addColorStop(1, `rgba(199,216,255,${coreA * 0.35})`);
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [streaks]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 50
      }}
    />
  );
}
