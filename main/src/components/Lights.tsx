import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getItemCount, subscribeInventory } from '../game/systems/inventorySystem';
import { getCampfires, resetCampfires, subscribeCampfires, type Campfire } from '../game/systems/campfires';
import { restoreCampfiresForWorld } from '../game/systems/persistence';
import { getPlayerUp } from '../state/playerFrame';

// Warm fire palette + tuned point-light values (physically-correct lights, decay 2).
const TORCH_COLOR = '#ffb15a';
const FIRE_COLOR = '#ff7a1e';
const TORCH_INTENSITY = 14;
const TORCH_DISTANCE = 14;
const CAMPFIRE_INTENSITY = 42;
const CAMPFIRE_DISTANCE = 28;

const _up = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP_Y = new THREE.Vector3(0, 1, 0);

/**
 * Carried torch light: a warm point light that follows the player whenever they
 * hold at least one Torch. Illuminates a small pool around them. Position is driven
 * imperatively each frame (no re-render); visibility flips with inventory.
 */
export function PlayerTorch({ playerPosition }: { playerPosition: THREE.Vector3 }) {
  const [has, setHas] = useState(() => getItemCount('torch') > 0);
  useEffect(() => {
    const update = () => setHas(getItemCount('torch') > 0);
    update();
    return subscribeInventory(update);
  }, []);
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!ref.current) return;
    // sit the flame a bit above the player's center, along local up.
    ref.current.position.copy(playerPosition).addScaledVector(getPlayerUp(), 0.8);
  });
  if (!has) return null;
  return <pointLight ref={ref} color={TORCH_COLOR} intensity={TORCH_INTENSITY} distance={TORCH_DISTANCE} decay={2} castShadow={false} />;
}

/** All placed campfires (stationary, brighter lights + a small fire mesh). */
export function Campfires({ terrainSeed }: { terrainSeed: number }) {
  const [list, setList] = useState<readonly Campfire[]>(() => getCampfires());
  useEffect(() => subscribeCampfires(() => setList([...getCampfires()])), []);
  // World-relative — clear, then load this world's saved campfires.
  useEffect(() => { resetCampfires(); restoreCampfiresForWorld(terrainSeed); setList([...getCampfires()]); }, [terrainSeed]);
  return (
    <>
      {list.map(c => <CampfireObject key={c.id} fire={c} />)}
    </>
  );
}

function CampfireObject({ fire }: { fire: Campfire }) {
  // Orient local +Y to the surface up so the ring lies flat on the ground.
  const quat = useMemo(() => {
    _up.set(fire.up[0], fire.up[1], fire.up[2]);
    if (_up.lengthSq() < 1e-6) _up.copy(UP_Y);
    else _up.normalize();
    return _q.setFromUnitVectors(UP_Y, _up).clone();
  }, [fire.up]);
  // Lift the group so the ring rests on the surface (player pos ≈ body center).
  const pos = useMemo<[number, number, number]>(() => [
    fire.pos[0] + fire.up[0] * 0.2,
    fire.pos[1] + fire.up[1] * 0.2,
    fire.pos[2] + fire.up[2] * 0.2
  ], [fire.pos, fire.up]);

  return (
    <group position={pos} quaternion={quat}>
      {/* ring of stones (flat) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.65, 0.16, 6, 12]} />
        <meshStandardMaterial color="#6b6f74" roughness={0.95} flatShading />
      </mesh>
      {/* crossed logs */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0.6, Math.PI / 2.6]}>
        <cylinderGeometry args={[0.08, 0.08, 1.0, 5]} />
        <meshStandardMaterial color="#5a3b22" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[0, -0.7, Math.PI / 2.6]}>
        <cylinderGeometry args={[0.08, 0.08, 1.0, 5]} />
        <meshStandardMaterial color="#4d3320" roughness={0.9} flatShading />
      </mesh>
      {/* glowing flame */}
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.28, 0.7, 7]} />
        <meshStandardMaterial color={FIRE_COLOR} emissive={FIRE_COLOR} emissiveIntensity={3.2} roughness={1} />
      </mesh>
      <pointLight position={[0, 0.7, 0]} color={FIRE_COLOR} intensity={CAMPFIRE_INTENSITY} distance={CAMPFIRE_DISTANCE} decay={2} castShadow={false} />
    </group>
  );
}
