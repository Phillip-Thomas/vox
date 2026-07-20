import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import { hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import {
  beginMawPondObservation,
  commitMawPondResonance,
  EMERGENT_MAW_MILESTONES,
  isMawPondResponseAttendable,
  isMawPondResponseObserved
} from '../emergentMawRepair.ts';
import { useStoryState } from '../storyState.ts';
import { getPondPose } from './storyWorld.ts';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { isStoryPaused } from '../storyClock.ts';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock,
  documentIsHidden,
  resetAuthoredForegroundClock
} from '../authoredFrameTime.ts';
import { mawResonanceRingFrameAt } from '../authoredPhysicalAnimation.ts';
import { resolveMawPondVisualPhase } from './mawPondVisualPolicy.ts';

const POND_ATTEND_DISTANCE = 5.2;
const PREWARM_FRAMES = 2;
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const RING_COLORS = Object.freeze([
  new THREE.Color('#93eff0').multiplyScalar(2.1),
  new THREE.Color('#4ba7aa').multiplyScalar(2),
  new THREE.Color('#4ba7aa').multiplyScalar(2)
]);
const BEAM_COLOR = new THREE.Color('#8df1ed').multiplyScalar(2.6);
const SURFACE_GLOW_COLOR = new THREE.Color('#4b9799').multiplyScalar(2.2);
const RING_INDICES = Object.freeze([0, 1, 2]);

interface MawPondResonanceProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}

