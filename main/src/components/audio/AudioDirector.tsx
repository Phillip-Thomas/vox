import { useEffect, useMemo, useRef, type FC } from 'react';
import { useAppState } from '../../state/appState.ts';
import { getWarp, useSpaceFlight } from '../../state/spaceFlight.ts';
import { getPlayerUp } from '../../state/playerFrame.ts';
import { localDaylight } from '../../utils/dayNight.ts';
import { buildPlanetProfile } from '../../game/PlanetProfile.ts';
import { getSunDirection } from '../SkyController.tsx';
import { useAudioSettings } from '../../audio/audioSettings.ts';
import { getMusicEngine } from '../../audio/musicEngine.ts';
import { getSfxEngine } from '../../audio/sfxEngine.ts';
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
  const audio = useAudioSettings();
  const planetMood = useMemo<PlanetMusicMood>(
    () => resolvePlanetMusicMood(buildPlanetProfile(terrainSeed)),
    [terrainSeed]
  );
  const scene = resolveMusicScene(app.phase, flight.phase, flight.controlMode);
  const sceneRef = useRef<MusicScene>(scene);
  const planetMoodRef = useRef<PlanetMusicMood>(planetMood);
  const warpActiveRef = useRef(false);

  useEffect(() => {
    planetMoodRef.current = planetMood;
  }, [planetMood]);

  useEffect(() => {
    getMusicEngine().setOutput(audio.musicVolume, audio.muted);
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
      getMusicEngine().setVisibilityDucked(document.hidden);
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
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

      const daylight = sceneRef.current === 'deepSpace'
        ? 0.5
        : localDaylight(getSunDirection(), getPlayerUp());
      const mix = resolveMusicMix(
        sceneRef.current,
        warp.kind === 'travel' ? warpIntensity : warpIntensity * 0.28,
        planetMoodRef.current,
        daylight
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
