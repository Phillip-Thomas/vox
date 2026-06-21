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

import { useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  wrapEffect
} from '@react-three/postprocessing';
import { N8AO } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode } from 'postprocessing';
import { getGraphicsQuality } from '../../config/graphicsSettings.ts';
import { buildBiomeProfile } from '../../utils/biomeProfile.ts';
import { getSunDirection } from '../SkyController.tsx';
import { PainterlyEffect } from './PainterlyEffect.ts';
import { ColorGradeEffect, getColorGrade } from './ColorGradeEffect.ts';
import { OutlineEffect } from './OutlineEffect.ts';

// Turn the custom Effect classes into R3F components.
const Painterly = wrapEffect(PainterlyEffect);
const ColorGrade = wrapEffect(ColorGradeEffect);
const EdgeOutline = wrapEffect(OutlineEffect);

interface PostFXProps {
  /** Planet seed — drives the per-biome color grade. */
  terrainSeed?: number;
}

/** Per-biome static grade params (tint + saturation feel). */
function biomeGrade(terrainSeed: number) {
  const b = buildBiomeProfile(terrainSeed);
  const accent = new THREE.Color().setHSL(b.alien ? b.hue : (0.08 + b.temperature * 0.1), 0.5, 0.6);
  const tint = new THREE.Color(1, 1, 1).lerp(accent, 0.18); // near-white nudged toward biome hue
  return {
    tint,
    tintAmount: 0.10 + (b.alien ? 0.06 : 0.0),
    saturation: 1.04 + b.saturation * 0.1 - b.aridity * 0.08, // vivid biomes pop, arid desats
    contrast: 1.03
  };
}

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

export default function PostFX({ terrainSeed = 0 }: PostFXProps) {
  useComposerToneMapping();

  // Read once on mount; `painterly` can be forced via overrideGraphicsQuality
  // (e.g. ?painterly=1 wired in App). Reading here keeps a single composer.
  const quality = getGraphicsQuality();
  const painterly = quality.painterly;
  const colorGrade = quality.colorGrade;
  const contactAO = quality.contactAO;
  const outline = quality.outline;

  const grade = useMemo(() => biomeGrade(terrainSeed), [terrainSeed]);

  // Drive the grade through the module handle (no props/ref — see ColorGradeEffect).
  // Per-biome tint/sat are static; warmth + contrast track the sun: warm at golden
  // hour, cooler + slightly punchier at night.
  useFrame(() => {
    const eff = getColorGrade();
    if (!eff) return;
    const sunY = getSunDirection().y;
    const daylight = THREE.MathUtils.smoothstep(sunY, -0.12, 0.18);
    const golden = daylight * (1 - THREE.MathUtils.smoothstep(sunY, 0.05, 0.32));
    eff.setGrade(
      grade.tint,
      grade.tintAmount,
      grade.saturation,
      golden * 0.8 - (1 - daylight) * 0.35,
      grade.contrast + (1 - daylight) * 0.05
    );
  });

  return (
    <EffectComposer
      // Selective bloom needs HDR precision so very-bright emissive surfaces
      // (lava, ores) read above the luminance threshold.
      multisampling={0}
      frameBufferType={THREE.HalfFloatType}
    >
      {/* Contact AO (N8AO): computes its own normals from depth (no extra normal
          pass), so it grounds grass/trees/ship/voxels cheaply. FIRST in the chain
          so bloom + grade operate on the occluded image. Half-res + modest samples
          to protect FPS on the instanced world; gated ULTRA/HIGH. */}
      {contactAO ? (
        <N8AO
          aoRadius={3.5}
          intensity={1.6}
          distanceFalloff={1.0}
          halfRes
          quality="medium"
        />
      ) : <></>}

      {/* Selective bloom: only pixels brighter than the threshold bloom, so
          the emissive lava/ores glow while normal terrain stays crisp. */}
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
        kernelSize={KernelSize.MEDIUM}
      />

      {/* Stylized depth outline: darkens silhouette edges so the realistic look
          reads as deliberate. After bloom (so glow isn't outlined), before grade
          (so edges are graded with everything else). Gated `outline`. */}
      {outline ? <EdgeOutline /> : <></>}

      {/* Optional painterly pass (Kuwahara), gated by the `painterly` flag.
          Placed BEFORE tone mapping so it operates in the same (HDR) space as
          bloom and the final ACES step still runs last. */}
      {painterly ? <Painterly /> : <></>}

      {/* Unified per-biome + time-of-day color grade (cohesion). Just before
          tone mapping so it grades the composited HDR frame once. */}
      {colorGrade ? <ColorGrade /> : <></>}

      {/* MUST be last: applies ACES once, replacing the renderer's tone map. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
