import { useEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import storedVantages from './vantages.json';
import { getQualityProfile, type QualityProfile } from '../../config/graphicsSettings';
import { buildPlanetProfile } from '../../game/PlanetProfile';
import { getVoxelRealitySnapshot, type VoxelRealityStage } from '../../game/systems/realityRenderSystem';
import { setPlayerUp } from '../../state/playerFrame';
import { setPlayerSubmerged } from '../../state/playerSubmersion';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants';
import { getWorldGen } from '../../utils/worldGenCache';
import { buildBiomeProfile } from '../../utils/biomeProfile';
import { buildFaunaProfile } from '../../utils/faunaField';
import { buildFloraProfile } from '../../utils/floraField';
import { buildGrassProfile } from '../../utils/grassProfile';
import { buildPlanetArtDirection } from '../../utils/planetArtDirection';
import { buildTerrainProfile } from '../../utils/terrainProfile';
import { buildTreeProfile } from '../../utils/treeProfile';
import { buildWaterProfile } from '../../utils/waterProfile';
import { buildWindProfile } from '../../utils/windProfile';
import type { WorldCoordinate } from '../../utils/worldCoordinates';

// User-authored vantages (recorded via PoseRecorder, filed into vantages.json):
// exact camera pose pinned to a specific world/seed. Replayed verbatim — far
// better framing than computed vantages (e.g. a hand-picked coastline).
interface StoredVantage {
  name: string;
  world: [number, number];
  day: number | null;
  pos: [number, number, number];
  quat: [number, number, number, number];
  reason?: string;
}
const STORED = storedVantages as StoredVantage[];

// --- Verification harness camera + window.__game bridge ----------------------
//
// Mounted ONLY under ?agent=1 (debug). Replaces the FPS/ship camera with a
// scriptable makeDefault camera and exposes `window.__game` so a headed Playwright
// runner (tools/capture.mjs, real GPU) can:
//   • drive the camera to COMPUTED vantages (framed off the live scene, so shots
//     reliably show the canopy/coast/horizon instead of "looking at grass"),
//   • read real FPS / draw-call / triangle metrics,
//   • await ready() (world gen + a few painted frames).
//
// This is the official replacement for the throwaway `window.__three` hack and is
// the gate for the whole visual roadmap: every phase captures before/after here.

export interface AgentMetrics {
  fps: number;
  p50: number;
  p95: number;
  drawCalls: number;
  triangles: number;
  materialCount: number;
  programCount: number;
  estimatedDrawCalls: number;
  estimatedTriangles: number;
  layerCounts: Record<string, number>;
  materialProgramKeys: string[];
}

export interface AgentProfileSummary {
  terrainSeed: number;
  worldCoordinate: WorldCoordinate | null;
  qualityProfile: QualityProfile;
  realityStage: VoxelRealityStage;
  styleReference: {
    primary: 'trees';
    secondary: 'grass';
    notes: string;
  };
  planet: ReturnType<typeof buildPlanetProfile>;
  artDirection: ReturnType<typeof buildPlanetArtDirection>;
  biome: ReturnType<typeof buildBiomeProfile>;
  grass: {
    densityMul: number;
    coverage: number;
    heightMul: number;
    widthMul: number;
    baseColor: string;
    tipColor: string;
    dryColor: string;
  };
  tree: {
    silhouette: string;
    trunkHeight: number;
    canopyDensity: number;
    leafScale: number;
    leafMode: number;
    bloomAmount: number;
    leafColor: string;
    leafTipColor: string;
    flowerColor: string;
  };
  water: {
    deepColor: string;
    shallowColor: string;
    foamColor: string;
  };
  wind: ReturnType<typeof buildWindProfile>;
  terrain: {
    tintColor: string;
    tintStrength: number;
  };
  flora: {
    densityMul: number;
    coverage: number;
    weights: ReturnType<typeof buildFloraProfile>['weights'];
  };
  fauna: {
    densityMul: number;
    coverage: number;
    weights: ReturnType<typeof buildFaunaProfile>['weights'];
  };
}

export interface AgentGame {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Frame the camera on a named vantage computed from the live scene. */
  view: (name: string) => string;
  /** Explicit camera placement. */
  lookFrom: (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => void;
  /** Latest real-GPU performance sample. */
  metrics: () => AgentMetrics;
  /** Clear rolling frame metrics after a scripted camera move / streaming rebuild. */
  resetMetrics: () => void;
  /** Deterministic profile data for the active planet and render state. */
  profiles: () => AgentProfileSummary;
  /** Resolves once the world has generated and several frames have painted. */
  ready: () => Promise<void>;
  /** Available vantage names. */
  vantages: string[];
}

declare global {
  interface Window {
    __game?: AgentGame;
  }
}

interface AgentCameraProps {
  planetSize: number;
  terrainSeed: number;
  /** Publish the camera position so grass/trees/water stream around the vantage. */
  onPositionChange?: (position: THREE.Vector3) => void;
  worldCoordinate?: WorldCoordinate | null;
}

const VANTAGES = [
  'overhead',
  'underCanopy',
  'coast',
  'horizon',
  'tree',
  'fauna',
  'grazer',
  'woolly',
  'runner',
  'hopper',
  'dragonfly',
  'surfaceEffects',
  'material',
  'hazard',
  'mineral',
  'sandDust',
  'dirtLife',
  'pollen',
  'frost',
  'lavaHeat',
  'ash',
  'crystalGlints',
  'metallicFlecks',
  'fungalSpores'
] as const;

function materialKey(material: THREE.Material): string {
  try {
    return (material as THREE.Material & { customProgramCacheKey?: () => string }).customProgramCacheKey?.() ?? '';
  } catch {
    return '';
  }
}

function materialList(material: unknown): THREE.Material[] {
  if (!material) return [];
  return Array.isArray(material) ? material : [material as THREE.Material];
}

function instancedByKey(scene: THREE.Scene, re: RegExp): THREE.InstancedMesh | null {
  let found: THREE.InstancedMesh | null = null;
  scene.traverse(o => {
    if (found || !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const mesh = o as THREE.InstancedMesh;
    if (materialList(mesh.material).some(material => re.test(materialKey(material)))) {
      found = mesh;
    }
  });
  return found;
}

function instancedByName(scene: THREE.Scene, re: RegExp): THREE.InstancedMesh | null {
  let found: THREE.InstancedMesh | null = null;
  scene.traverse(o => {
    if (found || !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const mesh = o as THREE.InstancedMesh;
    if (mesh.count > 0 && re.test(mesh.name)) found = mesh;
  });
  return found;
}

function instancedByMaterial(scene: THREE.Scene, predicate: (material: THREE.Material, key: string) => boolean): THREE.InstancedMesh | null {
  let found: THREE.InstancedMesh | null = null;
  scene.traverse(o => {
    if (found || !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const mesh = o as THREE.InstancedMesh;
    if (materialList(mesh.material).some(material => predicate(material, materialKey(material)))) {
      found = mesh;
    }
  });
  return found;
}

function surfaceEffectMesh(scene: THREE.Scene, ids: string[] = []): THREE.InstancedMesh | null {
  const wanted = new Set(ids);
  return instancedByMaterial(scene, (material, key) => {
    const effectId = String(material.userData?.effectId ?? '');
    if (wanted.size > 0) {
      if (wanted.has('sandDust') && /sand-dust/.test(key)) return true;
      if (wanted.has('dirtLife') && /dirt-life/.test(key)) return true;
      return effectId !== '' && wanted.has(effectId);
    }
    return /sand-dust|dirt-life|surface-phenomenon/.test(key);
  });
}

// The instance (by translation) with the largest +Y — i.e. cleanly on the top
// face — gives reliable, repeatable framing.
function topInstancePos(mesh: THREE.InstancedMesh, out: THREE.Vector3): boolean {
  const arr = mesh.instanceMatrix.array as ArrayLike<number>;
  let bi = -1;
  let by = -Infinity;
  for (let i = 0; i < mesh.count; i++) {
    const y = arr[i * 16 + 13];
    if (y > by) { by = y; bi = i; }
  }
  if (bi < 0) return false;
  out.set(arr[bi * 16 + 12], arr[bi * 16 + 13], arr[bi * 16 + 14]);
  return true;
}

function srgbHex(color: THREE.Color): string {
  return `#${color.clone().convertLinearToSRGB().getHexString()}`;
}

function geometryTriangleCount(geometry: THREE.BufferGeometry | undefined): number {
  if (!geometry) return 0;
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  const position = geometry.attributes.position;
  return position ? Math.floor(position.count / 3) : 0;
}

function sceneLayerReport(scene: THREE.Scene, gl: THREE.WebGLRenderer): Pick<AgentMetrics, 'layerCounts' | 'materialCount' | 'programCount' | 'estimatedDrawCalls' | 'estimatedTriangles' | 'materialProgramKeys'> {
  const layerCounts: Record<string, number> = {
    meshes: 0,
    instancedMeshes: 0,
    voxels: 0,
    grass: 0,
    trees: 0,
    flora: 0,
    fauna: 0,
    water: 0,
    surfaceEffects: 0,
    stones: 0
  };
  const materialUuids = new Set<string>();
  const materialProgramKeys = new Set<string>();
  let estimatedDrawCalls = 0;
  let estimatedTriangles = 0;

  scene.traverse(object => {
    const mesh = object as THREE.Mesh & { isInstancedMesh?: boolean; count?: number };
    if (!mesh.isMesh || !mesh.visible) return;
    layerCounts.meshes++;
    if (mesh.isInstancedMesh) layerCounts.instancedMeshes++;
    const count = mesh.isInstancedMesh ? Math.max(0, mesh.count ?? 0) : 1;
    estimatedTriangles += geometryTriangleCount(mesh.geometry) * count;
    let key = '';
    const materials = materialList(mesh.material);
    estimatedDrawCalls += Math.max(1, materials.length);
    for (const material of materials) {
      materialUuids.add(material.uuid);
      try {
        key = (material as THREE.Material & { customProgramCacheKey?: () => string }).customProgramCacheKey?.() ?? key;
      } catch {
        key = key || '';
      }
    }
    if (key) materialProgramKeys.add(key);
    if (/voxel-pbr/.test(key)) layerCounts.voxels += count;
    else if (/grass-pbr/.test(key)) layerCounts.grass += count;
    else if (/tree-/.test(key)) layerCounts.trees += count;
    else if (/flora-field/.test(key)) layerCounts.flora += count;
    else if (/fauna-field/.test(key)) layerCounts.fauna += count;
    else if (/water-blocks/.test(key)) layerCounts.water += count;
    else if (/sand-dust|dirt-life|surface-phenomenon/.test(key)) layerCounts.surfaceEffects += count;
    else if (/loose-stone/.test(key)) layerCounts.stones += count;
  });

  return {
    layerCounts,
    materialCount: materialUuids.size,
    programCount: (gl.info as { programs?: unknown[] }).programs?.length ?? 0,
    estimatedDrawCalls,
    estimatedTriangles,
    materialProgramKeys: [...materialProgramKeys].sort()
  };
}

function buildProfileSummary(
  terrainSeed: number,
  worldCoordinate: WorldCoordinate | null | undefined
): AgentProfileSummary {
  const planet = buildPlanetProfile(terrainSeed);
  const artDirection = buildPlanetArtDirection(terrainSeed);
  const biome = buildBiomeProfile(terrainSeed);
  const grass = buildGrassProfile(terrainSeed);
  const tree = buildTreeProfile(terrainSeed);
  const water = buildWaterProfile(terrainSeed);
  const wind = buildWindProfile(terrainSeed, biome);
  const terrain = buildTerrainProfile(terrainSeed);
  const flora = buildFloraProfile(terrainSeed);
  const fauna = buildFaunaProfile(terrainSeed);
  const reality = getVoxelRealitySnapshot();

  return {
    terrainSeed,
    worldCoordinate: worldCoordinate ?? null,
    qualityProfile: getQualityProfile(),
    realityStage: reality.stage,
    styleReference: artDirection.styleReference,
    planet,
    artDirection,
    biome,
    grass: {
      densityMul: grass.densityMul,
      coverage: grass.coverage,
      heightMul: grass.heightMul,
      widthMul: grass.widthMul,
      baseColor: srgbHex(grass.baseColor),
      tipColor: srgbHex(grass.tipColor),
      dryColor: srgbHex(grass.dryColor)
    },
    tree: {
      silhouette: tree.silhouette,
      trunkHeight: tree.trunkHeight,
      canopyDensity: tree.canopyDensity,
      leafScale: tree.leafScale,
      leafMode: tree.leafMode,
      bloomAmount: tree.bloomAmount,
      leafColor: srgbHex(tree.leafColor),
      leafTipColor: srgbHex(tree.leafTipColor),
      flowerColor: srgbHex(tree.flowerColor)
    },
    water: {
      deepColor: srgbHex(water.deepColor),
      shallowColor: srgbHex(water.shallowColor),
      foamColor: srgbHex(water.foamColor)
    },
    wind,
    terrain: {
      tintColor: srgbHex(terrain.tintColor),
      tintStrength: terrain.tintStrength
    },
    flora: {
      densityMul: flora.densityMul,
      coverage: flora.coverage,
      weights: flora.weights
    },
    fauna: {
      densityMul: fauna.densityMul,
      coverage: fauna.coverage,
      weights: fauna.weights
    }
  };
}

export default function AgentCamera({ planetSize, terrainSeed, onPositionChange, worldCoordinate = null }: AgentCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const waterGen = getWorldGen(planetSize, terrainSeed).generator;

  const frameTimes = useRef<number[]>([]);
  const lastTime = useRef(0);
  const frameCount = useRef(0);
  const sample = useRef<AgentMetrics>({
    fps: 0,
    p50: 0,
    p95: 0,
    drawCalls: 0,
    triangles: 0,
    materialCount: 0,
    programCount: 0,
    estimatedDrawCalls: 0,
    estimatedTriangles: 0,
    layerCounts: {},
    materialProgramKeys: []
  });

  // Suppress the (ground-thick) fog so distant vantages aren't washed out, like
  // OverviewCamera does. Phase 1 will validate fog separately at ground vantages.
  useEffect(() => {
    const prev = scene.fog;
    // keep fog for ground vantages; only thin it. Leave as-is for now (Phase 1
    // tunes fog) — the harness wants to SEE fog changes, so don't null it.
    return () => { scene.fog = prev; };
  }, [scene]);

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    const radial = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    const worldRadius = planetSize;

    const tangentFor = (up: THREE.Vector3, outV: THREE.Vector3) => {
      // any stable horizontal perpendicular to the radial up
      outV.set(0, 1, 0);
      if (Math.abs(up.y) > 0.95) outV.set(1, 0, 0);
      outV.cross(up).normalize();
    };

    // `streamAt` is the SURFACE point published as the "player position" so grass/
    // trees/water stream around the SUBJECT, not the (often far) camera — otherwise
    // distance culling empties the scene at overhead/horizon vantages.
    const resetMetrics = () => {
      frameTimes.current = [];
      lastTime.current = 0;
      frameCount.current = 0;
      sample.current = {
        ...sample.current,
        fps: 0,
        p50: 0,
        p95: 0,
        drawCalls: 0,
        triangles: 0
      };
    };

    const publishScriptedSubmersion = (eye: THREE.Vector3) => {
      const wet = waterGen.isWaterVoxel(
        Math.round(eye.x / VOXEL_SCALE),
        Math.round(eye.y / VOXEL_SCALE),
        Math.round(eye.z / VOXEL_SCALE)
      );
      const eyeDomVoxel = Math.max(Math.abs(eye.x), Math.abs(eye.y), Math.abs(eye.z)) / VOXEL_SCALE;
      const depthBelow = Math.max(0, (waterGen.getSeaLevelRadius() - eyeDomVoxel) * VOXEL_SCALE);
      setPlayerSubmerged(wet ? 1 : 0, depthBelow);
    };

    const apply = (p: THREE.Vector3, t: THREE.Vector3, streamAt: THREE.Vector3) => {
      resetMetrics();
      cam.position.copy(p);
      cam.up.set(0, 1, 0);
      cam.lookAt(t);
      cam.updateMatrixWorld(true);
      onPositionChange?.(streamAt.clone());
      setPlayerUp(streamAt); // so the sky's LOCAL day/night reflects this vantage
      publishScriptedSubmersion(p);
    };

    const surfaceTop = () => new THREE.Vector3(0, worldRadius, 0);
    const overhead = (why: string): string => {
      apply(
        pos.set(worldRadius * 2.6, worldRadius * 1.7, worldRadius * 2.6),
        target.set(0, 0, 0),
        surfaceTop() // stream the top hemisphere (where the arrival site + its trees are)
      );
      return why;
    };

    const frameInstance = (
      mesh: THREE.InstancedMesh | null,
      label: string,
      back = 5.8,
      lift = 2.1,
      lookLift = 0.8
    ): string | null => {
      if (!mesh || mesh.count <= 0 || !topInstancePos(mesh, pos)) return null;
      const base = pos.clone();
      radial.copy(base).normalize();
      tangentFor(radial, tangent);
      const eye = base.clone()
        .addScaledVector(tangent, back)
        .addScaledVector(radial, lift);
      apply(eye, base.clone().addScaledVector(radial, lookLift), base);
      return label;
    };

    const effectViewIds = (name: string): string[] | null => {
      if (name === 'surfaceEffects' || name === 'material') return [];
      if (name === 'hazard') return ['lavaHeat', 'ash', 'sandDust'];
      if (name === 'mineral') return ['crystalGlints', 'metallicFlecks'];
      if (name === 'sandDust') return ['sandDust'];
      if (name === 'dirtLife') return ['dirtLife'];
      if (name === 'pollen') return ['pollen'];
      if (name === 'frost') return ['frost'];
      if (name === 'lavaHeat') return ['lavaHeat'];
      if (name === 'ash') return ['ash'];
      if (name === 'crystalGlints') return ['crystalGlints'];
      if (name === 'metallicFlecks') return ['metallicFlecks'];
      if (name === 'fungalSpores') return ['fungalSpores'];
      return null;
    };

    const view = (name: string): string => {
      // User-authored vantage (exact pos+quat) takes precedence over computed ones.
      const stored = STORED.find(v => v.name === name);
      if (stored) {
        resetMetrics();
        cam.position.set(stored.pos[0], stored.pos[1], stored.pos[2]);
        cam.quaternion.set(stored.quat[0], stored.quat[1], stored.quat[2], stored.quat[3]);
        cam.updateMatrixWorld(true);
        // stream around the surface beneath the pinned camera.
        const dir = cam.position.clone().normalize();
        setPlayerUp(dir); // local up at this vantage drives the sky's day/night
        onPositionChange?.(dir.multiplyScalar(worldRadius));
        return name;
      }
      if (name === 'overhead') return overhead('overhead');
      if (name === 'underCanopy' || name === 'tree') {
        const leaf = instancedByKey(scene, /tree-leaf/);
        if (leaf && leaf.count > 0 && topInstancePos(leaf, pos)) {
          const base = pos.clone();
          radial.copy(base).normalize();
          tangentFor(radial, tangent);
          const back = name === 'tree' ? 9 : 5;
          const eye = base.clone().addScaledVector(tangent, back).addScaledVector(radial, 2.2);
          apply(eye, base.clone().addScaledVector(radial, 4), base);
          return name;
        }
        return overhead(name + ':no-trees(overhead)');
      }
      if (name === 'fauna' || name === 'grazer' || name === 'woolly' || name === 'runner' || name === 'hopper' || name === 'dragonfly') {
        const mesh =
          name === 'fauna'
            ? instancedByName(scene, /^fauna-(grazer|woolly|dragonfly|runner|hopper)$/)
            : instancedByName(scene, new RegExp(`^fauna-${name}$`));
        const frame =
          name === 'grazer' || name === 'fauna'
            ? { back: 4.4, lift: 1.45, lookLift: 0.46 }
            : name === 'woolly'
              ? { back: 3.15, lift: 1.05, lookLift: 0.34 }
              : name === 'dragonfly'
                ? { back: 2.05, lift: 0.7, lookLift: 0.14 }
                : { back: 3.25, lift: 0.98, lookLift: 0.3 };
        const framed = frameInstance(
          mesh,
          name,
          frame.back,
          frame.lift,
          frame.lookLift
        );
        if (framed) return framed;
        return overhead(`${name}:no-fauna(overhead)`);
      }
      if (name === 'coast') {
        const water = instancedByKey(scene, /water-blocks/);
        if (water && water.count > 0 && topInstancePos(water, pos)) {
          const wp = pos.clone();
          radial.copy(wp).normalize();
          tangentFor(radial, tangent);
          const eye = wp.clone().addScaledVector(tangent, 8).addScaledVector(radial, 5);
          apply(eye, wp.clone(), wp);
          return 'coast';
        }
        return overhead('coast:no-water(overhead)');
      }
      if (name === 'horizon') {
        // stand on the top face, look out toward the horizon (tangent) so terrain
        // meets sky — best vantage for fog / atmosphere. Stream around the eye.
        const surf = surfaceTop();
        radial.copy(surf).normalize();
        tangentFor(radial, tangent);
        const eye = surf.clone().addScaledVector(radial, 2.5);
        apply(eye, eye.clone().addScaledVector(tangent, 40).addScaledVector(radial, -2), eye);
        return 'horizon';
      }
      const effectIds = effectViewIds(name);
      if (effectIds !== null) {
        const framed = frameInstance(surfaceEffectMesh(scene, effectIds), name, 4.8, 1.6, 0.55);
        if (framed) return framed;
        return overhead(`${name}:no-effect(overhead)`);
      }
      return overhead('unknown(overhead)');
    };

    const lookFrom = (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
      apply(pos.set(px, py, pz), target.set(tx, ty, tz), target.clone());
    };

    const ready = () => new Promise<void>(resolve => {
      const poll = () => {
        // a planet voxel mesh with instances + several painted frames = ready.
        const voxels = instancedByKey(scene, /voxel-pbr/);
        if (frameCount.current > 20 && voxels && voxels.count > 0) resolve();
        else setTimeout(poll, 50);
      };
      poll();
    });

    window.__game = {
      gl, scene, camera: cam,
      view, lookFrom,
      metrics: () => {
        const report = sceneLayerReport(scene, gl);
        return {
          ...sample.current,
          ...report,
          drawCalls: Math.max(sample.current.drawCalls, report.estimatedDrawCalls),
          triangles: Math.max(sample.current.triangles, report.estimatedTriangles)
        };
      },
      resetMetrics,
      profiles: () => buildProfileSummary(terrainSeed, worldCoordinate),
      ready,
      vantages: [...VANTAGES, ...STORED.map(v => v.name)]
    };

    // default vantage so the first frame isn't empty
    view('overhead');

    return () => {
      setPlayerSubmerged(0, 0);
      delete window.__game;
    };
  }, [gl, scene, planetSize, terrainSeed, waterGen, onPositionChange, worldCoordinate]);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (lastTime.current !== 0) {
      const dt = now - lastTime.current;
      const buf = frameTimes.current;
      buf.push(dt);
      if (buf.length > 90) buf.shift();
      if (buf.length >= 30) {
        const sorted = [...buf].sort((a, b) => a - b);
        const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
        const report = sceneLayerReport(scene, gl);
        sample.current = {
          fps: Math.round(1000 / mean),
          p50: +sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
          p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
          drawCalls: Math.max(gl.info.render.calls, report.estimatedDrawCalls),
          triangles: Math.max(gl.info.render.triangles, report.estimatedTriangles),
          ...report
        };
      }
    }
    lastTime.current = now;
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={70}
      near={0.05}
      far={planetSize * 120}
      position={[planetSize * 2.6, planetSize * 1.7, planetSize * 2.6]}
    />
  );
}
