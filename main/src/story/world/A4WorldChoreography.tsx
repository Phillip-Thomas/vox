import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import { hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { createLiveAgentSurfaceTerrain } from '../../utils/agentSurfaceNavigationRuntime.ts';
import { turnGroundedHeadingToward, type GroundedSurfaceSample } from '../../utils/groundedSurfaceMotion.ts';
import {
  a4HerdDistance,
  planA4GroundedRoute,
  sampleA4GroundedRoute,
  shouldShowA4WorkerAfterPackDrop
} from '../a4PhysicalChoreography.ts';
import {
  commitA4FieldPackTear,
  commitA4HerdCrest,
  commitA4PondResponse,
  commitA4WorkerFlight,
  EMERGENT_AUDIT_MILESTONES,
  FIELD_PACK_DROPPED_MILESTONE
} from '../emergentAudit.ts';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock,
  documentIsHidden,
  resetAuthoredForegroundClock
} from '../authoredFrameTime.ts';
import { isStoryPaused } from '../storyClock.ts';
import { useStoryState } from '../storyState.ts';
import { getAuditWorkerPose, hideAuditWorker } from './AuditWorker.tsx';
import {
  establishFieldPackDropPose,
  getHeroTreePose,
  getPondPose,
  storyAnchors
} from './storyWorld.ts';

const HERD_COUNT = 5;
const HERD_START_SECONDS = 0.85;
const WORKER_START_SECONDS = 2.15;
const WORKER_SPEED = 4.35;

interface A4WorldChoreographyProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
  onWorkerDeparted?: () => void;
}

/**
 * Physical A4 disclosure. Every semantic receipt is written after its mesh or
 * grounded body has become observable; no timer fabricates a herd, flight or
 * pack drop. The route is dry-only and is shared by all four facts.
 */
