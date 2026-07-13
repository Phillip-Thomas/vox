// Phase 5 — postprocessing composer (bloom + optional painterly).
//
// Mounted ONLY when the active quality profile sets `postProcess: true`
// (ULTRA / HIGH). When it is not mounted the renderer keeps the direct ACES
// tone mapping path, so MEDIUM / LOW / POTATO avoid composer cost.
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

import { useEffect, useMemo, useRef } from 'react';
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
import { getSunDirection } from '../SkyController.tsx';
import { PainterlyEffect } from './PainterlyEffect.ts';
import { ColorGradeEffect, getColorGrade } from './ColorGradeEffect.ts';
import { OutlineEffect } from './OutlineEffect.ts';
import { UnderwaterEffect, getUnderwater } from './UnderwaterEffect.ts';
import { getCameraSubmergence } from '../../state/playerSubmersion.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import { buildPlanetPostGradeProfile } from '../../utils/planetVisualProfile.ts';
import { getVoxelRealityEffects } from '../../game/systems/realityRenderSystem.ts';
import { getShipFlightFeedback } from '../../state/shipFlightFeedback.ts';
import { FlightMotionEffect, getFlightMotion } from './FlightMotionEffect.ts';
import { DeathRenderEffect, getDeathRender } from './DeathRenderEffect.ts';
import { getDeathView } from '../../game/systems/deathSequence.ts';

// Turn the custom Effect classes into R3F components.
const Painterly = wrapEffect(PainterlyEffect);
const ColorGrade = wrapEffect(ColorGradeEffect);
const EdgeOutline = wrapEffect(OutlineEffect);
const Underwater = wrapEffect(UnderwaterEffect);
const FlightMotion = wrapEffect(FlightMotionEffect);
const DeathRender = wrapEffect(DeathRenderEffect);

// Scratch for projecting the sun direction to screen space (god-ray origin).
const _sunDir = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _sunPoint = new THREE.Vector3();

interface PostFXProps {
  /** Planet seed — drives the per-biome color grade. */
  terrainSeed?: number;
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
  const underwaterPostFX = quality.underwaterPostFX;
  const underwaterGodrays = quality.underwaterGodrays;

  const grade = useMemo(() => buildPlanetPostGradeProfile(terrainSeed), [terrainSeed]);
  // Edge-triggered submerge/emerge wipe + previous submerged state for it.
  const prevSubmerged = useRef(false);
  const wipe = useRef(0);

