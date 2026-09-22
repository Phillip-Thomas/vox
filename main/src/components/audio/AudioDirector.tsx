import { useEffect, useLayoutEffect, useMemo, useRef, type FC } from 'react';
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
import { getSfxEngine, setSfxRunSeed } from '../../audio/sfxEngine.ts';
import { getPhysicalBoardingSnapshot } from '../../story/physicalBoarding.ts';
import { getSfxEnvironment } from '../../audio/mix/sfxEnvironment.ts';
import { onAudioEvent } from '../../audio/mix/audioEventBus.ts';
import SoundCaption, { postSoundCaption, clearSoundCaptions } from '../hud/SoundCaption.tsx';
import { isSoundCaptionSilentBeat, soundCaptionForTrigger, type SoundCaptionTrigger, type SoundCaptionId } from '../hud/soundCaptionTable.ts';
import { pulseOxygenTick } from '../hud/OxygenMeter.tsx';
import { isMovieMode } from '../../story/autopilot/primitives.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import {
  setMixSnapshot,
  setMusicOutput,
  setMusicSubmerged,
  peekAudioContext
} from '../../audio/audioCore.ts';
import { tailLatencyForSampleRate } from '../../audio/mix/mixTuning.ts';
import { resolveMixSnapshot } from '../../audio/mix/mixSnapshot.ts';
import { automationDirty, type AutomationWrite } from '../../audio/mix/automationDirty.ts';
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
  getBedQualityTier,
  updateBedSignals
} from '../../audio/bedEngine.ts';
import { isScoreMoodLeading } from '../../audio/scoreEngine.ts';
import { SALT_REGION } from '../../audio/generative/seededMusic.ts';
import { REGION_QUANT_BLOCKS } from '../../audio/generative/tuning.ts';
import { neutralBedSignals, resolveEraGates, type BedSignals } from '../../audio/generative/worldSignals.ts';
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
import { getEmergentScoreMixSnapshot, getChapter10ScoreSnapshot } from '../../story/emergentScoreDirector.ts';
import { setVoiceRunSeed } from '../../audio/voice/voiceBus.ts';
import { resetVoicePresentation, suspendVoicePresentation, setVoicePresentationContext, setVoicePresentationFocused, getVoicePresentationDiagnostics } from '../../audio/voice/voicePresentation.ts';
import { isStoryPaused } from '../../story/storyClock.ts';
import { subscribeEmergentStoryEvents } from '../../story/emergentStoryEvents.ts';
import { acknowledgeObjectiveStoryEvent } from '../../story/ux/objectiveEventFeedback.ts';
import { getLocalActorId } from '../../game/playerActors.ts';
import { subscribeFinalizedLocalGameplayCommand } from '../../game/commandDispatchAdapter.ts';
import { acknowledgeObjectiveCommand } from '../../story/ux/objectiveCommandFeedback.ts';
import { resolveInteriorRoomFraction } from '../../audio/sfx/roomPresets.ts';

interface AudioDirectorProps {
  terrainSeed: number;
  worldId: string;
}

