import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import { hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { getPlayerSubmersion } from '../../state/playerSubmersion.ts';
import {
  acquireKestrelKeelFromDive,
  advanceKestrelKeelFreeing,
  advanceKestrelKeelAuthorityWait,
  AUTHORED_DIVE_AUTHORITY_RETRY_SECONDS,
  AUTHORED_DIVE_ENTER_SUBMERGENCE,
  AUTHORED_DIVE_KEEL_FREE_SECONDS,
  AUTHORED_DIVE_MAX_SHORE_BANK_DISTANCE,
  AUTHORED_DIVE_MILESTONES,
  bankSurfacedKestrelKeel,
  beginKestrelKeelFreeing,
  commitKeelSonarReveal,
  createKestrelKeelFreeingState
} from '../emergentDive.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from '../emergentUniqueItems.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { useStoryState } from '../storyState.ts';
import { getKeelMemoryPose, getPondPose } from './storyWorld.ts';
import { getPlayerLook, getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { getLocalPlayerSurfaceContact } from '../../state/playerSurfaceContact.ts';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock,
  resetAuthoredForegroundClock
} from '../authoredFrameTime.ts';
import { isStoryPaused } from '../storyClock.ts';
import { PLAYER_EYE_HEIGHT } from '../../utils/cubeGravityConstants.ts';
import { createKeelViewScratch, resolveKeelViewAlignment } from '../keelViewAlignment.ts';

const FREE_DISTANCE = 3.3;

interface KeelMemoryProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}

/** Continuous waterline gameplay: the prop stays on the real pond floor, and
 * the shore receipt cannot commit until the same body has genuinely surfaced. */
