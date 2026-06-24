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
import { BUILD_PIECES, type BuildPieceType } from '../game/data/buildPieces';
import { BUILD_MATERIALS, type BuildMaterialId } from '../game/data/buildMaterials';
import { getBuildGhost } from '../game/systems/buildGhost';
import { volumeQuat } from '../utils/buildPlacement';

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
// Ghost preview: BOTH halves at once (upper offset one cell up the wall) so the
// player sees the full 2-tall opening, not just the lower posts.
function makeDoorwayGhost() {
  return mergeGeometries([makeDoorwayLower(), makeDoorwayUpper().translate(0, VOXEL_SCALE, 0)])!;
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
// A ladder: two rails + evenly spaced rungs (thin, on a wall face).
function makeLadder() {
  const rail = new THREE.BoxGeometry(PANEL * 0.12, PANEL, THICK);
  const parts = [rail.clone().translate(-PANEL * 0.4, 0, 0), rail.clone().translate(PANEL * 0.4, 0, 0)];
  for (let i = -2; i <= 2; i++) {
    parts.push(new THREE.BoxGeometry(PANEL * 0.8, PANEL * 0.1, THICK * 0.8).translate(0, i * PANEL * 0.2, 0));
  }
  return mergeGeometries(parts)!;
}
// A door slab: fills the cell, a touch thicker than a wall; swings open via transform.
function makeDoor() {
  return new THREE.BoxGeometry(PANEL * 0.92, PANEL, THICK * 1.4);
}

// --- Volume geometry (local frame: up = +Y, ascends/slopes along +Z) ---------
const STEPS = 4;
function makeStairs() {
  const parts: THREE.BufferGeometry[] = [];
  const depth = VOXEL_SCALE / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * (VOXEL_SCALE / STEPS);
    parts.push(new THREE.BoxGeometry(PANEL, h, depth)
      .translate(0, -HALF + h / 2, -HALF + (i + 0.5) * depth));
  }
  return mergeGeometries(parts)!;
}
function makeSlopedRoof() {
  // A slab tilted so it rises from the −Z edge (floor) to the +Z edge (ceiling).
  const len = Math.SQRT2 * VOXEL_SCALE;
  return new THREE.BoxGeometry(PANEL, THICK * 1.6, len).rotateX(-Math.PI / 4);
}

// Solid (blocks movement) vs passable. Doors are solid only while closed.
function solidFor(p: StructurePiece): boolean {
  const def = BUILD_PIECES[p.type];
  if (def.openable) return !p.open;
  return !def.passable;
}

const _Y = new THREE.Vector3(0, 1, 0); // door-swing axis (local vertical)
function cellCenter(cell: [number, number, number]): [number, number, number] {
  const v = voxelCoordToWorld(cell[0], cell[1], cell[2], new THREE.Vector3());
  return [v.x, v.y, v.z];
}
const DOOR_SWING = THREE.MathUtils.degToRad(80);

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
    return {
      foundation: flat, wall: flat, ceiling: flat, doorway: makeDoorwayLower(), window: makeWindow(),
      gable: makeGable(), stairs: makeStairs(), sloped_roof: makeSlopedRoof(), ladder: makeLadder(), door: makeDoor()
    };
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
        {list.map(p => {
          const t = pieceTransform(p);
          return (
            <mesh
              key={p.id}
              geometry={geomFor(p)}
              material={MAT[p.material]}
              position={t.pos}
              quaternion={t.quat}
              userData={{ piece: p }}
              frustumCulled={false}
            />
          );
        })}
      </group>
      {list.filter(solidFor).map(p => {
        if (BUILD_PIECES[p.type].shape === 'volume') {
          // Tilted ramp/slab collider, in the piece's oriented frame (matches the mesh).
          const e = new THREE.Euler().setFromQuaternion(volumeQuat(p.up ?? 2, p.orient ?? 0));
          return (
            <RigidBody key={p.id} type="fixed" colliders={false} position={cellCenter(p.cell)} rotation={[e.x, e.y, e.z]}>
              <CuboidCollider args={[PANEL / 2, 0.2, Math.SQRT2 * HALF]} rotation={[-Math.PI / 4, 0, 0]} />
            </RigidBody>
          );
        }
        return (
          <RigidBody key={p.id} type="fixed" colliders={false} position={panelCenter(p.cell, p.face)} rotation={FACE_EULER[p.face]}>
            <CuboidCollider args={[PANEL / 2, PANEL / 2, THICK / 2]} />
          </RigidBody>
        );
      })}
    </>
  );
}

/** World transform for a piece's mesh: volume pieces sit at the cell centre with an
 *  oriented tilt; an open door swings about its vertical edge; panels lie on their face. */
function pieceTransform(p: StructurePiece): { pos: [number, number, number]; quat: [number, number, number, number] } {
  if (BUILD_PIECES[p.type].shape === 'volume') {
    const q = volumeQuat(p.up ?? 2, p.orient ?? 0);
    return { pos: cellCenter(p.cell), quat: [q.x, q.y, q.z, q.w] };
  }
  if (p.type === 'door' && p.open) {
    const q = FACE_QUAT[p.face].clone().multiply(new THREE.Quaternion().setFromAxisAngle(_Y, DOOR_SWING));
    return { pos: panelCenter(p.cell, p.face), quat: [q.x, q.y, q.z, q.w] };
  }
  return { pos: panelCenter(p.cell, p.face), quat: FACE_QUAT_ARR[p.face] };
}

/** Translucent preview of the selected piece at the snap target (green=ok, red=blocked). */
export function BuildGhost() {
  const flat = useMemo(() => makeFlatPanel(), []);
  const GEO = useMemo<Record<BuildPieceType, THREE.BufferGeometry>>(() => ({
    foundation: flat, wall: flat, ceiling: flat, doorway: makeDoorwayGhost(), window: makeWindow(),
    gable: makeGable(), stairs: makeStairs(), sloped_roof: makeSlopedRoof(), ladder: makeLadder(), door: makeDoor()
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
    if (BUILD_PIECES[g.type].shape === 'volume') {
      const c = cellCenter(g.cell);
      mesh.position.set(c[0], c[1], c[2]);
      mesh.quaternion.copy(volumeQuat(g.up, g.orient));
    } else {
      const c = panelCenter(g.cell, g.face);
      mesh.position.set(c[0], c[1], c[2]);
      mesh.quaternion.copy(FACE_QUAT[g.face]);
    }
    material.color.setHex(g.valid ? 0x7dffa0 : 0xff6b6b);
  });
  return <mesh ref={ref} material={material} frustumCulled={false} renderOrder={999} />;
}
