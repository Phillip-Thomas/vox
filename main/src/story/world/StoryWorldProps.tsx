import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStoryState } from '../storyState.ts';
import { clearSideLens, setSideLens } from '../sideLens.ts';
import {
  establishFieldPackDropPose,
  getAuditWorkerPath,
  getFieldPackDropPoseAuthority,
  getPondPose,
  getStorySidePlane,
  resetFieldPackDropPoseAuthority,
  storyAnchors,
  type FieldPackDropPoseSource
} from './storyWorld.ts';
import { getFeedRuntime } from '../feedRuntime.ts';
import AnomalyStone from './AnomalyStone.tsx';
import HeroAppleTree from './HeroAppleTree.tsx';
import SideWorkerAvatar from './SideWorkerAvatar.tsx';
import DescentPod from './DescentPod.tsx';
import HifiWreck from './HifiWreck.tsx';
import DebrisField from './DebrisField.tsx';
import SupplyPods from './SupplyPods.tsx';
import NavBeacons from './NavBeacons.tsx';
import SignalMesa from './SignalMesa.tsx';
import WreckRelay from './WreckRelay.tsx';
import AuditWorker, { hideAuditWorker } from './AuditWorker.tsx';
import { createLiveAgentSurfaceTerrain } from '../../utils/agentSurfaceNavigationRuntime.ts';
import type { CommandContext } from '../../game/commands.ts';
import FieldPack from './FieldPack.tsx';
import KeelMemory from './KeelMemory.tsx';
import EmergentAuditSites from './EmergentAuditSites.tsx';
import A4WorldChoreography from './A4WorldChoreography.tsx';
import MawPondResonance from './MawPondResonance.tsx';
import { shouldMountAuditWorker } from '../auditWorkerPresence.ts';
import { isSceneReadyForWorld, useAppState } from '../../state/appState.ts';
import { hasMilestone } from '../../game/systems/progressionSystem.ts';
import { FIELD_PACK_DROPPED_MILESTONE } from '../emergentAudit.ts';
import { clearJourneyEntityState } from '../journeyRuntime.ts';

/**
 * In-Canvas mount for the story world's bespoke props (guarded by
 * isStoryWorldSeed at the EfficientScene call site). Chapters route what
 * exists; once a landmark is introduced it PERSISTS — through the story AND
 * into the completed ('done') world: the wreck, the mesa, the stone, the tree,
 * the relay, and the auditor's dropped pack are facts of the fiction, not set
 * dressing. W-7744 himself remains transient and leaves after the A4 tear.
 * Pure-sandbox saves (chapter 'none') and quit-mid-story sessions (inactive,
 * chapter ch1..ch4) still get nothing — the prime directive holds.
 *
 * Also registers the raster-era side lens (the plane is deterministic per seed;
 * consumers only act on it when the input policy says lookMode === 'side').
 */
