import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { buildWindProfile } from '../utils/windProfile';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  applySurfacePhenomenonWindProfileToMaterial,
  applyDirtLifeWindProfileToMaterial,
  applySandDustWindProfileToMaterial,
  buildSurfacePhenomenonInstances,
  buildDirtLifeInstances,
  buildSandDustInstances,
  countDirtLifeVoxels,
  countSandDustVoxels,
  createDirtLifeGeometry,
  createDirtLifeMaterial,
  createSurfacePhenomenonGeometry,
  createSurfacePhenomenonMaterial,
  createSandDustGeometry,
  createSandDustMaterial,
  countSurfacePhenomenonVoxels,
  updateDirtLifeMaterial,
  updateSurfacePhenomenonMaterial,
  updateSandDustMaterial
} from '../utils/surfaceEffects';
import type { SurfaceEffectBuildResult, SurfacePhenomenonConfig, SurfacePhenomenonId } from '../utils/surfaceEffects';
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

function eligibleMaterials(art: PlanetArtDirection, materials: MaterialType[]): MaterialType[] {
  return materials.filter(material => isMaterialEligibleForEcology(art, 'surfaceEffects', material));
}

function phenomenonConfig(
  art: PlanetArtDirection,
  id: SurfacePhenomenonId,
  materials: MaterialType[],
  patch: Omit<SurfacePhenomenonConfig, 'id' | 'materials' | 'colorA' | 'colorB'> & {
    colorA: THREE.Color;
    colorB: THREE.Color;
  }
): SurfacePhenomenonConfig | null {
  const filtered = eligibleMaterials(art, materials);
  if (filtered.length === 0 || surfaceEffectWeight(art, id) <= 0.04) return null;
  return { id, materials: filtered, ...patch };
}

