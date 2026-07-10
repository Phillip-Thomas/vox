import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlayerPose } from '../../game/systems/playerPoseSystem.ts';
import { getLocalActorId } from '../../game/playerActors.ts';
import { getStoryInputPolicy } from '../storyInputPolicy.ts';
import { getSideFacing, getSideLens } from '../sideLens.ts';

// --- The raster-era worker sprite ---------------------------------------------------
//
// The side-scroller needs a visible protagonist; the first-person player has no
// body. This is a tiny voxel figure (boxes only — the era permits nothing else)
// driven imperatively from the local player pose: no React churn, flips with
// travel direction, bobs while walking. It exists only while the side lens is
// the active look mode.

const BODY = '#b7c4bd';
const VISOR = '#3a4741';
const SUIT_DIM = '#8d9a93';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _face = new THREE.Vector3();
const _FORWARD = new THREE.Vector3(0, 0, 1);

const SideWorkerAvatar: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  const materials = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.85 }),
    dim: new THREE.MeshStandardMaterial({ color: SUIT_DIM, roughness: 0.9 }),
    visor: new THREE.MeshStandardMaterial({ color: VISOR, roughness: 0.4 })
  }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const lens = getSideLens();
    const sideActive = getStoryInputPolicy().lookMode === 'side' && !!lens;
    group.visible = sideActive;
    if (!sideActive || !lens) return;

    const pose = getPlayerPose(getLocalActorId());
    if (!pose) {
      group.visible = false;
      return;
    }
    _pos.set(pose.position[0], pose.position[1], pose.position[2]);
    group.position.copy(_pos);

    // Face the last-moved direction along the travel axis.
    _face.copy(lens.travelAxis).multiplyScalar(getSideFacing()).normalize();
    _quat.setFromUnitVectors(_FORWARD, _face);
    group.quaternion.slerp(_quat, 0.25);

    // Walk bob (the era's whole animation budget).
    const moving = pose.action === 'walk' || pose.action === 'sprint';
    const bob = moving ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.14 : 0;
    group.children.forEach(child => {
      child.position.y = (child.userData.baseY as number) + bob;
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* torso */}
      <mesh geometry={box} material={materials.body} scale={[0.62, 0.78, 0.86]} position={[0, 0.0, 0]} userData={{ baseY: 0.0 }} />
      {/* head */}
      <mesh geometry={box} material={materials.body} scale={[0.52, 0.5, 0.56]} position={[0, 0.72, 0]} userData={{ baseY: 0.72 }} />
      {/* visor (offset toward facing) */}
      <mesh geometry={box} material={materials.visor} scale={[0.4, 0.18, 0.12]} position={[0, 0.76, 0.3]} userData={{ baseY: 0.76 }} />
      {/* legs */}
      <mesh geometry={box} material={materials.dim} scale={[0.26, 0.56, 0.3]} position={[0, -0.68, -0.18]} userData={{ baseY: -0.68 }} />
      <mesh geometry={box} material={materials.dim} scale={[0.26, 0.56, 0.3]} position={[0, -0.68, 0.18]} userData={{ baseY: -0.68 }} />
      {/* pack */}
      <mesh geometry={box} material={materials.dim} scale={[0.5, 0.6, 0.26]} position={[0, 0.06, -0.5]} userData={{ baseY: 0.06 }} />
    </group>
  );
};

export default SideWorkerAvatar;