const StoryWorldProps: React.FC<{
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}> = ({
  planetSize,
  terrainSeed,
  commandContext
}) => {
  const story = useStoryState();
  const { sceneReady } = useAppState();
  // The completed story world keeps its landmarks even though the story is
  // dormant (completeStory leaves chapter 'complete' in the snapshot).
  const done = story.chapter === 'complete';
  const liveWorldReady = sceneReady
    && isSceneReadyForWorld(commandContext.world.worldId);
  const liveTerrain = useMemo(
    () => createLiveAgentSurfaceTerrain(
      planetSize,
      terrainSeed,
      commandContext.world.worldId
    ),
    [commandContext.world.worldId, liveWorldReady, planetSize, terrainSeed]
  );
  const fieldPackSource: FieldPackDropPoseSource | null = story.beat === 'a4-exhale'
    ? 'a4-planned-tear'
    : liveWorldReady && (done || /^ch[5-9]$/.test(String(story.chapter)))
      ? 'direct-ch5-fallback'
      : null;
  // Resolve before child render so FieldPack, MawPondResonance and all frame
  // drivers observe the same authority together. Direct Ch5 reconstruction
  // waits for sceneReady: EfficientPlanet has then populated voxelSystem and
  // replayed this world's saved edits, so the locked fallback cannot be chosen
  // from the pristine generator while edited terrain is still loading.
  const fieldPack = useMemo(() => fieldPackSource
    ? establishFieldPackDropPose({
        planetSize,
        terrainSeed,
        terrain: liveTerrain,
        worldId: commandContext.world.worldId,
        terrainRevision: liveTerrain.revision,
        storyRunId: story.runId,
        source: fieldPackSource
      })
    : getFieldPackDropPoseAuthority(commandContext.world.worldId, story.runId), [
      commandContext.world.worldId,
      fieldPackSource,
      liveTerrain,
      planetSize,
      story.runId,
      terrainSeed
    ]);
  const departureScope = `${commandContext.actorId}:${commandContext.world.worldId}:${story.runId}`;
  const [departure, setDeparture] = useState(() => ({
    scope: departureScope,
    complete: hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId)
  }));
  // Within one live mount, the receipt starts the short grounded exit rather
  // than popping the body. A reload/new run scope derives hidden state directly
  // from that same durable receipt before AuditWorker can mount.
  const departureComplete = departure.scope === departureScope
    ? departure.complete
    : hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId);
  useEffect(() => {
    if (departure.scope === departureScope) return;
    setDeparture({
      scope: departureScope,
      complete: hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId)
    });
  }, [commandContext.actorId, departure.scope, departureScope]);
  const completeAuditWorkerDeparture = useCallback(() => {
    setDeparture(current => current.scope === departureScope && current.complete
      ? current
      : { scope: departureScope, complete: true });
  }, [departureScope]);
  const auditWorkerMounted = shouldMountAuditWorker(
    story.chapter,
    commandContext.world.worldId,
    departureComplete
  );

  useEffect(() => {
    setSideLens(getStorySidePlane(planetSize, terrainSeed));
    return clearSideLens;
  }, [commandContext.world.worldId, planetSize, terrainSeed]);

  // Live anchors for the director/autopilot (pond + the auditor's approach) —
  // computed once per world mount; the director never learns planetSize itself.
  useEffect(() => {
    storyAnchors.pond = getPondPose(planetSize, terrainSeed);
    storyAnchors.auditPath = getAuditWorkerPath(planetSize, terrainSeed, liveTerrain);
    storyAnchors.fieldPack = fieldPack;
    storyAnchors.worldId = commandContext.world.worldId;
    storyAnchors.storyRunId = story.runId;
    storyAnchors.terrainSeed = terrainSeed;
    storyAnchors.planetSize = planetSize;
  }, [
    commandContext.world.worldId,
    fieldPack,
    liveTerrain,
    planetSize,
    story.runId,
    terrainSeed
  ]);

  // Authority teardown belongs only to a world/run lifetime. Keeping it out
  // of the live-terrain publication effect is critical: sceneReady replaces
  // the terrain adapter after persisted edits replay, and the previous passive
  // effect cleanup must not erase the direct-Ch5 pose established by that
  // render before FieldPack gets its next progression-backed rerender.
  useEffect(() => {
    const worldId = commandContext.world.worldId;
    const storyRunId = story.runId;
    return () => {
      if (
        storyAnchors.worldId === worldId
        && storyAnchors.storyRunId === storyRunId
      ) {
        storyAnchors.pond = null;
        storyAnchors.auditPath = null;
        storyAnchors.fieldPack = null;
        storyAnchors.worldId = null;
        storyAnchors.storyRunId = null;
        storyAnchors.terrainSeed = null;
        storyAnchors.planetSize = null;
        hideAuditWorker();
      }
      resetFieldPackDropPoseAuthority({
        worldId,
        storyRunId
      });
    };
  }, [commandContext.world.worldId, story.runId]);

  // A receipt-backed reload starts with departure complete; continuous play
  // reaches this state after the choreography's short post-tear grounded tail.
  // Clear the module pose whenever either path unmounts the mesh.
  useEffect(() => {
    if (auditWorkerMounted) return;
    hideAuditWorker();
    // On a fresh receipt-backed reload the actor component correctly never
    // mounts, so its unmount cleanup cannot publish absence. The story-world
    // owner must still state that negative fact explicitly for first-frame
    // lifecycle proof (and for future systems that distinguish absent from
    // instrumentation-not-ready).
    clearJourneyEntityState(
      'actor:w7744',
      'StoryWorldProps',
      departureComplete ? 'departed' : 'not-mounted'
    );
  }, [auditWorkerMounted, departureComplete]);

  useEffect(() => {
    if (!done) return;
    const runtime = getFeedRuntime();
    if (runtime.descent < 1) runtime.descent = 1.1;
  }, [done]);

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
    || /^ch[5-9]$/.test(String(story.chapter))
    || story.beat === 'ch3-thirst' || story.beat === 'ch3-forage' || story.beat === 'ch3-signal';

  return (
    <>
      <SideWorkerAvatar />
      {/* The crashed pod persists as the smoking wreck — a permanent landmark
          from the descent onward. At the A3 material awakening it CONVERTS: the
          voxel pod self-hides and the hi-fi hull (HifiWreck) settles into the
          same impact site. Both mounted always; each self-gates on the a3
          milestone, so a resume past the awakening loads straight into the ship. */}
      <DescentPod planetSize={planetSize} terrainSeed={terrainSeed} />
      <HifiWreck
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
      />
      {/* The wreck relay: silent scenery from the first day; the network's
          voice from the klaxon on — and it stays up at done (carrier is up). */}
      {firstDayOrLater && <WreckRelay planetSize={planetSize} terrainSeed={terrainSeed} />}
      {/* W-7744 — hidden until arrival writes his pose; the A4 -> Chapter 5
          evidence boundary removes him after his grounded flight and pack tear. */}
      {auditWorkerMounted && <AuditWorker />}
      <FieldPack
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
      />
      <KeelMemory
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
      />
      <EmergentAuditSites
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
      />
      <A4WorldChoreography
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
        onWorkerDeparted={completeAuditWorkerDeparture}
      />
      <MawPondResonance
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        commandContext={commandContext}
      />
      {/* Hull debris scattered by the descent — the raster act's salvage. */}
      {story.chapter === 'ch1' && (
        <DebrisField planetSize={planetSize} terrainSeed={terrainSeed} />
      )}
      {/* Supply pods on the authoritative profile row — recovering the full
          line earns the transition into top-down NAV VIEW. */}
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
