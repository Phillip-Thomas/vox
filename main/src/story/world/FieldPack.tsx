import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import {
  hasMilestone,
  subscribeProgression
} from '../../game/systems/progressionSystem.ts';
import { acquireEmergentUniqueItemAuthoritatively } from '../emergentUniqueItems.ts';
import {
  advanceEmergentMawRepairRitual,
  advanceMawPurposeGap,
  beginEmergentMawRepairRitual,
  commitMawFirstDirection,
  EMERGENT_MAW_MILESTONES,
  getMawRepairRitualSnapshot
} from '../emergentMawRepair.ts';
import { FIELD_PACK_DROPPED_MILESTONE } from '../emergentAudit.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { useStoryState } from '../storyState.ts';
import { getFieldPackDropPoseAuthority } from './storyWorld.ts';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { isStoryPaused } from '../storyClock.ts';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock,
  documentIsHidden,
  resetAuthoredForegroundClock
} from '../authoredFrameTime.ts';
import {
  fieldPackCorePulseAt,
  fieldPackSegmentHeightAt
} from '../authoredPhysicalAnimation.ts';
import {
  clearJourneyEntityState,
  publishJourneyEntityState
} from '../journeyRuntime.ts';

const INTERACT_DISTANCE = 3.8;

interface FieldPackProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}

/**
 * W-7744's torn pack is a persistent causal object. Its placement is validated
 * by storyWorld; acquiring its one kit and repairing the Maw are receipt-backed
 * transactions, never a respawning pickup or a cosmetic upgrade button.
 */
