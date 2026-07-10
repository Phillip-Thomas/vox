import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStoryState } from '../storyState.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { beginA1 } from '../storyDirector.ts';
import { getAnomalyStonePose } from './storyWorld.ts';

// --- The anomaly stone ---------------------------------------------------------
//
// The first continuous form in a cubic world: a smooth, softly luminous stone at
// the survey edge. In the monochrome feed it reads as an impossibly clean shape
// among slabs; touching it ([F], live during ch1-anomaly) begins the A1 chroma
// awakening. It stays in the world afterwards — the first question, kept.

const TOUCH_DISTANCE = 4.5;

/** Module handle for the driver's survey-marker projection (heroTreeHandle pattern). */
export const anomalyStoneHandle: { position: THREE.Vector3 | null } = { position: null };

interface AnomalyStoneProps {
  planetSize: number;
  terrainSeed: number;
}

const AnomalyStone: React.FC<AnomalyStoneProps> = ({ planetSize, terrainSeed }) => {
  const story = useStoryState();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const pose = useMemo(() => getAnomalyStonePose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pose.up),
    [pose]
  );
  // High-detail icosahedron, gently squashed: unmistakably NOT a cube.
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.85, 3);
    geo.scale(1.15, 0.8, 1);
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Soft luminous pulse — the one thing in the feed that seems lit from within.
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const touchable = story.beat === 'ch1-anomaly';
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.6);
    material.emissiveIntensity = (touchable ? 0.34 : 0.16) + pulse * (touchable ? 0.30 : 0.10);
  });

  useEffect(() => {
    anomalyStoneHandle.position = pose.position;
    return () => {
      anomalyStoneHandle.position = null;
    };
  }, [pose]);

  // [F] Touch — only while the work order points here.
  useEffect(() => {
    if (story.beat !== 'ch1-anomaly') return;
    return registerStoryInteraction((_camera, position) => {
      if (position.distanceTo(pose.position) > TOUCH_DISTANCE) return null;
      return { id: 'story-anomaly', verb: 'Touch', perform: beginA1 };
    });
  }, [story.beat, pose]);

  return (
    <mesh ref={meshRef} geometry={geometry} position={pose.position} quaternion={quaternion}>
      <meshStandardMaterial
        ref={materialRef}
        color="#e8ecef"
        roughness={0.18}
        metalness={0.05}
        emissive="#dfe7ea"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

export default AnomalyStone;