const AudioDirector: FC<AudioDirectorProps> = ({ terrainSeed, worldId }) => {
  useEffect(() => subscribeFinalizedLocalGameplayCommand(result => acknowledgeObjectiveCommand(result, getLocalActorId())), []);
  useEffect(() => subscribeEmergentStoryEvents(event => acknowledgeObjectiveStoryEvent(event, getLocalActorId())), []);
  const pendingCaptions = useRef<{ id: SoundCaptionId; at: number }[]>([]);
  useEffect(() => {
    let raf = 0;
    const admitted = () => {
      const settings = getAudioSettingsSnapshot(), story = getStoryStateSnapshot();
      return settings.soundCaptions && !isMovieMode() && !isSoundCaptionSilentBeat(story.active ? story.beat : null);
    };
    const post = (id: SoundCaptionId) => postSoundCaption(id, { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    const tick = () => {
      raf = 0;
      if (!admitted()) { pendingCaptions.current = []; clearSoundCaptions(); return; }
      const now = peekAudioContext()?.currentTime ?? 0;
      pendingCaptions.current = pendingCaptions.current.filter(cue => { if (now < cue.at) return true; post(cue.id); return false; });
      if (pendingCaptions.current.length) raf = requestAnimationFrame(tick);
    };
    const unsubscribe = onAudioEvent(event => {
      if (!admitted()) return;
      const entry = soundCaptionForTrigger((event.id === 'hatch' ? 'dockHatchIris' : event.id) as SoundCaptionTrigger);
      if (!entry?.label) return;
      const context = peekAudioContext();
      const scheduled = event.params?.atAudioTime;
      if (context && scheduled != null && scheduled > context.currentTime) {
        const latency = tailLatencyForSampleRate(context.sampleRate).sfxPathS;
        const device = context.outputLatency > 0 ? context.outputLatency : context.baseLatency || 0;
        pendingCaptions.current.push({ id: entry.id, at: scheduled + latency + device });
        if (pendingCaptions.current.length > 32) pendingCaptions.current.shift();
        if (!raf) raf = requestAnimationFrame(tick);
      } else post(entry.id);
    });
    return () => { unsubscribe(); cancelAnimationFrame(raf); pendingCaptions.current = []; clearSoundCaptions(); };
  }, []);
  const app = useAppState();
  const flight = useSpaceFlight();
  const story = useStoryState();
  const audio = useAudioSettings();
  useEffect(() => { pendingCaptions.current = []; clearSoundCaptions(); }, [story.beat, audio.soundCaptions]);
  useEffect(() => {
    const diagnosticWindow = window as unknown as { __voxVoiceDiag?: typeof getVoicePresentationDiagnostics };
    diagnosticWindow.__voxVoiceDiag = getVoicePresentationDiagnostics;
    return () => { delete diagnosticWindow.__voxVoiceDiag; };
  }, []);
  useLayoutEffect(() => {
    setVoicePresentationContext({ beat: story.active ? story.beat : null, paused: isStoryPaused(), mood: getChapter10ScoreSnapshot().variant, stage: getVoxelRealityStage(), quality: getBedQualityTier(), underOxygen: story.beat === 'ch6-dive' && getCameraSubmergence() > 0.5 });
    if (!story.active) resetVoicePresentation();
  }, [story.active, story.beat]);
  useEffect(() => () => resetVoicePresentation(), []);
  useEffect(() => {
    const hide = () => { if (document.hidden) suspendVoicePresentation('hidden'); };
    const blur = () => setVoicePresentationFocused(false);
    const focus = () => setVoicePresentationFocused(true);
    setVoicePresentationFocused(document.hasFocus());
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    };
  }, []);
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
  const appPhaseRef = useRef(app.phase);
  // Stage 2 per-frame hygiene: one reused signals struct (no per-frame literal)
  // and the last-written automation targets for the dirty check.
  const bedSignalsRef = useRef<BedSignals>(neutralBedSignals());
  const lastLayerWriteRef = useRef<AutomationWrite | null>(null);
  const lastProceduralWriteRef = useRef<AutomationWrite | null>(null);

  useEffect(() => {
    appPhaseRef.current = app.phase;
  }, [app.phase]);

  useEffect(() => {
    planetMoodRef.current = planetMood;
  }, [planetMood]);

  useEffect(() => {
    windRef.current = wind;
  }, [wind]);

  useLayoutEffect(() => {
    // The generative bed retargets: new planet, new key/motif/tempo (tempo and
    // meter land on the next bar line — §8.1). The approach modulation has
    // already walked the harmony to this exact key when we arrive by flight.
    terrainSeedRef.current = terrainSeed;
    archetypeRef.current = profile.archetype;
    paletteBrightnessRef.current = paletteBrightnessOf(profile);
    biomeWeightsRef.current = profile.biomeWeights;
    // Publish seed/genome before the story driver's first frame can pin crawl's tonic.
    configureBedPlanet(terrainSeed, profile.archetype, paletteBrightnessRef.current);
    setSfxRunSeed(terrainSeed);
    setVoiceRunSeed(terrainSeed);
  }, [terrainSeed, profile]);

  useEffect(() => {
    // One volume/mute write covers the whole music mix (layers + score).
    setMusicOutput(audio.musicVolume, audio.muted);
    getSfxEngine().setOutput(audio.sfxVolume, audio.muted);
    if (audio.muted || audio.sfxVolume === 0) suspendVoicePresentation();
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
    let lastWaterLapAt = lastAt;
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
      const waterlineAudible = submergence > 0.02 && submergence < 0.5 && resolveEraGates(getMusicPrimitives().era, getVoxelRealityStage()).padChoir > 0;
      if (!waterlineAudible) lastWaterLapAt = now;
      else if (now - lastWaterLapAt >= 3400 && peekAudioContext()?.state === 'running') {
        lastWaterLapAt = now;
        const position = getPlayerWorldPosition();
        getSfxEngine().play('waterLap', { position: { x: position.x, y: position.y, z: position.z } });
      }
      const roomBoarding = getPhysicalBoardingSnapshot();
      const roomFlight = getSpaceFlightSnapshot();
      const interiorFraction = resolveInteriorRoomFraction(roomBoarding, roomFlight.controlMode);
      // Stage 2 snapshot mixer: ONE resolved mix state per frame (menu / sandbox /
      // story-lead / dive / station) → bus gains and the SFX muffle edge, applied
      // by audioCore only when they change. The splash is the one SFX edge here.
      const snapshot = resolveMixSnapshot({
        phase: appPhaseRef.current === 'menu' ? 'menu' : 'playing',
        storyLead: isScoreMoodLeading(),
        submergence,
        station: getSfxEnvironment().station,
        interior: interiorFraction > 0,
        interiorFraction,
        era: getMusicPrimitives().era,
        stage: getVoxelRealityStage(),
        quality: getBedQualityTier()
      });
      setMixSnapshot(snapshot);
      const submerged = snapshot.sfxSubmerged;
      if (submerged !== submergedRef.current) {
        submergedRef.current = submerged;
        getSfxEngine().play(submerged ? 'splashEnter' : 'splashExit');
      }
      // Music follows the continuous camera depth; only the splash/SFX state is
      // edge-triggered. audioCore slews the shared bus cutoff structurally.
      setMusicSubmerged(submergence);

      const storySnapshot = getStoryStateSnapshot();
      setVoicePresentationContext({ beat: storySnapshot.active ? storySnapshot.beat : null, paused: isStoryPaused(), mood: getChapter10ScoreSnapshot().variant, stage: getVoxelRealityStage(), quality: getBedQualityTier(), underOxygen: storySnapshot.beat === 'ch6-dive' && submergence > 0.5 });
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
      if (oxygenStep.emitPulse) {
        getSfxEngine().playOxygenPulse(oxygenStep.plan);
        pulseOxygenTick();
      }

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
      // Stage 2 dirty-checked automation: the legacy engine's start-anchored
      // target curves are idempotent (re-issuing the same target restarts the
      // same exponential), so writing only when a target moves by more than
      // AUTOMATION_EPSILON — or on the AUTOMATION_CADENCE_S keep-alive — is
      // audibly identical to the old per-frame write and ~20× cheaper.
      const nowS = now / 1000;
      const layerValues = mix.layers as Record<string, number>;
      if (automationDirty(lastLayerWriteRef.current, layerValues, mix.fadeSeconds, undefined, nowS)) {
        engine.setLayerTargets(mix.layers, mix.fadeSeconds);
        lastLayerWriteRef.current = { at: nowS, fade: mix.fadeSeconds, values: { ...layerValues } };
      }
      const proceduralTargets = {
        ...mix.procedural,
        // Outside the hatch the repaired ship is seen, not yet inhabited. The
        // procedural engine hum returns only after the pressure boundary seals.
        ship: mix.procedural.ship * storyMix.shipHumMultiplier
      };
      const shipSlew = storyMix.shipHumSlewSeconds ?? undefined;
      if (automationDirty(lastProceduralWriteRef.current, proceduralTargets as unknown as Record<string, number>, mix.fadeSeconds, shipSlew, nowS)) {
        engine.setProceduralTargets(proceduralTargets, mix.fadeSeconds, shipSlew == null
          ? undefined
          : { shipGainSeconds: shipSlew });
        lastProceduralWriteRef.current = {
          at: nowS,
          fade: mix.fadeSeconds,
          shipSlew,
          values: { ...(proceduralTargets as unknown as Record<string, number>) }
        };
      }

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
      // The one reused signals struct: written in place every frame (the bed
      // reads fields, never identity), so rAF allocates nothing here.
      const bedSignals = bedSignalsRef.current;
      bedSignals.era = prim.era;
      bedSignals.stage = getVoxelRealityStage();
      bedSignals.tension = prim.tension;
      bedSignals.energy = prim.energy;
      bedSignals.warmth = prim.warmth;
      bedSignals.wonder = prim.wonder;
      bedSignals.chroma = reality.chroma;
      bedSignals.detail = reality.detail;
      bedSignals.organic = reality.organic;
      bedSignals.atmosphere = reality.atmosphere;
      bedSignals.thermal = reality.thermal;
      bedSignals.crystalline = reality.crystalline;
      bedSignals.metal = reality.metal;
      bedSignals.daylight = daylight;
      bedSignals.golden = inSpace ? 0 : localGolden(getSunDirection(), getPlayerUp());
      bedSignals.submergence = submergence;
      bedSignals.oxygen = liveOxygen;
      bedSignals.biomeWeights = biomeWeightsRef.current;
      bedSignals.windStrength = windProfile.strength;
      bedSignals.windTurbulence = windProfile.turbulence;
      bedSignals.windGustSpeed = windProfile.gustSpeed;
      bedSignals.windVeer = windProfile.veer;
      bedSignals.windDirectionX = windProfile.direction.x;
      bedSignals.windDirectionY = windProfile.direction.y;
      bedSignals.windGustStrength = windProfile.gustStrength;
      bedSignals.windGustScale = windProfile.gustScale;
      bedSignals.windOffsetX = windProfile.offset.x;
      bedSignals.windOffsetY = windProfile.offset.y;
      bedSignals.playerX = pos.x;
      bedSignals.playerZ = pos.z;
      bedSignals.scene = bedScene;
      bedSignals.warpActive = warp.active;
      bedSignals.warpProgress = warp.active ? Math.min(1, warp.progress) : 0;
      bedSignals.regionUnit = regionUnit;
      bedSignals.timeSec = now / 1000;
      bedSignals.destinationWorldId = destinationIdentity?.worldId ?? null;
      bedSignals.destinationSeed = destinationIdentity?.seed ?? null;
      bedSignals.destinationProfileId = destinationIdentity?.profileId ?? null;
      bedSignals.destinationProfileVersion = destinationIdentity?.profileVersion ?? null;
      bedSignals.destinationProfileHash = destinationIdentity?.profileHash ?? null;
      bedSignals.destinationArchetype = destinationIdentity?.archetype ?? null;
      bedSignals.storyLeads = isScoreMoodLeading();
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

  return audio.soundCaptions && !isMovieMode() ? <SoundCaption /> : null;
};

export default AudioDirector;
