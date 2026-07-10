import React, { useEffect, useRef } from 'react';
import { theme } from '../../ui/theme.ts';
import { getFeedRuntime } from '../feedRuntime.ts';

// --- The Regulation Feed treatment ---------------------------------------------
//
// Screen-space CCTV lens over the live 3D render, built from plain DOM layers so
// it is IDENTICAL on every graphics tier (no composer involvement):
//
//   1. backdrop-filter layer — grayscale + contrast crush of everything beneath
//      (WebGL canvas included). Catches the sky/props that per-material chroma
//      can't reach. Grayscale amount tracks feedRuntime.desat so A1's flashes and
//      ramp drop it frame-accurately.
//   2. ordered-dither tile — an 8×8 Bayer PNG (generated once) tiled at low
//      opacity for the 1-bit readout feel.
//   3. scanlines — repeating gradient with a slow drift; rolls hard on glitches.
//   4. CCTV vignette.
//   5. glitch canvas — imperative tear/noise bands, painted only while glitching.
//
// All animation is rAF style-writes from feedRuntime (the WarpOverlay pattern);
// React renders this tree exactly once per mount.

function bayerDataUri(): string {
  const M = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(8, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4;
      const v = Math.round(((M[y][x] + 0.5) / 64) * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

const BAYER_URI = typeof document !== 'undefined' ? bayerDataUri() : '';

const layerBase: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none'
};

const FeedOverlay: React.FC = () => {
  const filterRef = useRef<HTMLDivElement>(null);
  const ditherRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const glitchRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastDesat = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = getFeedRuntime();
      const filter = filterRef.current;
      const dither = ditherRef.current;
      const scan = scanRef.current;
      const vignette = vignetteRef.current;
      const glitch = glitchRef.current;
      const flash = flashRef.current;
      if (!filter || !dither || !scan || !vignette || !glitch || !flash) return;

      // Hard white punctuation (pod impact): visible only while decaying.
      if (r.flash > 0.01) {
        flash.style.display = 'block';
        flash.style.opacity = String(Math.min(1, r.flash));
      } else if (flash.style.display !== 'none') {
        flash.style.display = 'none';
      }

      // Backdrop filter strings are only rebuilt when the value actually moves —
      // and the layer UNMOUNTS from compositing (display:none) whenever it is at
      // identity: a live backdrop-filter forces a full-screen readback every
      // frame even at grayscale(0), which is pure dead weight post-A1.
      const desat = Math.round(r.desat * 100) / 100;
      if (desat !== lastDesat) {
        lastDesat = desat;
        if (desat < 0.01) {
          filter.style.display = 'none';
        } else {
          filter.style.display = 'block';
          const contrast = 1 + 0.26 * r.treatment * desat;
          const bright = 1 + 0.05 * r.treatment;
          filter.style.backdropFilter = `grayscale(${desat}) contrast(${contrast}) brightness(${bright})`;
          (filter.style as unknown as Record<string, string>).webkitBackdropFilter = filter.style.backdropFilter;
        }
      }
      // Treatment layers leave the compositor entirely once dissolved (A2+).
      const treatmentGone = r.treatment < 0.01;
      const treatmentDisplay = treatmentGone ? 'none' : 'block';
      if (dither.style.display !== treatmentDisplay) {
        dither.style.display = treatmentDisplay;
        scan.style.display = treatmentDisplay;
        vignette.style.display = treatmentDisplay;
      }
      if (!treatmentGone) {
        dither.style.opacity = String(0.5 * r.treatment);
        scan.style.opacity = String(0.5 * r.treatment);
        scan.style.transform = r.scanRoll > 0.001 ? `translateY(${r.scanRoll * 46}px)` : 'translateY(0)';
        vignette.style.opacity = String(0.9 * r.treatment);
      }

      // Glitch canvas: paint only while glitching; one clear when it ends.
      const ctx = glitch.getContext('2d');
      if (ctx) {
        if (glitch.width !== glitch.clientWidth || glitch.height !== glitch.clientHeight) {
          glitch.width = glitch.clientWidth;
          glitch.height = glitch.clientHeight;
        }
        ctx.clearRect(0, 0, glitch.width, glitch.height);
        if (r.glitch > 0.01) {
          const bands = 2 + Math.floor(r.glitch * 6);
          for (let i = 0; i < bands; i++) {
            const y = Math.random() * glitch.height;
            const h = 2 + Math.random() * 12 * r.glitch;
            const off = (Math.random() - 0.5) * 60 * r.glitch;
            ctx.fillStyle = `rgba(255,255,255,${0.10 * r.glitch})`;
            ctx.fillRect(off, y, glitch.width, h);
            ctx.fillStyle = `rgba(0,0,0,${0.22 * r.glitch})`;
            ctx.fillRect(-off, y + h, glitch.width, h * 0.6);
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden style={{ ...layerBase, zIndex: theme.z.hud - 2 }}>
      {/* 1 — grayscale/contrast of everything beneath */}
      <div ref={filterRef} style={layerBase} />
      {/* 2 — ordered dither tile */}
      <div
        ref={ditherRef}
        style={{
          ...layerBase,
          backgroundImage: `url(${BAYER_URI})`,
          backgroundSize: '8px 8px',
          imageRendering: 'pixelated',
          mixBlendMode: 'overlay'
        }}
      />
      {/* 3 — scanlines (slow drift via keyframes; roll via transform) */}
      <div
        ref={scanRef}
        style={{
          ...layerBase,
          inset: -60,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 1px, transparent 1px, transparent 3px)',
          animation: 'pvFeedScanDrift 9s linear infinite'
        }}
      />
      {/* 4 — CCTV vignette */}
      <div
        ref={vignetteRef}
        style={{
          ...layerBase,
          background:
            'radial-gradient(115% 95% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.36) 84%, rgba(0,0,0,0.72) 100%)'
        }}
      />
      {/* 5 — imperative tear/noise canvas */}
      <canvas ref={glitchRef} style={{ ...layerBase, width: '100%', height: '100%' }} />
      {/* 6 — hard white flash (impact punctuation) */}
      <div ref={flashRef} style={{ ...layerBase, background: '#eef3ee', display: 'none' }} />
      <style>{`
        @keyframes pvFeedScanDrift {
          from { background-position-y: 0px; }
          to   { background-position-y: 60px; }
        }
      `}</style>
    </div>
  );
};

export default FeedOverlay;
