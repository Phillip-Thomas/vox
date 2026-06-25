import { useMemo } from 'react';
import * as THREE from 'three';
import type { PlayerPose, Vec3Tuple } from '../game/playerPose.ts';

interface PlayerAvatarProps {
  pose: PlayerPose;
  color?: string;
}

const UP_Y = new THREE.Vector3(0, 1, 0);
const FALLBACK_FORWARD = new THREE.Vector3(0, 0, -1);

function vector(tuple: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function safeUp(tuple: Vec3Tuple): THREE.Vector3 {
  const up = vector(tuple);
  return up.lengthSq() > 1e-9 ? up.normalize() : UP_Y.clone();
}

function safeForward(forwardTuple: Vec3Tuple, up: THREE.Vector3): THREE.Vector3 {
  const forward = vector(forwardTuple);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() > 1e-9) return forward.normalize();
  return FALLBACK_FORWARD.clone().addScaledVector(up, -FALLBACK_FORWARD.dot(up)).normalize();
}

export function createPlayerAvatarTransform(pose: PlayerPose): {
  position: Vec3Tuple;
  quaternion: [number, number, number, number];
} {
  const up = safeUp(pose.up);
  const forward = safeForward(pose.forward, up);
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const correctedForward = new THREE.Vector3().crossVectors(right, up).normalize();
  const matrix = new THREE.Matrix4().makeBasis(right, up, correctedForward);
  const q = new THREE.Quaternion().setFromRotationMatrix(matrix);
  return {
    position: pose.position,
    quaternion: [q.x, q.y, q.z, q.w]
  };
}

export default function PlayerAvatar({ pose, color = '#7dd3fc' }: PlayerAvatarProps) {
  const transform = useMemo(() => createPlayerAvatarTransform(pose), [pose]);
  const bodyColor = pose.action === 'swim'
    ? '#38bdf8'
    : pose.action === 'mine'
      ? '#fbbf24'
      : color;

  return (
    <group
      position={transform.position}
      quaternion={transform.quaternion}
      userData={{ playerId: pose.playerId, worldId: pose.worldId, action: pose.action }}
    >
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.28, 0.82, 5, 10]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.27, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.8} metalness={0.02} />
      </mesh>
      {pose.jetpackActive && (
        <mesh position={[0, 0.28, -0.34]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.14, 0.42, 12]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.82} />
        </mesh>
      )}
    </group>
  );
}
