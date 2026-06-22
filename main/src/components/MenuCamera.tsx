import { useEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { setPlayerUp } from '../state/playerFrame';

interface MenuCameraProps {
  planetSize: number;
  /** Where the player will spawn — streamed so foliage/water fill the shot. */
  streamTarget?: THREE.Vector3;
  /** Publish the streamed surface point as the "player position" (EfficientScene
   *  passes its publishPlayerPosition) so grass/trees/water/colliders populate. */
  onPositionChange?: (position: THREE.Vector3) => void;
}

/**
 * Cinematic landing-screen camera. A `makeDefault` camera that slowly orbits the
 * planet (the orbit math is `OverviewCamera`'s) while it doubles as the loading
 * warm-up.
 *
 * Unlike OverviewCamera it does NOT null the fog — atmosphere reads as a beauty
 * shot here — and, like `AgentCamera`, it publishes a SURFACE point as the player
 * position (`AgentCamera.tsx` streamAt trick). Publishing the far orbiting camera
 * position instead would distance-cull grass/trees/water to an empty scene and
 * leave the spawn site cold when the player takes over.
 */
export default function MenuCamera({ planetSize, streamTarget, onPositionChange }: MenuCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const worldRadius = planetSize;
  // Pulled back + narrow fov so the cube-sphere reads as a planet/body with sky
  // around it (a beauty shot), rather than a wall of terrain.
  const dist = worldRadius * 3.6;
  const lift = worldRadius * 1.45;

  // Stream around the spawn site (top face) so the warm-up fills the world the
  // player will drop into. Fixed point — the camera orbits, the subject doesn't.
  useEffect(() => {
    const point = streamTarget?.clone() ?? new THREE.Vector3(0, worldRadius, 0);
    onPositionChange?.(point.clone());
    setPlayerUp(point);
  }, [streamTarget, worldRadius, onPositionChange]);

  useFrame(state => {
    const cam = cameraRef.current;
    if (!cam) return;
    const t = state.clock.elapsedTime * 0.05;
    cam.position.set(Math.cos(t) * dist, lift, Math.sin(t) * dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={40}
      near={0.1}
      far={planetSize * 120}
      position={[dist, lift, dist]}
    />
  );
}
