import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import {
  getVoxelRealityEffects,
  getVoxelRealitySnapshot,
  subscribeVoxelReality
} from '../game/systems/realityRenderSystem';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { buildWindProfile } from '../utils/windProfile';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  applySurfaceEffectWindProfileToMaterial,
  buildSurfaceMoteInstances,
  countSurfaceMoteVoxels,
  createSurfaceMoteGeometry,
  createSurfaceMoteMaterial,
  surfaceEffectRealityDensityScale,
  updateSurfaceEffectMaterial
} from '../utils/surfaceEffects';
import type {
  SurfaceEffectBuildResult,
  SurfaceEffectId,
  SurfaceMoteConfig
} from '../utils/surfaceEffects';
import {
  buildCritterAgents,
  countCritterVoxels,
  createCritterGeometry,
  createCritterMaterial,
  critterMaxDistance,
  prepareCritterSeedAttribute,
  updateCritterAgents,
  updateCritterMaterial,
  writeCritterSeeds
} from '../utils/surfaceCritters';
import type { CritterAgent, CritterConfig } from '../utils/surfaceCritters';
import type { WindProfile } from '../utils/windProfile';
import { buildPlanetArtDirection, type PlanetArtDirection } from '../utils/planetArtDirection';
import { isMaterialEligibleForEcology, surfaceEffectWeight } from '../utils/planetEcology';
import { paletteRoleToLinearColor } from '../utils/planetVisualProfile';
import { MaterialType } from '../types/materials';

interface SurfaceEffectFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

const HEADROOM = 64;

// Ecology weight keys kept from the original phenomena registry so per-planet
// archetype tuning (arid boosts sandDust, frozen boosts frost, ...) carries over.
const WEIGHT_KEY: Partial<Record<SurfaceEffectId, string>> = {
  sandFlow: 'sandDust',
  soilLife: 'looseSoilLife',
  ashDrift: 'ash',
  lavaCrust: 'lavaHeat',
  lavaEmbers: 'lavaHeat',
  wormLife: 'looseSoilLife',
  grassLife: 'grassLife'
};

function effectWeight(art: PlanetArtDirection, id: SurfaceEffectId): number {
  return surfaceEffectWeight(art, WEIGHT_KEY[id] ?? id);
}

function eligibleMaterials(art: PlanetArtDirection, materials: MaterialType[]): MaterialType[] {
  return materials.filter(material => isMaterialEligibleForEcology(art, 'surfaceEffects', material));
}

interface SurfaceEffectSpec {
  id: string;
  densityScale: number;
  createGeometry: () => THREE.BufferGeometry;
  createMaterial: () => THREE.Material;
  count: (density: number, terrainSeed: number) => number;
  build: (
    mesh: THREE.InstancedMesh,
    density: number,
    maxDistance: number,
    playerWorld: THREE.Vector3 | null,
    terrainSeed: number,
    windProfile: WindProfile
  ) => SurfaceEffectBuildResult;
  applyWind: (profile: WindProfile, material: THREE.Material) => void;
  update: (
    material: THREE.Material,
    time: number,
    quality: ReturnType<typeof getGraphicsQuality>,
    reality: ReturnType<typeof getVoxelRealityEffects>
  ) => void;
}

function scaled(color: THREE.Color, s: number): THREE.Color {
  return color.clone().multiplyScalar(s);
}

function moteConfig(
  art: PlanetArtDirection,
  id: SurfaceEffectId,
  materials: MaterialType[],
  patch: Omit<SurfaceMoteConfig, 'id' | 'materials'>
): SurfaceMoteConfig | null {
  const filtered = eligibleMaterials(art, materials);
  if (filtered.length === 0 || effectWeight(art, id) <= 0.04) return null;
  return { id, materials: filtered, ...patch };
}

function critterConfig(
  art: PlanetArtDirection,
  id: SurfaceEffectId,
  materials: MaterialType[],
  patch: Omit<CritterConfig, 'effectId' | 'materials'>
): CritterConfig | null {
  const filtered = eligibleMaterials(art, materials);
  if (filtered.length === 0 || effectWeight(art, id) <= 0.04) return null;
  return { effectId: id, materials: filtered, ...patch };
}

