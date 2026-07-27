import { useEffect, useMemo, useRef, type FC } from 'react';
import { useAppState } from '../../state/appState.ts';
import { useStoryState } from '../../story/storyState.ts';
import { getSpaceFlightSnapshot, getWarp, useSpaceFlight } from '../../state/spaceFlight.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { getCameraSubmergence } from '../../state/playerSubmersion.ts';
import { localDaylight, localGolden } from '../../utils/dayNight.ts';
import {
  resolvePlanetProfile,
  type PlanetProfile
} from '../../game/PlanetProfile.ts';
import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { buildWindProfile, type WindProfile } from '../../utils/windProfile.ts';
import { seededVoxelUnit } from '../../utils/seededHash.ts';
import { getSystemFlightSnapshot } from '../../state/systemFlight.ts';
import { getSunDirection } from '../SkyController.tsx';
import { getAudioSettingsSnapshot, useAudioSettings } from '../../audio/audioSettings.ts';
import { getMusicEngine } from '../../audio/musicEngine.ts';
import { getSfxEngine } from '../../audio/sfxEngine.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import {
  setMusicOutput,
  setMusicSubmerged
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
import {
  configureBedPlanet,
  getBedDebugSnapshot,
  updateBedSignals
} from '../../audio/bedEngine.ts';
import { isScoreMoodLeading } from '../../audio/scoreEngine.ts';
import { SALT_REGION } from '../../audio/generative/seededMusic.ts';
import { REGION_QUANT_BLOCKS } from '../../audio/generative/tuning.ts';
import type { BedSignals } from '../../audio/generative/worldSignals.ts';
import {
  initialOxygenAudioClockState,
  stepOxygenAudioClock
} from '../../audio/oxygenAudio.ts';
import { isScoreDebugEnabled, updateScoreDebug } from '../../audio/scoreDebug.ts';
import {
  celestialMusicPrimitives,
  paletteBrightnessOf
} from '../../audio/planetMusicSignals.ts';
import {
  resolveCoordinateMusicIdentity,
  resolveSystemBodyMusicIdentity,
  type DestinationMusicIdentity
} from '../../audio/destinationMusicIdentity.ts';
import { getEmergentScoreMixSnapshot } from '../../story/emergentScoreDirector.ts';

interface AudioDirectorProps {
  terrainSeed: number;
  worldId: string;
}

