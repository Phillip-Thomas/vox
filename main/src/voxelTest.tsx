// =============================================================================
// VOXEL MATERIAL TEST HARNESS — isolated viewer for block shader effects.
// =============================================================================
//
// WHY: debugging voxel materials in the live game is slow and ambiguous: the
// right biome/material may not be visible, camera distance hides detail, and a
// single story stage makes it hard to compare whether an effect exists or is too
// subtle. This renders the EXACT shared voxel material (createVoxelMaterial)
// against every MaterialType with the same instance attributes the game uses.
//
// MODES (query string):
//   (default)         all render materials down the rows, reality stages across
//                     columns: bare, color, material, alive, paradox.
//   ?only=dirt        close-up stage strip for one material.
//   ?focus=dirt       dirt plus nearby comparison materials (stone/grass/sand).
//   ?seed=12345       planet wind/tint seed used by block surface effects.
//   ?profile=HIGH     graphics quality profile for shader gates.
//   ?effects=sand     spawned sand dust surface-effect patch.
//   ?effects=dirt     spawned loose-soil / micro-life surface-effect patch.
//   ?effects=lava     spawned lava ember + thermal surface patch.
//   ?effects=flora    spawned procedural flora ecology patch.
//   ?effects=fauna    spawned procedural fauna ecology patch.
//   ?effects=fauna&species=runner  isolated, deterministic fauna specimen.
//   ?effects=fauna&species=all     isolated comparison of every fauna kind.
//   &phase=0.25&pose=0.5&freeze=1  pin specimen animation for visual diffs.
//   &light=front|back|night        fixed specimen lighting for the fauna atlas.
//
// USE:
//   1. Dev server running (npm run dev in main/).
//   2. Open http://localhost:5173/voxel-test.html?focus=dirt
//   3. Orbit/zoom. Dirt should visibly gain clods, pebbles, dry wisps, and
//      living burrow/thread marks from material -> alive -> paradox.
//
// This is a DEV-ONLY entry (separate Vite html), so it never touches App.tsx.
// =============================================================================

import { StrictMode, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MATERIAL_ORDER, MATERIALS, MaterialType, materialId } from './types/materials.ts';
import SurfaceEffectField from './components/SurfaceEffectField.tsx';
import FloraField from './components/FloraField.tsx';
import FaunaField from './components/FaunaField.tsx';
import { FAUNA_KINDS, FAUNA_MODEL_SCHEMA_VERSION, type FaunaKind } from './utils/faunaModel.ts';
import {
  applyFaunaWindProfileToMaterial,
  buildFaunaProfile,
  createFaunaGeometry,
  createFaunaMaterial,
  faunaScaleForKind,
  prepareFaunaInstanceAttributes,
  updateFaunaMaterial
} from './utils/faunaField.ts';
import {
  createVoxelMaterial,
  updateVoxelMaterial,
  applyTerrainProfileToMaterial,
  applyVoxelWindProfileToMaterial
} from './utils/voxelMaterial.ts';
import { buildTerrainProfile } from './utils/terrainProfile.ts';
import { buildWindProfile } from './utils/windProfile.ts';
import {
  VOXEL_REALITY_PRESETS,
  type VoxelRealityStage
} from './game/systems/realityRenderSystem.ts';
import {
  DEFAULT_PROFILE,
  getGraphicsQuality,
  getQualityProfile,
  overrideGraphicsQuality,
  QUALITY_PROFILES,
  setQualityProfile,
  type QualityProfile
} from './config/graphicsSettings.ts';
import { voxelSystem } from './utils/efficientVoxelSystem.ts';
import { voxelCoordToWorld } from './utils/cubeGravityConstants.ts';
import { buildPlanetArtDirection } from './utils/planetArtDirection.ts';
import { isMaterialEligibleForEcology, surfaceEffectWeight } from './utils/planetEcology.ts';

const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const ONLY = QS.get('only') as MaterialType | null;
const FOCUS = QS.get('focus') as MaterialType | null;
const EFFECTS = QS.get('effects');
const SEED = Number(QS.get('seed')) || 12345;
const REQUESTED_PROFILE = (QS.get('profile') ?? '').toUpperCase() as QualityProfile;
const PROFILE = REQUESTED_PROFILE in QUALITY_PROFILES ? REQUESTED_PROFILE : DEFAULT_PROFILE;
if (PROFILE !== getQualityProfile()) setQualityProfile(PROFILE);
const EFFECT_FLORA = EFFECTS === 'flora';
const EFFECT_FAUNA = EFFECTS === 'fauna';
const REQUESTED_FAUNA_SPECIES = QS.get('species');
const FAUNA_SPECIMEN_SELECTION: FaunaKind | 'all' | null =
  REQUESTED_FAUNA_SPECIES === 'all'
    ? 'all'
    : FAUNA_KINDS.includes(REQUESTED_FAUNA_SPECIES as FaunaKind)
      ? REQUESTED_FAUNA_SPECIES as FaunaKind
      : null;
