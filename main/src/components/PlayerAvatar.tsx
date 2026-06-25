import { useMemo } from 'react';
import * as THREE from 'three';
import type { PlayerPose, Vec3Tuple } from '../game/playerPose.ts';

interface PlayerAvatarProps {
  pose: PlayerPose;
  color?: string;
}

const UP_Y = new THREE.Vector3(0, 1, 0);
const FALLBACK_FORWARD = new THREE.Vector3(0, 0, -1);
const DEFAULT_AVATAR_COLOR = '#7dd3fc';

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

export interface PlayerAvatarPresentation {
  bodyColor: string;
  bodyPosition: [number, number, number];
  bodyRotation: [number, number, number];
  headPosition: [number, number, number];
  showJetpackFlame: boolean;
  showMiningTool: boolean;
  showBuildPreview: boolean;
  miningToolOpacity: number;
}

export function createPlayerAvatarPresentation(
  pose: PlayerPose,
  color = DEFAULT_AVATAR_COLOR
): PlayerAvatarPresentation {
  const swimming = pose.action === 'swim' || pose.submergence > 0.5;
  return {
    bodyColor: swimming
      ? '#38bdf8'
      : pose.action === 'mine'
        ? '#fbbf24'
        : pose.action === 'build'
          ? '#86efac'
          : pose.action === 'jetpack' || pose.jetpackActive
            ? '#c4b5fd'
            : color,
    bodyPosition: swimming ? [0, 0.82, 0.04] : [0, 0.62, 0],
    bodyRotation: swimming ? [Math.PI / 2, 0, 0] : [0, 0, 0],
    headPosition: swimming ? [0, 0.86, 0.58] : [0, 1.27, 0],
    showJetpackFlame: pose.jetpackActive || pose.action === 'jetpack',
    showMiningTool: pose.action === 'mine',
    showBuildPreview: pose.action === 'build',
    miningToolOpacity: pose.action === 'mine'
      ? Math.max(0.35, Math.min(1, pose.miningProgress || 0.35))
      : 0
  };
}

export default function PlayerAvatar({ pose, color = DEFAULT_AVATAR_COLOR }: PlayerAvatarProps) {
  const transform = useMemo(() => createPlayerAvatarTransform(pose), [pose]);
  const presentation = useMemo(() => createPlayerAvatarPresentation(pose, color), [color, pose]);

  return (
    <group
      position={transform.position}
      quaternion={transform.quaternion}
      userData={{ playerId: pose.playerId, worldId: pose.worldId, action: pose.action }}
    >
      <mesh position={presentation.bodyPosition} rotation={presentation.bodyRotation} castShadow receiveShadow>
        <capsuleGeometry args={[0.28, 0.82, 5, 10]} />
        <meshStandardMaterial color={presentation.bodyColor} roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={presentation.headPosition} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.8} metalness={0.02} />
      </mesh>
      {presentation.showMiningTool && (
        <group position={[0.38, 0.88, 0.32]} rotation={[0.55, 0, -0.7]} userData={{ actionAccessory: 'mine' }}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.62, 8]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.75} />
          </mesh>
          <mesh position={[0.26, 0, 0]} castShadow>
            <boxGeometry args={[0.32, 0.06, 0.08]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.58} transparent opacity={presentation.miningToolOpacity} />
          </mesh>
        </group>
      )}
      {presentation.showBuildPreview && (
        <group position={[0, 0.84, 0.56]} userData={{ actionAccessory: 'build' }}>
          <mesh castShadow>
            <boxGeometry args={[0.58, 0.42, 0.035]} />
            <meshStandardMaterial color="#86efac" transparent opacity={0.58} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.026]}>
            <boxGeometry args={[0.64, 0.05, 0.018]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
        </group>
      )}
      {presentation.showJetpackFlame && (
        <mesh position={[0, 0.28, -0.34]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.14, 0.42, 12]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.82} />
        </mesh>
      )}
    </group>
  );
}
