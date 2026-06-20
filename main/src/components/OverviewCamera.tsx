import { useEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OverviewCameraProps {
  /** Planet edge size (EfficientScene planetSize). */
  planetSize: number;
  /** When true, slowly orbit the planet so more of the ocean is visible. */
  orbit?: boolean;
}

/**
 * DEBUG overview camera (gated behind ?overview=1 in App).
 *
 * Mounts a non-interactive `makeDefault` camera high above the planet looking at
 * its centre, BYPASSING the pointer-lock FPS player (which is not mounted in
 * overview mode). This is purely a verification aid — it lets the user (and a
 * headless screenshot) confirm the ocean is visible and reads as water without
 * having to walk around. It has NO effect on normal play because it is only
 * rendered when ?overview=1 is present and the player is mounted otherwise.
 */
export default function OverviewCamera({ planetSize, orbit = true }: OverviewCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const scene = useThree(state => state.scene);

  // Normal-play fog is intentionally thick (great at ground level) but from this
  // distant orbit it fogs out the whole planet. Overview is a debug/inspection
  // view only, so suppress scene fog while it's mounted and restore on unmount.
  // (SkyController installs scene.fog earlier in the tree, so this effect wins.)
  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = null;
    return () => {
      scene.fog = previousFog;
    };
  }, [scene]);
  // World units: voxel coords are scaled by VOXEL_SCALE=2, so the planet's world
  // half-extent is ~planetSize (planetSize/2 coords * 2). Pull the camera back to
  // ~2.6x that and lift it so we look down onto the surface at an angle that
  // shows both the curved horizon and the ocean basins.
  const worldRadius = planetSize; // planetSize/2 coords * VOXEL_SCALE(2)
  const dist = worldRadius * 2.6;
  const lift = worldRadius * 1.7;

  useFrame(state => {
    const cam = cameraRef.current;
    if (!cam) return;
    const t = orbit ? state.clock.elapsedTime * 0.08 : 0.6;
    cam.position.set(Math.cos(t) * dist, lift, Math.sin(t) * dist);
    cam.lookAt(0, 0, 0);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={55}
      near={1}
      far={planetSize * 8}
      position={[dist, lift, dist]}
    />
  );
}
