import React, { useEffect } from 'react';
import { useStoryState } from '../storyState.ts';
import { clearSideLens, setSideLens } from '../sideLens.ts';
import { getAuditWorkerPath, getPondPose, getStorySidePlane, storyAnchors } from './storyWorld.ts';
import { getCampfires, placeCampfire } from '../../game/systems/campfires.ts';
import { getFeedRuntime } from '../feedRuntime.ts';
import AnomalyStone from './AnomalyStone.tsx';
import HeroAppleTree from './HeroAppleTree.tsx';
import SideWorkerAvatar from './SideWorkerAvatar.tsx';
import DescentPod from './DescentPod.tsx';
import DebrisField from './DebrisField.tsx';
import SupplyPods from './SupplyPods.tsx';
import NavBeacons from './NavBeacons.tsx';
import SignalMesa from './SignalMesa.tsx';
import WreckRelay from './WreckRelay.tsx';
import AuditWorker, { getAuditWorkerPose } from './AuditWorker.tsx';

/**
 * In-Canvas mount for the story world's bespoke props (guarded by
 * isStoryWorldSeed at the EfficientScene call site). Chapters route what
 * exists; once a landmark is introduced it PERSISTS — through the story AND
 * into the completed ('done') world: the wreck, the mesa, the stone, the tree,
 * the relay, and the auditor are facts of the fiction, not set dressing.
 * Pure-sandbox saves (chapter 'none') and quit-mid-story sessions (inactive,
 * chapter ch1..ch4) still get nothing — the prime directive holds.
 *
 * Also registers the raster-era side lens (the plane is deterministic per seed;
 * consumers only act on it when the input policy says lookMode === 'side').
 */
const StoryWorldProps: React.FC<{ planetSize: number; terrainSeed: number }> = ({
  planetSize,
  terrainSeed
}) => {
  const story = useStoryState();
  // The completed story world keeps its landmarks even though the story is
  // dormant (completeStory leaves chapter 'complete' in the snapshot).
  const done = story.chapter === 'complete';

  useEffect(() => {
    setSideLens(getStorySidePlane(planetSize, terrainSeed));
    return clearSideLens;
  }, [planetSize, terrainSeed]);

  // Debug-jump affordance: beats past the campfire craft need a fire standing
  // (rest gates on it). Real runs always arrive here with one already placed.
  useEffect(() => {
    const needsFire = story.beat === 'ch3-dusk' || story.beat === 'ch3-await-rest' || story.beat === 'a3-dawn'
      || story.beat === 'ch4-vigil';
    if (!needsFire || getCampfires().length > 0) return;
    const plane = getStorySidePlane(planetSize, terrainSeed);
    placeCampfire(plane.origin.clone().addScaledVector(plane.up, 0.2), plane.up.clone());
  }, [story.beat, planetSize, terrainSeed]);

  // Live anchors for the director/autopilot (pond + the auditor's approach) —
  // computed once per world mount; the director never learns planetSize itself.
  useEffect(() => {
    storyAnchors.pond = getPondPose(planetSize, terrainSeed);
    storyAnchors.auditPath = getAuditWorkerPath(planetSize, terrainSeed);
    storyAnchors.terrainSeed = terrainSeed;
    return () => {
      storyAnchors.pond = null;
      storyAnchors.auditPath = null;
      storyAnchors.terrainSeed = null;
    };
  }, [planetSize, terrainSeed]);

  // The done world's standing facts: the wreck is landed scenery (the descent
  // timeline is long over, so its driver scalar needs asserting on fresh
  // boots), and W-7744 STANDS AT THE RELAY — "he stays to look." A live run
  // leaves him there (the arrival timeline no longer hides him); a resumed or
  // deep-linked 'done' world re-places him at his post, facing the site.
  useEffect(() => {
    if (!done) return;
    const runtime = getFeedRuntime();
    if (runtime.descent < 1) runtime.descent = 1.1;
    const pose = getAuditWorkerPose();
    if (pose.visible) return;
    const path = getAuditWorkerPath(planetSize, terrainSeed);
    const post = path[path.length - 1];
    if (!post) return;
    pose.position.copy(post.position);
    pose.up.copy(post.up);
    // He faces the site he is auditing (the arrival strip's origin).
    const site = getStorySidePlane(planetSize, terrainSeed).origin;
    pose.heading.copy(site).sub(post.position);
    if (pose.heading.lengthSq() < 1e-6) pose.heading.set(0, 0, 1);
    pose.heading.normalize();
    pose.stride = 0;
    pose.walk = 0;
    pose.visible = true;
  }, [done, planetSize, terrainSeed]);

  // Post-crash chapters: direct jumps can land with the descent driver still
  // at idle (-1) — assert the landed wreck (ch1 keeps its own animated driver).
  useEffect(() => {
    if (story.chapter !== 'ch2' && story.chapter !== 'ch3' && story.chapter !== 'ch4') return;
    const runtime = getFeedRuntime();
    if (runtime.descent < 1) runtime.descent = 1.1;
  }, [story.chapter]);

  if (!story.active && !done) return null;
  if (story.chapter === 'prologue') return null;

  const firstDayOrLater = story.chapter === 'ch4' || done
    || story.beat === 'ch3-thirst' || story.beat === 'ch3-forage' || story.beat === 'ch3-signal';

  return (
    <>
      <SideWorkerAvatar />
      {/* The crashed pod persists as the smoking wreck — a permanent landmark
          from the descent onward (chapter 1 through the done world). */}
      <DescentPod planetSize={planetSize} terrainSeed={terrainSeed} />
      {/* The wreck relay: silent scenery from the first day; the network's
          voice from the klaxon on — and it stays up at done (carrier is up). */}
      {firstDayOrLater && <WreckRelay planetSize={planetSize} terrainSeed={terrainSeed} />}
      {/* W-7744 — hidden until the arrival timeline writes his pose; from the
          arrival on he STANDS, into the done world (the audit is in progress). */}
      {(story.chapter === 'ch4' || done) && <AuditWorker />}
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
