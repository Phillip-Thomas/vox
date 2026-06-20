import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getWarp, tickWarp, warpOpacity } from '../../state/spaceFlight.ts';

/**
 * In-Canvas driver: advances the warp each rendered frame. Mounted once in the
 * persistent App/Canvas layer (OUTSIDE the remounting EfficientScene) so the
 * warp keeps advancing across the world swap it triggers at its midpoint.
 *
 * The visual white-out itself is the DOM <WarpFlash> below — a screen-space
 * effect that is camera-independent and dirt cheap, which doubles as the POTATO
 * warp. A4 layers a shader speed-line pass on top for higher profiles.
 */
export function WarpDriver() {
  useFrame((_, dt) => {
    // Clamp dt so a long frame (e.g. the regen spike hidden under the flash)
    // cannot teleport the warp past its midpoint swap.
    tickWarp(Math.min(dt, 0.05));
  });
  return null;
}

/**
 * DOM white-out driven by warp progress. Updates opacity imperatively each
 * animation frame (the progress lives in a mutable runtime object, not React
 * state) so it never forces a React re-render.
 */
export function WarpFlash() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const warp = getWarp();
        if (warp.active) {
          el.style.opacity = String(warpOpacity());
          el.style.display = 'block';
        } else if (el.style.display !== 'none') {
          el.style.opacity = '0';
          el.style.display = 'none';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        display: 'none',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 50,
        // Warm-white core fading to a cool rim reads as a hyperspace flash even
        // before the shader speed-lines (A4) are added.
        background:
          'radial-gradient(circle at 50% 50%, #ffffff 0%, #eaf2ff 55%, #c7d8ff 100%)'
      }}
    />
  );
}
