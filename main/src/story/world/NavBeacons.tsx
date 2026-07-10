import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { useStoryState } from '../storyState.ts';
import {
  currentNavWaypointIndex,
  reachNavWaypoint,
  setNavWaypointPositions
} from '../navWaypoints.ts';
import { getNavWaypointPoses } from './storyWorld.ts';

// --- Triangulation beacons -----------------------------------------------------------
//
// The top-down era's route markers: thin survey pylons with a beacon head. Only
// the ACTIVE one blinks (the route is ordered); passed fixes dim to a stub —
// the map remembers where you have been.

const REACH_RADIUS = 3.2;
const PYLON = '#a8b4ad';
const DIM = '#59645e';

interface NavBeaconsProps {
  planetSize: number;
  terrainSeed: number;
}

const NavBeacons: React.FC<NavBeaconsProps> = ({ planetSize, terrainSeed }) => {
  const story = useStoryState();
  const groupRef = useRef<THREE.Group>(null);

  const poses = useMemo(
    () => getNavWaypointPoses(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const materials = useMemo(() => ({
    active: new THREE.MeshStandardMaterial({ color: PYLON, roughness: 0.6, emissive: PYLON, emissiveIntensity: 0.3 }),
    dim: new THREE.MeshStandardMaterial({ color: DIM, roughness: 0.9 })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useEffect(() => {
    setNavWaypointPositions(poses.map(p => p.position));
    return () => setNavWaypointPositions([]);
  }, [poses]);

  const live = story.beat === 'ch1-nav';

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    materials.active.emissiveIntensity = 0.3 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 3.2));
    const current = currentNavWaypointIndex();
    group.children.forEach((pylon, i) => {
      const head = pylon.children[1] as THREE.Mesh | undefined;
      if (head) head.material = i === current ? materials.active : materials.dim;
      pylon.scale.setScalar(i < current ? 0.6 : 1); // passed fixes shrink to stubs
    });
    if (!live) return;
    const player = getPlayerWorldPosition();
    if (current < poses.length && player.distanceTo(poses[current].position) <= REACH_RADIUS) {
      reachNavWaypoint(current);
    }
  });

  return (
    <group ref={groupRef}>
      {poses.map((pose, i) => (
        <group key={i} position={pose.position}>
          <mesh geometry={box} material={materials.dim} scale={[0.18, 2.2, 0.18]} position={[0, 1.1, 0]} />
          <mesh geometry={box} material={materials.dim} scale={[0.5, 0.5, 0.5]} position={[0, 2.4, 0]} />
        </group>
      ))}
    </group>
  );
};

export default NavBeacons;
