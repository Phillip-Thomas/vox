import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { PlayerPose, Vec3Tuple } from '../game/playerPose.ts';

interface PlayerAvatarProps {
  pose: PlayerPose;
  color?: string;
  label?: string;
}

const UP_Y = new THREE.Vector3(0, 1, 0);
const FALLBACK_FORWARD = new THREE.Vector3(0, 0, -1);
const DEFAULT_AVATAR_COLOR = '#7dd3fc';
export const REMOTE_AVATAR_VELOCITY_LEAD_SECONDS = 0.08;
export const REMOTE_AVATAR_MAX_LEAD_DISTANCE = 0.75;
export const REMOTE_AVATAR_CHASE_RATE = 24;

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

function velocityLead(velocity: Vec3Tuple): Vec3Tuple {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (speed <= 1e-6) return [0, 0, 0];
  const leadSeconds = Math.min(
    REMOTE_AVATAR_VELOCITY_LEAD_SECONDS,
    REMOTE_AVATAR_MAX_LEAD_DISTANCE / speed
  );
  return [
    velocity[0] * leadSeconds,
    velocity[1] * leadSeconds,
    velocity[2] * leadSeconds
  ];
}

export function createPlayerAvatarRenderTarget(pose: PlayerPose): {
  position: Vec3Tuple;
  quaternion: [number, number, number, number];
} {
  const transform = createPlayerAvatarTransform(pose);
  if (pose.teleport || pose.warp) return transform;

  const lead = velocityLead(pose.velocity);
  return {
    ...transform,
    position: [
      transform.position[0] + lead[0],
      transform.position[1] + lead[1],
      transform.position[2] + lead[2]
    ]
  };
}

export interface PlayerAvatarPresentation {
  bodyColor: string;
  accentColor: string;
  beaconColor: string;
  beaconShape: 'crew' | 'wave' | 'thrust' | 'strike' | 'build';
  bodyPosition: [number, number, number];
  bodyRotation: [number, number, number];
  headPosition: [number, number, number];
  showSuitBackpack: boolean;
  showJetpackFlame: boolean;
  showMiningTool: boolean;
  showBuildPreview: boolean;
  showTorchGlow: boolean;
  miningToolOpacity: number;
}

export function createPlayerAvatarPresentation(
  pose: PlayerPose,
  color = DEFAULT_AVATAR_COLOR
): PlayerAvatarPresentation {
  const swimming = pose.action === 'swim' || pose.submergence > 0.5;
  const mining = pose.action === 'mine';
  const building = pose.action === 'build';
  const jetpacking = pose.action === 'jetpack' || pose.jetpackActive;
  const accentColor = swimming
    ? '#38bdf8'
    : mining
      ? '#fbbf24'
      : building
        ? '#86efac'
        : jetpacking
          ? '#c4b5fd'
          : color;
  return {
    bodyColor: swimming
      ? '#38bdf8'
      : mining
        ? '#fbbf24'
        : building
          ? '#86efac'
          : jetpacking
            ? '#c4b5fd'
            : color,
    accentColor,
    beaconColor: accentColor,
    beaconShape: swimming
      ? 'wave'
      : mining
        ? 'strike'
        : building
          ? 'build'
          : jetpacking
            ? 'thrust'
            : 'crew',
    bodyPosition: swimming ? [0, 0.82, 0.04] : [0, 0.62, 0],
    bodyRotation: swimming ? [Math.PI / 2, 0, 0] : [0, 0, 0],
    headPosition: swimming ? [0, 0.86, 0.58] : [0, 1.27, 0],
    showSuitBackpack: !swimming,
    showJetpackFlame: jetpacking,
    showMiningTool: mining,
    showBuildPreview: building,
    showTorchGlow: pose.torchActive,
    miningToolOpacity: mining
      ? Math.max(0.35, Math.min(1, pose.miningProgress || 0.35))
      : 0
  };
}

export function measurePlayerAvatarLabelWidth(label?: string): number {
  return Math.max(0.52, Math.min(1.25, (label?.length ?? 0) * 0.075 + 0.18));
}

