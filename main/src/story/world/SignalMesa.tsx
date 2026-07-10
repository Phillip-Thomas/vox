import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import { getSignalMesaPose, getStorySidePlane, MESA_HEIGHT } from './storyWorld.ts';

// --- The signal mesa ------------------------------------------------------------------
//
// The stepped voxel rise the anomaly stone sits on. The isometric era exists to
// reveal HEIGHT — this is the height. One face is a 1-block staircase back
// toward the work strip; the other faces are sheer. Fixed Rapier colliders so
// the capsule can actually stand on it (it is a prop, not terrain — the world
// save is never mutated).

const ROCK = '#7f8a84';
const ROCK_DARK = '#5b6660';

interface SignalMesaProps {
  planetSize: number;
  terrainSeed: number;
}

interface MesaBlock {
  x: number; // along the approach axis (toward the strip is -x here)
  y: number; // height in blocks
  z: number;
  dark: boolean;
}

/** Pure layout: a 3×3 top at MESA_HEIGHT with a 1-block staircase on -approach. */
export function mesaBlockLayout(): MesaBlock[] {
  const blocks: MesaBlock[] = [];
  for (let y = 0; y < MESA_HEIGHT; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        blocks.push({ x, y, z, dark: (x + z + y) % 2 === 0 });
      }
    }
  }
  // Staircase: two treads leading up the strip-facing side (players arrive from -x).
  blocks.push({ x: -2, y: 0, z: 0, dark: false });
  blocks.push({ x: -2, y: 0, z: -1, dark: true });
  blocks.push({ x: -2, y: 1, z: 0, dark: true });
  blocks.push({ x: -3, y: 0, z: 0, dark: true });
  return blocks;
}

const SignalMesa: React.FC<SignalMesaProps> = ({ planetSize, terrainSeed }) => {
  const { position, blocks, quaternion } = useMemo(() => {
    const pose = getSignalMesaPose(planetSize, terrainSeed);
    const plane = getStorySidePlane(planetSize, terrainSeed);
    // The staircase faces back along the travel axis (the player's approach).
    const basis = new THREE.Matrix4().makeBasis(plane.travelAxis, plane.up, plane.depthAxis);
    return {
      position: pose.position,
      blocks: mesaBlockLayout(),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(basis)
    };
  }, [planetSize, terrainSeed]);

  const materials = useMemo(() => ({
    rock: new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.92 }),
    dark: new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 0.95 })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} quaternion={quaternion}>
      {blocks.map((b, i) => (
        <mesh
          key={i}
          geometry={box}
          material={b.dark ? materials.dark : materials.rock}
          position={[b.x, b.y + 0.5, b.z]}
        />
      ))}
    </RigidBody>
  );
};

export default SignalMesa;
