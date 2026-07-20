import React from 'react';
import { useStoryState } from './storyState.ts';
import { useAppState } from '../state/appState.ts';
import TerminalPrologue from './prologue/TerminalPrologue.tsx';
import FeedOverlay from './feed/FeedOverlay.tsx';
import RegulationFeedHud from './feed/RegulationFeedHud.tsx';
import StoryCaptions from './StoryCaptions.tsx';
import AuditBand from './AuditBand.tsx';
import FreeMarker from './FreeMarker.tsx';
import StoryGuidanceHud from './ux/StoryGuidanceHud.tsx';
import { getStoryGuidancePresentationOwnership } from './ux/storyGuidancePresentation.ts';
import SleepFade from './transitions/SleepFade.tsx';
import CinematicFrame from './transitions/CinematicFrame.tsx';
import JourneyRuntimeProbeBridge from './JourneyRuntimeProbeBridge.tsx';

/**
 * Single App-level mount for every story DOM overlay (siblings of the <Canvas>).
 * Chapters route which overlays exist; each overlay manages its own rAF/paint so
 * nothing here re-renders per frame.
 */
interface StoryOverlaysProps {
  objectiveJournalOpen?: boolean;
  onObjectiveJournalOpenChange?: (open: boolean) => void;
}

const StoryOverlays: React.FC<StoryOverlaysProps> = ({
  objectiveJournalOpen = false,
  onObjectiveJournalOpenChange
}) => {
  const story = useStoryState();
  const { phase } = useAppState();
  // The earned world keeps the caption channel: post-A3 sense discoveries
  // ("so that is thirst.") still speak, even though the story is dormant —
  // and the AUDIT band survives the hand-off (the arrival's last line,
  // "AUDIT IN PROGRESS. RESUME NOTHING.", finishes its ttl in the done world).
  if (!story.active) {
    if (story.chapter === 'complete' && phase === 'playing') {
      return (
        <>
          <JourneyRuntimeProbeBridge />
          <StoryCaptions />
          <AuditBand />
        </>
      );
    }
    return <JourneyRuntimeProbeBridge />;
  }

  const guidance = getStoryGuidancePresentationOwnership(story, phase);

  return (
    <>
      <JourneyRuntimeProbeBridge />
      {story.chapter === 'prologue' && <TerminalPrologue />}
      {guidance.feedEffectsMounted && <FeedOverlay />}
      {guidance.feedEffectsMounted && (
        <RegulationFeedHud embodiedGuidanceActive={guidance.embodiedObjectiveMounted} />
      )}
      {phase === 'playing' && <StoryCaptions />}
      {/* The audit voice begins after the regulation feed. Objective guidance
          has a separate perspective boundary: it enters with first person at
          ch1-anomaly and remains mounted through every later active chapter. */}
      {phase === 'playing' && !guidance.feedEffectsMounted && <AuditBand />}
      {guidance.embodiedMarkerMounted && <FreeMarker />}
      {guidance.embodiedObjectiveMounted && (
        <StoryGuidanceHud
          open={objectiveJournalOpen}
          onOpenChange={onObjectiveJournalOpenChange}
        />
      )}
      {phase === 'playing' && (story.chapter === 'ch3' || story.chapter === 'ch4') && <SleepFade />}
      {/* Letterbox frame serves every staged moment (lift, dusk, dawn). */}
      {phase === 'playing' && <CinematicFrame />}
    </>
  );
};

export default StoryOverlays;
