import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStoryStateSnapshot } from '../storyState.ts';
import { getWreckRelayPose } from './storyWorld.ts';

// --- The wreck relay -----------------------------------------------------------------
//
// The network's re-established voice: a salvaged console + antenna planted at the
// crash strip's impact site. Silent scenery until ch3-signal's klaxon; from then
// on its beacon breathes — chapter 4's set-piece anchor. Boxes only (it is made
// of the wreck), one emissive lamp driven per-frame, zero React churn.

export const wreckRelayHandle: { position: THREE.Vector3 | null } = { position: null };

const HULL = '#8d9a94';
const SCORCH = '#57635e';
const LAMP_LIVE = new THREE.Color('#ff5a3c');
const LAMP_DEAD = new THREE.Color('#20241f');

/** Beats from which the relay is awake (the klaxon and after). */
const LIVE_BEATS = new Set(['ch3-signal', 'ch4-vigil', 'ch4-arrival']);

interface WreckRelayProps {
  planetSize: number;
  terrainSeed: number;
}

const WreckRelay: React.FC<WreckRelayProps> = ({ planetSize, terrainSeed }) => {
  const pose = useMemo(() => getWreckRelayPose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  const lampRef = useRef<THREE.MeshStandardMaterial>(null);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pose.up);
    return q;
  }, [pose]);

  React.useEffect(() => {
    wreckRelayHandle.position = pose.position;
    return () => {
      wreckRelayHandle.position = null;
    };
  }, [pose]);

  useFrame(({ clock }) => {
    const lamp = lampRef.current;
    if (!lamp) return;
    const beat = getStoryStateSnapshot().beat;
    const live = beat != null && LIVE_BEATS.has(beat);
    if (!live) {
      lamp.emissive.copy(LAMP_DEAD);
      lamp.emissiveIntensity = 0.2;
      return;
    }
    // A slow institutional breath — not a friendly blink.
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2);
    lamp.emissive.copy(LAMP_LIVE);
    lamp.emissiveIntensity = 0.5 + pulse * 1.6;
  });

  return (
    <group position={pose.position} quaternion={quaternion}>
      {/* Console slab, tipped as if dragged from the wreck. */}
      <mesh position={[0, 0.55, 0]} rotation={[0.06, 0.3, -0.04]}>
        <boxGeometry args={[1.5, 1.1, 0.7]} />
        <meshStandardMaterial color={HULL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.18, 0.28]} rotation={[0.06, 0.3, -0.04]}>
        <boxGeometry args={[1.3, 0.36, 0.5]} />
        <meshStandardMaterial color={SCORCH} roughness={0.95} />
      </mesh>
      {/* Antenna mast + cross vane. */}
      <mesh position={[0.35, 1.9, -0.1]}>
        <boxGeometry args={[0.09, 1.9, 0.09]} />
        <meshStandardMaterial color={SCORCH} roughness={0.9} />
      </mesh>
      <mesh position={[0.35, 2.6, -0.1]}>
        <boxGeometry args={[0.8, 0.07, 0.07]} />
        <meshStandardMaterial color={HULL} roughness={0.8} />
      </mesh>
      {/* The beacon lamp. */}
      <mesh position={[0.35, 2.86, -0.1]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial ref={lampRef} color="#3a2f2c" emissive={LAMP_DEAD} emissiveIntensity={0.2} roughness={0.4} />
      </mesh>
    </group>
  );
};

export default WreckRelay;