const queryUnitValue = (name: string, fallback: number): number => {
  const raw = QS.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? THREE.MathUtils.clamp(parsed, 0, 1) : fallback;
};
const FAUNA_SPECIMEN_PHASE = queryUnitValue('phase', 0.18);
const FAUNA_SPECIMEN_POSE = queryUnitValue('pose', 0);
const FAUNA_SPECIMEN_FROZEN = /^(1|true|yes)$/i.test(QS.get('freeze') ?? '');
type FaunaSpecimenLight = 'front' | 'back' | 'night';
const REQUESTED_FAUNA_LIGHT = QS.get('light');
const FAUNA_SPECIMEN_LIGHT: FaunaSpecimenLight =
  REQUESTED_FAUNA_LIGHT === 'back' || REQUESTED_FAUNA_LIGHT === 'night'
    ? REQUESTED_FAUNA_LIGHT
    : 'front';
type FaunaSpecimenView = 'threequarter' | 'side' | 'top';
const REQUESTED_FAUNA_VIEW = QS.get('view');
const FAUNA_SPECIMEN_VIEW: FaunaSpecimenView =
  REQUESTED_FAUNA_VIEW === 'side' || REQUESTED_FAUNA_VIEW === 'top'
    ? REQUESTED_FAUNA_VIEW
    : 'threequarter';
type EffectMaterial = MaterialType.SAND | MaterialType.DIRT | MaterialType.LAVA;
const EFFECT_MATERIAL: EffectMaterial | null =
  EFFECTS === 'sand'
    ? MaterialType.SAND
    : EFFECTS === 'dirt'
      ? MaterialType.DIRT
      : EFFECTS === 'lava'
        ? MaterialType.LAVA
        : null;
if (EFFECT_FAUNA) {
  const quality = getGraphicsQuality();
  overrideGraphicsQuality({
    faunaDensity: Math.max(quality.faunaDensity, 0.55),
    faunaMaxDistance: Math.max(quality.faunaMaxDistance, 120)
  });
}

const STAGES: VoxelRealityStage[] = ['bare', 'color', 'material', 'alive', 'paradox'];
const FOCUS_NEIGHBORS: Record<string, MaterialType[]> = {
  [MaterialType.DIRT]: [MaterialType.DIRT, MaterialType.GRASS, MaterialType.SAND, MaterialType.STONE],
  [MaterialType.SAND]: [MaterialType.SAND, MaterialType.DIRT, MaterialType.GRASS, MaterialType.BASALT],
  [MaterialType.LAVA]: [MaterialType.LAVA, MaterialType.BASALT, MaterialType.STONE, MaterialType.CRYSTAL],
  [MaterialType.ICE]: [MaterialType.ICE, MaterialType.CRYSTAL, MaterialType.STONE, MaterialType.SAND]
};

const materialSet = new Set(MATERIAL_ORDER);
const MATERIALS_TO_SHOW: MaterialType[] = ONLY && materialSet.has(ONLY)
  ? [ONLY]
  : FOCUS && FOCUS_NEIGHBORS[FOCUS]
    ? FOCUS_NEIGHBORS[FOCUS]
    : MATERIAL_ORDER;

const CUBE_SIZE = ONLY ? 2.35 : FOCUS ? 2.05 : 1.38;
const ROW_GAP = ONLY ? 0 : FOCUS ? 2.8 : 2.05;
const COL_GAP = ONLY ? 3.25 : FOCUS ? 3.25 : 3.0;
const SURFACE_Y = 7.5;

const matrix = new THREE.Matrix4();
const color = new THREE.Color();

