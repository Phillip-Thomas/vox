import React, { useEffect } from 'react';
import { useStoryState } from '../storyState.ts';
import { clearSideLens, setSideLens } from '../sideLens.ts';
import { getStorySidePlane } from './storyWorld.ts';
import { getCampfires, placeCampfire } from '../../game/systems/campfires.ts';
import AnomalyStone from './AnomalyStone.tsx';
import HeroAppleTree from './HeroAppleTree.tsx';
import SideWorkerAvatar from './SideWorkerAvatar.tsx';

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
      <AnomalyStone planetSize={planetSize} terrainSeed={terrainSeed} />
      {story.chapter !== 'ch1' && <HeroAppleTree planetSize={planetSize} terrainSeed={terrainSeed} />}
    </>
  );
};

export default StoryWorldProps;
