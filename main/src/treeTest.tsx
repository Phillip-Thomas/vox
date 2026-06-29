// =============================================================================
// TREE TEST HARNESS — isolated, well-lit viewer for the tree generator.
// =============================================================================
//
// WHY: debugging tree generation by hunting for the right species in the live
// game (right biome, right LOD, right camera, behind the menu) is slow and
// unreliable. This renders trees in a clean, centered, evenly-lit empty scene
// using the EXACT same generator + materials as the game (generateTree +
// treeMaterials + the per-planet treeProfile colours), so you can see them
// without question.
//
// COLOUR IS REAL NOW: every tree gets its OWN material instances and has its
// per-seed profile pushed in via applyTreeProfileToMaterials — so the canopy
// colour matches what that seed grows in-game (biome-anchored hue, flower
// accent, bloom). A single SHARED material set could only ever show one colour;
// that was the old harness's blind spot.
//
// MODES (query string):
//   (default)            VARIETY GRID — many real seeds in a grid so you can see
//                        the natural spread of silhouette AND biome colour.
//                        ?count=36 ?cols=6 to resize.
//   ?mode=silhouettes    the 6 named silhouettes in a row (geometry regression),
//                        now colour-correct.
//   ?only=weeping        a single forced silhouette, close-up, for tuning one.
//
// HOW TO USE:
//   1. Dev server running (npm run dev in main/).
//   2. Open  http://localhost:5173/tree-test.html
//   3. Orbit/zoom with the mouse. Each label shows silhouette + biome kind.
//   4. Headless screenshot: point Playwright at the URL (no ?agent / menu / world
//      needed), wait ~3s for shaders + the one-frame colour apply, screenshot.
//
// This is a DEV-ONLY entry (separate Vite html), so it never touches the game
// bundle or App.tsx.
//
// Docs trail: see TODO.md ("Dev harnesses") and memory `tree-test-harness`.
// =============================================================================

