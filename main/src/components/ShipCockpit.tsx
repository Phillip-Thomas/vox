import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  createCockpitFrameGeometry,
  shipAccentColor,
  shipHullColors
} from '../utils/shipDesign.ts';

interface ShipCockpitProps {
  /** Live thrust 0..1 (boost = 1) written by ShipController's frame loop. */
  thrustRef: React.RefObject<number>;
  terrainSeed: number;
}

/**
 * First-person cockpit: you sit inside the same hex-faceted crystal canopy the
 * exterior shows. A single merged frame draw (hex rim + shallow-V dash + sills
 * + stick/throttle silhouettes) plus a few emissive instruments; the central
 * holo ring spins and brightens with thrust.
 *
 * Everything sits at z in [-2.2 .. -3.8] in camera space (near plane 1, never
 * clips) hugging the frustum edges so the center of the view stays clear.
 *
 * MUST be rendered as a CHILD of the flight camera (ShipController nests it
 * inside its <PerspectiveCamera>). A previous version synced a world-space
 * group to the camera from its own useFrame — that runs a frame behind the
 * controller's camera write, which at flight speed (hundreds of wu/s) lagged
 * the frame by several units every frame and flickered. Scene-graph parenting
 * is rigid by construction: zero lag at any speed or callback order.
 */
export default function ShipCockpit({ thrustRef, terrainSeed }: ShipCockpitProps) {
  const holoRef = useRef<THREE.Mesh>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const gaugeLeftRef = useRef<THREE.MeshStandardMaterial>(null);
  const gaugeRightRef = useRef<THREE.MeshStandardMaterial>(null);

  const accent = useMemo(() => shipAccentColor(terrainSeed), [terrainSeed]);
  const warm = useMemo(() => new THREE.Color(0xff8a3d).convertSRGBToLinear(), []);
  const frameGeometry = useMemo(() => createCockpitFrameGeometry(shipHullColors(accent)), [accent]);

  useEffect(() => {
    return () => {
      frameGeometry.dispose();
    };
  }, [frameGeometry]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const thrust = Math.max(0, Math.min(1, thrustRef.current ?? 0));
    // Holo nav ring: idles slow and dim, spins up and brightens under thrust.
    if (holoRef.current) {
      holoRef.current.rotation.y += delta * (0.6 + thrust * 5.2);
      holoRef.current.rotation.x = 0.42 + Math.sin(t * 0.8) * 0.05;
    }
    if (holoMatRef.current) {
      holoMatRef.current.emissiveIntensity = 0.9 + thrust * 1.6 + Math.sin(t * 2.3) * 0.12;
    }
    // Gauges flicker faintly, a touch livelier with thrust.
    if (gaugeLeftRef.current) {
      gaugeLeftRef.current.emissiveIntensity = 1.1 + thrust * 0.6 + Math.sin(t * 5.1) * 0.1;
    }
    if (gaugeRightRef.current) {
      gaugeRightRef.current.emissiveIntensity = 1.0 + thrust * 0.9 + Math.sin(t * 3.7 + 1.4) * 0.12;
    }
  });

  return (
    <group name="ship-cockpit">
      {/* Dim interior cabin light so the frame stays readable in deep space
          (instrument glow alone leaves it a silhouette). */}
      <pointLight position={[0, 0.4, -1.8]} intensity={1.1} distance={5} decay={2} color="#cfd8e6" />

      {/* Frame: one merged flat-shaded vertex-colored draw. */}
      <mesh geometry={frameGeometry}>
        <meshStandardMaterial vertexColors flatShading roughness={0.52} metalness={0.55} />
      </mesh>

      {/* Central holo nav ring above the binnacle (hex, like everything else). */}
      <mesh ref={holoRef} position={[0, -0.62, -2.42]}>
        <torusGeometry args={[0.17, 0.018, 6, 6]} />
        <meshStandardMaterial
          ref={holoMatRef}
          color="#06121f"
          emissive={accent}
          emissiveIntensity={1}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[0, -0.62, -2.42]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#06121f" emissive={accent} emissiveIntensity={1.6} />
      </mesh>

      {/* Port gauge pod: two instruments. */}
      <mesh position={[-0.78, -0.9, -2.5]} rotation={[0.5, 0.12, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.05, 6]} />
        <meshStandardMaterial ref={gaugeLeftRef} color="#0b2740" emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-1.06, -0.94, -2.56]} rotation={[0.5, 0.2, 0]}>
        <boxGeometry args={[0.3, 0.1, 0.04]} />
        <meshStandardMaterial color="#06180f" emissive="#46ff9b" emissiveIntensity={0.9} />
      </mesh>

      {/* Starboard gauge pod. */}
      <mesh position={[0.78, -0.9, -2.5]} rotation={[0.5, -0.12, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.05, 6]} />
        <meshStandardMaterial ref={gaugeRightRef} color="#2a0b0b" emissive={warm} emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[1.06, -0.94, -2.56]} rotation={[0.5, -0.2, 0]}>
        <boxGeometry args={[0.3, 0.1, 0.04]} />
        <meshStandardMaterial color="#0b2740" emissive={accent} emissiveIntensity={0.8} />
      </mesh>

      {/* Overhead status pips on the spine stub. */}
      <mesh position={[-0.12, 1.47, -2.5]}>
        <sphereGeometry args={[0.028, 6, 4]} />
        <meshStandardMaterial color="#06180f" emissive="#46ff9b" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.12, 1.47, -2.5]}>
        <sphereGeometry args={[0.028, 6, 4]} />
        <meshStandardMaterial color="#0b2740" emissive={accent} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
