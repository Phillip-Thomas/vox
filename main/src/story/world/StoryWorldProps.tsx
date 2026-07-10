import React, { useEffect } from 'react';
import { useStoryState } from '../storyState.ts';
import { clearSideLens, setSideLens } from '../sideLens.ts';
import { getStorySidePlane } from './storyWorld.ts';
import { getCampfires, placeCampfire } from '../../game/systems/campfires.ts';
import AnomalyStone from './AnomalyStone.tsx';
import HeroAppleTree from './HeroAppleTree.tsx';
import SideWorkerAvatar from './SideWorkerAvatar.tsx';
import DescentPod from './DescentPod.tsx';
import DebrisField from './DebrisField.tsx';
import SupplyPods from './SupplyPods.tsx';
import NavBeacons from './NavBeacons.tsx';
import SignalMesa from './SignalMesa.tsx';

/**
 * In-Canvas mount for the story world's bespoke props (guarded by
 * isStoryWorldSeed at the EfficientScene call site). Chapters route what exists;
 * both props persist once introduced — the world keeps its questions.
 *
 * Also registers the raster-era side lens (the plane is deterministic per seed;
 * consumers only act on it when the input policy says lookMode === 'side').
 */
const StoryWorldProps: React.FC<{ planetSize: number; terrainSeed: number }> = ({
  planetSize,
  terrainSeed
}) => {
  const story = useStoryState();

  useEffect(() => {
    setSideLens(getStorySidePlane(planetSize, terrainSeed));
    return clearSideLens;
  }, [planetSize, terrainSeed]);

  // Debug-jump affordance: beats past the campfire craft need a fire standing
  // (rest gates on it). Real runs always arrive here with one already placed.
  useEffect(() => {
    const needsFire = story.beat === 'ch3-dusk' || story.beat === 'ch3-await-rest' || story.beat === 'a3-dawn';
    if (!needsFire || getCampfires().length > 0) return;
    const plane = getStorySidePlane(planetSize, terrainSeed);
    placeCampfire(plane.origin.clone().addScaledVector(plane.up, 0.2), plane.up.clone());
  }, [story.beat, planetSize, terrainSeed]);

  if (!story.active) return null;
  if (story.chapter === 'prologue') return null;

  return (
    <>
      <SideWorkerAvatar />
      {/* The crashed pod persists through ch1/ch2 as the smoking wreck. */}
      {(story.chapter === 'ch1' || story.chapter === 'ch2') && (
        <DescentPod planetSize={planetSize} terrainSeed={terrainSeed} />
      )}
      {/* Hull debris scattered by the descent — the raster act's salvage. */}
      {story.chapter === 'ch1' && (
        <DebrisField planetSize={planetSize} terrainSeed={terrainSeed} />
      )}
      {/* Supply pods off the work line — the belt-scroll era's recovery run. */}
      {story.chapter === 'ch1' && (
        <SupplyPods planetSize={planetSize} terrainSeed={terrainSeed} />
      )}
      {/* Triangulation pylons — the top-down era's ordered route. */}
      {story.chapter === 'ch1' && (
        <NavBeacons planetSize={planetSize} terrainSeed={terrainSeed} />
      )}
      {/* The signal mesa persists — the stone keeps its height forever. */}
      <SignalMesa planetSize={planetSize} terrainSeed={terrainSeed} />
      <AnomalyStone planetSize={planetSize} terrainSeed={terrainSeed} />
      {story.chapter !== 'ch1' && <HeroAppleTree planetSize={planetSize} terrainSeed={terrainSeed} />}
    </>
  );
};

export default StoryWorldProps;
