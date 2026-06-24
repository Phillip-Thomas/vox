import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VOXEL_SCALE, voxelCoordToWorld } from '../utils/cubeGravityConstants';
import {
  FACE_DIRS, getPieces, resetStructures, subscribeStructures, type StructurePiece
} from '../game/systems/structureSystem';
import { restoreStructuresForWorld } from '../game/systems/persistence';
import { type BuildPieceType } from '../game/data/buildPieces';
import { BUILD_MATERIALS, type BuildMaterialId } from '../game/data/buildMaterials';
import { getBuildGhost } from '../game/systems/buildGhost';

const PANEL = VOXEL_SCALE * 0.96;
const THICK = 0.22;
const HALF = VOXEL_SCALE / 2;

const _zAxis = new THREE.Vector3(0, 0, 1);
const FACE_VEC = FACE_DIRS.map(d => new THREE.Vector3(d[0], d[1], d[2]));
const FACE_QUAT = FACE_VEC.map(n => new THREE.Quaternion().setFromUnitVectors(_zAxis, n));
const FACE_QUAT_ARR = FACE_QUAT.map(q => [q.x, q.y, q.z, q.w] as [number, number, number, number]);
const FACE_EULER = FACE_QUAT.map(q => { const e = new THREE.Euler().setFromQuaternion(q); return [e.x, e.y, e.z] as [number, number, number]; });

function panelCenter(cell: [number, number, number], face: number): [number, number, number] {
  const v = voxelCoordToWorld(cell[0], cell[1], cell[2], new THREE.Vector3()).addScaledVector(FACE_VEC[face], HALF);
  return [v.x, v.y, v.z];
}

// --- Geometry per piece type (built once; the flat panel is shared) ----------
function makeFlatPanel() { return new THREE.BoxGeometry(PANEL, PANEL, THICK); }
// Doorways are 2 cells tall: the lower half is open side-posts; the upper half adds
// the lintel. Stacked, they frame a head-clearing opening.
function makeDoorwayLower() {
  const post = new THREE.BoxGeometry(PANEL * 0.18, PANEL, THICK);
  return mergeGeometries([post.clone().translate(-PANEL * 0.41, 0, 0), post.clone().translate(PANEL * 0.41, 0, 0)])!;
}
function makeDoorwayUpper() {
  const post = new THREE.BoxGeometry(PANEL * 0.18, PANEL, THICK);
  const lintel = new THREE.BoxGeometry(PANEL, PANEL * 0.22, THICK).translate(0, PANEL * 0.39, 0);
  return mergeGeometries([post.clone().translate(-PANEL * 0.41, 0, 0), post.clone().translate(PANEL * 0.41, 0, 0), lintel])!;
}
function makeWindow() {
  const h = new THREE.BoxGeometry(PANEL, PANEL * 0.26, THICK);
  const v = new THREE.BoxGeometry(PANEL * 0.26, PANEL * 0.5, THICK);
  return mergeGeometries([
    h.clone().translate(0, PANEL * 0.37, 0), h.clone().translate(0, -PANEL * 0.37, 0),
    v.clone().translate(-PANEL * 0.37, 0, 0), v.clone().translate(PANEL * 0.37, 0, 0)
  ])!;
}
function makeGable() {
  const s = new THREE.Shape();
  s.moveTo(-PANEL / 2, -PANEL / 2); s.lineTo(PANEL / 2, -PANEL / 2); s.lineTo(0, PANEL / 2); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: THICK, bevelEnabled: false }).translate(0, 0, -THICK / 2);
}

// Solid (blocks movement) vs passable (doorway/window are see/walk-through).
function isSolid(type: BuildPieceType): boolean {
  return type !== 'doorway' && type !== 'window';
}

/** Pick handle for build targeting / deconstruct: the group of piece meshes
 *  (each mesh carries its StructurePiece in userData). */
export const structureFieldHandle: { group: THREE.Group | null } = { group: null };

