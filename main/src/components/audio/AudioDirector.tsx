import { useEffect, useMemo, useRef, type FC } from 'react';
import { useAppState } from '../../state/appState.ts';
import { useStoryState } from '../../story/storyState.ts';
import { getSpaceFlightSnapshot, getWarp, useSpaceFlight } from '../../state/spaceFlight.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { getCameraSubmergence } from '../../state/playerSubmersion.ts';
import { localDaylight, localGolden } from '../../utils/dayNight.ts';
import { buildPlanetProfile, type PlanetProfile } from '../../game/PlanetProfile.ts';
import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { buildWindProfile, type WindProfile } from '../../utils/windProfile.ts';
import { coordinateToSeed } from '../../utils/worldCoordinates.ts';
import { seededVoxelUnit } from '../../utils/seededHash.ts';
import { getSunDirection } from '../SkyController.tsx';
import { useAudioSettings } from '../../audio/audioSettings.ts';
import { getMusicEngine } from '../../audio/musicEngine.ts';
import { getSfxEngine } from '../../audio/sfxEngine.ts';
import {
  setMusicOutput,
  setMusicSubmerged,
  setMusicVisibilityDucked
} from '../../audio/audioCore.ts';
import {
  getVoxelRealityEffects,
  getVoxelRealityStage
} from '../../game/systems/realityRenderSystem.ts';
import { getStoryStateSnapshot } from '../../story/storyState.ts';
import {
  getMusicChord,
  getMusicPrimitives,
  setMusicPrimitiveTargets,
  tickMusicPrimitives
} from '../../audio/musicPrimitives.ts';
import {
  resolvePlanetMusicMood,
  resolveMusicMix,
  resolveMusicScene,
  transitionCueForScene,
  type MusicScene,
  type PlanetMusicMood
} from '../../audio/musicDirector.ts';
import { configureBedPlanet, updateBedSignals } from '../../audio/bedEngine.ts';
import { isScoreMoodLeading } from '../../audio/scoreEngine.ts';
import { SALT_REGION } from '../../audio/generative/seededMusic.ts';
import { REGION_QUANT_BLOCKS } from '../../audio/generative/tuning.ts';

// Palette → default timbre brightness (§8.4 palette row): warm/saturated
// palettes open the pad filter, cold desaturated ones keep it dusky.
const PALETTE_BRIGHT_BASE = 0.3;
const PALETTE_BRIGHT_TEMPERATURE = 0.4;
const PALETTE_BRIGHT_SATURATION = 0.3;

function paletteBrightnessOf(profile: PlanetProfile): number {
  return Math.min(
    1,
    Math.max(
      0,
      PALETTE_BRIGHT_BASE +
        PALETTE_BRIGHT_TEMPERATURE * profile.palette.temperature +
        PALETTE_BRIGHT_SATURATION * profile.palette.saturation
    )
  );
}

interface AudioDirectorProps {
  terrainSeed: number;
}

