import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { useStoryState } from '../storyState.ts';
import {
  collectDebris,
  getDebrisScattered,
  isDebrisCollected,
  setDebrisPositions
} from '../debrisSalvage.ts';
import { useEffect } from 'react';
import { getDebrisPoses } from './storyWorld.ts';

// --- The hull debris field ----------------------------------------------------------
//
// Voxel wreckage and local impact rubble scattered along the one raster task
// row. Walk-over pickup (the LooseStoneField proximity pattern); each piece is
// 2–3 grid-aligned scorched boxes with a faint blink so it reads on the dither.

const PICKUP_RADIUS = 2.8;
const HULL = '#8f9c96';
const SCORCH = '#4f5a55';

interface DebrisFieldProps {
  planetSize: number;
  terrainSeed: number;
}

const DebrisField: React.FC<DebrisFieldProps> = ({ planetSize, terrainSeed }) => {
  const story = useStoryState();
  const groupRef = useRef<THREE.Group>(null);

  const poses = useMemo(
    () => getDebrisPoses(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const materials = useMemo(() => ({
    hull: new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.8, emissive: HULL, emissiveIntensity: 0 }),
    scorch: new THREE.MeshStandardMaterial({ color: SCORCH, roughness: 0.95 })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Registered for the movie autopilot's salvage sweep.
  useEffect(() => {
    setDebrisPositions(poses.map(p => p.position));
    return () => setDebrisPositions([]);
  }, [poses]);

  const collectable = story.beat === 'ch1-raster';

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    // Blink so debris reads against the dither (stronger while collectable).
    materials.hull.emissiveIntensity = collectable
      ? 0.25 + 0.35 * Math.abs(Math.sin(clock.elapsedTime * 2.4))
      : 0.08;

    const player = getPlayerWorldPosition();
    const scattered = getDebrisScattered();
    group.children.forEach((piece, i) => {
      const active = i < scattered && !isDebrisCollected(i);
      piece.visible = active;
      if (!active || !collectable) return;
      if (player.distanceTo(poses[i].position) <= PICKUP_RADIUS) {
        collectDebris(i);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {poses.map((pose, i) => (
        <group key={i} position={pose.position}>
          <mesh geometry={box} material={materials.hull} scale={[0.9, 0.5, 0.7]} />
          <mesh geometry={box} material={materials.scorch} scale={[0.5, 0.7, 0.5]} position={[0.5, 0.1, 0.2]} />
          {i % 2 === 0 && (
            <mesh geometry={box} material={materials.scorch} scale={[0.4, 0.3, 0.6]} position={[-0.5, -0.1, -0.2]} />
          )}
          {i < 3 && (
            <mesh geometry={box} material={materials.scorch} scale={[0.42, 0.28, 0.38]} position={[-0.72, -0.3, 0.48]} />
          )}
        </group>
      ))}
    </group>
  );
};

export default DebrisField;
