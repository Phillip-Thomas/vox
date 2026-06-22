// =============================================================================
// TREE TEST HARNESS — isolated, well-lit viewer for every tree silhouette.
// =============================================================================
//
// WHY: debugging tree generation by hunting for the right species in the live
// game (right biome, right LOD, right camera, behind the menu) is slow and
// unreliable. This renders ALL silhouettes side-by-side in a clean, centered,
// evenly-lit empty scene using the EXACT same generator + materials as the game
// (generateTree + treeMaterials), so you can see each one without question.
//
// HOW TO USE:
//   1. Dev server running (npm run dev in main/).
//   2. Open  http://localhost:5173/tree-test.html
//   3. Trees are laid left→right in SPECIES order; orbit/zoom with the mouse.
//      Each tree's label shows its name + the ACTUAL silhouette its seed yields.
//   4. To screenshot headless (real GPU), point tools/capture-style Playwright at
//      that URL, or just use the browser. (No ?agent / menu / world needed.)
//
// EXTENDING: add/replace entries in SPECIES below. `coord` picks a real world
// seed (so it's a genuine in-game tree); set `force` to render a specific
// silhouette regardless of the seed's natural roll. This is a DEV-ONLY entry
// (separate Vite html), so it never touches the game bundle or App.tsx.
//
// Docs trail: see TODO.md ("Dev harnesses") and memory `tree-test-harness`.
// =============================================================================

import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { generateTree, type TreeSilhouette } from './utils/treeGen.ts';
import { buildTreeProfile, paramsFromProfile } from './utils/treeProfile.ts';
import { coordinateToSeed } from './utils/worldCoordinates.ts';
import {
  createBarkMaterial,
  createLeafMaterial,
  createBlossomMaterial,
  updateTreeMaterials
} from './utils/treeMaterials.ts';
import { getGraphicsQuality } from './config/graphicsSettings.ts';

interface SpeciesSpec {
  name: string;
  coord: [number, number];          // a real world coord (genuine in-game seed)
  force?: TreeSilhouette;           // optional: force this silhouette on the seed
}

// Representative real worlds per silhouette (probed). Weeping uses the user's
// reported upside-down example (-92,-79).
const SPECIES: SpeciesSpec[] = [
  { name: 'round',    coord: [0, 45] },
  { name: 'conical',  coord: [0, 186] },
  { name: 'umbrella', coord: [0, 4] },
  { name: 'weeping',  coord: [-92, -79] },
  { name: 'wispy',    coord: [0, 62] },
  { name: 'frond',    coord: [0, 55] }
];
const SPACING = 9;

// Debug query params (dev-only harness):
//   ?only=weeping  -> render just that species, centered, with a closer camera
//                     (high-detail judging of the species you're tuning).
// Default (no param) keeps the all-6 side-by-side regression view.
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const ONLY = QS.get('only');

const _id = new THREE.Matrix4();

/** Build a tree's three InstancedMeshes (count 1, identity) sharing the materials. */
function buildTreeMeshes(
  seed: number,
  force: TreeSilhouette | undefined,
  mats: { bark: THREE.Material; leaf: THREE.Material; blossom: THREE.Material }
): { group: THREE.Group; silhouette: TreeSilhouette } {
  const profile = buildTreeProfile(seed);
  if (force) profile.silhouette = force;
  const arch = generateTree(seed, paramsFromProfile(profile));
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry | null | undefined, mat: THREE.Material) => {
    if (!geo || geo.attributes.position.count === 0) return;
    const im = new THREE.InstancedMesh(geo, mat, 1);
    im.setMatrixAt(0, _id);
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    group.add(im);
  };
  add(arch.trunkGeometry, mats.bark);
  add(arch.leafGeometry, mats.leaf);
  add(arch.blossomGeometry, mats.blossom);
  return { group, silhouette: profile.silhouette };
}

function Scene() {
  const mats = useMemo(
    () => ({ bark: createBarkMaterial(), leaf: createLeafMaterial(), blossom: createBlossomMaterial() }),
    []
  );
  const sun = useMemo(() => new THREE.Vector3(0.45, 0.85, 0.35).normalize(), []);
  const moon = useMemo(() => sun.clone().negate(), [sun]);

  const trees = useMemo(() => {
    const list = ONLY ? SPECIES.filter(s => s.name === ONLY) : SPECIES;
    return list.map((s, i) => {
      const seed = coordinateToSeed(s.coord[0], s.coord[1]);
      const { group, silhouette } = buildTreeMeshes(seed, s.force, mats);
      const x = (i - (list.length - 1) / 2) * SPACING;
      group.position.set(x, 0, 0);
      return { name: s.name, x, group, silhouette, seed };
    });
  }, [mats]);

  // Drive wind/SSS exactly like the game (so the look matches 1:1).
  useFrame(state => {
    updateTreeMaterials(
      mats.bark as THREE.MeshStandardMaterial,
      mats.leaf as THREE.MeshStandardMaterial,
      mats.blossom as THREE.MeshStandardMaterial,
      null,
      state.clock.elapsedTime,
      sun,
      moon,
      getGraphicsQuality()
    );
  });

  return (
    <>
      <color attach="background" args={['#9fb0c4']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 9]} intensity={1.4} />
      <directionalLight position={[-9, 5, -7]} intensity={0.35} color="#a9c2ff" />
      <gridHelper args={[90, 45, '#5b6675', '#49525e']} />
      {trees.map(t => (
        <group key={t.name}>
          <primitive object={t.group} />
          <Html position={[t.x, -1.2, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#0e1116', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {t.name}{t.silhouette !== t.name ? ` (→${t.silhouette})` : ''}
            </div>
          </Html>
        </group>
      ))}
      <OrbitControls target={[0, ONLY ? 4 : 3.5, 0]} />
    </>
  );
}

// Single-species close-up zooms the camera right in; the all-6 view stays wide.
const CAMERA = ONLY
  ? { position: [0, 4.5, 14] as [number, number, number], fov: 38, near: 0.1, far: 500 }
  : { position: [0, 6, 38] as [number, number, number], fov: 42, near: 0.1, far: 500 };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Canvas camera={CAMERA}>
      <Scene />
    </Canvas>
  </StrictMode>
);