// -----------------------------------------------------------------------------
// Per-planet effect registry: airborne motes only. Flush phenomena now live in
// the shared voxel shader, eliminating one full transparent quad per voxel.
// -----------------------------------------------------------------------------

function buildMoteConfigs(art: PlanetArtDirection): SurfaceMoteConfig[] {
  const p = art.palette;
  return [
    // Airborne saltation replaces the old full-face sand overlay. Tiny grains
    // cross voxel boundaries without ever exposing a square carrier.
    moteConfig(art, 'sandFlow', [MaterialType.SAND], {
      colorA: paletteRoleToLinearColor(p.sandLight),
      colorB: paletteRoleToLinearColor(p.waterFoam),
      coverageBase: 0.18,
      coverageGain: 0.34,
      motesPerVoxel: 1,
      size: 0.042,
      baseLift: 0.02,
      liftRange: 0.2,
      driftSpeed: 1.25,
      rise: 0,
      alpha: 0.48,
      emissive: 0,
      salt: 181
    }),
    // Volcanic ash belongs in the air, not painted onto a perfect square.
    moteConfig(art, 'ashDrift', [MaterialType.BASALT, MaterialType.STONE], {
      colorA: scaled(paletteRoleToLinearColor(p.rockBase), 0.72),
      colorB: scaled(paletteRoleToLinearColor(p.rockBase), 1.22),
      coverageBase: 0.12,
      coverageGain: 0.26,
      motesPerVoxel: 1,
      size: 0.05,
      baseLift: 0.08,
      liftRange: 0.72,
      driftSpeed: 0.52,
      rise: 0.08,
      alpha: 0.34,
      emissive: 0,
      salt: 451
    }),
    moteConfig(art, 'pollen', [MaterialType.GRASS], {
      colorA: paletteRoleToLinearColor(p.vegetationSSS),
      colorB: paletteRoleToLinearColor(p.flowerAccent),
      coverageBase: 0.14,
      coverageGain: 0.3,
      motesPerVoxel: 1.2,
      size: 0.045,
      baseLift: 0.25,
      liftRange: 0.8,
      driftSpeed: 0.5,
      rise: 0,
      alpha: 0.5,
      emissive: 0.15,
      salt: 331
    }),
    moteConfig(art, 'fungalSpores', [MaterialType.GRASS, MaterialType.DIRT], {
      colorA: paletteRoleToLinearColor(p.canopySSS),
      colorB: paletteRoleToLinearColor(p.flowerAccent),
      coverageBase: 0.18,
      coverageGain: 0.36,
      motesPerVoxel: 1.5,
      size: 0.035,
      baseLift: 0.15,
      liftRange: 0.9,
      driftSpeed: 0.28,
      rise: 0.12,
      alpha: 0.45,
      emissive: 0.35,
      salt: 571
    }),
    moteConfig(art, 'lavaEmbers', [MaterialType.LAVA], {
      colorA: paletteRoleToLinearColor(p.sunGlow),
      colorB: paletteRoleToLinearColor(p.hazardAccent),
      coverageBase: 0.26,
      coverageGain: 0.45,
      motesPerVoxel: 1.2,
      size: 0.058,
      baseLift: 0.1,
      liftRange: 1.7,
      driftSpeed: 0.35,
      rise: 0.75,
      alpha: 0.95,
      emissive: 2.6,
      salt: 611
    })
  ].filter((config): config is SurfaceMoteConfig => config !== null);
}

// Earthworm pink-brown, tinted by the planet's soil so it belongs to the
// palette without inheriting an alien fauna-coat hue.
const WORM_FLESH = new THREE.Color(0xb4776b).convertSRGBToLinear();