const AudioDirector: FC<AudioDirectorProps> = ({ terrainSeed }) => {
  const app = useAppState();
  const flight = useSpaceFlight();
  const story = useStoryState();
  const audio = useAudioSettings();
  const profile = useMemo<PlanetProfile>(() => buildPlanetProfile(terrainSeed), [terrainSeed]);
  const planetMood = useMemo<PlanetMusicMood>(() => resolvePlanetMusicMood(profile), [profile]);
  const wind = useMemo<WindProfile>(() => buildWindProfile(terrainSeed), [terrainSeed]);
  // The LO-FI story eras (prologue/ch1) duck the streamed layers to the quiet
  // transit bed — recorded music doesn't exist yet at that fidelity. From ch2 on
  // the normal scene returns and the ERA primitive fades the recorded layers in
  // under the procedural score: the awakening ladder applies to music too.
  const scene = resolveMusicScene(
    app.phase,
    flight.phase,
    flight.controlMode,
    story.active && (story.chapter === 'prologue' || story.chapter === 'ch1')
  );
  const sceneRef = useRef<MusicScene>(scene);
  const planetMoodRef = useRef<PlanetMusicMood>(planetMood);
  const warpActiveRef = useRef(false);
  const submergedRef = useRef(false);
  const windRef = useRef<WindProfile>(wind);
  const terrainSeedRef = useRef(terrainSeed);
  const destInfoRef = useRef<{ seed: number; archetype: ArchetypeId } | null>(null);
  const chordRootRef = useRef<number | null>(null);

  useEffect(() => {
    planetMoodRef.current = planetMood;
  }, [planetMood]);

  useEffect(() => {
    windRef.current = wind;
  }, [wind]);

  useEffect(() => {
    // The generative bed retargets: new planet, new key/motif/tempo (tempo and
    // meter land on the next bar line — §8.1). The approach modulation has
    // already walked the harmony to this exact key when we arrive by flight.
    terrainSeedRef.current = terrainSeed;
    configureBedPlanet(terrainSeed, profile.archetype, paletteBrightnessOf(profile));
  }, [terrainSeed, profile]);

  useEffect(() => {
    // One volume/mute write covers the whole music mix (layers + score).
    setMusicOutput(audio.musicVolume, audio.muted);
    getSfxEngine().setOutput(audio.sfxVolume, audio.muted);
  }, [audio.musicVolume, audio.sfxVolume, audio.muted]);

  useEffect(() => {
    const previous = sceneRef.current;
    sceneRef.current = scene;
    if (getWarp().active) return;
    const cue = transitionCueForScene(previous, scene);
    if (cue) getMusicEngine().playTransitionCue(cue);
  }, [scene]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setMusicVisibilityDucked(document.hidden);
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastAt = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastAt) / 1000);
      lastAt = now;
      const warp = getWarp();
      const warpIntensity = warp.active
        ? Math.sin(Math.min(warp.progress, 1) * Math.PI) * warp.intensity
        : 0;

      if (warp.active && !warpActiveRef.current) {
        const cue = warp.kind === 'travel'
          ? 'systemWarp'
          : warp.kind === 'enter'
            ? 'atmosphereEnter'
            : 'atmosphereLeave';
        getMusicEngine().playTransitionCue(cue);
      }
      warpActiveRef.current = warp.active;

      // Underwater: muffle the whole mix (sfx + music lowpass) and snap a splash
      // on the threshold crossing. Edge-driven so the cutoff ramps once per
      // transition (the "clunk"/"gasp"), not every frame. EfficientPlayer resets
      // submergence to 0 on unmount, so boarding the ship can't leave it stuck.
      const submerged = getCameraSubmergence() > 0.5;
      if (submerged !== submergedRef.current) {
        submergedRef.current = submerged;
        getSfxEngine().setSubmerged(submerged ? 1 : 0);
        setMusicSubmerged(submerged);
        getSfxEngine().play(submerged ? 'splashEnter' : 'splashExit');
      }

      const daylight = sceneRef.current === 'deepSpace'
        ? 0.5
        : localDaylight(getSunDirection(), getPlayerUp());

      // Global primitives — the world's standing truths. (The story director
      // writes tension/energy while a story is live; here we own the rest, plus
      // the ambient tension/energy when no story is running.)
      const reality = getVoxelRealityEffects();
      const inSpace = sceneRef.current === 'deepSpace';
      setMusicPrimitiveTargets({
        era: Math.min(1, reality.chroma * 0.35 + reality.detail * 0.3 + reality.organic * 0.35),
        warmth: daylight * 0.85 + 0.1,
        wonder: Math.min(1, (1 - daylight) * 0.55 + (inSpace ? 0.5 : 0) + getCameraSubmergence() * 0.35 + 0.15),
        ...(getStoryStateSnapshot().active ? {} : { tension: warpIntensity * 0.5, energy: warpIntensity })
      });
      tickMusicPrimitives(dt);

      const mix = resolveMusicMix(
        sceneRef.current,
        warp.kind === 'travel' ? warpIntensity : warpIntensity * 0.28,
        planetMoodRef.current,
        daylight,
        getMusicPrimitives()
      );
      const engine = getMusicEngine();
      engine.setLayerTargets(mix.layers, mix.fadeSeconds);
      engine.setProceduralTargets(mix.procedural, mix.fadeSeconds);

      // --- The generative bed (P3): rAF writes INTENT only — one world
      // snapshot per frame; the bed's own lookahead scheduler does all
      // scheduling on the audio clock.
      const prim = getMusicPrimitives();
      const currentScene = sceneRef.current;
      let destinationSeed: number | null = null;
      let destinationArchetype: string | null = null;
      if (currentScene === 'approach') {
        const flightSnap = getSpaceFlightSnapshot();
        const dest = flightSnap.destination ?? flightSnap.target;
        if (dest) {
          const seed = coordinateToSeed(dest.x, dest.y);
          if (destInfoRef.current?.seed !== seed) {
            destInfoRef.current = { seed, archetype: buildPlanetProfile(seed).archetype };
          }
          destinationSeed = seed;
          destinationArchetype = destInfoRef.current.archetype;
        }
      }
      const pos = getPlayerWorldPosition();
      const q = REGION_QUANT_BLOCKS;
      const regionUnit = seededVoxelUnit(
        Math.floor(pos.x / q),
        Math.floor(pos.y / q),
        Math.floor(pos.z / q),
        SALT_REGION,
        terrainSeedRef.current
      );
      const windProfile = windRef.current;
      updateBedSignals({
        era: prim.era,
        stage: getVoxelRealityStage(),
        tension: prim.tension,
        energy: prim.energy,
        warmth: prim.warmth,
        wonder: prim.wonder,
        chroma: reality.chroma,
        detail: reality.detail,
        organic: reality.organic,
        atmosphere: reality.atmosphere,
        thermal: reality.thermal,
        crystalline: reality.crystalline,
        metal: reality.metal,
        daylight,
        golden: inSpace ? 0 : localGolden(getSunDirection(), getPlayerUp()),
        submergence: getCameraSubmergence(),
        windStrength: windProfile.strength,
        windTurbulence: windProfile.turbulence,
        windGustSpeed: windProfile.gustSpeed,
        windVeer: windProfile.veer,
        scene: currentScene,
        warpActive: warp.active,
        warpProgress: warp.active ? Math.min(1, warp.progress) : 0,
        regionUnit,
        timeSec: now / 1000,
        destinationSeed,
        destinationArchetype,
        storyLeads: isScoreMoodLeading()
      });

      // The drone bank obeys the harmonic center (kill fixed pitches, P3):
      // edge-driven param glides, once per chord change, never per frame.
      const chordRoot = getMusicChord().root;
      if (chordRootRef.current !== chordRoot) {
        chordRootRef.current = chordRoot;
        engine.retuneDronesToChordRoot(chordRoot);
      }

      raf = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return null;
};

export default AudioDirector;