const KeelMemory: React.FC<KeelMemoryProps> = ({ planetSize, terrainSeed, commandContext }) => {
  const actorId = commandContext.actorId;
  const story = useStoryState();
  const pose = useMemo(
    () => getKeelMemoryPose(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const pond = useMemo(
    () => getPondPose(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const acquired = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId),
    () => false
  );
  const revealed = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(AUTHORED_DIVE_MILESTONES.keelSonarRevealed, actorId),
    () => false
  );
  const banked = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actorId),
    () => false
  );
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const rootRef = useRef<THREE.Group>(null);
  const sonarRef = useRef<THREE.Group>(null);
  const sonarRings = useRef<Array<THREE.Mesh | null>>([]);
  const sonarVisibleSeconds = useRef(0);
  const keelViewScratch = useRef(createKeelViewScratch());
  const freeingClock = useRef(createAuthoredForegroundClock());
  const freeingState = useRef(createKestrelKeelFreeingState());
  const mawContactRef = useRef<THREE.Group>(null);
  const bankAuthorityRetryAtMs = useRef(0);
  const quaternion = useMemo(
    () => pose
      ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pose.up)
      : new THREE.Quaternion(),
    [pose]
  );

  useFrame(({ camera, clock }, delta) => {
    if (!glowRef.current) return;
    const tide = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.15);
    glowRef.current.emissiveIntensity = revealed ? 0.9 + tide * 1.5 : 0.04;
    if (!pose || String(story.beat) !== 'ch6-dive') return;
    const distance = getPlayerWorldPosition().distanceTo(pose.position);
    const submergence = getPlayerSubmersion(actorId).submergence;
    const look = getPlayerLook();
    const cameraAlignment = resolveKeelViewAlignment(camera, pose.position, {
      playerPosition: getPlayerWorldPosition(),
      playerUp: getPlayerUp(),
      surfaceForward: look.forward,
      pitch: look.pitch,
      eyeHeight: PLAYER_EYE_HEIGHT
    }, keelViewScratch.current);
    if (!revealed) {
      const sonar = sonarRef.current;
      const visible = Boolean(rootRef.current && sonar && sonarRings.current.some(Boolean))
        && distance <= 24
        && submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE
        && cameraAlignment >= 0.75;
      if (sonar) sonar.visible = visible;
      if (!visible) {
        sonarVisibleSeconds.current = 0;
      } else {
        sonarVisibleSeconds.current += Math.max(0, Math.min(0.1, delta));
        sonarRings.current.forEach((ring, index) => {
          if (!ring) return;
          const phase = (clock.elapsedTime * 0.55 + index / 3) % 1;
          ring.scale.setScalar(0.55 + phase * 2.4);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.7;
        });
        if (sonarVisibleSeconds.current >= 0.35) {
          commitKeelSonarReveal(
            true,
            distance,
            submergence,
            cameraAlignment,
            commandContext.world.worldId,
            actorId
          );
        }
      }
    }

    const physicalFreeingEligible = revealed
      && !acquired
      && distance <= FREE_DISTANCE
      && submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE
      && cameraAlignment >= 0.55;
    if (freeingState.current.active || freeingState.current.readyToCommit) {
      const authoredDelta = advanceAuthoredForegroundClock(freeingClock.current, delta, {
        paused: isStoryPaused(),
        maxSeconds: 0.1
      });
      const previousReady = freeingState.current.readyToCommit;
      freeingState.current = freeingState.current.active
        ? advanceKestrelKeelFreeing(
            freeingState.current,
            authoredDelta,
            physicalFreeingEligible
          )
        : advanceKestrelKeelAuthorityWait(
            freeingState.current,
            authoredDelta,
            acquired
          );
      const progress = Math.min(
        1,
        freeingState.current.elapsedSeconds / AUTHORED_DIVE_KEEL_FREE_SECONDS
      );
      if (rootRef.current) {
        rootRef.current.position.copy(pose.position)
          .addScaledVector(pose.up, Math.sin(progress * Math.PI * 10) * 0.035 * progress);
        rootRef.current.scale.setScalar(1 + Math.sin(progress * Math.PI * 8) * 0.018);
      }
      if (mawContactRef.current) {
        mawContactRef.current.visible = freeingState.current.active || freeingState.current.readyToCommit;
        mawContactRef.current.scale.setScalar(0.35 + progress * 0.65);
      }
      if (!previousReady && freeingState.current.readyToCommit) {
        const committed = acquireKestrelKeelFromDive(
          'story:dive:keel-freed',
          submergence,
          actorId,
          commandContext
        );
        if (!committed) {
          freeingState.current = createKestrelKeelFreeingState();
          resetAuthoredForegroundClock(freeingClock.current);
        }
      }
    } else if (!freeingState.current.readyToCommit) {
      if (rootRef.current) {
        rootRef.current.position.copy(pose.position);
        rootRef.current.scale.setScalar(1);
      }
      if (mawContactRef.current) mawContactRef.current.visible = false;
    }
  });

  useEffect(() => {
    if (!pose || !pond || !story.active || String(story.beat) !== 'ch6-dive') return;
    return registerStoryInteraction((camera, playerPosition) => {
      const submergence = getPlayerSubmersion(actorId).submergence;
      const look = getPlayerLook();
      const interactionCameraAlignment = resolveKeelViewAlignment(camera, pose.position, {
        playerPosition,
        playerUp: getPlayerUp(),
        surfaceForward: look.forward,
        pitch: look.pitch,
        eyeHeight: PLAYER_EYE_HEIGHT
      }, keelViewScratch.current);
      if (
        revealed
        && !acquired
        && submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE
        && playerPosition.distanceTo(pose.position) <= FREE_DISTANCE
        && interactionCameraAlignment >= 0.55
      ) {
        if (freeingState.current.active || freeingState.current.readyToCommit) {
          return {
            id: 'story-keel-free',
            verb: freeingState.current.readyToCommit ? 'Maw Locking' : 'Hold Position',
            perform: () => undefined
          };
        }
        return {
          id: 'story-keel-free',
          verb: 'Engage Maw on Structural Pin',
          perform: () => {
            freeingState.current = beginKestrelKeelFreeing();
            resetAuthoredForegroundClock(freeingClock.current);
          }
        };
      }
      const shoreDistance = playerPosition.distanceTo(pond.shore);
      const surfaceContact = getLocalPlayerSurfaceContact();
      if (
        acquired
        && !banked
        && hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId)
        && shoreDistance <= AUTHORED_DIVE_MAX_SHORE_BANK_DISTANCE
        && surfaceContact.physicallySupported
        && !surfaceContact.feetInWater
      ) {
        const authorityPending = commandContext.now() < bankAuthorityRetryAtMs.current;
        return {
          id: 'story-keel-bank',
          verb: authorityPending ? 'Securing Keel Memory' : 'Secure Keel Memory',
          perform: () => {
            if (authorityPending) return;
            const committed = bankSurfacedKestrelKeel(
              'story:dive:keel-banked',
              getVitals(actorId).oxygen,
              submergence,
              actorId,
              commandContext,
              { ...surfaceContact, shoreDistance }
            );
            if (
              committed
              && !hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actorId)
            ) {
              bankAuthorityRetryAtMs.current = commandContext.now()
                + AUTHORED_DIVE_AUTHORITY_RETRY_SECONDS * 1000;
            }
          }
        };
      }
      return null;
    });
  }, [acquired, actorId, banked, commandContext, pond, pose, revealed, story.active, story.beat]);

  if (!pose || acquired || String(story.beat) !== 'ch6-dive') return null;
  return (
    <group ref={rootRef} position={pose.position} quaternion={quaternion} rotation={[0.12, 0.4, -0.08]}>
      {/* The marker gets the player to the water column; proximity then lets the
          repaired Maw disclose the drowned structural pin without a precision
          look or oxygen-threshold gate. */}
      <mesh position={[-0.66, 0.18, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.2, 0.72, 0.42]} />
        <meshStandardMaterial color="#302f2b" roughness={0.98} metalness={0.12} />
      </mesh>
      <mesh>
        <boxGeometry args={[1.5, 0.22, 0.5]} />
        <meshStandardMaterial
          color={revealed ? '#344b55' : '#252a2a'}
          roughness={revealed ? 0.32 : 0.92}
          metalness={revealed ? 0.76 : 0.18}
        />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.92, 0.08, 0.18]} />
        <meshStandardMaterial
          ref={glowRef}
          color={revealed ? '#f1bb6a' : '#343b3b'}
          emissive={revealed ? '#d47a24' : '#101313'}
          emissiveIntensity={revealed ? 1.2 : 0.04}
          roughness={0.12}
          metalness={0.6}
        />
      </mesh>
      <group ref={mawContactRef} visible={false} position={[-0.42, 0.32, 0.02]} rotation={[0, 0, -0.7]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.11, 0.95, 8]} />
          <meshStandardMaterial
            color="#f4c477"
            emissive="#d86e20"
            emissiveIntensity={1.7}
            roughness={0.28}
            metalness={0.72}
          />
        </mesh>
        <mesh position={[0, -0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.035, 8, 24]} />
          <meshBasicMaterial color="#ffcf80" transparent opacity={0.82} depthWrite={false} />
        </mesh>
      </group>
      <group ref={sonarRef} visible={false}>
        {[0, 1, 2].map(index => (
          <mesh
            key={index}
            ref={(mesh: THREE.Mesh | null) => { sonarRings.current[index] = mesh; }}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.62, 0.045, 8, 40]} />
            <meshBasicMaterial
              color={index === 0 ? '#f1bb6a' : '#66d7dc'}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.55, 0.18, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.14, 0.5, 0.3]} />
        <meshStandardMaterial color="#7b6856" roughness={0.9} metalness={0.15} />
      </mesh>
    </group>
  );
};

export default KeelMemory;