const AudioDirector: FC<AudioDirectorProps> = ({ terrainSeed, worldId }) => {
  const app = useAppState();
  const flight = useSpaceFlight();
  const story = useStoryState();
  const audio = useAudioSettings();
  const profile = useMemo<PlanetProfile>(
    () => resolvePlanetProfile({ worldId, seed: terrainSeed }).profile,
    [terrainSeed, worldId]
  );
  const planetMood = useMemo<PlanetMusicMood>(() => resolvePlanetMusicMood(profile), [profile]);
  const wind = useMemo<WindProfile>(
    () => buildWindProfile(terrainSeed, profile),
    [terrainSeed, profile]
  );
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
  const archetypeRef = useRef<ArchetypeId>(profile.archetype);
  const paletteBrightnessRef = useRef(paletteBrightnessOf(profile));
  const biomeWeightsRef = useRef(profile.biomeWeights);
  const destInfoRef = useRef<DestinationMusicIdentity | null>(null);
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
    archetypeRef.current = profile.archetype;
    paletteBrightnessRef.current = paletteBrightnessOf(profile);
    biomeWeightsRef.current = profile.biomeWeights;
    configureBedPlanet(terrainSeed, profile.archetype, paletteBrightnessRef.current);
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

  // The hidden-tab music duck now lives in audioCore's single visibility
  // authority (installVisibilityResume): one listener owns duck + route-revive.

  useEffect(() => {
    let raf = 0;
    let lastAt = performance.now();
    let oxygenClock = initialOxygenAudioClockState(lastAt / 1000);
    const reducedMotionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
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
          : warp.kind === 'enter' || warp.kind === 'system_handoff'
            ? 'atmosphereEnter'
            : 'atmosphereLeave';
        getMusicEngine().playTransitionCue(cue);
      }
      warpActiveRef.current = warp.active;

      // Underwater: continuously muffle the music bus with camera depth; SFX
      // state and the splash remain edge-driven at the waterline. EfficientPlayer
      // resets submergence to 0 on unmount, so boarding cannot leave it stuck.
      const submergence = getCameraSubmergence();
      const submerged = submergence > 0.5;
      if (submerged !== submergedRef.current) {
        submergedRef.current = submerged;
        getSfxEngine().setSubmerged(submerged ? 1 : 0);
        getSfxEngine().play(submerged ? 'splashEnter' : 'splashExit');
      }
      // Music follows the continuous camera depth; only the splash/SFX state is
      // edge-triggered. audioCore slews the shared bus cutoff structurally.
      setMusicSubmerged(submergence);

      const storySnapshot = getStoryStateSnapshot();
      const liveOxygen = Math.min(1, Math.max(0, getVitals().oxygen / 100));
      const audioSnapshot = getAudioSettingsSnapshot();
      const oxygenStep = stepOxygenAudioClock(
        oxygenClock,
        {
          oxygen: liveOxygen,
          submergence,
          enabled: storySnapshot.active && storySnapshot.beat === 'ch6-dive',
          muted: audioSnapshot.muted || audioSnapshot.sfxVolume <= 0,
          // The body warning remains present, but repetitive sensory pressure
          // is softened for reduced-motion users. This lane creates no flash.
          reducedMotion: reducedMotionQuery?.matches ?? false
        },
        now / 1000
      );
      oxygenClock = oxygenStep.state;
      if (oxygenStep.emitPulse) getSfxEngine().playOxygenPulse(oxygenStep.plan);

      const daylight = sceneRef.current === 'deepSpace'
        ? 0.5
        : localDaylight(getSunDirection(), getPlayerUp());

      // Global primitives — the world's standing truths. (The story director
      // writes tension/energy while a story is live; here we own the rest, plus
      // the ambient tension/energy when no story is running.)
      const reality = getVoxelRealityEffects();
      const inSpace = sceneRef.current === 'deepSpace';
      const celestial = celestialMusicPrimitives(daylight, inSpace, submergence);
      setMusicPrimitiveTargets({
        era: Math.min(1, reality.chroma * 0.35 + reality.detail * 0.3 + reality.organic * 0.35),
        warmth: celestial.warmth,
        wonder: celestial.wonder,
        ...(storySnapshot.active ? {} : { tension: warpIntensity * 0.5, energy: warpIntensity })
      });
      tickMusicPrimitives(dt);

      const mix = resolveMusicMix(
        sceneRef.current,
        warp.kind === 'travel' ? warpIntensity : warpIntensity * 0.28,
        planetMoodRef.current,
        daylight,
        getMusicPrimitives(),
        // Ambient procedural drones yield to a leading story score exactly the
        // way the generative bed does (owner ruling 2026-07: no constant low
        // tone stacked under the story ladder).
        isScoreMoodLeading()
      );
      const engine = getMusicEngine();
      const storyMix = getEmergentScoreMixSnapshot();
      engine.setLayerTargets(mix.layers, mix.fadeSeconds);
      engine.setProceduralTargets({
        ...mix.procedural,
        // Outside the hatch the repaired ship is seen, not yet inhabited. The
        // procedural engine hum returns only after the pressure boundary seals.
        ship: mix.procedural.ship * storyMix.shipHumMultiplier
      }, mix.fadeSeconds, storyMix.shipHumSlewSeconds == null
        ? undefined
        : { shipGainSeconds: storyMix.shipHumSlewSeconds });

      // --- The generative bed (P3): rAF writes INTENT only — one world
      // snapshot per frame; the bed's own lookahead scheduler does all
      // scheduling on the audio clock.
      const prim = getMusicPrimitives();
      const currentScene = sceneRef.current;
      const flightSnap = getSpaceFlightSnapshot();
      const systemTarget = resolveSystemBodyMusicIdentity(getSystemFlightSnapshot().target);
      const systemHandoffActive = warp.active && warp.kind === 'system_handoff';
      let destinationIdentity: DestinationMusicIdentity | null = null;
      if (systemTarget) {
        // A legal same-system target owns the complete p1 identity bundle. The
        // shared system coordinate can never substitute for this resolution.
        destInfoRef.current = systemTarget;
        destinationIdentity = systemTarget;
      } else if (systemHandoffActive && destInfoRef.current?.worldId) {
        // commitSystemPlanetHandoff clears the target at the covered midpoint;
        // retain its already-authenticated bundle through the remainder only.
        destinationIdentity = destInfoRef.current;
      } else if (currentScene === 'approach') {
        const coordinateDestination = flightSnap.destination ?? flightSnap.target;
        if (coordinateDestination) {
          const resolved = resolveCoordinateMusicIdentity(coordinateDestination);
          if (destInfoRef.current?.worldId !== null
            || destInfoRef.current?.seed !== resolved.seed
            || destInfoRef.current?.profileHash !== resolved.profileHash) {
            destInfoRef.current = resolved;
          }
          destinationIdentity = destInfoRef.current;
        }
      } else {
        destInfoRef.current = null;
      }
      // Same-system flight remains physically deep-space until the local
      // representation handoff. The bed nevertheless receives an approach
      // phrase only after the authoritative system-body target exists.
      const bedScene = destinationIdentity?.worldId ? 'approach' : currentScene;
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
      const bedSignals: BedSignals = {
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
        submergence,
        oxygen: liveOxygen,
        windStrength: windProfile.strength,
        windTurbulence: windProfile.turbulence,
        windGustSpeed: windProfile.gustSpeed,
        windVeer: windProfile.veer,
        windDirectionX: windProfile.direction.x,
        windDirectionY: windProfile.direction.y,
        windGustStrength: windProfile.gustStrength,
        windGustScale: windProfile.gustScale,
        windOffsetX: windProfile.offset.x,
        windOffsetY: windProfile.offset.y,
        playerX: pos.x,
        playerZ: pos.z,
        scene: bedScene,
        warpActive: warp.active,
        warpProgress: warp.active ? Math.min(1, warp.progress) : 0,
        regionUnit,
        timeSec: now / 1000,
        destinationWorldId: destinationIdentity?.worldId ?? null,
        destinationSeed: destinationIdentity?.seed ?? null,
        destinationProfileId: destinationIdentity?.profileId ?? null,
        destinationProfileVersion: destinationIdentity?.profileVersion ?? null,
        destinationProfileHash: destinationIdentity?.profileHash ?? null,
        destinationArchetype: destinationIdentity?.archetype ?? null,
        storyLeads: isScoreMoodLeading()
      };
      updateBedSignals(bedSignals);

      const chord = getMusicChord();
      if (isScoreDebugEnabled()) {
        updateScoreDebug({
          signals: bedSignals,
          planetSeed: terrainSeedRef.current,
          archetype: archetypeRef.current,
          paletteBrightness: paletteBrightnessRef.current,
          biomeWeights: biomeWeightsRef.current,
          chord,
          mix,
          bed: getBedDebugSnapshot()
        });
      }

      // The drone bank obeys the harmonic center (kill fixed pitches, P3):
      // edge-driven param glides, once per chord change, never per frame.
      const chordRoot = chord.root;
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
