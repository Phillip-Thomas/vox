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
  // The earned world keeps the caption channel: post-A3 sense discoveries
  // ("so that is thirst.") still speak, even though the story is dormant.
  if (!story.active) {
    if (story.chapter === 'complete' && phase === 'playing') return <StoryCaptions />;
    return null;
  }

  const feedLive = phase === 'playing' && storyHudTakeover(story);

  return (
    <>
      {story.chapter === 'prologue' && <TerminalPrologue />}
      {feedLive && <FeedOverlay />}
      {feedLive && <RegulationFeedHud />}
      {phase === 'playing' && <StoryCaptions />}
      {phase === 'playing' && story.chapter === 'ch3' && <SleepFade />}
      {/* Letterbox frame serves every staged moment (lift, dusk, dawn). */}
      {phase === 'playing' && <CinematicFrame />}
    </>
  );
};

export default StoryOverlays;