declare global {
  interface Window {
    __voxelTest?: {
      summary: () => {
        seed: number;
        profile: QualityProfile;
        stages: VoxelRealityStage[];
        materials: string[];
        mode: 'all' | 'focus' | 'only' | 'effects';
      };
    };
  }
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function makeVoxelMesh(stage: VoxelRealityStage, materials: MaterialType[]): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 8, 8, 8);
  const data = new THREE.InstancedBufferAttribute(new Float32Array(materials.length * 2), 2);
  geometry.setAttribute('aInstanceData', data);

  const material = createVoxelMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, materials.length);
  mesh.frustumCulled = false;

  materials.forEach((mat, index) => {
    const z = (index - (materials.length - 1) / 2) * ROW_GAP;
    matrix.makeTranslation(0, SURFACE_Y, z);
    mesh.setMatrixAt(index, matrix);
    color.copy(MATERIALS[mat].color);
    mesh.setColorAt(index, color);
    data.setXY(index, materialId(mat), 0);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  data.needsUpdate = true;
  mesh.userData.stage = stage;
  mesh.userData.material = material;
  return mesh;
}

function VoxelStageColumn({
  stage,
  x,
  materials
}: {
  stage: VoxelRealityStage;
  x: number;
  materials: MaterialType[];
}) {
  const terrainProfile = useMemo(() => buildTerrainProfile(SEED), []);
  const windProfile = useMemo(() => buildWindProfile(SEED), []);
  const appliedRef = useRef(false);
  const mesh = useMemo(() => makeVoxelMesh(stage, materials), [stage, materials]);

  useFrame(({ clock }) => {
    const material = mesh.userData.material as THREE.MeshStandardMaterial;
    if (!appliedRef.current && material.userData.shader) {
      applyTerrainProfileToMaterial(terrainProfile, material);
      applyVoxelWindProfileToMaterial(windProfile, material);
      appliedRef.current = true;
    }
    updateVoxelMaterial(material, clock.elapsedTime, getGraphicsQuality(), VOXEL_REALITY_PRESETS[stage]);
  });

  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);

  return (
    <group position={[x, 0, 0]}>
      <primitive object={mesh} />
      <Html position={[0, SURFACE_Y + CUBE_SIZE * 0.82, -(materials.length * ROW_GAP) / 2 - 1.1]} center>
        <div style={stageLabelStyle}>{stage.toUpperCase()}</div>
      </Html>
    </group>
  );
}

function Labels({ materials }: { materials: MaterialType[] }) {
  return (
    <group>
      {materials.map((mat, index) => (
        <Html
          key={mat}
          position={[-((STAGES.length - 1) / 2) * COL_GAP - 2.25, SURFACE_Y, (index - (materials.length - 1) / 2) * ROW_GAP]}
          center
        >
          <div style={materialLabelStyle}>{titleCase(mat)}</div>
        </Html>
      ))}
    </group>
  );
}

