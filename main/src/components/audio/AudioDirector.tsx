import { useEffect, useMemo, useRef, type FC } from 'react';
import { useAppState } from '../../state/appState.ts';
import { useStoryState } from '../../story/storyState.ts';
import { getWarp, useSpaceFlight } from '../../state/spaceFlight.ts';
import { getPlayerUp } from '../../state/playerFrame.ts';
import { getPlayerSubmergence } from '../../state/playerSubmersion.ts';
import { localDaylight } from '../../utils/dayNight.ts';
import { buildPlanetProfile } from '../../game/PlanetProfile.ts';
import { getSunDirection } from '../SkyController.tsx';
import { useAudioSettings } from '../../audio/audioSettings.ts';
import { getMusicEngine } from '../../audio/musicEngine.ts';
import { getSfxEngine } from '../../audio/sfxEngine.ts';
import { setStoryScoreOutput } from '../../story/storyScore.ts';
import { getVoxelRealityEffects } from '../../game/systems/realityRenderSystem.ts';
import { getStoryStateSnapshot } from '../../story/storyState.ts';
import {
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

interface AudioDirectorProps {
  terrainSeed: number;
}

const AudioDirector: FC<AudioDirectorProps> = ({ terrainSeed }) => {
  const app = useAppState();
  const flight = useSpaceFlight();
  const story = useStoryState();
  const audio = useAudioSettings();
  const planetMood = useMemo<PlanetMusicMood>(
    () => resolvePlanetMusicMood(buildPlanetProfile(terrainSeed)),
    [terrainSeed]
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

  useEffect(() => {
    planetMoodRef.current = planetMood;
  }, [planetMood]);

  useEffect(() => {
    getMusicEngine().setOutput(audio.musicVolume, audio.muted);
    getSfxEngine().setOutput(audio.sfxVolume, audio.muted);
    setStoryScoreOutput(audio.musicVolume, audio.muted);
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
      getMusicEngine().setVisibilityDucked(document.hidden);
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
      const submerged = getPlayerSubmergence() > 0.5;
      if (submerged !== submergedRef.current) {
        submergedRef.current = submerged;
        getSfxEngine().setSubmerged(submerged ? 1 : 0);
        getMusicEngine().setSubmerged(submerged);
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
        wonder: Math.min(1, (1 - daylight) * 0.55 + (inSpace ? 0.5 : 0) + getPlayerSubmergence() * 0.35 + 0.15),
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
      raf = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return null;
};

export default AudioDirector;
