import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { useStoryState } from '../storyState.ts';
import {
  collectPod,
  isPodCollected,
  setSupplyPodPositions,
  SUPPLY_POD_COUNT
} from '../supplyPods.ts';
import { getSupplyPodPoses } from './storyWorld.ts';

// --- The work-line supply pods -------------------------------------------------------
//
// The last profile-era objective: sealed Authority drop pods projected onto the
// one traversable work row. Same walk-over pickup and blink language as the hull
// debris, but a cleaner silhouette — these were DELIVERED, not crashed.

const PICKUP_RADIUS = 3.0; // 3D radius incl. the ~2.2u capsule-center-to-ground gap
const SHELL = '#9aa8a1';
const BAND = '#5a655f';

interface SupplyPodsProps {
  planetSize: number;
  terrainSeed: number;
}

const SupplyPods: React.FC<SupplyPodsProps> = ({ planetSize, terrainSeed }) => {
  const story = useStoryState();
  const groupRef = useRef<THREE.Group>(null);

  const poses = useMemo(
    () => getSupplyPodPoses(planetSize, terrainSeed).slice(0, SUPPLY_POD_COUNT),
    [planetSize, terrainSeed]
  );
  const materials = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.7, emissive: SHELL, emissiveIntensity: 0 }),
    band: new THREE.MeshStandardMaterial({ color: BAND, roughness: 0.9 })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Registered for the movie autopilot's recovery run.
  useEffect(() => {
    setSupplyPodPositions(poses.map(p => p.position));
    return () => setSupplyPodPositions([]);
  }, [poses]);

  const collectable = story.beat === 'ch1-depth';

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    materials.shell.emissiveIntensity = collectable
      ? 0.25 + 0.35 * Math.abs(Math.sin(clock.elapsedTime * 2.4))
      : 0.08;

    const player = getPlayerWorldPosition();
    group.children.forEach((pod, i) => {
      const active = !isPodCollected(i);
      pod.visible = active;
      if (!active || !collectable) return;
      if (player.distanceTo(poses[i].position) <= PICKUP_RADIUS) {
        collectPod(i);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {poses.map((pose, i) => (
        <group key={i} position={pose.position}>
          <mesh geometry={box} material={materials.shell} scale={[0.8, 0.9, 0.8]} />
          <mesh geometry={box} material={materials.band} scale={[0.86, 0.2, 0.86]} position={[0, 0.15, 0]} />
          <mesh geometry={box} material={materials.band} scale={[0.12, 0.7, 0.12]} position={[0, 0.8, 0]} />
        </group>
      ))}
    </group>
  );
};

export default SupplyPods;