function Scene() {
  const materials = MATERIALS_TO_SHOW;
  const mode = ONLY ? 'only' : FOCUS ? 'focus' : 'all';

  if (EFFECT_FLORA) return <FloraEffectScene />;
  if (EFFECT_FAUNA) {
    return FAUNA_SPECIMEN_SELECTION
      ? <FaunaSpecimenScene selection={FAUNA_SPECIMEN_SELECTION} />
      : <FaunaEffectScene />;
  }
  if (EFFECT_MATERIAL) return <SurfaceEffectScene materialType={EFFECT_MATERIAL} />;

  useEffect(() => {
    window.__voxelTest = {
      summary: () => ({
        seed: SEED,
        profile: PROFILE,
        stages: STAGES,
        materials,
        mode
      })
    };
    return () => {
      delete window.__voxelTest;
    };
  }, [materials, mode]);

  const cameraTargetZ = 0;
  return (
    <>
      <color attach="background" args={['#8798aa']} />
      <fog attach="fog" args={['#8798aa', 34, 82]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#d9f0ff', '#4f3629', 0.86]} />
      <directionalLight position={[8, 17, 7]} intensity={1.7} color="#fff4da" />
      <directionalLight position={[0, 11, 18]} intensity={0.45} color="#dfefff" />
      <directionalLight position={[-9, 8, -8]} intensity={0.32} color="#9bbdff" />
      <gridHelper args={[80, 40, '#546273', '#46515d']} position={[0, SURFACE_Y - CUBE_SIZE / 2 - 0.02, 0]} />
      {STAGES.map((stage, index) => (
        <VoxelStageColumn
          key={stage}
          stage={stage}
          x={(index - (STAGES.length - 1) / 2) * COL_GAP}
          materials={materials}
        />
      ))}
      <Labels materials={materials} />
      <Html position={[0, SURFACE_Y + CUBE_SIZE * 1.45, (materials.length * Math.max(ROW_GAP, 1.6)) / 2 + 2.2]} center>
        <div style={headerStyle}>
          Voxel material shader stages · seed {SEED} · {PROFILE} · {mode}
        </div>
      </Html>
      <OrbitControls target={[0, SURFACE_Y, cameraTargetZ]} makeDefault />
    </>
  );
}

function EffectPatchCubes({
  coords,
  materialType,
  terrainSeed = SEED
}: {
  coords: Array<[number, number, number]>;
  materialType: MaterialType.SAND | MaterialType.DIRT | MaterialType.GRASS | MaterialType.LAVA;
  terrainSeed?: number;
}) {
  const terrainProfile = useMemo(() => buildTerrainProfile(terrainSeed), [terrainSeed]);
  const windProfile = useMemo(() => buildWindProfile(terrainSeed), [terrainSeed]);
  const appliedRef = useRef(false);
  const mesh = useMemo(() => {
    const geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
    const data = new THREE.InstancedBufferAttribute(new Float32Array(coords.length * 2), 2);
    geometry.setAttribute('aInstanceData', data);
    const material = createVoxelMaterial();
    const im = new THREE.InstancedMesh(geometry, material, coords.length);
    coords.forEach(([x, y, z], index) => {
      const p = voxelCoordToWorld(x, y, z);
      matrix.makeTranslation(p.x, p.y, p.z);
      im.setMatrixAt(index, matrix);
      im.setColorAt(index, MATERIALS[materialType].color);
      data.setXY(index, materialId(materialType), 0);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    data.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [coords, materialType]);

  useFrame(({ clock }) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!appliedRef.current && material.userData.shader) {
      applyTerrainProfileToMaterial(terrainProfile, material);
      applyVoxelWindProfileToMaterial(windProfile, material);
      appliedRef.current = true;
    }
    updateVoxelMaterial(material, clock.elapsedTime, getGraphicsQuality(), VOXEL_REALITY_PRESETS.alive);
  });

  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);

  return <primitive object={mesh} />;
}

// The requested effect must actually exist on the harness planet: the seed's
// archetype gates which materials get surface effects (e.g. volcanic planets
// have no dirt micro-life). Scan deterministically from the requested seed to
// the nearest seed whose art direction supports the requested material, so
// ?effects=sand / ?effects=dirt ALWAYS shows the effect being inspected.
function findEffectHarnessSeed(materialType: EffectMaterial, baseSeed: number): number {
  const weightKey = materialType === MaterialType.SAND
    ? 'sandDust'
    : materialType === MaterialType.LAVA
      ? 'lavaHeat'
      : 'looseSoilLife';
  for (let i = 0; i < 64; i++) {
    const candidate = baseSeed + i * 7919;
    const art = buildPlanetArtDirection(candidate);
    if (
      isMaterialEligibleForEcology(art, 'surfaceEffects', materialType) &&
      surfaceEffectWeight(art, weightKey) > 0.25
    ) {
      return candidate;
    }
  }
  return baseSeed;
}

// Expose the scene so headless probes can audit which effect layers rendered.
function DebugSceneHook() {
  const scene = useThree(state => state.scene);
  useEffect(() => {
    (window as unknown as { __voxelTestScene?: THREE.Scene }).__voxelTestScene = scene;
    return () => {
      delete (window as unknown as { __voxelTestScene?: THREE.Scene }).__voxelTestScene;
    };
  }, [scene]);
  return null;
}

function SurfaceEffectScene({ materialType }: { materialType: EffectMaterial }) {
  const coords = useMemo<Array<[number, number, number]>>(() => {
    const list: Array<[number, number, number]> = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -4; z <= 4; z++) {
        list.push([x, 25, z]);
      }
    }
    return list;
  }, []);
  const effectSeed = useMemo(() => findEffectHarnessSeed(materialType, SEED), [materialType]);
  const player = useMemo(() => new THREE.Vector3(0, 52, 14), []);
  const effectLabel = materialType === MaterialType.SAND
    ? 'sand saltation'
    : materialType === MaterialType.LAVA
      ? 'thermal channels + embers'
      : 'loose dirt micro-life';
  const fieldLabel = materialType === MaterialType.SAND
    ? 'Blowing sand field'
    : materialType === MaterialType.LAVA
      ? 'Cooling lava field'
      : 'Loose soil + worms';

  useEffect(() => {
    // Inspection harness: force enough density/distance that the effect under
    // review is unmistakable regardless of the device profile defaults.
    const quality = getGraphicsQuality();
    overrideGraphicsQuality({
      voxelEffectDensity: Math.max(quality.voxelEffectDensity, 1.1),
      voxelEffectMaxDistance: Math.max(quality.voxelEffectMaxDistance, 140)
    });
  }, []);

  useEffect(() => {
    voxelSystem.reset();
    const color = MATERIALS[materialType].color;
    coords.forEach(([x, y, z]) => {
      voxelSystem.addVoxel(x, y, z, materialType, color, undefined, {
        supportsSurfaceResources: true
      });
    });
    window.__voxelTest = {
      summary: () => ({
        seed: effectSeed,
        profile: PROFILE,
        stages: STAGES,
        materials: [materialType],
        mode: 'effects'
      })
    };
    return () => {
      delete window.__voxelTest;
      voxelSystem.reset();
    };
  }, [coords, materialType, effectSeed]);

  return (
    <>
      <color attach="background" args={['#8798aa']} />
      <fog attach="fog" args={['#8798aa', 38, 100]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#e2f4ff', '#6c513b', 0.92]} />
      <directionalLight position={[8, 18, 9]} intensity={1.8} color="#fff0ce" />
      <directionalLight position={[-9, 10, -8]} intensity={0.42} color="#9bbdff" />
      <DebugSceneHook />
      <EffectPatchCubes coords={coords} materialType={materialType} terrainSeed={effectSeed} />
      <SurfaceEffectField terrainSeed={effectSeed} playerPosition={player} />
      <Html position={[0, 55.5, -12]} center>
        <div style={headerStyle}>
          Spawned voxel effects · {effectLabel} · seed {effectSeed} · {PROFILE}
        </div>
      </Html>
      <Html position={[-11.5, 51, -8]} center>
        <div style={materialLabelStyle}>{fieldLabel}</div>
      </Html>
      <OrbitControls target={[0, 50.8, 0]} makeDefault />
    </>
  );
}