/** A real surface/material oscillation precedes the signed resonance receipt. */
const MawPondResonance: React.FC<MawPondResonanceProps> = ({
  planetSize,
  terrainSeed,
  commandContext
}) => {
  const story = useStoryState();
  const directionResolved = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, commandContext.actorId),
    () => false
  );
  const resonant = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, commandContext.actorId),
    () => false
  );
  const pose = useMemo(
    () => getPondPose(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const gazeTarget = useMemo(
    () => pose?.surface.clone().addScaledVector(pose.up, 1.35) ?? null,
    [pose]
  );
  const surfaceQuaternion = useMemo(
    () => pose ? new THREE.Quaternion().setFromUnitVectors(LOCAL_UP, pose.up) : null,
    [pose]
  );
  const ringGeometry = useMemo(
    () => new THREE.TorusGeometry(0.75, 0.055, 8, 48),
    []
  );
  const visualPhase = resolveMawPondVisualPhase(story.active, story.beat, directionResolved);
  const revealed = visualPhase === 'revealed';
  const rootRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<Array<THREE.Mesh | null>>([]);
  const prewarmFramesRef = useRef(0);
  const authoredClockRef = useRef(createAuthoredForegroundClock());
  const visibleSecondsRef = useRef(0);
  const cameraEyeRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraToPondRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const resonanceMountedBeat = story.beat === 'ch5-maw' || story.beat === 'ch6-dive';
    if (!directionResolved || !resonanceMountedBeat) {
      resetAuthoredForegroundClock(authoredClockRef.current);
    }
    if (directionResolved && story.beat === 'ch5-maw') return;
    visibleSecondsRef.current = 0;
  }, [directionResolved, story.beat]);

  useEffect(() => {
    prewarmFramesRef.current = 0;
  }, [commandContext.actorId, commandContext.world.worldId]);

  useEffect(() => {
    if (!story.active
      || story.beat !== 'ch5-maw'
      || !directionResolved
      || resonant
      || !pose) return;
    return registerStoryInteraction((_camera, playerPosition) => {
      const playerNearPond = playerPosition.distanceTo(pose.shore) <= POND_ATTEND_DISTANCE;
      const responseMeshMounted = Boolean(
        rootRef.current?.visible
        && ringRefs.current.length === 3
        && ringRefs.current.every(Boolean)
      );
      if (!isMawPondResponseAttendable({ playerNearPond, responseMeshMounted })) return null;
      return {
        id: 'story-maw-pond-attend',
        verb: 'Attend Pond Response',
        perform: () => commitMawPondResonance(
          commandContext,
          isMawPondResponseAttendable({
            playerNearPond: getPlayerWorldPosition().distanceTo(pose.shore) <= POND_ATTEND_DISTANCE,
            responseMeshMounted: Boolean(
              rootRef.current?.visible
              && ringRefs.current.length === 3
              && ringRefs.current.every(Boolean)
            )
          }),
          'story:maw:keel-resonance'
        )
      };
    });
  }, [commandContext, directionResolved, pose, resonant, story.active, story.beat]);

  useFrame(({ camera }, delta) => {
    if (!rootRef.current) return;
    if (visualPhase === 'absent') {
      rootRef.current.visible = false;
      return;
    }
    if (visualPhase === 'prewarm') {
      rootRef.current.visible = prewarmFramesRef.current < PREWARM_FRAMES;
      if (rootRef.current.visible) prewarmFramesRef.current += 1;
      return;
    }
    rootRef.current.visible = true;
    const paused = isStoryPaused();
    const hidden = documentIsHidden();
    const dt = advanceAuthoredForegroundClock(authoredClockRef.current, delta, { paused, hidden });
    const visualElapsed = authoredClockRef.current.elapsedSeconds;
    for (let index = 0; index < ringRefs.current.length; index++) {
      const ring = ringRefs.current[index];
      if (!ring) continue;
      const frame = mawResonanceRingFrameAt(visualElapsed, index);
      ring.scale.setScalar(frame.scale);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = frame.opacity;
    }

    if (story.beat !== 'ch5-maw') return;
    if (!pose || !gazeTarget || paused || hidden) return;
    const playerNearPond = getPlayerWorldPosition().distanceTo(pose.shore) <= POND_ATTEND_DISTANCE;
    if (!playerNearPond) {
      visibleSecondsRef.current = 0;
      return;
    }
    if (resonant) return;

    // Signed camera authority stays with the player. The response proves that
    // the player (or movie-mode input adapter) actually held the pond in view;
    // this evidence component never corrects the camera toward its own target.
    camera.getWorldPosition(cameraEyeRef.current);
    camera.getWorldDirection(cameraForwardRef.current);
    cameraToPondRef.current.copy(gazeTarget).sub(cameraEyeRef.current).normalize();
    const cameraAlignment = cameraForwardRef.current.dot(cameraToPondRef.current);
    const responseMeshMounted = rootRef.current.visible
      && ringRefs.current.length === 3
      && ringRefs.current.every(Boolean);
    beginMawPondObservation(
      commandContext,
      responseMeshMounted,
      'story:maw:keel-resonance'
    );
    if (cameraAlignment >= 0.94 && responseMeshMounted) {
      visibleSecondsRef.current += dt;
    } else {
      visibleSecondsRef.current = 0;
    }
    if (isMawPondResponseObserved({
      playerNearPond,
      responseMeshMounted,
      cameraAlignment,
      visibleSeconds: visibleSecondsRef.current
    })) {
      commitMawPondResonance(
        commandContext,
        true,
        'story:maw:keel-resonance'
      );
    }
  });

  if (!pose || !surfaceQuaternion || visualPhase === 'absent') {
    return null;
  }
  return (
    <group
      ref={rootRef}
      name="maw-pond-resonance"
      position={pose.surface}
      quaternion={surfaceQuaternion}
    >
      {RING_INDICES.map(index => (
        <mesh
          key={index}
          ref={(mesh: THREE.Mesh | null) => { ringRefs.current[index] = mesh; }}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={ringGeometry}
          frustumCulled={false}
        >
          <meshBasicMaterial
            color={RING_COLORS[index]}
            transparent
            opacity={revealed ? 0.5 : 0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 1.65, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.035, 0.24, 3.3, 10, 1, true]} />
        <meshBasicMaterial
          color={BEAM_COLOR}
          transparent
          opacity={revealed ? 0.26 : 0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.28, 1.4, 48]} />
        <meshBasicMaterial
          color={SURFACE_GLOW_COLOR}
          transparent
          opacity={revealed ? 0.24 : 0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default MawPondResonance;