const A4WorldChoreography: React.FC<A4WorldChoreographyProps> = ({
  planetSize,
  terrainSeed,
  commandContext,
  onWorkerDeparted
}) => {
  const story = useStoryState();
  useSyncExternalStore(
    subscribeProgression,
    () => a4ProgressionRevision(commandContext.actorId),
    () => ''
  );
  const [terrainRevision, setTerrainRevision] = useState(() => createLiveAgentSurfaceTerrain(
    planetSize,
    terrainSeed,
    commandContext.world.worldId
  ).revision);
  const terrain = useMemo(
    () => createLiveAgentSurfaceTerrain(
      planetSize,
      terrainSeed,
      commandContext.world.worldId
    ),
    [commandContext.world.worldId, planetSize, terrainRevision, terrainSeed]
  );
  const pack = useMemo(
    () => establishFieldPackDropPose({
      planetSize,
      terrainSeed,
      terrain,
      worldId: commandContext.world.worldId,
      terrainRevision: terrain.revision,
      storyRunId: story.runId,
      source: hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId)
        ? 'physical-tear'
        : 'a4-planned-tear'
    }),
    [
      commandContext.actorId,
      commandContext.world.worldId,
      planetSize,
      story.runId,
      terrain,
      terrainSeed
    ]
  );
  const pond = useMemo(
    () => getPondPose(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const route = useMemo(() => {
    if (story.beat !== 'a4-exhale' || !pack) return null;
    const worker = getAuditWorkerPose();
    // A deep-linked predecessor rehearsal has no live module pose. Reconstruct
    // the terminal staging of ch4-defy at the hero tree, where W-7744 actually
    // begins this flight, without fabricating any of the physical A4 receipts.
    const terminal = getHeroTreePose(planetSize, terrainSeed);
    const start = worker.visible
      ? worker.position.clone()
      : terminal.position.clone().addScaledVector(terminal.up, 0.1);
    const workerTarget = pack.position.clone().addScaledVector(pack.up, -0.13);
    return planA4GroundedRoute(terrain, planetSize, start, workerTarget, pack.up);
  }, [pack, planetSize, story.beat, terrain, terrainSeed]);

  const pondRef = useRef<THREE.Group>(null);
  const branchRef = useRef<THREE.Group>(null);
  const herdRefs = useRef<Array<THREE.Group | null>>([]);
  const authoredClockRef = useRef(createAuthoredForegroundClock());
  const elapsedRef = useRef(0);
  const workerDistanceRef = useRef(0);
  const reconstructedPackRef = useRef(false);
  const workerDeparturePublishedRef = useRef(false);
  const herdSamples = useRef(createSamples(HERD_COUNT));
  const workerSample = useRef(createSample());
  const branchSample = useMemo(
    () => route ? sampleA4GroundedRoute(route, route.branchDistance, createSample()) : null,
    [route]
  );

  useEffect(() => {
    resetAuthoredForegroundClock(authoredClockRef.current);
    elapsedRef.current = 0;
    workerDistanceRef.current = 0;
    reconstructedPackRef.current = false;
    workerDeparturePublishedRef.current = false;
    if (story.beat !== 'a4-exhale' || !route) return;
    const worker = getAuditWorkerPose();
    const actorId = commandContext.actorId;
    if (hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actorId)) {
      reconstructedPackRef.current = true;
      workerDistanceRef.current = route.length;
      elapsedRef.current = WORKER_START_SECONDS;
      hideAuditWorker();
      workerDeparturePublishedRef.current = true;
      onWorkerDeparted?.();
      return;
    } else if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actorId)) {
      workerDistanceRef.current = 0.75;
      elapsedRef.current = WORKER_START_SECONDS;
    } else if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actorId)) {
      elapsedRef.current = WORKER_START_SECONDS;
    } else if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actorId)) {
      elapsedRef.current = HERD_START_SECONDS;
    }
    if (!worker.visible || workerDistanceRef.current > 0) {
      const start = sampleA4GroundedRoute(route, workerDistanceRef.current, workerSample.current);
      worker.visible = true;
      worker.position.copy(start.position);
      worker.up.copy(route.up);
      if (start.heading.lengthSq() > 1e-6) worker.heading.copy(start.heading);
      worker.walk = 0;
    }
  }, [commandContext.actorId, onWorkerDeparted, route, story.beat]);

  useFrame((_state, delta) => {
    if (story.beat !== 'a4-exhale' || !route || !pack) return;
    if (!hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId)) {
      const liveRevision = createLiveAgentSurfaceTerrain(
        planetSize,
        terrainSeed,
        commandContext.world.worldId
      ).revision;
      if (liveRevision !== terrainRevision) {
        // Hold for one render while route, branch and every pack consumer move
        // together to the newly edited terrain revision.
        setTerrainRevision(liveRevision);
        return;
      }
    }
    const dt = advanceAuthoredForegroundClock(authoredClockRef.current, delta, {
      paused: isStoryPaused(),
      hidden: documentIsHidden()
    });
    if (dt <= 0) return;
    const actorId = commandContext.actorId;
    const worldId = commandContext.world.worldId;
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actorId)) return;
    if (hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actorId)) {
      if (!reconstructedPackRef.current) {
        workerDistanceRef.current = Math.min(
          route.length,
          workerDistanceRef.current + dt * WORKER_SPEED
        );
      }
      const workerVisible = shouldShowA4WorkerAfterPackDrop({
        reconstructedFromReceipt: reconstructedPackRef.current,
        workerDistance: workerDistanceRef.current,
        routeLength: route.length
      });
      if (workerVisible) {
        const worker = getAuditWorkerPose();
        const exit = sampleA4GroundedRoute(route, workerDistanceRef.current, workerSample.current);
        worker.visible = true;
        worker.position.copy(exit.position);
        worker.up.copy(route.up);
        if (exit.heading.lengthSq() > 1e-6) worker.heading.copy(exit.heading);
        worker.walk = 1;
        worker.stride += dt * WORKER_SPEED;
      } else {
        hideAuditWorker();
        if (!workerDeparturePublishedRef.current) {
          workerDeparturePublishedRef.current = true;
          onWorkerDeparted?.();
        }
      }
      // A reload after the pack receipt reconstructs the causal scene, not
      // just its ledger. Keep the authored herd spread across the crest while
      // the handback breath finishes instead of remounting five hidden groups.
      for (let index = 0; index < HERD_COUNT; index++) {
        const group = herdRefs.current[index];
        if (!group) continue;
        const distance = a4HerdDistance(route, 60, index);
        const herd = sampleA4GroundedRoute(route, distance, herdSamples.current[index]);
        applyGroundedGroup(group, herd, route.up);
        group.visible = true;
      }
      if (pondRef.current) pondRef.current.scale.setScalar(1);
      return;
    }
    elapsedRef.current += dt;
    const elapsed = elapsedRef.current;

    const pondGroup = pondRef.current;
    if (pondGroup) {
      const pulse = 0.82 + Math.sin(elapsed * 3.1) * 0.16;
      pondGroup.scale.setScalar(pulse);
      if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actorId) && elapsed >= 0.3) {
        commitA4PondResponse(true, worldId, actorId);
      }
    }

    if (elapsed >= HERD_START_SECONDS) {
      let visibleAgents = 0;
      let furthestDistance = 0;
      for (let index = 0; index < HERD_COUNT; index++) {
        const group = herdRefs.current[index];
        if (!group) continue;
        const distance = a4HerdDistance(route, elapsed - HERD_START_SECONDS, index);
        const sample = sampleA4GroundedRoute(route, distance, herdSamples.current[index]);
        applyGroundedGroup(group, sample, route.up);
        group.visible = true;
        visibleAgents += 1;
        furthestDistance = Math.max(furthestDistance, distance);
      }
      if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actorId)
        && visibleAgents >= 3 && furthestDistance >= 0.6) {
        commitA4HerdCrest(visibleAgents, furthestDistance, worldId, actorId);
      }
    }

    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actorId)
      || elapsed < WORKER_START_SECONDS) return;
    const worker = getAuditWorkerPose();
    worker.visible = true;
    workerDistanceRef.current = Math.min(
      route.length,
      workerDistanceRef.current + dt * WORKER_SPEED
    );
    const sample = sampleA4GroundedRoute(route, workerDistanceRef.current, workerSample.current);
    worker.position.copy(sample.position);
    worker.up.copy(route.up);
    if (sample.heading.lengthSq() > 1e-6) {
      turnGroundedHeadingToward(worker.heading, sample.heading, route.up, 6.5 * dt);
    }
    worker.walk = workerDistanceRef.current < route.length ? 1 : 0;
    worker.stride += dt * WORKER_SPEED;

    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actorId)
      && workerDistanceRef.current >= 0.75) {
      commitA4WorkerFlight(true, workerDistanceRef.current, worldId, actorId);
    }
    const contactedBranch = Boolean(branchRef.current)
      && workerDistanceRef.current >= route.branchDistance
      && worker.position.distanceTo(branchSample?.position ?? pack.position) <= 1.6;
    if (!hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actorId) && contactedBranch) {
      const committedPack = establishFieldPackDropPose({
        planetSize,
        terrainSeed,
        terrain,
        worldId,
        terrainRevision: terrain.revision,
        storyRunId: story.runId,
        source: 'physical-tear'
      });
      if (!committedPack || !committedPack.position.equals(pack.position)) return;
      storyAnchors.fieldPack = committedPack;
      commitA4FieldPackTear(true, true, true, worldId, actorId);
    }
  });

  if (story.beat !== 'a4-exhale' || !route || !pack || !pond || !branchSample) return null;
  return (
    <>
      <group ref={pondRef} position={pond.surface} quaternion={surfaceQuaternion(pond.up)}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.15, 0.065, 8, 48]} />
          <meshBasicMaterial color="#7ce9dd" transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 1.75, 48]} />
          <meshBasicMaterial color="#408d83" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      </group>
      {Array.from({ length: HERD_COUNT }, (_, index) => (
        <A4HerdAnimal
          key={index}
          index={index}
          setRef={group => { herdRefs.current[index] = group; }}
        />
      ))}
      <group
        ref={branchRef}
        position={branchSample.position}
        quaternion={surfaceQuaternion(route.up)}
      >
        <mesh position={[0, 0.32, 0]} rotation={[0.12, 0.35, 0.78]}>
          <cylinderGeometry args={[0.07, 0.11, 1.65, 7]} />
          <meshStandardMaterial color="#4d3827" roughness={1} />
        </mesh>
        <mesh position={[0.45, 0.72, 0.04]} rotation={[0.18, 0, -0.42]}>
          <coneGeometry args={[0.34, 0.7, 7]} />
          <meshStandardMaterial color="#3e7544" roughness={0.92} />
        </mesh>
      </group>
    </>
  );
};

