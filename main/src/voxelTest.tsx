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
//   ?effects=flora    spawned procedural flora ecology patch.
//   ?effects=fauna    spawned procedural fauna ecology patch.
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
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MATERIAL_ORDER, MATERIALS, MaterialType, materialId } from './types/materials.ts';
import SurfaceEffectField from './components/SurfaceEffectField.tsx';
import FloraField from './components/FloraField.tsx';
import FaunaField from './components/FaunaField.tsx';
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
const EFFECT_MATERIAL: MaterialType.SAND | MaterialType.DIRT | null =
  EFFECTS === 'sand' ? MaterialType.SAND : EFFECTS === 'dirt' ? MaterialType.DIRT : null;
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
  if (EFFECT_FAUNA) return <FaunaEffectScene />;
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
  materialType
}: {
  coords: Array<[number, number, number]>;
  materialType: MaterialType.SAND | MaterialType.DIRT | MaterialType.GRASS;
}) {
  const mesh = useMemo(() => {
    const geometry = new THREE.BoxGeometry(1.98, 1.98, 1.98, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: MATERIALS[materialType].color,
      roughness: 0.95,
      metalness: 0
    });
    const im = new THREE.InstancedMesh(geometry, material, coords.length);
    coords.forEach(([x, y, z], index) => {
      const p = voxelCoordToWorld(x, y, z);
      matrix.makeTranslation(p.x, p.y, p.z);
      im.setMatrixAt(index, matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [coords, materialType]);

  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);

  return <primitive object={mesh} />;
}

function SurfaceEffectScene({ materialType }: { materialType: MaterialType.SAND | MaterialType.DIRT }) {
  const coords = useMemo<Array<[number, number, number]>>(() => {
    const list: Array<[number, number, number]> = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -4; z <= 4; z++) {
        list.push([x, 25, z]);
      }
    }
    return list;
  }, []);
  const player = useMemo(() => new THREE.Vector3(0, 52, 14), []);
  const effectLabel = materialType === MaterialType.SAND ? 'sand dust' : 'loose dirt micro-life';
  const fieldLabel = materialType === MaterialType.SAND ? 'Sand dust field' : 'Loose soil + tiny crawlers';

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
        seed: SEED,
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
  }, [coords, materialType]);

  return (
    <>
      <color attach="background" args={['#8798aa']} />
      <fog attach="fog" args={['#8798aa', 38, 100]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#e2f4ff', '#6c513b', 0.92]} />
      <directionalLight position={[8, 18, 9]} intensity={1.8} color="#fff0ce" />
      <directionalLight position={[-9, 10, -8]} intensity={0.42} color="#9bbdff" />
      <EffectPatchCubes coords={coords} materialType={materialType} />
      <SurfaceEffectField terrainSeed={SEED} playerPosition={player} />
      <Html position={[0, 55.5, -12]} center>
        <div style={headerStyle}>
          Spawned voxel effects · {effectLabel} · seed {SEED} · {PROFILE}
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
