import React, { useSyncExternalStore } from 'react';
import { useStoryState } from './storyState.ts';
import { useAppState } from '../state/appState.ts';
import TerminalPrologue from './prologue/TerminalPrologue.tsx';
import FeedOverlay from './feed/FeedOverlay.tsx';
import RegulationFeedHud from './feed/RegulationFeedHud.tsx';
import SurveyBracketOverlay from './feed/SurveyBracketOverlay.tsx';
import MovieStatusOverlay from './MovieStatusOverlay.tsx';
import { storyDebugEnabled } from './StoryDebugPanel.tsx';
import StoryCaptions from './StoryCaptions.tsx';
import AuditBand from './AuditBand.tsx';
import FreeMarker from './FreeMarker.tsx';
import StoryGuidanceHud from './ux/StoryGuidanceHud.tsx';
import { getStoryGuidancePresentationOwnership } from './ux/storyGuidancePresentation.ts';
import SleepFade from './transitions/SleepFade.tsx';
import CinematicFrame from './transitions/CinematicFrame.tsx';
import JourneyRuntimeProbeBridge from './JourneyRuntimeProbeBridge.tsx';
import { stationReturnPending, subscribeStationReturn } from './stationReturnStory.ts';

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
  const returningIssuedCell = useSyncExternalStore(
    subscribeStationReturn,
    stationReturnPending,
    () => false
  );
  // The earned world keeps the caption channel: post-A3 sense discoveries
  // ("so that is thirst.") still speak, even though the story is dormant —
  // and the AUDIT band survives the hand-off (the arrival's last line,
  // "AUDIT IN PROGRESS. RESUME NOTHING.", finishes its ttl in the done world).
  if (!story.active) {
    if ((story.chapter === 'complete' || returningIssuedCell) && phase === 'playing') {
      return (
        <>
          <JourneyRuntimeProbeBridge />
          <StoryCaptions />
          <AuditBand />
          {returningIssuedCell && <FreeMarker />}
          {returningIssuedCell && (
            <StoryGuidanceHud
              open={objectiveJournalOpen}
              onOpenChange={onObjectiveJournalOpenChange}
            />
          )}
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
      {guidance.surveyBracketsMounted && <SurveyBracketOverlay />}
      {phase === 'playing' && <StoryCaptions />}
      {/* Screening chrome: says what the movie is waiting for so a hold never
          reads as a hang. Renders only in movie mode. */}
      {phase === 'playing' && <MovieStatusOverlay debug={storyDebugEnabled()} />}
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