function createBuildMaterial(colorHex: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uTint = { value: new THREE.Color(colorHex) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vBPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vBPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uTint; varying vec3 vBPos;
        float bH(float n){ return fract(sin(n) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float plank = floor(vBPos.y * 1.6);
        float grain = sin(vBPos.y * 34.0 + bH(plank) * 6.28) * 0.5 + 0.5;
        vec3 c = uTint * (0.82 + 0.26 * grain);
        c *= 0.9 + 0.18 * bH(floor(vBPos.x * 2.0) + plank * 7.0);
        diffuseColor.rgb *= c;`);
  };
  m.customProgramCacheKey = () => `build-${colorHex.toString(16)}`;
  return m;
}

/** Renders all placed structure pieces + a fixed collider per solid piece. */
export default function StructureField({ terrainSeed }: { terrainSeed: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const [list, setList] = useState<StructurePiece[]>(() => getPieces());

  const GEO = useMemo<Record<BuildPieceType, THREE.BufferGeometry>>(() => {
    const flat = makeFlatPanel();
    return { foundation: flat, wall: flat, ceiling: flat, doorway: makeDoorwayLower(), window: makeWindow(), gable: makeGable() };
  }, []);
  const doorwayUpper = useMemo(() => makeDoorwayUpper(), []);
  const geomFor = (p: StructurePiece) => (p.type === 'doorway' && p.tall === 'upper') ? doorwayUpper : GEO[p.type];
  const MAT = useMemo(() => {
    const m = {} as Record<BuildMaterialId, THREE.MeshStandardMaterial>;
    (Object.keys(BUILD_MATERIALS) as BuildMaterialId[]).forEach(id => { m[id] = createBuildMaterial(BUILD_MATERIALS[id].colorHex); });
    return m;
  }, []);

  useEffect(() => subscribeStructures(() => setList(getPieces())), []);
  // World-relative: clear, then load THIS world's saved structures.
  useEffect(() => { resetStructures(); restoreStructuresForWorld(terrainSeed); setList(getPieces()); }, [terrainSeed]);
  useEffect(() => {
    structureFieldHandle.group = groupRef.current;
    return () => {
      structureFieldHandle.group = null;
      Object.values(GEO).forEach(g => g.dispose());
      doorwayUpper.dispose();
      Object.values(MAT).forEach(m => m.dispose());
    };
  }, [GEO, doorwayUpper, MAT]);

  return (
    <>
      <group ref={groupRef}>
        {list.map(p => (
          <mesh
            key={p.id}
            geometry={geomFor(p)}
            material={MAT[p.material]}
            position={panelCenter(p.cell, p.face)}
            quaternion={FACE_QUAT_ARR[p.face]}
            userData={{ piece: p }}
            frustumCulled={false}
          />
        ))}
      </group>
      {list.filter(p => isSolid(p.type)).map(p => (
        <RigidBody key={p.id} type="fixed" colliders={false} position={panelCenter(p.cell, p.face)} rotation={FACE_EULER[p.face]}>
          <CuboidCollider args={[PANEL / 2, PANEL / 2, THICK / 2]} />
        </RigidBody>
      ))}
    </>
  );
}

/** Translucent preview of the selected piece at the snap target (green=ok, red=blocked). */
export function BuildGhost() {
  const flat = useMemo(() => makeFlatPanel(), []);
  const GEO = useMemo<Record<BuildPieceType, THREE.BufferGeometry>>(() => ({
    foundation: flat, wall: flat, ceiling: flat, doorway: makeDoorwayLower(), window: makeWindow(), gable: makeGable()
  }), [flat]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.4, depthWrite: false }), []);
  const ref = useRef<THREE.Mesh>(null);
  const lastType = useRef<BuildPieceType | null>(null);
  useEffect(() => () => { Object.values(GEO).forEach(g => { if (g !== flat) g.dispose(); }); flat.dispose(); material.dispose(); }, [GEO, flat, material]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const g = getBuildGhost();
    mesh.visible = g.active;
    if (!g.active) return;
    if (lastType.current !== g.type) { mesh.geometry = GEO[g.type]; lastType.current = g.type; }
    const c = panelCenter(g.cell, g.face);
    mesh.position.set(c[0], c[1], c[2]);
    mesh.quaternion.copy(FACE_QUAT[g.face]);
    material.color.setHex(g.valid ? 0x7dffa0 : 0xff6b6b);
  });
  return <mesh ref={ref} material={material} frustumCulled={false} renderOrder={999} />;
}
