import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getFeedRuntime } from '../feedRuntime.ts';
import { getStorySidePlane } from './storyWorld.ts';

// --- The descent pod ---------------------------------------------------------------
//
// The crash landing, seen from the ground in the raster lens: the pod streaks
// down the 2D frame trailing debris cubes, hits the strip in a white flash, and
// stays as a smoking wreck for the rest of chapter 1 — the camera never cuts;
// the pod falls INTO the frame the player is about to walk. Driven entirely by
// feedRuntime.descent (-1 idle, 0..1 falling, >1 landed), written by the
// director's descent timeline. Boxes only — the era permits nothing else.

const HULL = '#9aa8a1';
const SCORCH = '#5d6a64';
const TRAIL_CUBES = 6;
const SMOKE_CUBES = 4;

interface DescentPodProps {
  planetSize: number;
  terrainSeed: number;
}

const DescentPod: React.FC<DescentPodProps> = ({ planetSize, terrainSeed }) => {
  const podRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.Group>(null);

  const path = useMemo(() => {
    const plane = getStorySidePlane(planetSize, terrainSeed);
    const impact = plane.origin.clone().addScaledVector(plane.travelAxis, -5).addScaledVector(plane.up, 0.4);
    // Enters the visible frame early (side camera: ~±10u horizontal, ~+7u sky
    // at the focus plane) and streaks the full diagonal before impact.
    const start = impact.clone().addScaledVector(plane.travelAxis, -19).addScaledVector(plane.up, 13);
    return { plane, impact, start };
  }, [planetSize, terrainSeed]);

  const materials = useMemo(() => ({
    hull: new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.7 }),
    scorch: new THREE.MeshStandardMaterial({ color: SCORCH, roughness: 0.95, transparent: true })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame(({ clock }) => {
    const pod = podRef.current;
    const trail = trailRef.current;
    const smoke = smokeRef.current;
    if (!pod || !trail || !smoke) return;
    const t = getFeedRuntime().descent;

    if (t < 0) {
      pod.visible = false;
      trail.visible = false;
      smoke.visible = false;
      return;
    }

    const falling = t < 1;
    pod.visible = true;
    trail.visible = falling;
    smoke.visible = !falling;

    // Gravity-flavored ease: slow entry, hard arrival.
    const fallT = Math.min(1, t);
    const k = fallT * fallT * (0.4 + 0.6 * fallT);
    pod.position.lerpVectors(path.start, path.impact, k);
    pod.rotation.z = falling ? -0.5 + k * 0.65 : 0.12; // tumbles in, rests skewed
    pod.rotation.x = falling ? Math.sin(fallT * 9) * 0.08 : 0;

    if (falling) {
      // Debris cubes strung back along the incoming path, jittering.
      const children = trail.children;
      for (let i = 0; i < children.length; i++) {
        const back = (i + 1) / (children.length + 1);
        const cube = children[i];
        cube.position.lerpVectors(path.start, path.impact, Math.max(0, k - back * 0.35));
        cube.position.x += Math.sin(clock.elapsedTime * 13 + i * 2.1) * 0.5;
        cube.position.y += Math.cos(clock.elapsedTime * 11 + i * 1.7) * 0.5 + back * 2.2;
        cube.scale.setScalar(0.24 + 0.2 * (1 - back));
      }
    } else {
      // Wreck smoke: gray cubes rising on a slow loop.
      const children = smoke.children;
      for (let i = 0; i < children.length; i++) {
        const cube = children[i];
        const cycle = (clock.elapsedTime * 0.35 + i / children.length) % 1;
        cube.position.copy(path.impact);
        cube.position.y += 1.2 + cycle * 4.5;
        cube.position.x += Math.sin(clock.elapsedTime * 0.8 + i * 2.4) * 0.5;
        cube.scale.setScalar(0.36 * (1 - cycle) + 0.08);
        (cube as THREE.Mesh).material = materials.scorch;
        materials.scorch.opacity = 0.75;
      }
    }
  });

  return (
    <>
      <group ref={podRef} visible={false}>
        {/* hull */}
        <mesh geometry={box} material={materials.hull} scale={[2.2, 1.5, 1.5]} />
        {/* scorched nose */}
        <mesh geometry={box} material={materials.scorch} scale={[0.9, 1.1, 1.1]} position={[-1.4, -0.1, 0]} />
        {/* fin */}
        <mesh geometry={box} material={materials.hull} scale={[0.7, 0.9, 0.24]} position={[1.1, 0.9, 0]} />
      </group>
      <group ref={trailRef} visible={false}>
        {Array.from({ length: TRAIL_CUBES }, (_, i) => (
          <mesh key={i} geometry={box} material={materials.scorch} />
        ))}
      </group>
      <group ref={smokeRef} visible={false}>
        {Array.from({ length: SMOKE_CUBES }, (_, i) => (
          <mesh key={i} geometry={box} material={materials.scorch} />
        ))}
      </group>
    </>
  );
};

export default DescentPod;