function buildSurfaceEffectSpecs(art: PlanetArtDirection): SurfaceEffectSpec[] {
  const p = art.palette;
  const specs: SurfaceEffectSpec[] = [];

  const sandScale = surfaceEffectWeight(art, 'sandDust');
  if (sandScale > 0.04 && eligibleMaterials(art, [MaterialType.SAND]).length > 0) {
    specs.push({
      id: 'sand_dust',
      densityScale: sandScale,
      createGeometry: createSandDustGeometry,
      createMaterial: createSandDustMaterial,
      count: countSandDustVoxels,
      build: buildSandDustInstances,
      applyWind: applySandDustWindProfileToMaterial,
      update: updateSandDustMaterial
    });
  }

  const dirtScale = surfaceEffectWeight(art, 'looseSoilLife');
  if (dirtScale > 0.04 && eligibleMaterials(art, [MaterialType.DIRT]).length > 0) {
    specs.push({
      id: 'dirt_life',
      densityScale: dirtScale,
      createGeometry: createDirtLifeGeometry,
      createMaterial: createDirtLifeMaterial,
      count: countDirtLifeVoxels,
      build: buildDirtLifeInstances,
      applyWind: applyDirtLifeWindProfileToMaterial,
      update: updateDirtLifeMaterial
    });
  }

  const configs = [
    phenomenonConfig(art, 'pollen', [MaterialType.GRASS], {
      colorA: paletteRoleToLinearColor(p.vegetationSSS),
      colorB: paletteRoleToLinearColor(p.flowerAccent),
      coverageBase: 0.2,
      coverageGain: 0.58,
      particlesPerVoxel: 1.7,
      surfaceOffset: 1.04,
      baseLift: 0.08,
      width: 0.48,
      height: 0.58,
      depth: 0.42,
      alpha: 0.22,
      sparkle: 0.2,
      rise: 0.8,
      turbulence: 0.72,
      salt: 331
    }),
    phenomenonConfig(art, 'frost', [MaterialType.ICE], {
      colorA: paletteRoleToLinearColor(p.waterFoam),
      colorB: paletteRoleToLinearColor(p.skyHigh),
      coverageBase: 0.26,
      coverageGain: 0.62,
      particlesPerVoxel: 1.6,
      surfaceOffset: 1.035,
      baseLift: 0.05,
      width: 0.36,
      height: 0.78,
      depth: 0.24,
      alpha: 0.28,
      sparkle: 0.45,
      rise: 0.55,
      turbulence: 0.42,
      salt: 371
    }),
    phenomenonConfig(art, 'lavaHeat', [MaterialType.LAVA], {
      colorA: paletteRoleToLinearColor(p.hazardAccent),
      colorB: paletteRoleToLinearColor(p.sunGlow),
      coverageBase: 0.3,
      coverageGain: 0.7,
      particlesPerVoxel: 1.8,
      surfaceOffset: 1.045,
      baseLift: 0.06,
      width: 0.56,
      height: 0.92,
      depth: 0.42,
      alpha: 0.32,
      sparkle: 0.65,
      rise: 1.2,
      turbulence: 0.86,
      salt: 411
    }),
    phenomenonConfig(art, 'ash', [MaterialType.BASALT, MaterialType.STONE], {
      colorA: paletteRoleToLinearColor(p.rockBase),
      colorB: paletteRoleToLinearColor(p.soilDark),
      coverageBase: 0.18,
      coverageGain: 0.56,
      particlesPerVoxel: 1.4,
      surfaceOffset: 1.035,
      baseLift: 0.05,
      width: 0.62,
      height: 0.66,
      depth: 0.44,
      alpha: 0.18,
      sparkle: 0.08,
      rise: 0.72,
      turbulence: 0.84,
      salt: 451
    }),
    phenomenonConfig(art, 'crystalGlints', [MaterialType.CRYSTAL], {
      colorA: paletteRoleToLinearColor(p.mineralAccent),
      colorB: paletteRoleToLinearColor(p.wingGlass),
      coverageBase: 0.22,
      coverageGain: 0.5,
      particlesPerVoxel: 1.1,
      surfaceOffset: 1.04,
      baseLift: 0.08,
      width: 0.24,
      height: 0.32,
      depth: 0.2,
      alpha: 0.34,
      sparkle: 0.95,
      rise: 0.26,
      turbulence: 0.28,
      salt: 491
    }),
    phenomenonConfig(art, 'metallicFlecks', [MaterialType.STONE, MaterialType.COPPER, MaterialType.GOLD, MaterialType.SILVER], {
      colorA: paletteRoleToLinearColor(p.mineralAccent),
      colorB: paletteRoleToLinearColor(p.waterFoam),
      coverageBase: 0.16,
      coverageGain: 0.45,
      particlesPerVoxel: 1.0,
      surfaceOffset: 1.04,
      baseLift: 0.06,
      width: 0.22,
      height: 0.28,
      depth: 0.18,
      alpha: 0.3,
      sparkle: 0.82,
      rise: 0.18,
      turbulence: 0.22,
      salt: 531
    }),
    phenomenonConfig(art, 'fungalSpores', [MaterialType.GRASS, MaterialType.DIRT], {
      colorA: paletteRoleToLinearColor(p.canopySSS),
      colorB: paletteRoleToLinearColor(p.flowerAccent),
      coverageBase: 0.28,
      coverageGain: 0.66,
      particlesPerVoxel: 2.0,
      surfaceOffset: 1.05,
      baseLift: 0.1,
      width: 0.5,
      height: 0.72,
      depth: 0.46,
      alpha: 0.24,
      sparkle: 0.38,
      rise: 0.95,
      turbulence: 0.76,
      salt: 571
    })
  ].filter((config): config is SurfacePhenomenonConfig => config !== null);

  for (const config of configs) {
    specs.push({
      id: config.id,
      densityScale: surfaceEffectWeight(art, config.id),
      createGeometry: createSurfacePhenomenonGeometry,
      createMaterial: () => createSurfacePhenomenonMaterial(config),
      count: (density, seed) => countSurfacePhenomenonVoxels(config, density, seed),
      build: (mesh, density, maxDistance, playerWorld, seed, windProfile) =>
        buildSurfacePhenomenonInstances(config, mesh, density, maxDistance, playerWorld, seed, windProfile),
      applyWind: applySurfacePhenomenonWindProfileToMaterial,
      update: updateSurfacePhenomenonMaterial
    });
  }

  return specs;
}

/**
 * Material-driven spawned surface phenomena. This is intentionally separate from
 * `voxelMaterial`: shader detail changes the block skin, while this field places
 * actual animated geometry above eligible blocks.
 */
export default function SurfaceEffectField({ terrainSeed, playerPosition }: SurfaceEffectFieldProps) {
  const density = getGraphicsQuality().voxelEffectDensity;
  const windProfile = useMemo(() => buildWindProfile(terrainSeed), [terrainSeed]);
  const art = useMemo(() => buildPlanetArtDirection(terrainSeed), [terrainSeed]);
  const specs = useMemo(() => buildSurfaceEffectSpecs(art), [art]);

  if (density <= 0 || specs.length === 0) return null;

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