function buildCritterConfigs(art: PlanetArtDirection): CritterConfig[] {
  const p = art.palette;
  const soil = paletteRoleToLinearColor(p.soilDark);
  const wormBody = soil.clone().lerp(WORM_FLESH, 0.62);
  return [
    critterConfig(art, 'wormLife', [MaterialType.DIRT], {
      kind: 'worm',
      coverageBase: 0.08,
      coverageGain: 0.14,
      speed: 0.085,
      leash: 3,
      bodyColor: wormBody,
      accentColor: scaled(wormBody, 1.4),
      darkColor: scaled(soil, 0.7),
      salt: 71
    }),
    critterConfig(art, 'grassLife', [MaterialType.GRASS], {
      kind: 'caterpillar',
      coverageBase: 0.06,
      coverageGain: 0.12,
      speed: 0.16,
      leash: 4,
      bodyColor: paletteRoleToLinearColor(p.vegetationTip),
      accentColor: paletteRoleToLinearColor(p.flowerAccent),
      darkColor: scaled(soil, 0.6),
      salt: 73
    })
  ].filter((config): config is CritterConfig => config !== null);
}

function buildSurfaceEffectSpecs(art: PlanetArtDirection): SurfaceEffectSpec[] {
  const specs: SurfaceEffectSpec[] = [];

  for (const config of buildMoteConfigs(art)) {
    specs.push({
      id: config.id,
      densityScale: effectWeight(art, config.id),
      createGeometry: createSurfaceMoteGeometry,
      createMaterial: () => createSurfaceMoteMaterial(config),
      count: (density, seed) => countSurfaceMoteVoxels(config, density, seed),
      build: (mesh, density, maxDistance, playerWorld, seed, windProfile) =>
        buildSurfaceMoteInstances(config, mesh, density, maxDistance, playerWorld, seed, windProfile),
      applyWind: applySurfaceEffectWindProfileToMaterial,
      update: updateSurfaceEffectMaterial
    });
  }

  return specs;
}

/**
 * Sparse airborne material phenomena plus surface critters. All flush detail
 * is authored in `voxelMaterial`; keeping transparent geometry only for things
 * that truly leave the surface avoids carrier seams and excess overdraw.
 */
export default function SurfaceEffectField({ terrainSeed, playerPosition }: SurfaceEffectFieldProps) {
  const [realitySnapshot, setRealitySnapshot] = useState(() => getVoxelRealitySnapshot());
  // QUANTIZED subscription: the story's awakening ramps override reality every
  // frame; rebuilding the instanced layers 60×/s melts exactly the cutscenes
  // that stare into the sun. Only re-render when the stage flips or the derived
  // density scale moves a whole 5% step (~20 discrete rebuilds per ramp).
  useEffect(() => subscribeVoxelReality(next => {
    setRealitySnapshot(prev => {
      const step = (s: typeof prev) => Math.round(surfaceEffectRealityDensityScale(s.effects) * 20);
      return prev.stage !== next.stage || step(prev) !== step(next) ? next : prev;
    });
  }), []);

  const density = getGraphicsQuality().voxelEffectDensity * surfaceEffectRealityDensityScale(realitySnapshot.effects);
  const windProfile = useMemo(() => buildWindProfile(terrainSeed), [terrainSeed]);
  const art = useMemo(() => buildPlanetArtDirection(terrainSeed), [terrainSeed]);
  const specs = useMemo(() => buildSurfaceEffectSpecs(art), [art]);
  const critters = useMemo(() => buildCritterConfigs(art), [art]);

  if (density <= 0 || (specs.length === 0 && critters.length === 0)) return null;

  return (
    <>
      {specs.map(spec => (
        <SurfaceEffectLayer
          key={spec.id}
          spec={spec}
          density={density * spec.densityScale}
          terrainSeed={terrainSeed}
          playerPosition={playerPosition}
          windProfile={windProfile}
        />
      ))}
      {critters.map(config => (
        <SurfaceCritterLayer
          key={config.effectId}
          config={config}
          density={density * effectWeight(art, config.effectId)}
          terrainSeed={terrainSeed}
          playerPosition={playerPosition}
        />
      ))}
    </>
  );
}