function FloraEffectScene() {
  const patches = useMemo(() => {
    const byMaterial = new Map<MaterialType.SAND | MaterialType.DIRT | MaterialType.GRASS, Array<[number, number, number]>>([
      [MaterialType.SAND, []],
      [MaterialType.DIRT, []],
      [MaterialType.GRASS, []]
    ]);
    for (let x = -5; x <= 5; x++) {
      for (let z = -4; z <= 4; z++) {
        const materialType =
          z < -1 ? MaterialType.SAND :
            z < 2 ? MaterialType.DIRT :
              MaterialType.GRASS;
        byMaterial.get(materialType)!.push([x, 25, z]);
      }
    }
    return byMaterial;
  }, []);
  const player = useMemo(() => new THREE.Vector3(0, 52, 14), []);

  useEffect(() => {
    voxelSystem.reset();
    for (const [materialType, coords] of patches) {
      const color = MATERIALS[materialType].color;
      coords.forEach(([x, y, z]) => {
        voxelSystem.addVoxel(x, y, z, materialType, color, undefined, {
          supportsSurfaceResources: true
        });
      });
    }
    window.__voxelTest = {
      summary: () => ({
        seed: SEED,
        profile: PROFILE,
        stages: STAGES,
        materials: [MaterialType.SAND, MaterialType.DIRT, MaterialType.GRASS],
        mode: 'effects'
      })
    };
    return () => {
      delete window.__voxelTest;
      voxelSystem.reset();
    };
  }, [patches]);

  return (
    <>
      <color attach="background" args={['#8798aa']} />
      <fog attach="fog" args={['#8798aa', 38, 100]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#e2f4ff', '#5d513d', 0.92]} />
      <directionalLight position={[8, 18, 9]} intensity={1.8} color="#fff0ce" />
      <directionalLight position={[-9, 10, -8]} intensity={0.42} color="#9bbdff" />
      {[MaterialType.SAND, MaterialType.DIRT, MaterialType.GRASS].map(materialType => (
        <EffectPatchCubes
          key={materialType}
          coords={patches.get(materialType)!}
          materialType={materialType}
        />
      ))}
      <FloraField terrainSeed={SEED} playerPosition={player} />
      <Html position={[0, 55.5, -12]} center>
        <div style={headerStyle}>
          Spawned voxel effects · procedural flora · seed {SEED} · {PROFILE}
        </div>
      </Html>
      <Html position={[-11.5, 51, -8]} center>
        <div style={materialLabelStyle}>Climate-weighted plants</div>
      </Html>
      <OrbitControls target={[0, 50.8, 0]} makeDefault />
    </>
  );
}

const FAUNA_SPECIMEN_Y = 50;
const specimenMatrix = new THREE.Matrix4();
const specimenRotation = new THREE.Quaternion();
const specimenScale = new THREE.Vector3();
const specimenPosition = new THREE.Vector3();
const specimenUp = new THREE.Vector3(0, 1, 0);

interface FaunaSpecimenLighting {
  background: string;
  ground: string;
  gridMajor: string;
  gridMinor: string;
  ambient: number;
  sky: string;
  earth: string;
  hemisphere: number;
  keyPosition: [number, number, number];
  keyColor: string;
  keyIntensity: number;
  fillPosition: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  rimPosition: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  sunDirection: THREE.Vector3;
  moonDirection: THREE.Vector3;
}

const FAUNA_SPECIMEN_LIGHTING: Record<FaunaSpecimenLight, FaunaSpecimenLighting> = {
  front: {
    background: '#73818b', ground: '#6b716d', gridMajor: '#879189', gridMinor: '#626964',
    ambient: 0.58, sky: '#e8f5ff', earth: '#5a4b3c', hemisphere: 1.1,
    keyPosition: [10, 18, 12], keyColor: '#fff1d2', keyIntensity: 2.15,
    fillPosition: [-9, 9, 5], fillColor: '#a8ceff', fillIntensity: 0.72,
    rimPosition: [2, 7, -10], rimColor: '#d7e6ff', rimIntensity: 0.5,
    sunDirection: new THREE.Vector3(0.52, 0.78, 0.34).normalize(),
    moonDirection: new THREE.Vector3(-0.4, -0.75, -0.2).normalize()
  },
  back: {
    background: '#687680', ground: '#626a68', gridMajor: '#7e8984', gridMinor: '#555e5b',
    ambient: 0.4, sky: '#deefff', earth: '#4b4037', hemisphere: 0.78,
    keyPosition: [-7, 17, -12], keyColor: '#ffe9bd', keyIntensity: 2.75,
    fillPosition: [8, 8, 11], fillColor: '#b9d5f5', fillIntensity: 0.32,
    rimPosition: [10, 12, -3], rimColor: '#fff6df', rimIntensity: 0.66,
    sunDirection: new THREE.Vector3(-0.4, 0.74, -0.54).normalize(),
    moonDirection: new THREE.Vector3(0.35, -0.8, 0.2).normalize()
  },
  night: {
    background: '#121a24', ground: '#22292d', gridMajor: '#3d4b53', gridMinor: '#28343a',
    ambient: 0.2, sky: '#8fb3e8', earth: '#10141b', hemisphere: 0.62,
    keyPosition: [7, 15, 9], keyColor: '#a9c8ff', keyIntensity: 1.65,
    fillPosition: [-8, 7, 3], fillColor: '#777fd1', fillIntensity: 0.38,
    rimPosition: [1, 10, -10], rimColor: '#b9d8ff', rimIntensity: 0.72,
    sunDirection: new THREE.Vector3(-0.15, -0.92, -0.22).normalize(),
    moonDirection: new THREE.Vector3(0.42, 0.82, 0.32).normalize()
  }
};

function FaunaSpecimenCamera({ comparison }: { comparison: boolean }) {
  const camera = useThree(state => state.camera);

  useEffect(() => {
    const position = comparison
      ? [10.5, 59.2, 20]
      : FAUNA_SPECIMEN_VIEW === 'side'
        ? [0, 53.8, 11.8]
        : FAUNA_SPECIMEN_VIEW === 'top'
          ? [0.01, 64.5, 0.01]
          : [5.8, 54.2, 10.5];
    camera.position.set(position[0], position[1], position[2]);
    camera.near = 0.1;
    camera.far = 180;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = comparison ? 42 : 38;
      camera.updateProjectionMatrix();
    }
  }, [camera, comparison]);

  return null;
}

