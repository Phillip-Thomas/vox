import React from 'react';
import { storyHudTakeover, useStoryState } from './storyState.ts';
import { useAppState } from '../state/appState.ts';
import TerminalPrologue from './prologue/TerminalPrologue.tsx';
import FeedOverlay from './feed/FeedOverlay.tsx';
import RegulationFeedHud from './feed/RegulationFeedHud.tsx';
import StoryCaptions from './StoryCaptions.tsx';
import SleepFade from './transitions/SleepFade.tsx';
import CinematicFrame from './transitions/CinematicFrame.tsx';

/**
 * Single App-level mount for every story DOM overlay (siblings of the <Canvas>).
 * Chapters route which overlays exist; each overlay manages its own rAF/paint so
 * nothing here re-renders per frame.
 */
const StoryOverlays: React.FC = () => {
  const story = useStoryState();
  const { phase } = useAppState();
  if (!story.active) return null;

  const feedLive = phase === 'playing' && storyHudTakeover(story);

  return (
    <>
      {story.chapter === 'prologue' && <TerminalPrologue />}
      {feedLive && <FeedOverlay />}
      {feedLive && <RegulationFeedHud />}
      {phase === 'playing' && <StoryCaptions />}
      {phase === 'playing' && story.chapter === 'ch3' && <SleepFade />}
      {phase === 'playing' && story.chapter === 'ch3' && <CinematicFrame />}
    </>
  );
};

export default StoryOverlays;