function SurfaceEffectLayer({
  spec,
  density,
  terrainSeed,
  playerPosition,
  windProfile
}: {
  spec: SurfaceEffectSpec;
  density: number;
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
  windProfile: WindProfile;
}) {
  const geometry = useMemo(() => (density > 0 ? spec.createGeometry() : null), [density, spec]);
  const material = useMemo(() => (density > 0 ? spec.createMaterial() : null), [density, spec]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const profileAppliedRef = useRef(false);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [capacity, setCapacity] = useState(0);

  const neededCapacity = () => measureWarpMetric(
    `surface_effects:${spec.id}_count_capacity`,
    () => spec.count(density, terrainSeed),
    needed => ({ needed })
  );

  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    measureWarpMetric(
      `surface_effects:${spec.id}_rebuild`,
      () => spec.build(
        mesh,
        density,
        quality.voxelEffectMaxDistance,
        playerPosition ?? null,
        terrainSeed,
        windProfile
      ),
      result => ({ count: result.count, voxelCount: result.voxelCount, capacity: mesh.instanceMatrix.count })
    );
  };

  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, terrainSeed]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity, windProfile]);

  useEffect(() => {
    profileAppliedRef.current = false;
  }, [windProfile, material]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;

    if (!profileAppliedRef.current && material.userData.shader) {
      spec.applyWind(windProfile, material);
      profileAppliedRef.current = true;
    }
    spec.update(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects());

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) {
        growCapacity(needed);
      } else if (mesh) {
        signatureRef.current = sig;
        rebuild();
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (mesh && playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 100) {
      lastBucketPos.current.copy(playerPosition);
      rebuild();
    }
  });

  if (density <= 0 || !geometry || !material || capacity <= 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

function SurfaceCritterLayer({
  config,
  density,
  terrainSeed,
  playerPosition
}: {
  config: CritterConfig;
  density: number;
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}) {
  const geometry = useMemo(() => (density > 0 ? createCritterGeometry(config) : null), [density, config]);
  const material = useMemo(() => (density > 0 ? createCritterMaterial(config) : null), [density, config]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const agentsRef = useRef<CritterAgent[]>([]);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [capacity, setCapacity] = useState(0);

  const rebuildAgents = () => {
    const mesh = meshRef.current;
    if (!mesh || !geometry || density <= 0) return;
    const quality = getGraphicsQuality();
    const agents = measureWarpMetric(
      `surface_effects:${config.effectId}_agents`,
      () => buildCritterAgents(
        config,
        density,
        critterMaxDistance(quality),
        playerPosition ?? null,
        terrainSeed,
        mesh.instanceMatrix.count,
        { existingAgents: agentsRef.current }
      ),
      result => ({ count: result.length, capacity: mesh.instanceMatrix.count })
    );
    agentsRef.current = agents;
    prepareCritterSeedAttribute(geometry, mesh.instanceMatrix.count);
    writeCritterSeeds(geometry, agents);
    mesh.count = agents.length;
  };

  const neededCapacity = () => Math.min(
    measureWarpMetric(
      `surface_effects:${config.effectId}_count_capacity`,
      () => countCritterVoxels(config, density, terrainSeed),
      n => ({ needed: n })
    ),
    160
  );

  const growCapacity = (needed: number) => {
    setCapacity(prev => (needed <= prev ? prev : Math.ceil(needed * 1.25) + 16));
  };

  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, terrainSeed]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuildAgents();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }, delta) => {
    if (!material || density <= 0) return;

    const quality = getGraphicsQuality();
    const reality = getVoxelRealityEffects();
    updateCritterMaterial(material, clock.elapsedTime, quality, reality);

    const mesh = meshRef.current;
    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      // Voxels can populate after mount (world load, test harness): grow the
      // capacity here so the layer appears once the mesh exists.
      const needed = neededCapacity();
      if (needed > capacity) {
        growCapacity(needed);
      } else if (mesh) {
        signatureRef.current = sig;
        rebuildAgents();
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (mesh && playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 64) {
      lastBucketPos.current.copy(playerPosition);
      rebuildAgents();
    }

    // Freeze (and effectively hide via uVisibility=0) when animation is off.
    if (!mesh || !quality.animatedShaders) return;
    updateCritterAgents(mesh, agentsRef.current, delta, terrainSeed, config);
  });

  if (density <= 0 || !geometry || !material || capacity <= 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
