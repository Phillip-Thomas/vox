// Phase 5 — postprocessing composer (bloom + optional painterly).
//
// Mounted ONLY when the active quality profile sets `postProcess: true`
// (ULTRA / HIGH). When it is not mounted the renderer keeps its ACES tone
// mapping path untouched, so MEDIUM / LOW / POTATO look exactly as before.
//
// ── Tone-mapping handling (post on vs off parity) ───────────────────────────
// The app normally sets `gl.toneMapping = ACESFilmicToneMapping` in the
// Canvas `onCreated`. That works because Three tone-maps as the final step of
// the forward render. But `EffectComposer` renders the scene into an offscreen
// HDR buffer and composites it itself — if the renderer also tone-mapped, the
// result would be tone-mapped twice (washed out / wrong).
//
// So while this component is mounted we flip the renderer to `NoToneMapping`
// and instead append a `<ToneMapping mode={ACES_FILMIC}>` effect as the LAST
// pass in the chain. ACES is therefore applied exactly once, at the same point
// in the pipeline, matching the no-post look (modulo the bloom we add on top).
// On unmount we restore `ACESFilmicToneMapping` so toggling profiles at runtime
// can't leave the renderer in a bad state.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  wrapEffect
} from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode } from 'postprocessing';
import { getGraphicsQuality } from '../../config/graphicsSettings.ts';
import { PainterlyEffect } from './PainterlyEffect.ts';

// Turn the custom Effect class into an R3F component.
const Painterly = wrapEffect(PainterlyEffect);

/**
 * Swaps the renderer to NoToneMapping for the lifetime of the composer and
 * restores ACES on unmount. Kept as its own hook so the intent is obvious.
 */
function useComposerToneMapping() {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const previous = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = previous;
    };
  }, [gl]);
}

export default function PostFX() {
  useComposerToneMapping();

  // Read once on mount; `painterly` can be forced via overrideGraphicsQuality
  // (e.g. ?painterly=1 wired in App). Reading here keeps a single composer.
  const painterly = getGraphicsQuality().painterly;

  return (
    <EffectComposer
      // Selective bloom needs HDR precision so very-bright emissive surfaces
      // (lava, ores) read above the luminance threshold.
      multisampling={0}
      frameBufferType={THREE.HalfFloatType}
    >
      {/* Selective bloom: only pixels brighter than the threshold bloom, so
          the emissive lava/ores glow while normal terrain stays crisp. */}
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
        kernelSize={KernelSize.MEDIUM}
      />

      {/* Optional painterly pass (Kuwahara), gated by the `painterly` flag.
          Placed BEFORE tone mapping so it operates in the same (HDR) space as
          bloom and the final ACES step still runs last. */}
      {painterly ? <Painterly /> : <></>}

      {/* MUST be last: applies ACES once, replacing the renderer's tone map. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