const FieldPack: React.FC<FieldPackProps> = ({
  commandContext
}) => {
  const story = useStoryState();
  const pose = getFieldPackDropPoseAuthority(
    commandContext.world.worldId,
    story.runId
  );
  const kitAvailable = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId)
      && !hasMilestone('story:item:maw-repair-kit:acquired', commandContext.actorId),
    () => false
  );
  const dropped = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(FIELD_PACK_DROPPED_MILESTONE, commandContext.actorId),
    () => false
  );
  const repaired = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone('maw_repaired', commandContext.actorId),
    () => false
  );
  const coreRef = useRef<THREE.MeshStandardMaterial>(null);
  const segmentRefs = useRef<Array<THREE.Group | null>>([]);
  const authoredClockRef = useRef(createAuthoredForegroundClock());
  const visualElapsedRef = useRef(0);
  const quaternion = useMemo(
    () => pose
      ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pose.up)
      : new THREE.Quaternion(),
    [pose]
  );

  useEffect(() => {
    const present = Boolean(pose && dropped);
    publishJourneyEntityState('prop:field-pack', {
      mounted: present,
      visible: present,
      position: pose ? [pose.position.x, pose.position.y, pose.position.z] : null,
      phase: !present ? 'absent' : kitAvailable ? 'kit-available' : repaired ? 'repaired' : 'kit-recovered',
      source: 'FieldPack'
    });
  }, [dropped, kitAvailable, pose, repaired]);

  useEffect(
    () => () => {
      clearJourneyEntityState('prop:field-pack', 'FieldPack');
    },
    []
  );

  useEffect(() => {
    resetAuthoredForegroundClock(authoredClockRef.current);
    visualElapsedRef.current = 0;
  }, [commandContext.actorId, commandContext.world.worldId]);

  useFrame((_state, delta) => {
    if (!coreRef.current) return;
    const paused = isStoryPaused();
    const dt = advanceAuthoredForegroundClock(authoredClockRef.current, delta, {
      paused,
      hidden: documentIsHidden()
    });
    visualElapsedRef.current += dt;
    const visualElapsed = visualElapsedRef.current;
    const pulse = fieldPackCorePulseAt(visualElapsed);
    coreRef.current.emissiveIntensity = kitAvailable ? 0.8 + pulse * 1.2 : 0.08;
    let ritual = getMawRepairRitualSnapshot(commandContext.actorId);
    if (String(story.beat) === 'ch5-maw' && pose) {
      const attending = getPlayerWorldPosition().distanceTo(pose.position) <= INTERACT_DISTANCE;
      // R3F callbacks continue while the pause menu is open. Narrative time,
      // physics and the player are frozen there, so the physical repair must be
      // frozen too; otherwise eight menu seconds could spend both inputs.
      if (ritual.phase === 'repairing' || ritual.phase === 'ready') {
        advanceEmergentMawRepairRitual(commandContext, attending, dt);
      }
      if (repaired) advanceMawPurposeGap(commandContext, dt);
      ritual = getMawRepairRitualSnapshot(commandContext.actorId);
    }
    for (let index = 0; index < segmentRefs.current.length; index++) {
      const segment = segmentRefs.current[index];
      if (!segment) continue;
      const local = Math.max(0, Math.min(1, ritual.progress * 3 - index));
      segment.position.x = (index - 1) * (0.46 - local * 0.28);
      segment.position.y = fieldPackSegmentHeightAt(visualElapsed, index, local);
      segment.rotation.z = (index - 1) * 0.24 * (1 - local);
    }
  });

  useEffect(() => {
    if (!pose || !dropped || !story.active || String(story.beat) !== 'ch5-maw') return;
    return registerStoryInteraction((_camera, playerPosition) => {
      const withinRange = playerPosition.distanceTo(pose.position) <= INTERACT_DISTANCE;
      const ritual = getMawRepairRitualSnapshot(commandContext.actorId);
      if (!withinRange) return null;
      if (kitAvailable) {
        return {
          id: 'story-field-kit',
          verb: 'Recover Field Kit',
          perform: () => acquireEmergentUniqueItemAuthoritatively(
            commandContext,
            'maw_repair_kit',
            'story:maw:field-kit-acquired',
          )
        };
      }
      if (
        !repaired
        && getItemCount('maw_repair_kit', commandContext.actorId) > 0
        && getItemCount('faulty_maw', commandContext.actorId) > 0
      ) {
        if (ritual.phase === 'repairing' || ritual.phase === 'ready') {
          const updated = getMawRepairRitualSnapshot(commandContext.actorId);
          return {
            id: 'story-maw-repair',
            verb: `Hold Repair ${Math.round(updated.progress * 100)}%`,
            perform: () => { /* attention, not repeated spending */ }
          };
        }
        return {
          id: 'story-maw-repair',
          verb: 'Begin Maw Repair',
          perform: () => beginEmergentMawRepairRitual(
            commandContext,
            'story:maw:repair-committed'
          )
        };
      }
      if (
        repaired
        && !hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, commandContext.actorId)
        && getMawRepairRitualSnapshot(commandContext.actorId).directionAvailable
      ) {
        return {
          // Lowering remains one real option beside testing the repaired tool on
          // stone/base metal. The persisted branch receipt keeps that agency.
          id: 'story-maw-repair',
          verb: 'Lower Maw and Listen',
          perform: () => commitMawFirstDirection(
            commandContext,
            'lowered-and-listened',
            'story:maw:first-direction'
          )
        };
      }
      return null;
    });
  }, [commandContext, dropped, kitAvailable, pose, repaired, story.active, story.beat]);

  if (!pose || !dropped) return null;

  return (
    <group position={pose.position} quaternion={quaternion} rotation={[0.08, -0.34, 0.16]}>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[1.08, 0.62, 0.82]} />
        <meshStandardMaterial color="#4d5955" roughness={0.9} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.66, 0.04]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.92, 0.12, 0.68]} />
        <meshStandardMaterial color="#6c7771" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[0.22, 0.72, 0.08]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          ref={coreRef}
          color={kitAvailable ? '#72e3e8' : '#263535'}
          emissive={kitAvailable ? '#30c8d7' : '#101515'}
          emissiveIntensity={kitAvailable ? 1 : 0.08}
          roughness={0.25}
          metalness={0.5}
        />
      </mesh>
      {[0, 1, 2].map(index => (
        <group
          key={index}
          ref={group => { segmentRefs.current[index] = group; }}
          position={[(index - 1) * 0.46, 0.88, -0.08]}
        >
          <mesh>
            <boxGeometry args={[0.38, 0.11, 0.24]} />
            <meshStandardMaterial
              color="#657a77"
              emissive="#1e777b"
              emissiveIntensity={0.34}
              roughness={0.38}
              metalness={0.62}
            />
          </mesh>
        </group>
      ))}
      {/* A physically torn retaining strap: the route changed, not the world's intention. */}
      <mesh position={[-0.46, 0.46, 0.31]} rotation={[0.45, 0, 0.72]}>
        <boxGeometry args={[0.08, 0.76, 0.08]} />
        <meshStandardMaterial color="#252d2b" roughness={1} />
      </mesh>
    </group>
  );
};

export default FieldPack;