function faunaSpecimenPosition(kind: FaunaKind, index: number, comparison: boolean): THREE.Vector3 {
  if (!comparison) return new THREE.Vector3(0, FAUNA_SPECIMEN_Y, 0);
  const column = index % 3;
  const row = Math.floor(index / 3);
  const hover = kind === 'dragonfly' ? 1.45 : kind === 'fish' ? 1.05 : 0;
  return new THREE.Vector3((column - 1) * 6.2, FAUNA_SPECIMEN_Y + hover, (row - 0.5) * 5.2);
}

function FaunaSpecimen({
  kind,
  index,
  comparison,
  profile,
  lighting
}: {
  kind: FaunaKind;
  index: number;
  comparison: boolean;
  profile: ReturnType<typeof buildFaunaProfile>;
  lighting: FaunaSpecimenLighting;
}) {
  const mesh = useMemo(() => {
    const geometry = createFaunaGeometry(kind, profile);
    const material = createFaunaMaterial(kind, profile);
    prepareFaunaInstanceAttributes(geometry, 1);
    const instance = new THREE.InstancedMesh(geometry, material, 1);
    const scaleSeed = ((SEED * 0.000013 + index * 0.173) % 1 + 1) % 1;
    const [baseSx, baseSy, baseSz] = faunaScaleForKind(kind, scaleSeed, 1);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 1, 1);
    const naturalExtent = Math.max(bounds.x * baseSx, bounds.y * baseSy, bounds.z * baseSz, 0.001);
    // Specimen mode compares topology and material response, so normalize the
    // display extent without changing the game renderer's world-scale contract.
    const inspectionScale = (comparison ? 3.25 : 4.25) / naturalExtent;
    const sx = baseSx * inspectionScale;
    const sy = baseSy * inspectionScale;
    const sz = baseSz * inspectionScale;
    const groundOffset = -(geometry.boundingBox?.min.y ?? 0) * sy;
    const position = faunaSpecimenPosition(kind, index, comparison);
    if (kind !== 'dragonfly' && kind !== 'fish') position.y += groundOffset;
    if (!comparison && kind === 'dragonfly') position.y += 1.45;
    if (!comparison && kind === 'fish') position.y += 1.05;
    specimenPosition.copy(position);
    specimenScale.set(sx, sy, sz);
    specimenRotation.setFromAxisAngle(specimenUp, comparison ? -0.12 : -0.2);
    specimenMatrix.compose(specimenPosition, specimenRotation, specimenScale);
    instance.setMatrixAt(0, specimenMatrix);
    instance.instanceMatrix.needsUpdate = true;
    instance.frustumCulled = false;
    instance.name = `fauna-specimen-${kind}`;
    instance.userData.faunaSpecimen = {
      schemaVersion: FAUNA_MODEL_SCHEMA_VERSION,
      kind
    };

    const seed = geometry.getAttribute('aFaunaSeed') as THREE.InstancedBufferAttribute;
    const stride = geometry.getAttribute('aFaunaStride') as THREE.InstancedBufferAttribute;
    const pose = geometry.getAttribute('aFaunaPose') as THREE.InstancedBufferAttribute;
    seed.setX(0, scaleSeed);
    stride.setX(0, FAUNA_SPECIMEN_PHASE);
    pose.setX(0, FAUNA_SPECIMEN_POSE);
    seed.needsUpdate = true;
    stride.needsUpdate = true;
    pose.needsUpdate = true;
    return instance;
  }, [comparison, index, kind, profile]);

  useFrame(({ clock }) => {
    const material = mesh.material as THREE.Material;
    const stride = mesh.geometry.getAttribute('aFaunaStride') as THREE.InstancedBufferAttribute;
    const animationTime = FAUNA_SPECIMEN_FROZEN
      ? FAUNA_SPECIMEN_PHASE * Math.PI * 2
      : clock.elapsedTime;
    stride.setX(
      0,
      FAUNA_SPECIMEN_FROZEN
        ? FAUNA_SPECIMEN_PHASE
        : FAUNA_SPECIMEN_PHASE + clock.elapsedTime * (kind === 'dragonfly' ? 0.8 : 0.32)
    );
    stride.needsUpdate = true;
    applyFaunaWindProfileToMaterial(profile.wind, material);
    updateFaunaMaterial(
      material,
      animationTime,
      getGraphicsQuality(),
      VOXEL_REALITY_PRESETS.alive,
      lighting.sunDirection,
      lighting.moonDirection
    );
  });

  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);

  return <primitive object={mesh} />;
}

