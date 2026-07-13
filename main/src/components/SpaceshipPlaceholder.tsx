import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { setBoardable, setShipPosition } from '../state/shipProximity.ts';
import {
  createShipCanopyGeometry,
  createShipHullGeometry,
  shipAccentColor,
  shipHullColors,
  shipParkedOrientation
} from '../utils/shipDesign.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { resolveSafeShipBoardingPosition } from '../utils/spawnValidation.ts';

const BOARD_RANGE = 3.5;
const BOARD_RANGE_SQ = BOARD_RANGE * BOARD_RANGE;

interface SpaceshipPlaceholderProps {
  position: THREE.Vector3;
  planetSize?: number;
  terrainSeed: number;
  activeApproach: boolean;
  /** Live player position (from EfficientScene) for the boarding proximity check. */
  playerPosition?: THREE.Vector3;
  /**
   * Whether this is the player's live, boardable ship (default) or a static wreck
   * (false). A wreck publishes no boardable/ship-position state, so on-foot [F]
   * never offers to enter it — it's set dressing, not a vehicle.
   */
  interactive?: boolean;
  /** Radians of settle tilt for a crashed attitude (0 = level parked, default). */
  crashedTilt?: number;
}

/**
 * The player's parked starfighter — a hex-faceted mini one-seater that perches
 * on kinked insect legs at its landing rest height (see utils/shipDesign.ts for
 * the design language). One merged flat-shaded hull draw + a faceted crystal
 * canopy + emissive thruster/beacon accents that breathe while parked.
 */
export default function SpaceshipPlaceholder({
  position,
  planetSize = 50,
  terrainSeed,
  activeApproach,
  playerPosition,
  interactive = true,
  crashedTilt = 0
}: SpaceshipPlaceholderProps) {
  const { phase, controlMode } = useSpaceFlight();
  const boardableRef = useRef(false);
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null);
  const validationRef = useRef({
    editVersion: -1,
    terrainSeed: Number.NaN,
    position: new THREE.Vector3(Infinity, Infinity, Infinity),
    safe: false
  });

  // Boarding is only offered while on foot on the surface.
  const boardable = phase === 'surface' && controlMode === 'fps';

  const accent = useMemo(
    () => shipAccentColor(terrainSeed, activeApproach),
    [activeApproach, terrainSeed]
  );
  const spawnTerrain = useMemo(() => {
    const generator = getWorldGen(planetSize, terrainSeed).generator;
    return {
      shouldVoxelExist: (x: number, y: number, z: number) =>
        generator.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) =>
        voxelSystem.isDeleted(x, y, z) || generator.isWaterVoxel(x, y, z),
      generateBlockForPosition: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z)
    };
  }, [planetSize, terrainSeed]);
  const hullGeometry = useMemo(() => createShipHullGeometry(shipHullColors(accent)), [accent]);
  const canopyGeometry = useMemo(() => createShipCanopyGeometry(), []);
  // Upright on the supporting CUBE FACE normal, nose along the direction the
  // cockpit faced at touchdown — never radial up (which visibly leans toward
  // cube edges) or a fixed world rotation (which fails on non-top faces).
  const parkedQuat = useMemo(() => {
    const q = shipParkedOrientation(position);
    // Crashed attitude: settle the hull off level — a pitch dug into the impact
    // plus a roll skew, in the ship's local frame (post-multiplied so it reads
    // relative to the surface-normal parked orientation, on any planet face).
    if (crashedTilt) {
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(crashedTilt * 0.7, 0, crashedTilt)));
    }
    return q;
  }, [position, crashedTilt]);

  useEffect(() => {
    return () => {
      hullGeometry.dispose();
    };
  }, [hullGeometry]);
  useEffect(() => {
    return () => {
      canopyGeometry.dispose();
    };
  }, [canopyGeometry]);

  // Proximity check → publish "boardable" for the on-foot interaction resolver, which
  // owns the unified "[F] Enter Ship" prompt + the F key (no one-off listener/prompt here).
  useFrame(({ clock }) => {
    // A static wreck never offers boarding — skip the proximity publish entirely.
    if (interactive) {
      const editVersion = voxelSystem.getEditVersion();
      if (
        validationRef.current.editVersion !== editVersion
        || validationRef.current.terrainSeed !== terrainSeed
        || validationRef.current.position.distanceToSquared(position) > 0.001
      ) {
        validationRef.current.editVersion = editVersion;
        validationRef.current.terrainSeed = terrainSeed;
        validationRef.current.position.copy(position);
        validationRef.current.safe = resolveSafeShipBoardingPosition(
          spawnTerrain,
          planetSize,
          position,
          0
        ) !== null;
      }
      const close = validationRef.current.safe
        && boardable
        && !!playerPosition
        && playerPosition.distanceToSquared(position) <= BOARD_RANGE_SQ;
      if (close !== boardableRef.current) {
        boardableRef.current = close;
        setBoardable(close);
      }
    }
    // Idle breath on the thrusters + a slow counter-phased beacon blink; both
    // brighten when the approach highlight is active.
    const t = clock.elapsedTime;
    const breathe = 0.55 + 0.45 * Math.sin(t * 1.6);
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = (activeApproach ? 1.6 : 0.7) + breathe * 0.5;
    }
    if (beaconRef.current) {
      beaconRef.current.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 2.2 + 2.1)) * (activeApproach ? 2.2 : 1.3);
    }
  });

  useEffect(() => {
    // The wreck is not a ship the HUD/interaction layer should track or board.
    if (!interactive) return;
    setShipPosition(position);
    return () => {
      setShipPosition(null);
      setBoardable(false);
    };
  }, [position, interactive]);

  // While flying (controlMode==='flight') the ship IS the avatar / cockpit; hide
  // the parked exterior so it doesn't float in the cockpit view. It reappears
  // once landed back on foot.
  if (controlMode === 'flight') return null;

  return (
    <group
      name="ship-exterior"
      position={[position.x, position.y, position.z]}
      quaternion={parkedQuat}
    >
      {/* Hull: single merged flat-shaded vertex-colored draw. */}
      <mesh geometry={hullGeometry}>
        <meshStandardMaterial vertexColors flatShading roughness={0.46} metalness={0.32} />
      </mesh>

      {/* Faceted crystal canopy. */}
      <mesh geometry={canopyGeometry}>
        <meshStandardMaterial
          color="#8bd3ff"
          emissive={activeApproach ? accent : '#0b2740'}
          emissiveIntensity={activeApproach ? 0.5 : 0.18}
          roughness={0.16}
          metalness={0.05}
          flatShading
          transparent
          opacity={0.62}
        />
      </mesh>

      {/* Twin thruster glow discs at the nacelle exits + center engine ring. */}
      <mesh position={[-1.08, -0.14, 1.05]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.15, 6]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#0a1520"
          emissive={accent}
          emissiveIntensity={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-1.08, -0.14, -1.05]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.15, 6]} />
        <meshStandardMaterial color="#0a1520" emissive={accent} emissiveIntensity={1.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-1.75, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.32, 6]} />
        <meshStandardMaterial color="#0a1520" emissive={accent} emissiveIntensity={1.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Tail-fin beacon. */}
      <mesh position={[-1.88, 1.22, 0]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial ref={beaconRef} color="#1a0d08" emissive="#ff8a3d" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}
