import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- The other worker ---------------------------------------------------------------
//
// W-7744, the field auditor: the first OTHER in the story. Director-driven — the
// arrival timeline writes his pose into this module store every tick (no physics,
// no controller); the component only renders it with a walk bob. A regulation
// body: suit-grey boxes, a visor slit, and a gait of straight lines ("he walks
// like the feed looks"). He runs on the player's old feed; the staging never
// says whether he is real. Zero cost while hidden.

export interface AuditWorkerPose {
  visible: boolean;
  position: THREE.Vector3;
  up: THREE.Vector3;
  /** World-space heading (movement direction, unit, ⊥ up when walking). */
  heading: THREE.Vector3;
  /** Accumulated stride distance — drives the leg swing / bob phase. */
  stride: number;
  /** 0 = standing, 1 = full walk animation. */
  walk: number;
}

const pose: AuditWorkerPose = {
  visible: false,
  position: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  heading: new THREE.Vector3(0, 0, 1),
  stride: 0,
  walk: 0
};

/** Director-side write access (the arrival timeline owns him). */
export function getAuditWorkerPose(): AuditWorkerPose {
  return pose;
}

export function hideAuditWorker(): void {
  pose.visible = false;
  pose.walk = 0;
  pose.stride = 0;
}

const SUIT = '#6e7b77';
const SUIT_DARK = '#4c5754';
const VISOR = '#1a2e2c';
/** The feed's ember — his eye reads from across the field, like the relay's lamp. */
const VISOR_GLOW = '#ff5a3c';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

/** Local boot sole. Combined with the route's +0.05 contact margin, this is 0. */
export const AUDIT_WORKER_BOOT_SOLE_Y = -0.05;

const AuditWorker: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);

  const materials = useMemo(() => ({
    suit: new THREE.MeshStandardMaterial({ color: SUIT, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: SUIT_DARK, roughness: 0.9 }),
    visor: new THREE.MeshStandardMaterial({
      color: VISOR,
      roughness: 0.25,
      metalness: 0.2,
      emissive: new THREE.Color(VISOR_GLOW),
      emissiveIntensity: 1.35
    })
  }), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    if (group.visible !== pose.visible) group.visible = pose.visible;
    if (!pose.visible) return;

    // Basis from up + heading (regulation gait: no lean, no sway off-axis).
    _fwd.copy(pose.heading);
    const vertical = _fwd.dot(pose.up);
    _fwd.addScaledVector(pose.up, -vertical);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    // Right-handed basis (up × fwd = right); the wrong order mirrors the body
    // and he walks the whole scene backwards.
    _right.crossVectors(pose.up, _fwd).normalize();
    _m.makeBasis(_right, pose.up, _fwd);
    _q.setFromRotationMatrix(_m);
    group.quaternion.copy(_q);

    // A metronome bob — precise, joyless.
    const phase = pose.stride * 2.4;
    const bob = Math.abs(Math.sin(phase)) * 0.05 * pose.walk;
    group.position.copy(pose.position).addScaledVector(pose.up, bob);

    const swing = Math.sin(phase) * 0.5 * pose.walk;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
    if (torsoRef.current) torsoRef.current.rotation.x = 0.03 * pose.walk;

    // Dev affordance (mirrors __storyBeat/__autopilot): capture harnesses
    // verify his pose without reaching into the reconciler.
    if (typeof window !== 'undefined') {
      (window as unknown as { __auditWorker?: object }).__auditWorker = {
        pos: [Math.round(pose.position.x * 10) / 10, Math.round(pose.position.y * 10) / 10, Math.round(pose.position.z * 10) / 10],
        heading: [Math.round(pose.heading.x * 100) / 100, Math.round(pose.heading.y * 100) / 100, Math.round(pose.heading.z * 100) / 100],
        walk: pose.walk
      };
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Hip pivots own the swing; the old meshes rotated around their centres
          and left both visible boot soles almost half a unit above the ground. */}
      <group ref={leftLegRef} position={[-0.14, 0.95, 0]}>
        <mesh position={[0, -0.5, 0]} material={materials.dark}>
          <boxGeometry args={[0.2, 1, 0.24]} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.14, 0.95, 0]}>
        <mesh position={[0, -0.5, 0]} material={materials.dark}>
          <boxGeometry args={[0.2, 1, 0.24]} />
        </mesh>
      </group>
      <group ref={torsoRef} position={[0, 1.3, 0]}>
        <mesh position={[0, 0, 0]} material={materials.suit}>
          <boxGeometry args={[0.56, 0.7, 0.34]} />
        </mesh>
        {/* Backpack unit — the suit loop he lives inside. */}
        <mesh position={[0, 0.05, -0.26]} material={materials.dark}>
          <boxGeometry args={[0.42, 0.5, 0.2]} />
        </mesh>
        {/* Arms, held straight — he is not swinging them for pleasure. */}
        <mesh position={[-0.36, -0.05, 0]} material={materials.suit}>
          <boxGeometry args={[0.14, 0.62, 0.2]} />
        </mesh>
        <mesh position={[0.36, -0.05, 0]} material={materials.suit}>
          <boxGeometry args={[0.14, 0.62, 0.2]} />
        </mesh>
        {/* Head + the feed's visor slit. */}
        <mesh position={[0, 0.53, 0]} material={materials.suit}>
          <boxGeometry args={[0.34, 0.36, 0.32]} />
        </mesh>
        <mesh position={[0, 0.55, 0.145]} material={materials.visor}>
          <boxGeometry args={[0.26, 0.08, 0.05]} />
        </mesh>
      </group>
    </group>
  );
};

export default AuditWorker;
