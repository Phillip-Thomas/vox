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
import { createCockpitSurfaceMaterial } from '../utils/cockpitSurface.ts';
import {
  createCockpitScreenGeometry,
  createCockpitScreenMaterial
} from '../utils/cockpitScreens.ts';
import { seededUnit } from '../utils/worldCoordinates.ts';
import {
  SHIP_BASE_FOV,
  getShipFlightFeedback
} from '../state/shipFlightFeedback.ts';
import { getShipCockpitViewportLayout } from './shipCockpitLayout.ts';
import type { FlightPhase } from '../state/spaceFlight.ts';

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

// The canopy is the only transparent surface the pilot looks through for the
// whole game, so it earns real treatment — but it also covers most of the
// screen, which makes it the one place fill rate genuinely matters. Everything
// here is closed-form: no transmission pass, no refraction render target, no
// second draw. What sells it is not physical accuracy but the four things a
// real canopy always shows: the coating's fresnel edge, the cabin reflected
// back at you, accumulated abrasion in the wiper arc, and ionisation when you
// push the airframe.
const CANOPY_FRAGMENT = /* glsl */`
  uniform vec3 uAccent;
  uniform vec3 uAmber;
  uniform float uBoost;
  uniform float uSpeed;
  uniform float uTime;
  varying vec2 vUv;

  float line(float value, float width) {
    return 1.0 - smoothstep(width, width * 2.2, abs(value));
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;

    // Grazing angle stands in for fresnel: the further from the boresight, the
    // more the coating turns into a mirror.
    float edge = pow(clamp(abs(p.x), 0.0, 1.0), 3.5)
      + pow(clamp(abs(p.y), 0.0, 1.0), 4.0);
    float fresnel = clamp(edge, 0.0, 1.0);

    // Structural facets of the crystal canopy.
    float facet = line(fract((vUv.x + vUv.y * 0.42) * 3.0) - 0.5, 0.012)
      + line(fract((vUv.x - vUv.y * 0.55) * 4.0) - 0.5, 0.008);

    // Abrasion: fine scratches concentrated in a wiper arc swept from the sill,
    // which is where a canopy actually wears.
    float arc = length(p * vec2(1.0, 1.35) - vec2(0.0, -1.25));
    float wiperBand = 1.0 - smoothstep(0.18, 0.42, abs(arc - 1.35));
    float scratch = line(sin(vUv.y * 620.0 + vUv.x * 31.0) * 0.5, 0.018) * 0.5
      + line(sin(arc * 260.0 + vUv.x * 12.0) * 0.5, 0.03) * wiperBand;

    // Dust and micrometeorite pitting: sparse, static, and the reason the glass
    // reads as used rather than newly fitted.
    vec2 grit = floor(vUv * 220.0);
    float pit = step(0.9965, hash21(grit)) * 0.9
      + step(0.998, hash21(grit + 7.3)) * 0.6;

    // Cabin reflection. Three broad shapes are enough for the eye to accept it:
    // the lit dash below, and the two rim diagonals converging overhead.
    float dashGlow = smoothstep(0.55, -0.25, p.y) * smoothstep(1.0, 0.25, abs(p.x));
    float rimL = line(p.y - (-0.35 - p.x * 0.9), 0.06) * step(p.x, 0.0);
    float rimR = line(p.y - (-0.35 + p.x * 0.9), 0.06) * step(0.0, p.x);
    vec3 reflection = uAmber * dashGlow * 0.55 + uAccent * (rimL + rimR) * 0.5;

    float pulse = 0.72 + 0.28 * sin(uTime * 3.0);
    vec3 color = mix(vec3(0.12, 0.2, 0.24), uAccent, 0.42 + uBoost * 0.24);
    color += uAccent * uBoost * edge * 0.2 * pulse;
    color += reflection * (0.35 + fresnel * 0.65);

    // Leading-edge ionisation: heat building where the airframe meets the flow.
    float leading = smoothstep(0.35, 1.0, -p.y) * smoothstep(0.2, 0.9, abs(p.x));
    color += mix(uAmber, vec3(0.75, 0.9, 1.0), 0.4)
      * leading * uBoost * (0.55 + 0.45 * sin(uTime * 11.0 + p.x * 6.0));

    float alpha = 0.012
      + edge * 0.075
      + facet * 0.015
      + scratch * 0.014
      + pit * 0.05
      + dashGlow * 0.02
      + uBoost * leading * 0.05
      + uSpeed * fresnel * 0.012;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.2));
  }
`;