const A4HerdAnimal: React.FC<{
  index: number;
  setRef: (group: THREE.Group | null) => void;
}> = ({ index, setRef }) => (
  <group ref={setRef} visible={false} scale={0.82 + index * 0.045}>
    <mesh position={[0, 0.72, 0]}>
      <capsuleGeometry args={[0.34, 0.78, 4, 8]} />
      <meshStandardMaterial color={index % 2 === 0 ? '#37413b' : '#59635a'} roughness={0.94} />
    </mesh>
    <mesh position={[0, 0.9, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.26, 0.58, 6]} />
      <meshStandardMaterial color="#252d29" roughness={1} />
    </mesh>
    {[-0.23, 0.23].flatMap(x => [-0.3, 0.32].map(z => (
      <mesh key={`${x}:${z}`} position={[x, 0.28, z]}>
        <boxGeometry args={[0.12, 0.56, 0.12]} />
        <meshStandardMaterial color="#252d29" roughness={1} />
      </mesh>
    )))}
  </group>
);

function createSample(): GroundedSurfaceSample {
  return {
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(),
    distance: 0,
    segmentIndex: -1,
    segmentProgress: 0
  };
}

function createSamples(count: number): GroundedSurfaceSample[] {
  return Array.from({ length: count }, createSample);
}

const basis = new THREE.Matrix4();
const right = new THREE.Vector3();
const forward = new THREE.Vector3();
function applyGroundedGroup(
  group: THREE.Group,
  sample: GroundedSurfaceSample,
  up: THREE.Vector3
): void {
  group.position.copy(sample.position);
  forward.copy(sample.heading);
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
  forward.addScaledVector(up, -forward.dot(up)).normalize();
  right.crossVectors(up, forward).normalize();
  basis.makeBasis(right, up, forward);
  group.quaternion.setFromRotationMatrix(basis);
}

function surfaceQuaternion(up: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
}

function a4ProgressionRevision(actorId: string): string {
  return [
    EMERGENT_AUDIT_MILESTONES.a4Alive,
    EMERGENT_AUDIT_MILESTONES.a4PondVisible,
    EMERGENT_AUDIT_MILESTONES.a4HerdVisible,
    EMERGENT_AUDIT_MILESTONES.a4WorkerFlight,
    FIELD_PACK_DROPPED_MILESTONE
  ].map(id => hasMilestone(id, actorId) ? '1' : '0').join('');
}

export default A4WorldChoreography;