function AvatarBeaconShape({
  shape,
  color
}: {
  shape: PlayerAvatarPresentation['beaconShape'];
  color: string;
}) {
  if (shape === 'wave') {
    return (
      <group userData={{ avatarPart: 'action-beacon-wave' }}>
        <mesh position={[-0.06, 0, 0]} rotation={[0, 0, 0.45]}>
          <boxGeometry args={[0.18, 0.028, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0.08, 0, 0]} rotation={[0, 0, -0.45]}>
          <boxGeometry args={[0.18, 0.028, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={0.82} />
        </mesh>
      </group>
    );
  }

  if (shape === 'thrust') {
    return (
      <mesh rotation={[0, 0, Math.PI]} userData={{ avatarPart: 'action-beacon-thrust' }}>
        <coneGeometry args={[0.075, 0.17, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    );
  }

  if (shape === 'strike') {
    return (
      <group rotation={[0, 0, -0.6]} userData={{ avatarPart: 'action-beacon-strike' }}>
        <mesh>
          <boxGeometry args={[0.22, 0.035, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={0.96} />
        </mesh>
        <mesh position={[0.08, 0.055, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.14, 0.03, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={0.86} />
        </mesh>
      </group>
    );
  }

  if (shape === 'build') {
    return (
      <mesh userData={{ avatarPart: 'action-beacon-build' }}>
        <boxGeometry args={[0.15, 0.15, 0.024]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} wireframe />
      </mesh>
    );
  }

  return (
    <mesh userData={{ avatarPart: 'action-beacon-crew' }}>
      <sphereGeometry args={[0.055, 12, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.92} />
    </mesh>
  );
}

export default function PlayerAvatar({ pose, color = DEFAULT_AVATAR_COLOR, label }: PlayerAvatarProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const hasInitialized = useRef(false);
  const frameTargetPosition = useRef(new THREE.Vector3());
  const frameTargetQuaternion = useRef(new THREE.Quaternion());
  const target = useMemo(() => createPlayerAvatarRenderTarget(pose), [pose]);
  const targetRef = useRef(target);
  targetRef.current = target;
  const presentation = useMemo(() => createPlayerAvatarPresentation(pose, color), [color, pose]);
  const labelWidth = useMemo(() => measurePlayerAvatarLabelWidth(label), [label]);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    if (hasInitialized.current && !pose.teleport && !pose.warp) return;
    groupRef.current.position.fromArray(target.position);
    groupRef.current.quaternion.fromArray(target.quaternion);
    hasInitialized.current = true;
  }, [pose.teleport, pose.warp, target]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !hasInitialized.current) return;
    const next = targetRef.current;
    frameTargetPosition.current.fromArray(next.position);
    frameTargetQuaternion.current.fromArray(next.quaternion);
    const alpha = 1 - Math.exp(-Math.min(delta, 0.05) * REMOTE_AVATAR_CHASE_RATE);
    group.position.lerp(frameTargetPosition.current, alpha);
    group.quaternion.slerp(frameTargetQuaternion.current, alpha);
  });

  return (
    <group
      ref={groupRef}
      userData={{ playerId: pose.playerId, worldId: pose.worldId, action: pose.action }}
    >
      <group userData={{ avatarPart: 'footing-marker' }}>
        <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.45, 0.012, 6, 36]} />
          <meshBasicMaterial color={presentation.accentColor} transparent opacity={0.42} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.05, 0.51]} rotation={[Math.PI / 2, 0, Math.PI / 3]}>
          <coneGeometry args={[0.09, 0.22, 3]} />
          <meshBasicMaterial color={presentation.accentColor} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={presentation.bodyPosition} rotation={presentation.bodyRotation} castShadow receiveShadow>
        <capsuleGeometry args={[0.28, 0.82, 5, 10]} />
        <meshStandardMaterial color={presentation.bodyColor} roughness={0.72} metalness={0.05} />
      </mesh>
      {presentation.showSuitBackpack && (
        <mesh position={[0, 0.66, -0.29]} castShadow userData={{ avatarPart: 'suit-backpack' }}>
          <boxGeometry args={[0.32, 0.48, 0.16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.74} metalness={0.08} emissive={presentation.accentColor} emissiveIntensity={0.08} />
        </mesh>
      )}
      <mesh position={presentation.headPosition} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.8} metalness={0.02} />
      </mesh>
      <mesh position={[presentation.headPosition[0], presentation.headPosition[1], presentation.headPosition[2] + 0.215]} userData={{ avatarPart: 'visor' }}>
        <boxGeometry args={[0.26, 0.09, 0.018]} />
        <meshStandardMaterial color="#06111f" roughness={0.35} metalness={0.18} emissive={presentation.accentColor} emissiveIntensity={0.16} />
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
        <group userData={{ actionAccessory: 'jetpack' }}>
          <mesh position={[-0.11, 0.26, -0.42]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.08, 0.42, 12]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.82} />
          </mesh>
          <mesh position={[0.11, 0.26, -0.42]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.08, 0.42, 12]} />
            <meshBasicMaterial color="#c4b5fd" transparent opacity={0.68} />
          </mesh>
        </group>
      )}
      {presentation.showTorchGlow && (
        <mesh position={[-0.33, 0.82, 0.34]} userData={{ actionAccessory: 'torch' }}>
          <sphereGeometry args={[0.085, 12, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
        </mesh>
      )}
      {label && (
        <Billboard position={[0, 1.72, 0]}>
          <mesh position={[0, 0, -0.012]}>
            <planeGeometry args={[labelWidth, 0.22]} />
            <meshBasicMaterial color="#05080f" transparent opacity={0.58} depthWrite={false} />
          </mesh>
          <Text
            fontSize={0.115}
            color="#e6eef7"
            anchorX="center"
            anchorY="middle"
            outlineColor="#05080f"
            outlineWidth={0.008}
          >
            {label}
          </Text>
        </Billboard>
      )}
      <Billboard position={[0, label ? 1.98 : 1.72, 0]}>
        <mesh position={[0, 0, -0.016]}>
          <planeGeometry args={[0.42, 0.24]} />
          <meshBasicMaterial color="#05080f" transparent opacity={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.009]}>
          <ringGeometry args={[0.102, 0.126, 24]} />
          <meshBasicMaterial color={presentation.beaconColor} transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <AvatarBeaconShape shape={presentation.beaconShape} color={presentation.beaconColor} />
      </Billboard>
    </group>
  );
}
