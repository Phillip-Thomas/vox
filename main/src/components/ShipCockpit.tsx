import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  createCockpitFrameGeometry,
  createCockpitInteriorGeometry,
  createCockpitLightGeometry,
  shipAccentColor,
  shipHullColors
} from '../utils/shipDesign.ts';
import { seededUnit } from '../utils/worldCoordinates.ts';
import {
  SHIP_BASE_FOV,
  getShipFlightFeedback
} from '../state/shipFlightFeedback.ts';

interface ShipCockpitProps {
  terrainSeed: number;
}

const CANOPY_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CANOPY_FRAGMENT = /* glsl */`
  uniform vec3 uAccent;
  uniform float uBoost;
  uniform float uTime;
  varying vec2 vUv;

  float line(float value, float width) {
    return 1.0 - smoothstep(width, width * 2.2, abs(value));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float edge = pow(clamp(abs(p.x), 0.0, 1.0), 3.5)
      + pow(clamp(abs(p.y), 0.0, 1.0), 4.0);
    float facet = line(fract((vUv.x + vUv.y * 0.42) * 3.0) - 0.5, 0.012)
      + line(fract((vUv.x - vUv.y * 0.55) * 4.0) - 0.5, 0.008);
    float scratch = line(sin(vUv.y * 620.0 + vUv.x * 31.0) * 0.5, 0.018)
      * smoothstep(0.62, 0.98, sin(vUv.x * 91.0 + uTime * 0.02) * 0.5 + 0.5);
    float pulse = 0.72 + 0.28 * sin(uTime * 3.0);
    vec3 color = mix(vec3(0.12, 0.2, 0.24), uAccent, 0.42 + uBoost * 0.24);
    color += uAccent * uBoost * edge * 0.2 * pulse;
    float alpha = 0.012 + edge * 0.075 + facet * 0.015 + scratch * 0.012;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.14));
  }
`;

