import React, { useEffect, useState } from 'react';
import { getLavaImmersion, isCameraInLava } from '../../state/playerLavaImmersion.ts';

/**
 * Molten-heat feedback while the body is in lava: a pulsing orange vignette that
 * deepens as the melt takes hold (a damage alarm — body channel, like the health
 * bar), plus a near-solid molten wash when the RENDER CAMERA itself is inside a
 * lava cell — the voxel mesh has no interior faces, so this overlay IS the
 * "inside lava" view. The wash keys on the camera channel so external lenses
 * (survey chart, side rigs) over a burning character stay readable. Polls the
 * client-only lava-immersion state via rAF (same shape as CrashFlash).
 */
const LavaHeatVignette: React.FC = () => {
  const [immersion, setImmersion] = useState(0);
  const [eyeUnder, setEyeUnder] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setImmersion(getLavaImmersion());
      setEyeUnder(isCameraInLava());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (immersion <= 0.01 && !eyeUnder) return null;
  const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
  const glow = immersion * pulse;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        boxShadow: `inset 0 0 ${140 * glow}px ${50 * glow}px rgba(255,80,10,${0.5 * glow})`
      }} />
      {eyeUnder && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255,120,20,0.88) 0%, rgba(185,35,0,0.96) 70%, rgba(120,10,0,0.98) 100%)'
        }} />
      )}
    </div>
  );
};

export default LavaHeatVignette;
