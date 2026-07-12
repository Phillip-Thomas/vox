import * as THREE from 'three';
import type { QualityProfile } from '../config/graphicsSettings.ts';
import {
  buildStarSystemManifest,
  type PlanetDescriptor,
  type PlanetSlot,
  type SystemCoordinate,
  type Vec3Tuple
} from '../game/starSystem.ts';
import {
  deriveWorldPreviewTraits,
  previewSurfaceValue
} from '../utils/worldPreview.ts';

export interface CompanionBodyModel {
  descriptor: PlanetDescriptor;
  relativePosition: Vec3Tuple;
}

export interface CompanionVisualBudget {
  surfaceSubdivisions: number;
  cloudSubdivisions: number;
  ringSegments: number;
  separateCloudShell: boolean;
  exactTerrainShell: boolean;
}

export interface CompanionBodyModelOptions {
  coordinate: SystemCoordinate;
  activePlanetSlot?: PlanetSlot;
  forceSingleBody?: boolean;
  bodyCountOverride?: 1 | 2 | 3;
}

const FACE_FRAMES: ReadonlyArray<{
  normal: Vec3Tuple;
  tangentU: Vec3Tuple;
  tangentV: Vec3Tuple;
}> = [
  { normal: [1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  { normal: [-1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, -1] },
  { normal: [0, 1, 0], tangentU: [0, 0, 1], tangentV: [1, 0, 0] },
  { normal: [0, -1, 0], tangentU: [0, 0, 1], tangentV: [-1, 0, 0] },
  { normal: [0, 0, 1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] },
  { normal: [0, 0, -1], tangentU: [1, 0, 0], tangentV: [0, -1, 0] }
];

export function buildCompanionBodyModels({
  coordinate,
  activePlanetSlot = 0,
  forceSingleBody = false,
  bodyCountOverride
}: CompanionBodyModelOptions): CompanionBodyModel[] {
  const manifest = buildStarSystemManifest(coordinate, {
    forceSingleBody,
    ...(bodyCountOverride === undefined ? {} : { bodyCountOverride })
  });
  const active = manifest.planets.find(planet => planet.address.slot === activePlanetSlot);
  if (!active) return [];

  return manifest.planets
    .filter(planet => planet.address.slot !== activePlanetSlot)
    .slice(0, 2)
    .map(descriptor => ({
      descriptor,
      relativePosition: [
        descriptor.systemPosition[0] - active.systemPosition[0],
        descriptor.systemPosition[1] - active.systemPosition[1],
        descriptor.systemPosition[2] - active.systemPosition[2]
      ]
    }));
}

export function companionVisualBudget(profile: QualityProfile): CompanionVisualBudget {
  switch (profile) {
    case 'ULTRA':
      return { surfaceSubdivisions: 32, cloudSubdivisions: 22, ringSegments: 112, separateCloudShell: true, exactTerrainShell: true };
    case 'HIGH':
      return { surfaceSubdivisions: 28, cloudSubdivisions: 18, ringSegments: 96, separateCloudShell: true, exactTerrainShell: true };
    case 'MEDIUM':
      return { surfaceSubdivisions: 20, cloudSubdivisions: 12, ringSegments: 64, separateCloudShell: true, exactTerrainShell: false };
    case 'LOW':
      return { surfaceSubdivisions: 14, cloudSubdivisions: 0, ringSegments: 36, separateCloudShell: false, exactTerrainShell: false };
    case 'POTATO':
      return { surfaceSubdivisions: 8, cloudSubdivisions: 0, ringSegments: 20, separateCloudShell: false, exactTerrainShell: false };
  }
}

export const EXACT_SHELL_FULL_DISTANCE = 420;
export const EXACT_SHELL_START_DISTANCE = 1_050;
export const EXACT_TERRAIN_BATCH_SIZE = 5_000;
export const EXACT_WATER_BATCH_SIZE = 4_096;

export function companionExactTerrainFaceCount(instanceData: Float32Array, terrainCount: number): number {
  let faces = 0;
  for (let index = 0; index < terrainCount; index++) {
    let hiddenMask = Math.trunc(instanceData[index * 2 + 1]) & 0x3f;
    let hiddenFaces = 0;
    while (hiddenMask !== 0) {
      hiddenMask &= hiddenMask - 1;
      hiddenFaces++;
    }
    faces += 6 - hiddenFaces;
  }
  return faces;
}

export function companionExactShellDrawCount(terrainFaceCount: number, waterFaceCount: number): number {
  const terrainDraws = terrainFaceCount > 0 ? 1 : 0;
  const waterDraws = Math.ceil(Math.max(0, waterFaceCount) / EXACT_WATER_BATCH_SIZE);
  return terrainDraws + waterDraws;
}

export function companionExactShellTriangleCount(terrainFaceCount: number, waterFaceCount: number): number {
  return Math.max(0, terrainFaceCount + waterFaceCount) * 2;
}

/** Exact terrain dissolves in well before activation so landmarks never jump. */
export function companionExactShellBlend(centerDistance: number): number {
  if (!Number.isFinite(centerDistance)) return 0;
  const t = THREE.MathUtils.clamp(
    (centerDistance - EXACT_SHELL_FULL_DISTANCE)
      / (EXACT_SHELL_START_DISTANCE - EXACT_SHELL_FULL_DISTANCE),
    0,
    1
  );
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

export function createCompanionSurfaceGeometry(seed: number, requestedSubdivisions: number): THREE.BufferGeometry {
  const subdivisions = THREE.MathUtils.clamp(Math.trunc(requestedSubdivisions), 2, 32);
  const traits = deriveWorldPreviewTraits(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const direction = new THREE.Vector3();
  const color = new THREE.Color();
  const ice = new THREE.Color('#d9e7ed');
  const row = subdivisions + 1;

  for (const face of FACE_FRAMES) {
    const baseVertex = positions.length / 3;
    for (let y = 0; y <= subdivisions; y++) {
      const v = -1 + (y / subdivisions) * 2;
      for (let x = 0; x <= subdivisions; x++) {
        const u = -1 + (x / subdivisions) * 2;
        const px = face.normal[0] + face.tangentU[0] * u + face.tangentV[0] * v;
        const py = face.normal[1] + face.tangentU[1] * u + face.tangentV[1] * v;
        const pz = face.normal[2] + face.tangentU[2] * u + face.tangentV[2] * v;
        direction.set(px, py, pz).normalize();

        const surface = previewSurfaceValue(direction, traits);
        const relief = (surface - 0.5) * (0.045 + traits.relief * 0.085);
        const oceanInset = surface < traits.oceanCoverage ? -0.012 : 0;
        const displacement = 1 + relief + oceanInset;
        positions.push(px * displacement, py * displacement, pz * displacement);
        uvs.push(x / subdivisions, y / subdivisions);

        const latitude = Math.abs(direction.y);
        if (surface < traits.oceanCoverage) {
          color.copy(traits.oceanColor).offsetHSL(0, 0, (surface - traits.oceanCoverage) * 0.1);
        } else if (latitude > traits.iceCoverage) {
          color.copy(ice);
        } else if (surface > 0.78 - traits.relief * 0.12) {
          color.copy(traits.rockColor);
        } else {
          color.copy(traits.landColor).lerp(
            traits.rockColor,
            THREE.MathUtils.clamp((surface - 0.56) * (1 + traits.relief), 0, 0.5)
          );
        }
        color.multiplyScalar(0.86 + surface * 0.22);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let y = 0; y < subdivisions; y++) {
      for (let x = 0; x < subdivisions; x++) {
        const a = baseVertex + y * row + x;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function createCompanionCloudGeometry(seed: number, subdivisions: number): THREE.BufferGeometry {
  const geometry = createCompanionSurfaceGeometry(seed, subdivisions);
  const traits = deriveWorldPreviewTraits(seed);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  const direction = new THREE.Vector3();
  const phase = seed * 0.00017;

  for (let index = 0; index < position.count; index++) {
    direction.set(position.getX(index), position.getY(index), position.getZ(index)).normalize();
    const bands = Math.sin((direction.x * 2.1 + direction.z * 3.7 + phase) * 5.2);
    const broken = Math.sin((direction.y * 4.4 - direction.z * 2.3 + phase * 1.7) * 7.1);
    const coverage = THREE.MathUtils.smoothstep(bands * 0.62 + broken * 0.38, 0.18, 0.72);
    colors[index * 4] = traits.cloudColor.r;
    colors[index * 4 + 1] = traits.cloudColor.g;
    colors[index * 4 + 2] = traits.cloudColor.b;
    colors[index * 4 + 3] = coverage * 0.42;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return geometry;
}