  // Drive the grade through the module handle (no props/ref — see ColorGradeEffect).
  // Per-biome tint/sat are static; warmth + contrast track the sun: warm at golden
  // hour, cooler + slightly punchier at night.
  useFrame((state, delta) => {
    // Death decompile: one intensity signal from the sequence machine drives
    // the whole arc; a uniform-branch no-op whenever nobody is dying.
    const deathRender = getDeathRender();
    if (deathRender) {
      const death = getDeathView();
      deathRender.setFrame(
        death.intensity,
        state.clock.elapsedTime,
        death.cause,
        death.phase === 'rewake' ? 1 : 0
      );
    }

    const flightMotion = getFlightMotion();
    if (flightMotion) {
      const flight = getShipFlightFeedback();
      flightMotion.setFrame(flight.reducedMotion ? 0 : flight.motion, flight.boost);
    }

    const eff = getColorGrade();
    if (eff) {
      const sunY = getSunDirection().y;
      const daylight = THREE.MathUtils.smoothstep(sunY, -0.12, 0.18);
      const golden = daylight * (1 - THREE.MathUtils.smoothstep(sunY, 0.05, 0.32));
      const reality = getVoxelRealityEffects();
      const chroma = THREE.MathUtils.clamp(reality.chroma, 0, 1);
      const resolved = THREE.MathUtils.clamp(Math.max(reality.detail, reality.atmosphere), 0, 1.25);
      const tintAmount = grade.tintAmount * THREE.MathUtils.lerp(0.28, 1.1, Math.max(chroma, resolved * 0.7));
      const saturation = THREE.MathUtils.lerp(0.08, grade.saturation, chroma) * THREE.MathUtils.lerp(0.96, 1.04, resolved);
      const warmth = (grade.warmthBias + golden * 0.8 - (1 - daylight) * 0.35) * THREE.MathUtils.lerp(0.45, 1.05, chroma);
      const contrast = THREE.MathUtils.lerp(0.92, grade.contrast + (1 - daylight) * 0.05, THREE.MathUtils.clamp(0.38 + resolved * 0.62, 0, 1.08));
      const lift = THREE.MathUtils.lerp(0.024, 0.008, THREE.MathUtils.clamp(resolved, 0, 1));
      const shoulder = THREE.MathUtils.lerp(0.46, 0.28, THREE.MathUtils.clamp(resolved, 0, 1));
      eff.setGrade(
        grade.tint,
        tintAmount,
        saturation,
        warmth,
        contrast,
        lift,
        shoulder
      );
    }

    // Drive the underwater pass from the single submergence signal.
    if (underwaterPostFX) {
      const uw = getUnderwater();
      if (uw) {
        const submergence = getCameraSubmergence();
        const submerged = submergence > 0.5;
        // Edge-trigger the crossing wipe (1 -> 0 over ~0.35s).
        if (submerged !== prevSubmerged.current) { prevSubmerged.current = submerged; wipe.current = 1; }
        if (wipe.current > 0) wipe.current = Math.max(0, wipe.current - delta / 0.35);

        // Project the sun direction to screen-space for the god-ray origin.
        let sunUvX = -100;
        let sunUvY = -100;
        _sunDir.copy(getSunDirection());
        state.camera.getWorldDirection(_camFwd);
        if (_camFwd.dot(_sunDir) > 0.0) {
          _sunPoint.copy(state.camera.position).addScaledVector(_sunDir, 2000).project(state.camera);
          if (_sunPoint.z < 1.0) { sunUvX = _sunPoint.x * 0.5 + 0.5; sunUvY = _sunPoint.y * 0.5 + 0.5; }
        }

        // Low-oxygen vignette pulse (the M3 breath visual hooks in here).
        const oxygen = getVitals().oxygen;
        const vignette = oxygen < 25 ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 7.0) : 0;

        uw.uniforms.get('uGodrays')!.value = underwaterGodrays ? 1 : 0;
        uw.setFrame(submergence, state.clock.elapsedTime, sunUvX, sunUvY, wipe.current, vignette);
      }
    }
  });

  return (
    <EffectComposer
      // Selective bloom needs HDR precision so very-bright emissive surfaces
      // (lava, ores) read above the luminance threshold.
      multisampling={4}
      frameBufferType={THREE.HalfFloatType}
    >
      {/* Contact AO (N8AO): computes its own normals from depth (no extra normal
          pass), so it grounds grass/trees/ship/voxels cheaply. FIRST in the chain
          so bloom + grade operate on the occluded image. Half-res + modest samples
          to protect FPS on the instanced world; gated ULTRA/HIGH. */}
      {contactAO ? (
        <N8AO
          aoRadius={3.0}
          intensity={1.15}
          distanceFalloff={1.25}
          halfRes
          quality="medium"
        />
      ) : <></>}

      {/* Selective bloom: only pixels brighter than the threshold bloom, so
          the emissive lava/ores glow while normal terrain stays crisp. */}
      <Bloom
        intensity={0.42}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.28}
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

      {/* Three-tap radial flight smear. Depth masking preserves the near cockpit
          and central aiming region while distant stars stretch under boost. */}
      <FlightMotion />

      {/* Depth-based underwater pass (extinction + haze + godrays + wobble +
          vignette + crossing wipe). A no-op above water (driven submergence=0);
          fades in with the same signal as the fog/audio/particles. After the
          grade so the water is the final medium, before ACES. Gated ULTRA/HIGH;
          lower tiers use the always-on FogExp2 underwater override instead. */}
      {underwaterPostFX ? <Underwater /> : <></>}

      {/* Death decompile (perception → glyph substrate). LAST before ACES so it
          reads the fully composed frame — the thing being decompiled is the
          player's finished perception, not a half-built buffer. No-op at
          uProgress 0 (see DeathRenderEffect). */}
      <DeathRender />

      {/* MUST be last: applies ACES once, replacing the renderer's tone map. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
