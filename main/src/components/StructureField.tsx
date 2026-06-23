import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { VOXEL_SCALE, voxelCoordToWorld } from '../utils/cubeGravityConstants';
import {
  FACE_DIRS, getPieces, getStructureVersion, resetStructures, subscribeStructures, type StructurePiece
} from '../game/systems/structureSystem';
import { getBuildGhost } from '../game/systems/buildGhost';

// Panel: a thin box the size of a cube face (slightly under 2u to avoid seam
// z-fighting), thin along local +Z. Oriented per face by FACE_QUAT.
const PANEL = VOXEL_SCALE * 0.96;
const THICK = 0.22;
const HALF = VOXEL_SCALE / 2;

const _zAxis = new THREE.Vector3(0, 0, 1);
const FACE_VEC = FACE_DIRS.map(d => new THREE.Vector3(d[0], d[1], d[2]));
const FACE_QUAT = FACE_VEC.map(n => new THREE.Quaternion().setFromUnitVectors(_zAxis, n));
const FACE_EULER = FACE_QUAT.map(q => { const e = new THREE.Euler().setFromQuaternion(q); return [e.x, e.y, e.z] as [number, number, number]; });

const _cell = new THREE.Vector3();
const _scratch = new THREE.Matrix4();

/** World transform (position + quaternion) of a panel at (cell, face). */
function panelCenter(cell: [number, number, number], face: number, out: THREE.Vector3): THREE.Vector3 {
  voxelCoordToWorld(cell[0], cell[1], cell[2], out);
  return out.addScaledVector(FACE_VEC[face], HALF);
}

/** Handle for deconstruct picking: the instanced mesh + slot→piece map. */
export const structureFieldHandle: { mesh: THREE.InstancedMesh | null; slotPiece: StructurePiece[] } = {
  mesh: null, slotPiece: []
};

// Procedural plank material (keeps PBR; injects wood grain — not a flat colour).
function createPlankMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uWood = { value: new THREE.Color(0x8a5a2c) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vWoodPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWoodPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uWood; varying vec3 vWoodPos;
        float wH(float n){ return fract(sin(n) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float plank = floor(vWoodPos.y * 1.6);                 // horizontal plank rows
        float grain = sin(vWoodPos.y * 34.0 + wH(plank) * 6.28) * 0.5 + 0.5;
        vec3 wood = uWood * (0.82 + 0.26 * grain);
        wood *= 0.9 + 0.18 * wH(floor(vWoodPos.x * 2.0) + plank * 7.0); // plank-to-plank tone
        wood *= 1.0 - 0.18 * smoothstep(0.85, 1.0, fract(vWoodPos.y * 1.6)); // seam shadow
        diffuseColor.rgb *= wood;`);
  };
  m.customProgramCacheKey = () => 'plank-v1';
  return m;
}

/** Renders all placed structure pieces (instanced) + a fixed collider per piece. */
export default function StructureField({ terrainSeed }: { terrainSeed: number }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(PANEL, PANEL, THICK), []);
  const material = useMemo(() => createPlankMaterial(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [list, setList] = useState<StructurePiece[]>(() => getPieces());
  const [capacity, setCapacity] = useState(64);
  const versionRef = useRef(-1);

  useEffect(() => subscribeStructures(() => setList(getPieces())), []);
  useEffect(() => { resetStructures(); }, [terrainSeed]); // world-relative coords
  useEffect(() => () => { geometry.dispose(); material.dispose(); structureFieldHandle.mesh = null; structureFieldHandle.slotPiece = []; }, [geometry, material]);

  // Grow capacity if needed.
  useEffect(() => { if (list.length > capacity) setCapacity(Math.ceil(list.length * 1.5) + 16); }, [list.length, capacity]);

  // Fill instance matrices on any structure change / capacity realloc.
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (versionRef.current === getStructureVersion() && mesh.count === list.length) return;
    versionRef.current = getStructureVersion();
    const n = Math.min(list.length, mesh.instanceMatrix.count);
    structureFieldHandle.slotPiece = [];
    for (let i = 0; i < n; i++) {
      const p = list[i];
      panelCenter(p.cell, p.face, _cell);
      _scratch.compose(_cell, FACE_QUAT[p.face], { x: 1, y: 1, z: 1 } as THREE.Vector3);
      mesh.setMatrixAt(i, _scratch);
      structureFieldHandle.slotPiece[i] = p;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    structureFieldHandle.mesh = mesh;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      {list.map(p => {
        const c = panelCenter(p.cell, p.face, new THREE.Vector3());
        const hz = p.face >= 0 ? THICK / 2 : THICK / 2;
        return (
          <RigidBody key={p.id} type="fixed" colliders={false} position={[c.x, c.y, c.z]} rotation={FACE_EULER[p.face]}>
            <CuboidCollider args={[PANEL / 2, PANEL / 2, hz]} />
          </RigidBody>
        );
      })}
    </>
  );
}

/** Translucent preview of where the selected piece will snap (green=ok, red=blocked). */
export function BuildGhost() {
  const geometry = useMemo(() => new THREE.BoxGeometry(PANEL, PANEL, THICK), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.4, depthWrite: false }),
    []
  );
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const g = getBuildGhost();
    mesh.visible = g.active;
    if (!g.active) return;
    panelCenter(g.cell, g.face, _cell);
    mesh.position.copy(_cell);
    mesh.quaternion.copy(FACE_QUAT[g.face]);
    material.color.setHex(g.valid ? 0x7dffa0 : 0xff6b6b);
  });
  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={999} />;
}
