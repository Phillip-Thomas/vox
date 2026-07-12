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
import { seededUnit } from '../utils/worldCoordinates.ts';
import { deriveWorldPreviewTraits } from '../utils/worldPreview.ts';
import { getSunDirection } from './SkyController.tsx';
import {
  buildCompanionBodyModels,
  companionVisualBudget,
  createCompanionCloudGeometry,
  createCompanionSurfaceGeometry
} from './systemCompanionBodiesModel.ts';

interface SystemCompanionBodiesProps {
  currentCoordinate: SystemCoordinate;
  activePlanetSlot?: PlanetSlot;
  forceSingleBody?: boolean;
  bodyCountOverride?: 1 | 2 | 3;
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
}

const SURFACE_SKY_INNER_RADIUS = 208;
const SURFACE_SKY_PREFERRED_DISTANCE = 138;
const SURFACE_SKY_EXIT_FRACTION = 0.78;
const CLOUD_SCALE = 1.024;
const COMPANION_PROGRAM_KEY = 'system-companion-unified-v1';

const COMPANION_VERTEX_SHADER = /* glsl */`
  attribute vec3 color;
  varying vec3 vColor;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vPositionObject;

  void main() {
    vColor = color;
    vPositionObject = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPositionWorld = worldPosition.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
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
}

function createUnifiedCompanionMaterial(options: UnifiedMaterialOptions): THREE.ShaderMaterial {
  const layerMode = options.layer === 'surface' ? 0 : options.layer === 'cloud' ? 1 : 2;
  const material = new THREE.ShaderMaterial({
    name: `system-companion-${options.layer}-${options.worldId}`,
    vertexShader: COMPANION_VERTEX_SHADER,
    fragmentShader: COMPANION_FRAGMENT_SHADER,
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
      uOpacity: { value: options.opacity }
    },
    transparent: true,
    depthTest: true,
    depthWrite: options.depthWrite,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  material.userData = {
    systemCompanion: true,
    systemCompanionLayer: options.layer,
    worldId: options.worldId,
    bakedAtmosphere: options.layer === 'surface',
    programStrategy: COMPANION_PROGRAM_KEY
  };
  material.customProgramCacheKey = () => COMPANION_PROGRAM_KEY;
  return material;
}

function setMaterialVisibility(material: THREE.ShaderMaterial | null, visibility: number): void {
  if (material) material.uniforms.uVisibility.value = visibility;
}

function setMaterialSun(material: THREE.ShaderMaterial | null, sunDirection: THREE.Vector3): void {
  if (material) (material.uniforms.uSunDirection.value as THREE.Vector3).copy(sunDirection);
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

function disposeRuntime(runtime: BodyRuntime): void {
  runtime.surfaceGeometry.dispose();
  runtime.cloudGeometry?.dispose();
  runtime.surfaceMaterial.dispose();
  runtime.cloudMaterial?.dispose();
  runtime.ringMaterial?.dispose();
}

export default function SystemCompanionBodies({
  currentCoordinate,
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
        depthWrite: true
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
      )
    };
  }), [bodyModels, budget, qualityProfile]);

  useEffect(() => () => {
    for (const runtime of runtimes) disposeRuntime(runtime);
  }, [runtimes]);

  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  useFrame(({ camera }) => {
    const phase = getSpaceFlightSnapshot().phase;
    const physicalSpace = phase === 'deep_space';
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

      if (physicalSpace) {
        group.visible = true;
        group.position.copy(runtime.relativePosition);
        group.scale.setScalar(runtime.nominalFaceRadius);
        setMaterialVisibility(runtime.surfaceMaterial, 1);
        setMaterialVisibility(runtime.cloudMaterial, 1);
        setMaterialVisibility(runtime.ringMaterial, 1);
        continue;
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
