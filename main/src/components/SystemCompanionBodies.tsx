import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getQualityProfile,
  subscribeGraphicsQuality,
  type QualityProfile
} from '../config/graphicsSettings.ts';
import type { PlanetSlot, SystemCoordinate } from '../game/starSystem.ts';
import { getPlayerUp } from '../state/playerFrame.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import {
  composeWaterFaceMatrix,
  createWaterFacePlacementScratch,
  WATER_QUAD_SIZE
} from '../utils/waterFacePlacement.ts';
import { seededUnit } from '../utils/worldCoordinates.ts';
import { deriveWorldPreviewTraits } from '../utils/worldPreview.ts';
import {
  getPreparedWorldRenderData,
  type PreparedWorldRenderData
} from '../utils/worldGenCache.ts';
import { getSunDirection } from './SkyController.tsx';
import {
  buildCompanionBodyModels,
  companionExactShellBlend,
  companionExactTerrainFaceCount,
  companionVisualBudget,
  createCompanionCloudGeometry,
  createCompanionSurfaceGeometry,
  EXACT_TERRAIN_BATCH_SIZE,
  EXACT_WATER_BATCH_SIZE
} from './systemCompanionBodiesModel.ts';

interface SystemCompanionBodiesProps {
  currentCoordinate: SystemCoordinate;
  planetSize: number;
  activePlanetSlot?: PlanetSlot;
  forceSingleBody?: boolean;
  bodyCountOverride?: 1 | 2 | 3;
}

interface ExactShellRuntime {
  meshes: THREE.Mesh[];
  terrainMaterial: THREE.ShaderMaterial;
  waterMaterial: THREE.ShaderMaterial;
  owner: THREE.Group;
  prepared: PreparedWorldRenderData;
  terrainCount: number;
  waterCount: number;
  waterColor: THREE.Color;
  nextTerrainOffset: number;
  terrainFaceCount: number;
  nextTerrainFaceOffset: number;
  terrainFaceCenters: Float32Array;
  terrainFaceDirections: Float32Array;
  terrainFaceColors: Float32Array;
  terrainMesh: THREE.Mesh | null;
  nextWaterOffset: number;
  warmMesh: THREE.Mesh | null;
  ready: boolean;
  lodBlend: number;
  lastBlendAtMs: number | null;
}

interface BodyRuntime {
  key: string;
  planetSlot: PlanetSlot;
  seed: number;
  group: THREE.Group | null;
  relativePosition: THREE.Vector3;
  nominalFaceRadius: number;
  surfaceBoundRadius: number;
  unitSurfaceBoundRadius: number;
  terrainQuaternion: [number, number, number, number];
  surfaceGeometry: THREE.BufferGeometry;
  cloudGeometry: THREE.BufferGeometry | null;
  surfaceMaterial: THREE.ShaderMaterial;
  cloudMaterial: THREE.ShaderMaterial | null;
  ringMaterial: THREE.ShaderMaterial | null;
  ringRotation: THREE.Euler;
  exactShell: ExactShellRuntime | null;
}

const SURFACE_SKY_INNER_RADIUS = 208;
const SURFACE_SKY_PREFERRED_DISTANCE = 138;
const SURFACE_SKY_EXIT_FRACTION = 0.78;
const CLOUD_SCALE = 1.024;
const COMPANION_PROGRAM_KEY = 'system-companion-unified-v1';
const EXACT_COMPANION_PROGRAM_KEY = 'system-companion-exact-v1';
const EXACT_FACE_COMPANION_PROGRAM_KEY = 'system-companion-exact-face-v1';
const EXACT_SHELL_PROMOTION_SECONDS = 0.45;
const exactInstanceMatrix = new THREE.Matrix4();
const exactInstancePosition = new THREE.Vector3();
const exactWaterPlacement = createWaterFacePlacementScratch();

