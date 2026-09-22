import type * as THREE from 'three';
import type { MarkerPose, WorldHandles } from './beats/worldHandles.ts';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { signalMesaHandle } from './world/SignalMesa.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { hifiWreckHandle } from './world/hifiWreck.ts';
import { currentNavWaypointPosition } from './navWaypoints.ts';
import { getSupplyPodPositions, isPodCollected } from './supplyPods.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { storyAnchors, getKeelMemoryPose } from './world/storyWorld.ts';
import { nearestForageNodeWorld } from '../components/ForageField.tsx';
import { nearestCampfireMarkerTarget, nearestGatherResourceTarget, currentGatherMarkerResource } from './storyDirector.ts';
import { readSystemCompanionBodyTarget } from '../state/systemCompanionBodyTargets.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { chapter10WreckSitePosition, chapter10HabitatCorePosition, chapter10FabricatorPosition, chapter10StationTargetPosition, getEmergentStoryMarkerTarget } from './emergentStoryDirector.ts';
import { resolveTidegardenSettlementTarget } from './tidegardenSettlementTargets.ts';
import { commonGroundMarkerProjection, commonGroundMarkerTarget } from './commonGroundDirector.ts';

const pose = (position: THREE.Vector3 | null | undefined, projectionSpace?: 'surface' | 'spatial'): MarkerPose | null => position ? { position, ...(projectionSpace ? { projectionSpace } : {}) } : null;

/** Live world facade; read at resolution time, so late mounts never leave stale targets. */
export const storyWorldHandles: WorldHandles = {
  target(name) {
    switch (name) {
      case 'anomaly': return anomalyStoneHandle.position ? { position: anomalyStoneHandle.position, surfaceUp: anomalyStoneHandle.up } : null;
      case 'summit': return pose(signalMesaHandle.summit);
      case 'tree': return pose(heroTreeHandle.position);
      case 'waypoint': return pose(currentNavWaypointPosition());
      case 'pod': {
        const player = getPlayerWorldPosition();
        const nearest = getSupplyPodPositions().filter((_, index) => !isPodCollected(index)).sort((a, b) => a.distanceToSquared(player) - b.distanceToSquared(player))[0];
        return pose(nearest);
      }
      case 'fire': return pose(nearestCampfireMarkerTarget());
      case 'pond-surface': return pose(storyAnchors.pond?.surface);
      case 'pond-shore': return pose(storyAnchors.pond?.shore);
      case 'forage': return storyAnchors.terrainSeed == null ? null : pose(nearestForageNodeWorld(getPlayerWorldPosition(), storyAnchors.terrainSeed, 60));
      case 'origin-relay': return pose(chapter10WreckSitePosition()?.clone());
      case 'relay': return pose(wreckRelayHandle.position);
      case 'maw-pack': return pose(storyAnchors.fieldPack?.position);
      case 'keel': return storyAnchors.planetSize == null || storyAnchors.terrainSeed == null ? null : pose(getKeelMemoryPose(storyAnchors.planetSize, storyAnchors.terrainSeed)?.position);
      case 'wreck': return pose(hifiWreckHandle.diagnosisTarget ?? hifiWreckHandle.position);
      case 'workstation': return pose(hifiWreckHandle.workstationPosition ?? hifiWreckHandle.position);
      case 'hatch': return pose(hifiWreckHandle.hatchTarget);
      case 'origin': return pose(readSystemCompanionBodyTarget(STORY_PRIMARY_WORLD_ID), 'spatial');
      case 'tidegarden': return pose(readSystemCompanionBodyTarget(TIDEGARDEN_WORLD_ID), 'spatial');
      case 'station': return pose(chapter10StationTargetPosition()?.clone(), 'spatial');
      case 'core': return pose(chapter10HabitatCorePosition()?.clone());
      case 'fabricator': return pose(chapter10FabricatorPosition()?.clone());
    }
  },
  gather(resource) { return pose(nearestGatherResourceTarget(resource === 'flint' ? 'flint' : currentGatherMarkerResource())); },
  audit(beat) { return pose(getEmergentStoryMarkerTarget(beat)); },
  settlement(id) { return pose(resolveTidegardenSettlementTarget(id)); },
  commonGround(objectiveId) {
    return pose(commonGroundMarkerTarget(objectiveId), commonGroundMarkerProjection(objectiveId));
  }
};