/** Camera-child Kestrel flight deck: rigid at any ship velocity and one shared signal. */
export default function ShipCockpit({ terrainSeed }: ShipCockpitProps) {
  const rootRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Group>(null);
  const instrumentRef = useRef<THREE.Group>(null);
  const holoRef = useRef<THREE.Mesh>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRailMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const gaugeNeedleRef = useRef<THREE.Mesh>(null);
  const gaugeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const throttleRef = useRef<THREE.Group>(null);
  const stickRef = useRef<THREE.Group>(null);
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
  const screenGeometry = useMemo(() => createCockpitScreenGeometry(), []);

  // One material lights every solid surface in the cabin, and one more drives
  // every display. Two shaders, two uniform sets, no per-mesh state changes.
  const surface = useMemo(
    () => createCockpitSurfaceMaterial(accent, warm),
    [accent, warm]
  );
  const screens = useMemo(
    () => createCockpitScreenMaterial(accent, warm),
    [accent, warm]
  );

  const canopyUniforms = useMemo(() => ({
    uAccent: { value: accent.clone() },
    uAmber: { value: warm.clone() },
    uBoost: { value: 0 },
    uSpeed: { value: 0 },
    uTime: { value: 0 }
  }), [accent, warm]);

  // Light arriving through the canopy, per flight phase. It is the cabin's key,
  // so changing it is what makes leaving atmosphere feel like a change of room.
  const canopyLightByPhase = useMemo<Partial<Record<FlightPhase, THREE.Color>>>(() => ({
    deep_space: new THREE.Color(0x8fb0d6).convertSRGBToLinear(),
    descent: new THREE.Color(0xd2e2f6).convertSRGBToLinear(),
    surface: new THREE.Color(0xf2f6fb).convertSRGBToLinear(),
    approach: new THREE.Color(0xb4cde8).convertSRGBToLinear()
  }), []);
  const canopyLightRef = useRef(new THREE.Color(0x8fb4d8).convertSRGBToLinear());

  // Attitude is read off the live camera basis rather than plumbed through the
  // flight state: the instruments must agree with what the pilot sees, and the
  // camera IS what the pilot sees.
  const previousQuat = useRef(new THREE.Quaternion());
  const stickDeflect = useRef({ pitch: 0, roll: 0 });
  const camForward = useMemo(() => new THREE.Vector3(), []);
  const camUp = useMemo(() => new THREE.Vector3(), []);
  const camQuat = useMemo(() => new THREE.Quaternion(), []);
  const deltaQuat = useMemo(() => new THREE.Quaternion(), []);
  const deltaEuler = useMemo(() => new THREE.Euler(), []);

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
    screenGeometry.dispose();
  }, [frameGeometry, interiorGeometry, lightGeometry, screenGeometry]);

  useEffect(() => () => {
    surface.material.dispose();
    screens.material.dispose();
  }, [surface, screens]);

  useFrame(({ clock, size, camera }, delta) => {
    const t = clock.elapsedTime;
    const flight = getShipFlightFeedback();
    const boost = flight.boost;

    // Scale X/Y only as FOV widens: scaling Z too would cancel in perspective
    // and fail to preserve screen anchors. The pressure shell and instruments
    // have separate portrait floors: the shell crops toward the viewport edges
    // instead of collapsing its pillars into the forward flight aperture.
    const fovScale = Math.tan(THREE.MathUtils.degToRad(flight.fov * 0.5))
      / Math.tan(THREE.MathUtils.degToRad(SHIP_BASE_FOV * 0.5));
    const layout = getShipCockpitViewportLayout(size.width, size.height);
    if (shellRef.current) {
      shellRef.current.scale.set(fovScale * layout.shellScaleX, fovScale, 1);
    }
    if (instrumentRef.current) {
      instrumentRef.current.scale.set(fovScale * layout.instrumentScaleX, fovScale, 1);
    }
    if (rootRef.current) {
      // The camera-child root owns rigidity/vibration only. Reasserting identity
      // also clears a stale whole-rig portrait scale during hot replacement.
      rootRef.current.scale.set(1, 1, 1);
      const vibration = flight.reducedMotion ? 0 : boost * 0.0035;
      rootRef.current.position.set(
        Math.sin(t * 43) * vibration,
        Math.sin(t * 51 + 1.7) * vibration,
        0
      );
    }

    // --- attitude + stick deflection from the live camera basis --------------
    camera.getWorldQuaternion(camQuat);
    camForward.set(0, 0, -1).applyQuaternion(camQuat);
    camUp.set(0, 1, 0).applyQuaternion(camQuat);
    const pitch = Math.asin(THREE.MathUtils.clamp(camForward.y, -1, 1));
    const roll = Math.atan2(camUp.x, camUp.y);

    // Angular rate this frame drives the stick, so the control the pilot is
    // holding actually moves with the input instead of idling in the corner.
    deltaQuat.copy(previousQuat.current).invert().premultiply(camQuat);
    deltaEuler.setFromQuaternion(deltaQuat, 'YXZ');
    previousQuat.current.copy(camQuat);
    const rate = Math.max(delta, 1 / 240);
    const follow = 1 - Math.exp(-9 * delta);
    stickDeflect.current.pitch += (
      THREE.MathUtils.clamp(deltaEuler.x / rate, -2.4, 2.4) * 0.16 - stickDeflect.current.pitch
    ) * follow;
    stickDeflect.current.roll += (
      THREE.MathUtils.clamp(-deltaEuler.y / rate, -2.4, 2.4) * 0.2 - stickDeflect.current.roll
    ) * follow;

    // --- shared cabin uniforms ----------------------------------------------
    const target = canopyLightByPhase[flight.phase] ?? canopyLightByPhase.approach!;
    canopyLightRef.current.lerp(target, 1 - Math.exp(-2.5 * delta));
    const surfaceUniforms = surface.uniforms;
    surfaceUniforms.uTime.value = t;
    surfaceUniforms.uBoost.value = boost;
    surfaceUniforms.uCanopy.value.copy(canopyLightRef.current);
    surfaceUniforms.uCabin.value = 1 + boost * 0.12;

    const screenUniforms = screens.uniforms;
    screenUniforms.uTime.value = t;
    screenUniforms.uThrottle.value = flight.throttle;
    screenUniforms.uSpeed.value = flight.speedRatio;
    screenUniforms.uBoost.value = boost;
    screenUniforms.uPitch.value = pitch;
    screenUniforms.uRoll.value = roll;
    screenUniforms.uGain.value = flight.reducedMotion ? 0.72 : 1;

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
    if (gaugeNeedleRef.current) {
      // Sweep across a 240-degree dial, the way an engine gauge reads.
      gaugeNeedleRef.current.rotation.z = THREE.MathUtils.lerp(
        gaugeNeedleRef.current.rotation.z,
        2.1 - (flight.speedRatio * 0.75 + boost * 0.25) * 4.2,
        1 - Math.exp(-8 * delta)
      );
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
    if (stickRef.current) {
      stickRef.current.rotation.x = stickDeflect.current.pitch;
      stickRef.current.rotation.z = stickDeflect.current.roll;
    }
    if (speedBarRef.current) speedBarRef.current.scale.x = 0.08 + flight.speedRatio * 0.92;
    if (boostRingRef.current) {
      boostRingRef.current.rotation.z -= delta * (0.5 + boost * 7.5);
      boostRingRef.current.scale.setScalar(0.9 + boost * 0.18);
    }
    if (cabinLightRef.current) cabinLightRef.current.intensity = 1.3 + boost * 0.65;
    if (canopyMatRef.current) {
      canopyMatRef.current.uniforms.uBoost.value = boost;
      canopyMatRef.current.uniforms.uSpeed.value = flight.speedRatio;
      canopyMatRef.current.uniforms.uTime.value = t;
    }

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
        {/* The merged shell and frame are lit analytically inside their own
            shader; this practical remains for the hand controls and gauges,
            which are still standard-material props. */}
        <pointLight
          ref={cabinLightRef}
          position={[0, 0.35, -1.5]}
          intensity={1.3}
          distance={6.5}
          decay={2}
          color="#d8e5ef"
        />

        <group ref={shellRef} name="ship-cockpit-pressure-shell">
          {/* Two static merged draws own the pressure shell and forward frame.
              Both use the SAME shader instance, so the pair costs one material
              bind: the cabin's whole surface treatment is a single program. */}
          <mesh geometry={interiorGeometry} material={surface.material} />
          <mesh geometry={frameGeometry} material={surface.material} />

          {/* Every MFD in the cabin, one draw. */}
          <mesh
            name="ship-cockpit-displays"
            geometry={screenGeometry}
            material={screens.material}
          />

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
        </group>

        <group ref={instrumentRef} name="ship-cockpit-instruments">
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

          {/* Port throttle quadrant. The lever is no longer a bare stick: it has
              a slotted housing to travel in and a shaped grip, so its position
              in the slot reads as a setting rather than a floating prop. */}
          <group position={[-1.02, -1.17, -2.12]} rotation={[-0.18, 0, 0.1]}>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.3, 0.14, 0.46]} />
              <meshStandardMaterial color="#2b333d" metalness={0.4} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[0.11, 0.03, 0.4]} />
              <meshStandardMaterial color="#0a0d11" metalness={0.1} roughness={0.9} />
            </mesh>
            {/* Detent marks along the quadrant slot. */}
            {[-0.16, -0.05, 0.06, 0.17].map(z => (
              <mesh key={z} position={[0.14, 0.14, z]}>
                <boxGeometry args={[0.05, 0.02, 0.02]} />
                <meshStandardMaterial color="#c3ccd6" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
            <group ref={throttleRef}>
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[0.07, 0.44, 0.07]} />
                <meshStandardMaterial color="#8994a3" metalness={0.78} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.53, 0]}>
                <boxGeometry args={[0.21, 0.12, 0.17]} />
                <meshStandardMaterial color="#1e252d" metalness={0.15} roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.6, -0.05]}>
                <boxGeometry args={[0.1, 0.04, 0.05]} />
                <meshStandardMaterial color="#222b35" emissive={accent} emissiveIntensity={0.5} />
              </mesh>
            </group>
          </group>

          {/* Starboard side-stick, offset off the boresight so it never sits in
              the flight aperture. It deflects with the pilot's actual angular
              input, which is the cheapest possible proof the cabin is flying. */}
          <group position={[0.72, -1.44, -1.86]}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.13, 0.17, 0.12, 8]} />
              <meshStandardMaterial color="#2b333d" metalness={0.45} roughness={0.5} />
            </mesh>
            <group ref={stickRef} position={[0, 0.06, 0]}>
              <mesh position={[0, 0.04, 0]}>
                <cylinderGeometry args={[0.1, 0.13, 0.1, 8]} />
                <meshStandardMaterial color="#0d1116" roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.24, 0]}>
                <cylinderGeometry args={[0.045, 0.05, 0.32, 8]} />
                <meshStandardMaterial color="#8994a3" metalness={0.8} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0.46, -0.01]} rotation={[0.12, 0, 0]}>
                <boxGeometry args={[0.12, 0.2, 0.14]} />
                <meshStandardMaterial color="#1a2028" metalness={0.1} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.55, 0.05]} rotation={[0.35, 0, 0]}>
                <boxGeometry args={[0.06, 0.03, 0.04]} />
                <meshStandardMaterial color="#151a20" emissive={accent} emissiveIntensity={0.7} />
              </mesh>
            </group>
          </group>

          {/* Starboard engine gauge: a bezelled dial with a needle that sweeps
              with drive output, in place of the bare emissive puck. */}
          <group position={[0.9, -0.91, -2.46]} rotation={[0.5, -0.12, 0]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.11, 0.04, 12]} />
              <meshStandardMaterial color="#39414c" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.085, 12]} />
              <meshStandardMaterial
                ref={gaugeMatRef}
                color="#2a1208"
                emissive={warm}
                emissiveIntensity={1.2}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh ref={gaugeNeedleRef} position={[0, 0.032, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[0.075, 0.012, 0.004]} />
              <meshBasicMaterial color="#ffe6c8" toneMapped={false} />
            </mesh>
          </group>

          {/* Port velocity bar, now running in a machined track. */}
          <group position={[-0.87, -0.92, -2.47]} rotation={[0.48, 0.1, 0]}>
            <mesh position={[0, -0.005, -0.012]}>
              <boxGeometry args={[0.68, 0.085, 0.03]} />
              <meshStandardMaterial color="#2b333d" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh ref={speedBarRef}>
              <boxGeometry args={[0.62, 0.055, 0.035]} />
              <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