const COMPANION_VERTEX_SHADER = /* glsl */`
  attribute vec3 color;
  #ifdef EXACT_FACE_SHELL
    attribute vec3 instanceCenter;
    attribute float instanceFaceDirection;
    attribute vec3 instanceFaceColor;
  #endif
  varying vec3 vColor;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vPositionObject;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vec3 localNormal = normal;
    #ifdef EXACT_FACE_SHELL
      vec3 faceNormal;
      vec3 tangentX;
      vec3 tangentY;
      if (instanceFaceDirection < 0.5) {
        faceNormal = vec3(1.0, 0.0, 0.0);
        tangentX = vec3(0.0, 1.0, 0.0);
        tangentY = vec3(0.0, 0.0, 1.0);
      } else if (instanceFaceDirection < 1.5) {
        faceNormal = vec3(-1.0, 0.0, 0.0);
        tangentX = vec3(0.0, 0.0, 1.0);
        tangentY = vec3(0.0, 1.0, 0.0);
      } else if (instanceFaceDirection < 2.5) {
        faceNormal = vec3(0.0, 1.0, 0.0);
        tangentX = vec3(0.0, 0.0, 1.0);
        tangentY = vec3(1.0, 0.0, 0.0);
      } else if (instanceFaceDirection < 3.5) {
        faceNormal = vec3(0.0, -1.0, 0.0);
        tangentX = vec3(1.0, 0.0, 0.0);
        tangentY = vec3(0.0, 0.0, 1.0);
      } else if (instanceFaceDirection < 4.5) {
        faceNormal = vec3(0.0, 0.0, 1.0);
        tangentX = vec3(1.0, 0.0, 0.0);
        tangentY = vec3(0.0, 1.0, 0.0);
      } else {
        faceNormal = vec3(0.0, 0.0, -1.0);
        tangentX = vec3(0.0, 1.0, 0.0);
        tangentY = vec3(1.0, 0.0, 0.0);
      }
      localPosition = vec4(
        instanceCenter + faceNormal + tangentX * position.x + tangentY * position.y,
        1.0
      );
      localNormal = faceNormal;
      vColor = instanceFaceColor;
    #else
      #ifdef USE_INSTANCING
        localPosition = instanceMatrix * localPosition;
        localNormal = mat3(instanceMatrix) * localNormal;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = color;
      #endif
    #endif
    vPositionObject = localPosition.xyz;
    vec4 worldPosition = modelMatrix * localPosition;
    vPositionWorld = worldPosition.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * localNormal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const COMPANION_FRAGMENT_SHADER = /* glsl */`
  uniform vec3 uTint;
  uniform vec3 uCloudColor;
  uniform vec3 uAtmosphereColor;
  uniform vec3 uSunDirection;
  uniform float uSeedPhase;
  uniform float uLayerMode;
  uniform float uCloudStrength;
  uniform float uAtmosphereStrength;
  uniform float uVisibility;
  uniform float uOpacity;
  uniform float uLodBlend;
  uniform float uLodRole;

  varying vec3 vColor;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vPositionObject;

  float cloudField(vec3 p) {
    vec3 d = normalize(p);
    float broad = sin((d.x * 2.1 + d.z * 3.7 + uSeedPhase) * 5.2);
    float broken = sin((d.y * 4.4 - d.z * 2.3 + uSeedPhase * 1.7) * 7.1);
    return broad * 0.62 + broken * 0.38;
  }

  float screenDither(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  void main() {
    vec3 normalWorld = normalize(vNormalWorld);
    vec3 viewDirection = normalize(cameraPosition - vPositionWorld);
    vec3 sunDirection = normalize(uSunDirection);
    float nDotL = dot(normalWorld, sunDirection);
    float dayLight = max(nDotL, 0.0);
    float nightFacing = max(-nDotL, 0.0);
    float viewFacing = max(dot(normalWorld, viewDirection), 0.0);
    float rim = pow(1.0 - viewFacing, 3.0);
    float clouds = smoothstep(0.18, 0.72, cloudField(vPositionObject));
    vec3 colorOut;
    float alphaOut;

    if (uLayerMode < 0.5) {
      if (uLodRole > -0.5) {
        float threshold = screenDither(gl_FragCoord.xy);
        if (uLodRole < 0.5 && threshold < uLodBlend) discard;
        if (uLodRole > 0.5 && threshold >= uLodBlend) discard;
      }
      vec3 base = vColor * uTint;
      base = mix(base, uCloudColor, clouds * uCloudStrength * 0.46);
      // Deliberate ambient/emissive floor: the dark hemisphere remains legible at
      // small angular sizes while the directional term still owns the terminator.
      float illumination = 0.38 + dayLight * 0.74 + nightFacing * 0.05;
      colorOut = base * illumination;
      colorOut += uAtmosphereColor * rim * uAtmosphereStrength * (0.28 + dayLight * 0.32);
      alphaOut = uVisibility * uOpacity;
    } else if (uLayerMode < 1.5) {
      float coverage = clouds * uCloudStrength;
      if (coverage < 0.025) discard;
      colorOut = uCloudColor * (0.42 + dayLight * 0.62);
      colorOut += uAtmosphereColor * rim * 0.12;
      alphaOut = coverage * uVisibility * uOpacity;
    } else {
      colorOut = uTint * (0.42 + abs(nDotL) * 0.58);
      alphaOut = uVisibility * uOpacity;
    }

    if (alphaOut <= 0.002) discard;
    gl_FragColor = vec4(colorOut, alphaOut);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface UnifiedMaterialOptions {
  layer: 'surface' | 'cloud' | 'ring';
  worldId: string;
  tint: THREE.Color;
  cloudColor: THREE.Color;
  atmosphereColor: THREE.Color;
  seed: number;
  cloudStrength: number;
  atmosphereStrength: number;
  opacity: number;
  depthWrite: boolean;
  lodRole?: -1 | 0 | 1;
  exactShell?: boolean;
  exactFaceShell?: boolean;
}

function createUnifiedCompanionMaterial(options: UnifiedMaterialOptions): THREE.ShaderMaterial {
  const layerMode = options.layer === 'surface' ? 0 : options.layer === 'cloud' ? 1 : 2;
  const material = new THREE.ShaderMaterial({
    name: `system-companion-${options.exactShell ? 'exact' : options.layer}-${options.worldId}`,
    vertexShader: COMPANION_VERTEX_SHADER,
    fragmentShader: COMPANION_FRAGMENT_SHADER,
    defines: options.exactFaceShell ? { EXACT_FACE_SHELL: 1 } : undefined,
    uniforms: {
      uTint: { value: options.tint.clone() },
      uCloudColor: { value: options.cloudColor.clone() },
      uAtmosphereColor: { value: options.atmosphereColor.clone() },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSeedPhase: { value: options.seed * 0.00017 },
      uLayerMode: { value: layerMode },
      uCloudStrength: { value: options.cloudStrength },
      uAtmosphereStrength: { value: options.atmosphereStrength },
      uVisibility: { value: 1 },
      uOpacity: { value: options.opacity },
      uLodBlend: { value: 0 },
      uLodRole: { value: options.lodRole ?? -1 }
    },
    transparent: !options.exactShell,
    depthTest: true,
    depthWrite: options.depthWrite,
    side: options.exactShell ? THREE.FrontSide : THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  material.userData = {
    systemCompanion: true,
    systemCompanionLayer: options.layer,
    worldId: options.worldId,
    bakedAtmosphere: options.layer === 'surface',
    programStrategy: options.exactFaceShell
      ? EXACT_FACE_COMPANION_PROGRAM_KEY
      : options.exactShell
        ? EXACT_COMPANION_PROGRAM_KEY
        : COMPANION_PROGRAM_KEY
  };
  material.customProgramCacheKey = () => options.exactFaceShell
    ? EXACT_FACE_COMPANION_PROGRAM_KEY
    : options.exactShell
      ? EXACT_COMPANION_PROGRAM_KEY
      : COMPANION_PROGRAM_KEY;
  return material;
}

function setMaterialVisibility(material: THREE.ShaderMaterial | null, visibility: number): void {
  if (material) material.uniforms.uVisibility.value = visibility;
}

function setMaterialSun(material: THREE.ShaderMaterial | null, sunDirection: THREE.Vector3): void {
  if (material) (material.uniforms.uSunDirection.value as THREE.Vector3).copy(sunDirection);
}

function setMaterialLodBlend(material: THREE.ShaderMaterial | null, blend: number): void {
  if (material) material.uniforms.uLodBlend.value = blend;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function rayExitDistance(origin: THREE.Vector3, direction: THREE.Vector3, radius: number): number {
  const projected = origin.dot(direction);
  const discriminant = projected * projected + radius * radius - origin.lengthSq();
  if (discriminant <= 0) return 0;
  return -projected + Math.sqrt(discriminant);
}

function disposeExactShell(runtime: BodyRuntime): void {
  if (!runtime.exactShell) return;
  for (const mesh of runtime.exactShell.meshes) {
    mesh.removeFromParent();
    if (mesh.userData.systemCompanionOwnsGeometry) mesh.geometry.dispose();
    if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
  }
  runtime.exactShell.terrainMaterial.dispose();
  runtime.exactShell.waterMaterial.dispose();
  runtime.exactShell = null;
}

function disposeRuntime(runtime: BodyRuntime): void {
  disposeExactShell(runtime);
  runtime.surfaceGeometry.dispose();
  runtime.cloudGeometry?.dispose();
  runtime.surfaceMaterial.dispose();
  runtime.cloudMaterial?.dispose();
  runtime.ringMaterial?.dispose();
}

function ensureExactTerrainShell(
  runtime: BodyRuntime,
  planetSize: number,
  waterGeometry: THREE.BufferGeometry
): ExactShellRuntime | null {
  if (!runtime.exactShell) {
    if (!runtime.group) return null;
    const prepared = getPreparedWorldRenderData(planetSize, runtime.seed, runtime.key);
    if (!prepared || prepared.terrain.count <= 0) return null;

    const cloudColor = runtime.surfaceMaterial.uniforms.uCloudColor.value as THREE.Color;
    const atmosphereColor = runtime.surfaceMaterial.uniforms.uAtmosphereColor.value as THREE.Color;
    const terrainMaterial = createUnifiedCompanionMaterial({
      layer: 'surface',
      worldId: runtime.key,
      tint: new THREE.Color('#ffffff'),
      cloudColor,
      atmosphereColor,
      seed: runtime.seed,
      cloudStrength: 0,
      atmosphereStrength: 0.48,
      opacity: 1,
      depthWrite: true,
      lodRole: 1,
      exactShell: true,
      exactFaceShell: true
    });
    const traits = deriveWorldPreviewTraits(runtime.seed);
    const waterMaterial = createUnifiedCompanionMaterial({
      layer: 'surface',
      worldId: `${runtime.key}-water`,
      tint: new THREE.Color('#ffffff'),
      cloudColor,
      atmosphereColor,
      seed: runtime.seed,
      cloudStrength: 0,
      atmosphereStrength: 0.34,
      opacity: 1,
      depthWrite: true,
      lodRole: 1,
      exactShell: true
    });
    const terrainFaceCount = companionExactTerrainFaceCount(
      prepared.terrain.instanceData,
      prepared.terrain.count
    );
    runtime.exactShell = {
      meshes: [],
      terrainMaterial,
      waterMaterial,
      owner: runtime.group,
      prepared,
      terrainCount: prepared.terrain.count,
      waterCount: prepared.waterFaces.length,
      waterColor: traits.oceanColor.clone(),
      nextTerrainOffset: 0,
      terrainFaceCount,
      nextTerrainFaceOffset: 0,
      terrainFaceCenters: new Float32Array(terrainFaceCount * 3),
      terrainFaceDirections: new Float32Array(terrainFaceCount),
      terrainFaceColors: new Float32Array(terrainFaceCount * 3),
      terrainMesh: null,
      nextWaterOffset: 0,
      warmMesh: null,
      ready: false,
      lodBlend: 0,
      lastBlendAtMs: null
    };
  }

  const shell = runtime.exactShell;
  shell.warmMesh = null;
  if (shell.ready) return shell;

  if (shell.nextTerrainOffset < shell.terrainCount) {
    const end = Math.min(
      shell.terrainCount,
      shell.nextTerrainOffset + EXACT_TERRAIN_BATCH_SIZE
    );
    let faceSlot = shell.nextTerrainFaceOffset;
    for (let source = shell.nextTerrainOffset; source < end; source++) {
      const matrixOffset = source * 16;
      const colorOffset = source * 3;
      const centerX = shell.prepared.terrain.matrices[matrixOffset + 12];
      const centerY = shell.prepared.terrain.matrices[matrixOffset + 13];
      const centerZ = shell.prepared.terrain.matrices[matrixOffset + 14];
      const hiddenMask = Math.trunc(shell.prepared.terrain.instanceData[source * 2 + 1]) & 0x3f;
      for (let faceDirection = 0; faceDirection < 6; faceDirection++) {
        if ((hiddenMask & (1 << faceDirection)) !== 0) continue;
        const target = faceSlot * 3;
        shell.terrainFaceCenters[target] = centerX;
        shell.terrainFaceCenters[target + 1] = centerY;
        shell.terrainFaceCenters[target + 2] = centerZ;
        shell.terrainFaceDirections[faceSlot] = faceDirection;
        shell.terrainFaceColors[target] = shell.prepared.terrain.colors[colorOffset];
        shell.terrainFaceColors[target + 1] = shell.prepared.terrain.colors[colorOffset + 1];
        shell.terrainFaceColors[target + 2] = shell.prepared.terrain.colors[colorOffset + 2];
        faceSlot++;
      }
    }
    shell.nextTerrainOffset = end;
    shell.nextTerrainFaceOffset = faceSlot;
    return shell;
  }

  if (!shell.terrainMesh) {
    if (shell.nextTerrainFaceOffset !== shell.terrainFaceCount) {
      throw new Error(`Exact terrain face count mismatch for ${runtime.key}.`);
    }
    const plane = new THREE.PlaneGeometry(2, 2);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index?.clone() ?? null;
    for (const attributeName of ['position', 'normal', 'uv'] as const) {
      geometry.setAttribute(attributeName, plane.getAttribute(attributeName).clone());
    }
    plane.dispose();
    geometry.instanceCount = shell.terrainFaceCount;
    geometry.setAttribute(
      'instanceCenter',
      new THREE.InstancedBufferAttribute(shell.terrainFaceCenters, 3).setUsage(THREE.StaticDrawUsage)
    );
    geometry.setAttribute(
      'instanceFaceDirection',
      new THREE.InstancedBufferAttribute(shell.terrainFaceDirections, 1).setUsage(THREE.StaticDrawUsage)
    );
    geometry.setAttribute(
      'instanceFaceColor',
      new THREE.InstancedBufferAttribute(shell.terrainFaceColors, 3).setUsage(THREE.StaticDrawUsage)
    );
    const mesh = new THREE.Mesh(geometry, shell.terrainMaterial);
    mesh.name = `system-companion-exact-terrain-shell-${runtime.key}`;
    mesh.scale.setScalar(1 / runtime.nominalFaceRadius);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.userData = {
      systemCompanion: true,
      systemCompanionLayer: 'exact-terrain-shell',
      systemCompanionOwnsGeometry: true,
      worldId: runtime.key,
      batch: 0,
      instances: shell.terrainFaceCount
    };
    shell.owner.add(mesh);
    shell.meshes.push(mesh);
    shell.terrainMesh = mesh;
    shell.warmMesh = mesh;
    return shell;
  }

  if (shell.nextWaterOffset < shell.waterCount) {
    const start = shell.nextWaterOffset;
    const count = Math.min(EXACT_WATER_BATCH_SIZE, shell.waterCount - start);
    const mesh = new THREE.InstancedMesh(waterGeometry, shell.waterMaterial, count);
    mesh.name = `system-companion-exact-water-shell-${runtime.key}-${shell.meshes.length}`;
    mesh.count = count;
    const colors = new Float32Array(count * 3);
    const matrices = mesh.instanceMatrix.array as Float32Array;
    for (let index = 0; index < count; index++) {
      const face = shell.prepared.waterFaces[start + index];
      voxelCoordToWorld(face.x, face.y, face.z, exactInstancePosition);
      composeWaterFaceMatrix(
        face.faceDir,
        exactInstancePosition,
        exactInstanceMatrix,
        exactWaterPlacement
      );
      exactInstanceMatrix.toArray(matrices, index * 16);
      shell.waterColor.toArray(colors, index * 3);
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
    mesh.instanceColor.needsUpdate = true;
    mesh.scale.setScalar(1 / runtime.nominalFaceRadius);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.userData = {
      systemCompanion: true,
      systemCompanionLayer: 'exact-water-shell',
      worldId: runtime.key,
      batch: shell.meshes.length,
      instances: count
    };
    shell.owner.add(mesh);
    shell.meshes.push(mesh);
    shell.nextWaterOffset += count;
    shell.warmMesh = mesh;
    return shell;
  }

  shell.ready = true;
  return shell;
}

function advanceExactShellBlend(
  shell: ExactShellRuntime,
  targetBlend: number,
  nowMs: number
): number {
  const previousMs = shell.lastBlendAtMs;
  shell.lastBlendAtMs = nowMs;
  if (previousMs === null) return shell.lodBlend;
  const maxDelta = Math.max(0, nowMs - previousMs) / (EXACT_SHELL_PROMOTION_SECONDS * 1_000);
  shell.lodBlend += THREE.MathUtils.clamp(targetBlend - shell.lodBlend, -maxDelta, maxDelta);
  if (Math.abs(shell.lodBlend - targetBlend) < 1e-4) shell.lodBlend = targetBlend;
  return shell.lodBlend;
}

export default function SystemCompanionBodies({
  currentCoordinate,
  planetSize,
  activePlanetSlot = 0,
  forceSingleBody = false,
  bodyCountOverride
}: SystemCompanionBodiesProps) {
  const [qualityProfile, setQualityProfile] = useState<QualityProfile>(() => getQualityProfile());
  const budget = useMemo(() => companionVisualBudget(qualityProfile), [qualityProfile]);
  const ringGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(1.3, 1.9, budget.ringSegments);
    geometry.name = 'system-companion-ring-geometry';
    geometry.userData = { systemCompanion: true, systemCompanionLayer: 'ring' };
    return geometry;
  }, [budget.ringSegments]);
  const exactWaterGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(WATER_QUAD_SIZE, WATER_QUAD_SIZE);
    geometry.name = 'system-companion-exact-water-face-geometry';
    return geometry;
  }, []);
  const scratch = useRef({
    cameraPosition: new THREE.Vector3(),
    toBody: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    effectiveUp: new THREE.Vector3(),
    surrogatePosition: new THREE.Vector3()
  });

  useEffect(() => subscribeGraphicsQuality(() => setQualityProfile(getQualityProfile())), []);

  const bodyModels = useMemo(
    () => buildCompanionBodyModels({
      coordinate: currentCoordinate,
      activePlanetSlot,
      forceSingleBody,
      ...(bodyCountOverride === undefined ? {} : { bodyCountOverride })
    }),
    [
      activePlanetSlot,
      bodyCountOverride,
      currentCoordinate.x,
      currentCoordinate.y,
      forceSingleBody
    ]
  );
  const runtimes = useMemo<BodyRuntime[]>(() => bodyModels.map(model => {
    const descriptor = model.descriptor;
    const traits = deriveWorldPreviewTraits(descriptor.seed);
    const surfaceGeometry = createCompanionSurfaceGeometry(descriptor.seed, budget.surfaceSubdivisions);
    const cloudGeometry = budget.separateCloudShell
      ? createCompanionCloudGeometry(descriptor.seed, budget.cloudSubdivisions)
      : null;
    surfaceGeometry.name = `system-companion-surface-geometry-${descriptor.worldId}`;
    surfaceGeometry.userData = {
      systemCompanion: true,
      systemCompanionLayer: 'surface',
      worldId: descriptor.worldId,
      seed: descriptor.seed
    };
    if (cloudGeometry) {
      cloudGeometry.name = `system-companion-cloud-geometry-${descriptor.worldId}`;
      cloudGeometry.userData = {
        systemCompanion: true,
        systemCompanionLayer: 'cloud',
        worldId: descriptor.worldId,
        seed: descriptor.seed
      };
    }
    const unitSurfaceBoundRadius = surfaceGeometry.boundingSphere?.radius ?? Math.sqrt(3);
    const hasRings = seededUnit(descriptor.seed, 61) > 0.82;
    const ringColor = new THREE.Color().setHSL(
      0.08 + seededUnit(descriptor.seed, 67) * 0.1,
      0.3,
      0.64
    );

    return {
      key: descriptor.worldId,
      planetSlot: descriptor.address.slot,
      seed: descriptor.seed,
      group: null,
      relativePosition: new THREE.Vector3(...model.relativePosition),
      nominalFaceRadius: descriptor.nominalFaceRadius,
      surfaceBoundRadius: descriptor.surfaceBoundRadius,
      unitSurfaceBoundRadius,
      terrainQuaternion: descriptor.terrainQuaternion,
      surfaceGeometry,
      cloudGeometry,
      surfaceMaterial: createUnifiedCompanionMaterial({
        layer: 'surface',
        worldId: descriptor.worldId,
        tint: new THREE.Color('#ffffff'),
        cloudColor: traits.cloudColor,
        atmosphereColor: traits.atmosphereColor,
        seed: descriptor.seed,
        cloudStrength: budget.separateCloudShell ? 0.1 : budget.surfaceSubdivisions >= 12 ? 0.28 : 0.16,
        atmosphereStrength: 0.72,
        opacity: 1,
        depthWrite: true,
        lodRole: 0
      }),
      cloudMaterial: cloudGeometry
        ? createUnifiedCompanionMaterial({
          layer: 'cloud',
          worldId: descriptor.worldId,
          tint: new THREE.Color('#ffffff'),
          cloudColor: traits.cloudColor,
          atmosphereColor: traits.atmosphereColor,
          seed: descriptor.seed,
          cloudStrength: qualityProfile === 'ULTRA' ? 0.58 : 0.46,
          atmosphereStrength: 0,
          opacity: 0.72,
          depthWrite: false
        })
        : null,
      ringMaterial: hasRings
        ? createUnifiedCompanionMaterial({
          layer: 'ring',
          worldId: descriptor.worldId,
          tint: ringColor,
          cloudColor: traits.cloudColor,
          atmosphereColor: traits.atmosphereColor,
          seed: descriptor.seed,
          cloudStrength: 0,
          atmosphereStrength: 0,
          opacity: 0.34,
          depthWrite: false
        })
        : null,
      ringRotation: new THREE.Euler(
        0.4 + seededUnit(descriptor.seed, 71) * 0.65,
        seededUnit(descriptor.seed, 73) * Math.PI,
        seededUnit(descriptor.seed, 79) * 0.4
      ),
      exactShell: null
    };
  }), [bodyModels, budget, qualityProfile]);

  useEffect(() => () => {
    for (const runtime of runtimes) disposeRuntime(runtime);
  }, [runtimes]);

  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);
  useEffect(() => () => exactWaterGeometry.dispose(), [exactWaterGeometry]);

  useFrame(({ camera }) => {
    const phase = getSpaceFlightSnapshot().phase;
    const physicalSpace = phase === 'deep_space';
    const systemTarget = getSystemFlightSnapshot().target;
    const exactTargetWorldId = systemTarget?.kind === 'system_body'
      ? systemTarget.worldId
      : null;
    const exactOwnerWorldId = runtimes.find(runtime => runtime.exactShell)?.key ?? null;
    const nowMs = performance.now();
    const sunDirection = getSunDirection();
    const work = scratch.current;
    camera.getWorldPosition(work.cameraPosition);
    if (phase === 'surface') {
      work.effectiveUp.copy(getPlayerUp());
    } else if (work.cameraPosition.lengthSq() > 1e-6) {
      work.effectiveUp.copy(work.cameraPosition).normalize();
    } else {
      work.effectiveUp.copy(getPlayerUp());
    }

    for (const runtime of runtimes) {
      const group = runtime.group;
      if (!group) continue;
      setMaterialSun(runtime.surfaceMaterial, sunDirection);
      setMaterialSun(runtime.cloudMaterial, sunDirection);
      setMaterialSun(runtime.ringMaterial, sunDirection);
      const wantsExactShell = physicalSpace
        && budget.exactTerrainShell
        && runtime.key === exactTargetWorldId;
      const canOwnExactShell = wantsExactShell
        && (exactOwnerWorldId === null || exactOwnerWorldId === runtime.key);

      if (physicalSpace) {
        const exactShell = canOwnExactShell
          ? ensureExactTerrainShell(
            runtime,
            planetSize,
            exactWaterGeometry
          )
          : runtime.exactShell;
        work.toBody.copy(runtime.relativePosition).sub(work.cameraPosition);
        const centerDistance = work.toBody.length();
        const desiredExactBlend = exactShell?.ready && canOwnExactShell
          ? companionExactShellBlend(centerDistance)
          : 0;
        const exactBlend = exactShell
          ? advanceExactShellBlend(exactShell, desiredExactBlend, nowMs)
          : 0;
        setMaterialLodBlend(runtime.surfaceMaterial, exactBlend);
        if (exactShell) {
          for (const mesh of exactShell.meshes) {
            mesh.visible = exactBlend > 0 || mesh === exactShell.warmMesh;
          }
          setMaterialSun(exactShell.terrainMaterial, sunDirection);
          setMaterialSun(exactShell.waterMaterial, sunDirection);
          setMaterialVisibility(exactShell.terrainMaterial, 1);
          setMaterialVisibility(exactShell.waterMaterial, 1);
          setMaterialLodBlend(exactShell.terrainMaterial, exactBlend);
          setMaterialLodBlend(exactShell.waterMaterial, exactBlend);
          if (!canOwnExactShell && exactBlend <= 0) disposeExactShell(runtime);
        }
        group.visible = true;
        group.position.copy(runtime.relativePosition);
        group.scale.setScalar(runtime.nominalFaceRadius);
        setMaterialVisibility(runtime.surfaceMaterial, 1);
        setMaterialVisibility(runtime.cloudMaterial, 1);
        setMaterialVisibility(runtime.ringMaterial, 1);
        continue;
      }

      setMaterialLodBlend(runtime.surfaceMaterial, 0);
      if (runtime.exactShell) {
        for (const mesh of runtime.exactShell.meshes) mesh.visible = false;
      }

      work.toBody.copy(runtime.relativePosition).sub(work.cameraPosition);
      const physicalDistance = work.toBody.length();
      if (physicalDistance <= runtime.surfaceBoundRadius + 1) {
        group.visible = false;
        continue;
      }
      work.direction.copy(work.toBody).multiplyScalar(1 / physicalDistance);
      const skyExit = rayExitDistance(work.cameraPosition, work.direction, SURFACE_SKY_INNER_RADIUS);
      if (skyExit <= 1) {
        group.visible = false;
        continue;
      }

      const surrogateDistance = Math.min(
        SURFACE_SKY_PREFERRED_DISTANCE,
        skyExit * SURFACE_SKY_EXIT_FRACTION
      );
      const angularSin = THREE.MathUtils.clamp(runtime.surfaceBoundRadius / physicalDistance, 0, 0.95);
      const angularTan = angularSin / Math.sqrt(Math.max(1e-6, 1 - angularSin * angularSin));
      const surrogateBoundRadius = surrogateDistance * angularTan;
      const surrogateScale = surrogateBoundRadius / runtime.unitSurfaceBoundRadius;
      const extinction = smoothstep(-0.12, 0.2, work.direction.dot(work.effectiveUp));

      group.visible = extinction > 0.002;
      work.surrogatePosition
        .copy(work.cameraPosition)
        .addScaledVector(work.direction, surrogateDistance);
      group.position.copy(work.surrogatePosition);
      group.scale.setScalar(surrogateScale);
      setMaterialVisibility(runtime.surfaceMaterial, extinction);
      setMaterialVisibility(runtime.cloudMaterial, extinction);
      setMaterialVisibility(runtime.ringMaterial, extinction);
    }
  });

  if (runtimes.length === 0) return null;

  return (
    <group
      name="system-companion-bodies"
      userData={{
        systemCompanionManager: true,
        programStrategy: COMPANION_PROGRAM_KEY,
        bodyCount: runtimes.length
      }}
    >
      {runtimes.map(runtime => (
        <group
          key={runtime.key}
          ref={node => { runtime.group = node; }}
          name={`system-companion-body-${runtime.key}`}
          quaternion={runtime.terrainQuaternion}
          userData={{
            systemCompanion: true,
            worldId: runtime.key,
            planetSlot: runtime.planetSlot,
            seed: runtime.seed,
            terrainOrientation: 'identity'
          }}
        >
          <mesh
            name={`system-companion-surface-${runtime.key}`}
            geometry={runtime.surfaceGeometry}
            material={runtime.surfaceMaterial}
            frustumCulled
            userData={{
              systemCompanion: true,
              systemCompanionLayer: 'surface',
              worldId: runtime.key,
              bakedAtmosphere: true
            }}
          />
          {runtime.cloudGeometry && runtime.cloudMaterial && (
            <mesh
              name={`system-companion-cloud-${runtime.key}`}
              geometry={runtime.cloudGeometry}
              material={runtime.cloudMaterial}
              scale={CLOUD_SCALE}
              frustumCulled
              userData={{
                systemCompanion: true,
                systemCompanionLayer: 'cloud',
                worldId: runtime.key
              }}
            />
          )}
          {runtime.ringMaterial && (
            <mesh
              name={`system-companion-ring-${runtime.key}`}
              geometry={ringGeometry}
              material={runtime.ringMaterial}
              rotation={runtime.ringRotation}
              frustumCulled
              userData={{
                systemCompanion: true,
                systemCompanionLayer: 'ring',
                worldId: runtime.key
              }}
            />
          )}
        </group>
      ))}
    </group>
  );
}
