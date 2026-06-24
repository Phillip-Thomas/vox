import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { seededUnit } from '../utils/worldCoordinates';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { setBoardable } from '../state/shipProximity.ts';

const BOARD_RANGE = 3.5;
const BOARD_RANGE_SQ = BOARD_RANGE * BOARD_RANGE;

interface SpaceshipPlaceholderProps {
  position: THREE.Vector3;
  terrainSeed: number;
  activeApproach: boolean;
  /** Live player position (from EfficientScene) for the boarding proximity check. */
  playerPosition?: THREE.Vector3;
}

export default function SpaceshipPlaceholder({
  position,
  terrainSeed,
  activeApproach,
  playerPosition
}: SpaceshipPlaceholderProps) {
  const { phase, controlMode } = useSpaceFlight();
  const boardableRef = useRef(false);

  // Boarding is only offered while on foot on the surface.
  const boardable = phase === 'surface' && controlMode === 'fps';

  const accent = useMemo(() => {
    const hue = 0.52 + seededUnit(terrainSeed, 73) * 0.12;
    return new THREE.Color().setHSL(hue, 0.72, activeApproach ? 0.62 : 0.48);
  }, [activeApproach, terrainSeed]);

  // Proximity check → publish "boardable" for the on-foot interaction resolver, which
  // owns the unified "[F] Enter Ship" prompt + the F key (no one-off listener/prompt here).
  useFrame(() => {
    const close = boardable && !!playerPosition && playerPosition.distanceToSquared(position) <= BOARD_RANGE_SQ;
    if (close !== boardableRef.current) {
      boardableRef.current = close;
      setBoardable(close);
    }
  });

  // Clear the flag if this ship unmounts (world swap) so no stale prompt lingers.
  useEffect(() => () => setBoardable(false), []);

  // While flying (controlMode==='flight') the ship IS the avatar / cockpit; hide
  // the parked exterior so it doesn't float in the cockpit view. It reappears
  // once landed back on foot.
  if (controlMode === 'flight') return null;

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, Math.PI * 0.18, 0]}
      scale={1.15}
    >
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.42, 2.5, 6, 14]} />
        <meshStandardMaterial color="#d7dde6" roughness={0.42} metalness={0.18} />
      </mesh>

      <mesh position={[1.65, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.46, 0.9, 18]} />
        <meshStandardMaterial color={accent} roughness={0.35} metalness={0.1} />
      </mesh>

      <mesh position={[-1.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.34, 0.65, 14]} />
        <meshStandardMaterial color="#5b6472" roughness={0.52} metalness={0.28} />
      </mesh>

      <mesh position={[-0.25, -0.28, 0.58]}>
        <boxGeometry args={[1.45, 0.1, 0.78]} />
        <meshStandardMaterial color="#8894a6" roughness={0.48} metalness={0.16} />
      </mesh>

      <mesh position={[-0.25, -0.28, -0.58]}>
        <boxGeometry args={[1.45, 0.1, 0.78]} />
        <meshStandardMaterial color="#8894a6" roughness={0.48} metalness={0.16} />
      </mesh>

      <mesh position={[0.25, 0.37, 0]}>
        <sphereGeometry args={[0.34, 18, 10]} />
        <meshStandardMaterial
          color="#8bd3ff"
          emissive={activeApproach ? accent : '#0b2740'}
          emissiveIntensity={activeApproach ? 0.45 : 0.16}
          roughness={0.2}
          metalness={0.05}
          transparent
          opacity={0.68}
        />
      </mesh>
    </group>
  );
}