function FaunaSpecimenScene({ selection }: { selection: FaunaKind | 'all' }) {
  const comparison = selection === 'all';
  const lighting = FAUNA_SPECIMEN_LIGHTING[FAUNA_SPECIMEN_LIGHT];
  const kinds = useMemo<readonly FaunaKind[]>(
    () => comparison ? FAUNA_KINDS : [selection as FaunaKind],
    [comparison, selection]
  );
  const profile = useMemo(() => buildFaunaProfile(SEED), []);
  const target = useMemo<[number, number, number]>(
    () => comparison
      ? [0, FAUNA_SPECIMEN_Y + 1.5, 0]
      : [0.2, FAUNA_SPECIMEN_Y + 1.35, 0],
    [comparison]
  );

  useEffect(() => {
    window.__voxelTest = {
      summary: () => ({
        seed: SEED,
        profile: PROFILE,
        stages: STAGES,
        materials: kinds.map(kind => `fauna:${kind}`),
        mode: 'effects'
      })
    };
    return () => {
      delete window.__voxelTest;
    };
  }, [kinds]);

  return (
    <>
      <color attach="background" args={[lighting.background]} />
      <fog attach="fog" args={[lighting.background, 34, 80]} />
      <ambientLight intensity={lighting.ambient} />
      <hemisphereLight args={[lighting.sky, lighting.earth, lighting.hemisphere]} />
      <directionalLight position={lighting.keyPosition} intensity={lighting.keyIntensity} color={lighting.keyColor} />
      <directionalLight position={lighting.fillPosition} intensity={lighting.fillIntensity} color={lighting.fillColor} />
      <directionalLight position={lighting.rimPosition} intensity={lighting.rimIntensity} color={lighting.rimColor} />
      <FaunaSpecimenCamera comparison={comparison} />
      <DebugSceneHook />
      <mesh position={[0, FAUNA_SPECIMEN_Y - 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[comparison ? 26 : 15, comparison ? 19 : 13]} />
        <meshStandardMaterial color={lighting.ground} roughness={0.96} metalness={0} />
      </mesh>
      <gridHelper
        args={[comparison ? 26 : 15, comparison ? 26 : 15, lighting.gridMajor, lighting.gridMinor]}
        position={[0, FAUNA_SPECIMEN_Y, 0]}
      />
      {kinds.map((kind, index) => (
        <FaunaSpecimen
          key={kind}
          kind={kind}
          index={index}
          comparison={comparison}
          profile={profile}
          lighting={lighting}
        />
      ))}
      <Html position={[0, FAUNA_SPECIMEN_Y + (comparison ? 7.1 : 4.7), comparison ? -5.8 : -3.6]} center>
        <div style={headerStyle}>
          Fauna specimen · {selection} · {FAUNA_SPECIMEN_VIEW} · phase {FAUNA_SPECIMEN_PHASE.toFixed(2)} · {FAUNA_SPECIMEN_LIGHT} light · pose {FAUNA_SPECIMEN_POSE.toFixed(2)} · {FAUNA_SPECIMEN_FROZEN ? 'frozen' : 'animated'}
        </div>
      </Html>
      <OrbitControls target={target} makeDefault />
    </>
  );
}

function FaunaEffectScene() {
  const patches = useMemo(() => {
    const byMaterial = new Map<MaterialType.SAND | MaterialType.DIRT | MaterialType.GRASS, Array<[number, number, number]>>([
      [MaterialType.SAND, []],
      [MaterialType.DIRT, []],
      [MaterialType.GRASS, []]
    ]);
    for (let x = -9; x <= 9; x++) {
      for (let z = -7; z <= 7; z++) {
        const materialType =
          z < -3 ? MaterialType.SAND :
            z < 3 ? MaterialType.DIRT :
              MaterialType.GRASS;
        byMaterial.get(materialType)!.push([x, 25, z]);
      }
    }
    return byMaterial;
  }, []);
  const player = useMemo(() => new THREE.Vector3(0, 56, 22), []);

  useEffect(() => {
    voxelSystem.reset();
    for (const [materialType, coords] of patches) {
      const color = MATERIALS[materialType].color;
      coords.forEach(([x, y, z]) => {
        voxelSystem.addVoxel(x, y, z, materialType, color, undefined, {
          supportsSurfaceResources: true
        });
      });
    }
    window.__voxelTest = {
      summary: () => ({
        seed: SEED,
        profile: PROFILE,
        stages: STAGES,
        materials: [MaterialType.SAND, MaterialType.DIRT, MaterialType.GRASS],
        mode: 'effects'
      })
    };
    return () => {
      delete window.__voxelTest;
      voxelSystem.reset();
    };
  }, [patches]);

  return (
    <>
      <color attach="background" args={['#8798aa']} />
      <fog attach="fog" args={['#8798aa', 46, 118]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#e2f4ff', '#5d513d', 0.92]} />
      <directionalLight position={[9, 19, 10]} intensity={1.8} color="#fff0ce" />
      <directionalLight position={[-10, 11, -9]} intensity={0.42} color="#9bbdff" />
      {[MaterialType.SAND, MaterialType.DIRT, MaterialType.GRASS].map(materialType => (
        <EffectPatchCubes
          key={materialType}
          coords={patches.get(materialType)!}
          materialType={materialType}
        />
      ))}
      <FaunaField terrainSeed={SEED} playerPosition={player} />
      <Html position={[0, 57.2, -16]} center>
        <div style={headerStyle}>
          Spawned voxel effects · procedural fauna test density · seed {SEED} · {PROFILE}
        </div>
      </Html>
      <Html position={[-18.5, 52, -12]} center>
        <div style={materialLabelStyle}>Biome-weighted critters + insects</div>
      </Html>
      <OrbitControls target={[0, 51.2, 0]} makeDefault />
    </>
  );
}

const labelBase: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 11,
  letterSpacing: 0,
  color: '#eaf7ff',
  background: 'rgba(16, 24, 35, 0.72)',
  border: '1px solid rgba(166, 220, 255, 0.3)',
  borderRadius: 6,
  padding: '5px 8px',
  whiteSpace: 'nowrap',
  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.22)',
  pointerEvents: 'none'
};

const stageLabelStyle: CSSProperties = {
  ...labelBase,
  color: '#b8ecff',
  textTransform: 'uppercase'
};

const materialLabelStyle: CSSProperties = {
  ...labelBase,
  minWidth: 76,
  textAlign: 'right'
};

const headerStyle: CSSProperties = {
  ...labelBase,
  fontSize: 12,
  color: '#ffffff',
  background: 'rgba(10, 17, 27, 0.78)',
  width: 'min(92vw, 580px)',
  maxWidth: 580,
  whiteSpace: 'normal',
  textAlign: 'center',
  lineHeight: 1.35,
  overflowWrap: 'anywhere'
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Canvas
      camera={{
        position: (EFFECT_MATERIAL || EFFECT_FLORA) ? [0, 60, 24] : EFFECT_FAUNA ? [0, 64, 34] : ONLY ? [0, 19, 14] : FOCUS ? [0, 18, 19] : [0, 21, 27],
        fov: (EFFECT_MATERIAL || EFFECT_FLORA || EFFECT_FAUNA) ? 44 : ONLY ? 42 : 48,
        near: 0.1,
        far: 1000
      }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <Scene />
    </Canvas>
  </StrictMode>
);