import { StrictMode, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { generateTree, type TreeSilhouette } from './utils/treeGen.ts';
import {
  buildTreeProfile,
  paramsFromProfile,
  SILHOUETTES,
  type LeafMode,
  type TreeProfile
} from './utils/treeProfile.ts';
import { buildBiomeProfile } from './utils/biomeProfile.ts';
import { coordinateToSeed } from './utils/worldCoordinates.ts';
import {
  createBarkMaterial,
  createLeafMaterial,
  createBlossomMaterial,
  applyTreeProfileToMaterials,
  updateTreeMaterials
} from './utils/treeMaterials.ts';
import { getGraphicsQuality } from './config/graphicsSettings.ts';

interface SpeciesSpec {
  name: string;
  coord: [number, number];          // a real world coord (genuine in-game seed)
  force?: TreeSilhouette;           // optional: force this silhouette on the seed
}

// Representative real worlds per silhouette (probed). Weeping uses the user's
// reported upside-down example (-92,-79). Used by ?mode=silhouettes.
const SPECIES: SpeciesSpec[] = [
  { name: 'round',    coord: [0, 45] },
  { name: 'conical',  coord: [0, 186] },
  { name: 'umbrella', coord: [0, 4] },
  { name: 'weeping',  coord: [-92, -79] },
  { name: 'wispy',    coord: [0, 62] },
  { name: 'frond',    coord: [0, 55] }
];

// Query params (dev-only harness).
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const ONLY = QS.get('only');
const MODE = QS.get('mode');
const COUNT = Math.max(1, Math.min(64, Number(QS.get('count')) || 24));
const COLS = Math.max(1, Math.min(12, Number(QS.get('cols')) || 6));

const _id = new THREE.Matrix4();

interface TreeMats {
  bark: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  blossom: THREE.MeshStandardMaterial;
}

interface BuiltTree {
  key: string;
  group: THREE.Group;
  silhouette: TreeSilhouette;
  kind: string;
  profile: TreeProfile;
  mats: TreeMats;
  seed: number;
}

declare global {
  interface Window {
    __treeTest?: {
      summary: () => Array<{
        key: string;
        silhouette: TreeSilhouette;
        kind: string;
        seed: number;
        trunkHeight: number;
        crownRadius: number;
        canopyDensity: number;
        leafScale: number;
        wind: {
          strength: number;
          gustStrength: number;
          gustScale: number;
          gustSpeed: number;
          turbulence: number;
          veer: number;
        };
        species: {
          branchJointAngle: number;
          whorlCount: number;
          gnarl: number;
          gravitropism: number;
          apicalDominance: number;
          apicalDominanceDecay: number;
          branchStiffness: number;
          foliageSpacing: number;
          foliageThreshold: number;
          foliageDroop: number;
          trunkFlare: number;
          trunkRoughness: number;
          thinFineBranches: number;
        };
        meshes: Array<{
          materialKey: string;
          vertices: number;
          instances: number;
        }>;
      }>;
    };
  }
}

/**
 * Build one tree as three InstancedMeshes (count 1, identity) with ITS OWN
 * material set, so each tree can carry its own per-seed colours. The profile
 * colours are pushed into the materials lazily in useFrame (once the shaders
 * have compiled and the colour uniforms exist).
 */
function buildTree(key: string, seed: number, force: TreeSilhouette | undefined): BuiltTree {
  const profile = buildTreeProfile(seed);
  if (force) {
    profile.silhouette = force;
    profile.shapeId = SILHOUETTES.indexOf(force);
    profile.leafMode = (force === 'conical' ? 1 : force === 'frond' ? 2 : 0) as LeafMode;
  }
  const arch = generateTree(seed, paramsFromProfile(profile));

  const mats: TreeMats = {
    bark: createBarkMaterial(),
    leaf: createLeafMaterial(),
    blossom: createBlossomMaterial()
  };

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

  return { key, group, silhouette: profile.silhouette, kind: buildBiomeProfile(seed).kind, profile, mats, seed };
}

// Decorrelated lattice of real world coords -> a wide spread of biomes (hue +
// silhouette). Prime-ish steps so neighbouring grid cells aren't similar seeds.
function varietyCoord(i: number): [number, number] {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return [col * 13 - row * 7 + 3, row * 17 + col * 5 + 11];
}

function Scene() {
  const sun = useMemo(() => new THREE.Vector3(0.45, 0.85, 0.35).normalize(), []);
  const moon = useMemo(() => sun.clone().negate(), [sun]);
  const appliedRef = useRef<Set<string>>(new Set());

  // Layout + tree construction per mode.
  const trees = useMemo<BuiltTree[]>(() => {
    const sx = MODE === 'silhouettes' ? 8 : 8.4;
    const sz = 10.2;
    if (ONLY) {
      const spec = SPECIES.find(s => s.name === ONLY) ?? SPECIES[0];
      const t = buildTree(spec.name, coordinateToSeed(spec.coord[0], spec.coord[1]), spec.force);
      t.group.position.set(0, 0, 0);
      return [t];
    }
    if (MODE === 'silhouettes') {
      return SPECIES.map((s, i) => {
        const t = buildTree(s.name, coordinateToSeed(s.coord[0], s.coord[1]), s.force);
        t.group.position.set((i - (SPECIES.length - 1) / 2) * sx, 0, 0);
        return t;
      });
    }
    // Default: variety grid.
    const rows = Math.ceil(COUNT / COLS);
    const list: BuiltTree[] = [];
    for (let i = 0; i < COUNT; i++) {
      const [cx, cy] = varietyCoord(i);
      const t = buildTree(`v${i}`, coordinateToSeed(cx, cy), undefined);
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = (col - (COLS - 1) / 2) * sx;
      const z = (row - (rows - 1) / 2) * sz;
      t.group.position.set(x, 0, -z);
      list.push(t);
    }
    return list;
  }, []);

  useEffect(() => {
    window.__treeTest = {
      summary: () =>
        trees.map(t => {
          const params = paramsFromProfile(t.profile);
          const meshes: Array<{ materialKey: string; vertices: number; instances: number }> = [];
          t.group.traverse(object => {
            if (!(object as THREE.InstancedMesh).isInstancedMesh) return;
            const mesh = object as THREE.InstancedMesh;
            const material = mesh.material as THREE.Material & {
              customProgramCacheKey?: () => string;
            };
            let materialKey = '';
            try { materialKey = material.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
            meshes.push({
              materialKey,
              vertices: mesh.geometry.attributes.position.count,
              instances: mesh.count
            });
          });
          return {
            key: t.key,
            silhouette: t.silhouette,
            kind: t.kind,
            seed: t.seed,
            trunkHeight: t.profile.trunkHeight,
            crownRadius: params.crownRadius,
            canopyDensity: t.profile.canopyDensity,
            leafScale: t.profile.leafScale,
            wind: {
              strength: t.profile.wind.strength,
              gustStrength: t.profile.wind.gustStrength,
              gustScale: t.profile.wind.gustScale,
              gustSpeed: t.profile.wind.gustSpeed,
              turbulence: t.profile.wind.turbulence,
              veer: t.profile.wind.veer
            },
            species: {
              branchJointAngle: t.profile.branchJointAngle,
              whorlCount: t.profile.whorlCount,
              gnarl: t.profile.gnarl,
              gravitropism: t.profile.gravitropism,
              apicalDominance: t.profile.apicalDominance,
              apicalDominanceDecay: t.profile.apicalDominanceDecay,
              branchStiffness: t.profile.branchStiffness,
              foliageSpacing: t.profile.foliageSpacing,
              foliageThreshold: t.profile.foliageThreshold,
              foliageDroop: t.profile.foliageDroop,
              trunkFlare: t.profile.trunkFlare,
              trunkRoughness: t.profile.trunkRoughness,
              thinFineBranches: t.profile.thinFineBranches
            },
            meshes
          };
        })
    };
    return () => {
      delete window.__treeTest;
    };
  }, [trees]);

  // Apply per-tree colours once shaders compile, then drive wind/SSS every frame
  // for every tree (1:1 with the game's updateTreeMaterials).
  useFrame(state => {
    const quality = getGraphicsQuality();
    for (const t of trees) {
      if (!appliedRef.current.has(t.key) && t.mats.leaf.userData.shader) {
        applyTreeProfileToMaterials(t.profile, t.mats.bark, t.mats.leaf, t.mats.blossom, null);
        appliedRef.current.add(t.key);
      }
      updateTreeMaterials(t.mats.bark, t.mats.leaf, t.mats.blossom, null, state.clock.elapsedTime, sun, moon, quality);
    }
  });

  const labelScale = ONLY ? 18 : MODE === 'silhouettes' ? 18 : 26;

  return (
    <>
      <color attach="background" args={['#9fb0c4']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 9]} intensity={1.4} />
      <directionalLight position={[-9, 5, -7]} intensity={0.35} color="#a9c2ff" />
      <gridHelper args={[160, 80, '#5b6675', '#49525e']} />
      {trees.map(t => (
        <group key={t.key}>
          <primitive object={t.group} />
          <Html
            position={[t.group.position.x, -1.2, t.group.position.z]}
            center
            distanceFactor={labelScale}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{ color: '#0e1116', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>
              {t.silhouette}
              <br />
              <span style={{ fontWeight: 400, opacity: 0.8 }}>{t.kind}</span>
            </div>
          </Html>
        </group>
      ))}
      <OrbitControls target={[0, ONLY ? 5.8 : 5.2, 0]} />
    </>
  );
}

// Camera framing per mode: close-up for ?only, a wide row for silhouettes, and a
// pulled-back high angle for the variety grid (so the whole grid is in frame).
const ROWS = Math.ceil(COUNT / COLS);
const CAMERA: { position: [number, number, number]; fov: number; near: number; far: number } = ONLY
  ? { position: [0, 6.1, 14.5], fov: 36, near: 0.1, far: 1000 }
  : MODE === 'silhouettes'
    ? { position: [0, 7.8, 46], fov: 42, near: 0.1, far: 1000 }
    : { position: [0, Math.max(15, ROWS * 5.6), Math.max(42, COLS * 7 + ROWS * 3.6)], fov: 46, near: 0.1, far: 1000 };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Canvas camera={CAMERA}>
      <Scene />
    </Canvas>
  </StrictMode>
);