/** Camera-child Kestrel flight deck: rigid at any ship velocity and one shared signal. */
export default function ShipCockpit({ terrainSeed }: ShipCockpitProps) {
  const rootRef = useRef<THREE.Group>(null);
  const holoRef = useRef<THREE.Mesh>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRailMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const gaugeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const throttleRef = useRef<THREE.Group>(null);
  const speedBarRef = useRef<THREE.Mesh>(null);
  const boostRingRef = useRef<THREE.Mesh>(null);
  const canopyMatRef = useRef<THREE.ShaderMaterial>(null);
  const cabinLightRef = useRef<THREE.PointLight>(null);
  const streakRef = useRef<THREE.InstancedMesh>(null);
  const streakMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const streakPhaseRef = useRef(0);

  const accent = useMemo(() => shipAccentColor(terrainSeed), [terrainSeed]);
  const warm = useMemo(() => new THREE.Color(0xff9a47).convertSRGBToLinear(), []);
  const colors = useMemo(() => shipHullColors(accent), [accent]);
  const frameGeometry = useMemo(() => createCockpitFrameGeometry(colors), [colors]);
  const interiorGeometry = useMemo(() => createCockpitInteriorGeometry(colors), [colors]);
  const lightGeometry = useMemo(() => createCockpitLightGeometry(colors), [colors]);
  const canopyUniforms = useMemo(() => ({
    uAccent: { value: accent.clone() },
    uBoost: { value: 0 },
    uTime: { value: 0 }
  }), [accent]);
  const streakDummy = useMemo(() => new THREE.Object3D(), []);
  const streakSeeds = useMemo(() => Array.from({ length: 72 }, (_, index) => {
    const angle = seededUnit(terrainSeed, 410 + index * 3) * Math.PI * 2;
    const radius = THREE.MathUtils.lerp(2.5, 15, seededUnit(terrainSeed, 411 + index * 3));
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.58,
      z: seededUnit(terrainSeed, 412 + index * 3) * 68
    };
  }), [terrainSeed]);

  useEffect(() => () => {
    frameGeometry.dispose();
    interiorGeometry.dispose();
    lightGeometry.dispose();
  }, [frameGeometry, interiorGeometry, lightGeometry]);

  useFrame(({ clock, size }, delta) => {
    const t = clock.elapsedTime;
    const flight = getShipFlightFeedback();
    const boost = flight.boost;

    // Scale X/Y only as FOV widens: scaling Z too would cancel in perspective
    // and fail to preserve screen anchors. Portrait compresses X further so the
    // pressure shell and controls remain visible in the narrow horizontal FOV.
    const fovScale = Math.tan(THREE.MathUtils.degToRad(flight.fov * 0.5))
      / Math.tan(THREE.MathUtils.degToRad(SHIP_BASE_FOV * 0.5));
    if (rootRef.current) {
      const aspect = size.width / Math.max(1, size.height);
      const portraitScaleX = Math.min(1, aspect / 1.42);
      rootRef.current.scale.set(fovScale * portraitScaleX, fovScale, 1);
      const vibration = flight.reducedMotion ? 0 : boost * 0.0035;
      rootRef.current.position.set(
        Math.sin(t * 43) * vibration,
        Math.sin(t * 51 + 1.7) * vibration,
        0
      );
    }

    if (holoRef.current) {
      holoRef.current.rotation.y += delta * (0.55 + flight.speedRatio * 2.5 + boost * 4.2);
      holoRef.current.rotation.x = 0.42 + Math.sin(t * 0.8) * 0.045;
    }
    if (holoMatRef.current) {
      holoMatRef.current.emissiveIntensity = 0.95 + flight.speedRatio * 0.8 + boost * 1.5;
    }
    if (gaugeMatRef.current) {
      gaugeMatRef.current.emissiveIntensity = 1.2 + boost * 1.8 + Math.sin(t * 4.2) * 0.08;
    }
    if (lightRailMatRef.current) {
      lightRailMatRef.current.color.setScalar(0.8 + boost * 0.75);
    }
    if (throttleRef.current) {
      throttleRef.current.rotation.x = THREE.MathUtils.lerp(
        throttleRef.current.rotation.x,
        -0.18 - flight.throttle * 0.48,
        1 - Math.exp(-12 * delta)
      );
    }
    if (speedBarRef.current) speedBarRef.current.scale.x = 0.08 + flight.speedRatio * 0.92;
    if (boostRingRef.current) {
      boostRingRef.current.rotation.z -= delta * (0.5 + boost * 7.5);
      boostRingRef.current.scale.setScalar(0.9 + boost * 0.18);
    }
    if (canopyMatRef.current) {
      canopyMatRef.current.uniforms.uBoost.value = boost;
      canopyMatRef.current.uniforms.uTime.value = t;
    }
    if (cabinLightRef.current) cabinLightRef.current.intensity = 1.15 + boost * 0.75;

    const streakMotion = flight.reducedMotion || flight.phase !== 'deep_space' ? 0 : flight.motion;
    streakPhaseRef.current += delta * (1.5 + flight.speedRatio * 20 + boost * 38);
    if (streakRef.current) {
      for (let index = 0; index < streakSeeds.length; index++) {
        const seed = streakSeeds[index];
        const cycle = (seed.z - streakPhaseRef.current + 6800) % 68;
        streakDummy.position.set(seed.x, seed.y, -6 - cycle);
        streakDummy.scale.set(1, 1, 0.45 + streakMotion * 7.5);
        streakDummy.updateMatrix();
        streakRef.current.setMatrixAt(index, streakDummy.matrix);
      }
      streakRef.current.instanceMatrix.needsUpdate = true;
    }
    if (streakMatRef.current) streakMatRef.current.opacity = streakMotion * 0.5;
  });

  return (
    <group name="ship-cockpit" userData={{ design: 'kestrel-flight-deck' }}>
      {/* One-draw near-dust field makes acceleration readable on every tier. */}
      <instancedMesh ref={streakRef} args={[undefined, undefined, streakSeeds.length]} frustumCulled={false}>
        <boxGeometry args={[0.016, 0.016, 0.7]} />
        <meshBasicMaterial
          ref={streakMatRef}
          color="#bfeeff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <group ref={rootRef} name="ship-cockpit-rig">
      <pointLight
        ref={cabinLightRef}
        position={[0, 0.35, -1.5]}
        intensity={1.15}
        distance={6.5}
        decay={2}
        color="#d8e5ef"
      />

      {/* Two static merged draws own the pressure shell and forward frame. */}
      <mesh geometry={interiorGeometry}>
        <meshStandardMaterial
          vertexColors
          flatShading
          roughness={0.62}
          metalness={0.34}
          emissive="#182532"
          emissiveIntensity={0.72}
        />
      </mesh>
      <mesh geometry={frameGeometry}>
        <meshStandardMaterial
          vertexColors
          flatShading
          roughness={0.46}
          metalness={0.6}
          emissive="#0b1118"
          emissiveIntensity={0.34}
        />
      </mesh>

      {/* One merged emissive draw: cyan navigation rails and amber engine rails. */}
      <mesh geometry={lightGeometry}>
        <meshBasicMaterial ref={lightRailMatRef} vertexColors toneMapped={false} />
      </mesh>

      {/* Cheap faceted glass; no transmission, refraction texture or extra pass. */}
      <mesh position={[0, 0.02, -3.92]} renderOrder={1}>
        <planeGeometry args={[8.4, 4.75, 1, 1]} />
        <shaderMaterial
          ref={canopyMatRef}
          uniforms={canopyUniforms}
          vertexShader={CANOPY_VERTEX}
          fragmentShader={CANOPY_FRAGMENT}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* Central velocity director and boost halo. */}
      <mesh ref={holoRef} position={[0, -0.61, -2.4]}>
        <torusGeometry args={[0.18, 0.018, 6, 12]} />
        <meshStandardMaterial
          ref={holoMatRef}
          color="#06121f"
          emissive={accent}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={boostRingRef} position={[0, -0.61, -2.405]}>
        <torusGeometry args={[0.245, 0.009, 4, 12]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>

      {/* Single animated throttle assembly; authored separately from static shell. */}
      <group ref={throttleRef} position={[-1.02, -1.17, -2.12]} rotation={[-0.18, 0, 0.1]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.09, 0.48, 0.09]} />
          <meshStandardMaterial color="#8994a3" metalness={0.78} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.47, 0]}>
          <boxGeometry args={[0.23, 0.1, 0.16]} />
          <meshStandardMaterial color="#222b35" emissive={accent} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Starboard engine gauge and port velocity bar keep feedback peripheral. */}
      <mesh position={[0.9, -0.91, -2.46]} rotation={[0.5, -0.12, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 6]} />
        <meshStandardMaterial
          ref={gaugeMatRef}
          color="#2a1208"
          emissive={warm}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={speedBarRef} position={[-0.87, -0.92, -2.47]} rotation={[0.48, 0.1, 0]}>
        <boxGeometry args={[0.62, 0.055, 0.035]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      </group>
    </group>
  );
}
