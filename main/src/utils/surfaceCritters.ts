import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MaterialType } from '../types/materials';
import { voxelSystem } from './efficientVoxelSystem';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { seededVoxelUnit } from './seededHash';
import type { GraphicsQuality } from '../config/graphicsSettings';
import type { VoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { isVoxelFaceOpen, surfaceEffectVisibility, type SurfaceEffectId } from './surfaceEffects';

// =============================================================================
// SURFACE MICRO-CRITTERS — close-up reward layer of the voxel surface effects.
//
// Tiny deterministic agents (worms on loose soil, caterpillars on grass) that
// genuinely CRAWL from voxel to adjacent voxel of the SAME material — the
// close-inspection payoff the dirt design run asked for ("close inspection
// should reward the player with small movement"). Same travel idiom as
// faunaField agents, but constrained to the home material so the life visibly
// propagates across a contiguous field of like voxels, never onto rock or air.
//
// Placement/orientation matches the other surface layers (dominant cube face,
// deterministic tangent basis); gait animation runs in the vertex shader.
// =============================================================================

export type CritterKind = 'worm' | 'caterpillar';

export interface CritterConfig {
  kind: CritterKind;
  effectId: SurfaceEffectId;
  materials: MaterialType[];
  /** Fraction of eligible voxels that host one critter at density 1. */
  coverageBase: number;
  coverageGain: number;
  /** Crawl speed in world units/s (worms ~0.1, caterpillars ~0.2). */
  speed: number;
  /** Max voxel steps a critter wanders from home before turning back. */
  leash: number;
  /** Body colors (linear), usually palette-derived. */
  bodyColor: THREE.Color;
  accentColor: THREE.Color;
  darkColor: THREE.Color;
  salt: number;
}

export interface CritterAgent {
  terrainSeed: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  toX: number;
  toY: number;
  toZ: number;
  material: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
  directionIndex: number;
  speed: number;
  seed: number;
  stepSalt: number;
  stepCount: number;
  orientation: THREE.Quaternion;
}

export interface CritterBuildResult {
  count: number;
  voxelCount: number;
}

const CRITTER_COVERAGE_SALT = 611;
const CRITTER_OFFSET_U_SALT = 612;
const CRITTER_OFFSET_V_SALT = 613;
const CRITTER_SEED_SALT = 614;
const CRITTER_DIR_SALT = 615;
const CRITTER_STEP_SALT = 616;

// Bodies sit ON the face (cube face plane at 0.99 from the voxel center).
const CRITTER_SURFACE_OFFSET: Record<CritterKind, number> = {
  worm: 1.0,
  caterpillar: 1.005
};

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _sideV = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _desired = new THREE.Quaternion();
const _basisM = new THREE.Matrix4();
const _scaleV = new THREE.Vector3(1, 1, 1);
const _scratch = new THREE.Matrix4();

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}

// -----------------------------------------------------------------------------
// Eligibility (pure, unit-tested)
// -----------------------------------------------------------------------------

export function critterCoverage(density: number, config: Pick<CritterConfig, 'coverageBase' | 'coverageGain'>): number {
  if (density <= 0) return 0;
  return clamp(config.coverageBase + density * config.coverageGain, 0, 1);
}

export function isCritterHomeVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  config: Pick<CritterConfig, 'materials'>
): boolean {
  return voxel.supportsSurfaceResources !== false && config.materials.includes(voxel.material as MaterialType);
}

/** Critters only travel across voxels of the SAME material as their home voxel. */
export function isCritterTravelVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean } | undefined,
  homeMaterial: string
): boolean {
  if (!voxel) return false;
  if (voxel.supportsSurfaceResources === false) return false;
  return voxel.material === homeMaterial;
}

export function shouldPlaceCritter(
  x: number,
  y: number,
  z: number,
  density: number,
  terrainSeed: number,
  config: CritterConfig
): boolean {
  const coverage = critterCoverage(density, config);
  if (coverage <= 0) return false;
  return seededVoxelUnit(x, y, z, CRITTER_COVERAGE_SALT + config.salt, terrainSeed) <= coverage;
}

export function countCritterVoxels(config: CritterConfig, density: number, terrainSeed: number): number {
  if (density <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isCritterHomeVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;
    if (!shouldPlaceCritter(x, y, z, density, terrainSeed, config)) continue;
    n++;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Travel (same idiom as faunaField, constrained to the home material)
// -----------------------------------------------------------------------------

function surfaceNeighborSteps(x: number, y: number, z: number): Array<[number, number, number]> {
  voxelCoordToWorld(x, y, z, _world);
  const face = dominantFaceForPosition(_world);
  if (face === 'top' || face === 'bottom') return [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
  if (face === 'left' || face === 'right') return [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]];
  return [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]];
}

function surfaceUpCoordStep(x: number, y: number, z: number): [number, number, number] {
  voxelCoordToWorld(x, y, z, _world);
  const up = FACE_NORMALS[dominantFaceForPosition(_world)];
  return [Math.round(up.x), Math.round(up.y), Math.round(up.z)];
}

function findCritterTravelCandidate(
  agent: CritterAgent,
  directionIndex: number
): [number, number, number] | null {
  const steps = surfaceNeighborSteps(agent.x, agent.y, agent.z);
  const [sx, sy, sz] = steps[mod4(directionIndex)];
  const [ux, uy, uz] = surfaceUpCoordStep(agent.x, agent.y, agent.z);
  for (const climb of [0, 1, -1]) {
    const nx = agent.x + sx + ux * climb;
    const ny = agent.y + sy + uy * climb;
    const nz = agent.z + sz + uz * climb;
    const voxel = voxelSystem.getVoxel(nx, ny, nz);
    if (voxel && isCritterTravelVoxel(voxel, agent.material) && isVoxelFaceOpen(nx, ny, nz)) {
      return [nx, ny, nz];
    }
  }
  return null;
}

function directionTowardHome(agent: CritterAgent): number {
  const steps = surfaceNeighborSteps(agent.x, agent.y, agent.z);
  let best = agent.directionIndex;
  let bestGain = -Infinity;
  for (let i = 0; i < 4; i++) {
    const [sx, sy, sz] = steps[i];
    const gain =
      (Math.abs(agent.homeX - agent.x) - Math.abs(agent.homeX - (agent.x + sx))) +
      (Math.abs(agent.homeY - agent.y) - Math.abs(agent.homeY - (agent.y + sy))) +
      (Math.abs(agent.homeZ - agent.z) - Math.abs(agent.homeZ - (agent.z + sz)));
    if (gain > bestGain) {
      bestGain = gain;
      best = i;
    }
  }
  return best;
}

function chooseCritterNextVoxel(agent: CritterAgent, terrainSeed: number, config: CritterConfig): [number, number, number] {
  const leashDist =
    Math.abs(agent.x - agent.homeX) + Math.abs(agent.y - agent.homeY) + Math.abs(agent.z - agent.homeZ);
  if (leashDist >= config.leash) {
    agent.directionIndex = directionTowardHome(agent);
  } else {
    const turnRoll = seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount, terrainSeed);
    if (turnRoll < 0.22) agent.directionIndex = mod4(agent.directionIndex + 1);
    else if (turnRoll < 0.44) agent.directionIndex = mod4(agent.directionIndex - 1);
  }

  for (const candidateDir of [agent.directionIndex, agent.directionIndex + 1, agent.directionIndex - 1, agent.directionIndex + 2]) {
    const candidate = findCritterTravelCandidate(agent, candidateDir);
    if (!candidate) continue;
    agent.directionIndex = mod4(candidateDir);
    return candidate;
  }
  return [agent.x, agent.y, agent.z];
}

function computeCritterAnchor(
  kind: CritterKind,
  x: number,
  y: number,
  z: number,
  offsetU: number,
  offsetV: number,
  target: THREE.Vector3
): THREE.Vector3 {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();
  target.copy(_world);
  target.addScaledVector(_up, CRITTER_SURFACE_OFFSET[kind]);
  target.addScaledVector(_tangent, offsetU * 0.7);
  target.addScaledVector(_bitangent, offsetV * 0.7);
  return target;
}

function setCritterRoute(agent: CritterAgent, terrainSeed: number, config: CritterConfig): void {
  agent.stepCount += 1;
  agent.x = agent.toX;
  agent.y = agent.toY;
  agent.z = agent.toZ;
  agent.from.copy(agent.to);
  const [nx, ny, nz] = chooseCritterNextVoxel(agent, terrainSeed, config);
  agent.toX = nx;
  agent.toY = ny;
  agent.toZ = nz;
  const offsetU = seededVoxelUnit(nx, ny, nz, CRITTER_OFFSET_U_SALT + config.salt + agent.stepCount, terrainSeed) - 0.5;
  const offsetV = seededVoxelUnit(nx, ny, nz, CRITTER_OFFSET_V_SALT + config.salt + agent.stepCount, terrainSeed) - 0.5;
  computeCritterAnchor(config.kind, nx, ny, nz, offsetU, offsetV, agent.to);
}

export function createCritterAgent(
  x: number,
  y: number,
  z: number,
  material: string,
  terrainSeed: number,
  config: CritterConfig
): CritterAgent {
  const offsetU = seededVoxelUnit(x, y, z, CRITTER_OFFSET_U_SALT + config.salt, terrainSeed) - 0.5;
  const offsetV = seededVoxelUnit(x, y, z, CRITTER_OFFSET_V_SALT + config.salt, terrainSeed) - 0.5;
  const seed = seededVoxelUnit(x, y, z, CRITTER_SEED_SALT + config.salt, terrainSeed);
  const agent: CritterAgent = {
    terrainSeed,
    homeX: x,
    homeY: y,
    homeZ: z,
    x,
    y,
    z,
    toX: x,
    toY: y,
    toZ: z,
    material,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    progress: seed * 0.8,
    directionIndex: Math.floor(seededVoxelUnit(x, y, z, CRITTER_DIR_SALT + config.salt, terrainSeed) * 4),
    speed: config.speed * (0.7 + seed * 0.6),
    seed,
    stepSalt: CRITTER_STEP_SALT + Math.floor(seed * 4096),
    stepCount: 0,
    orientation: new THREE.Quaternion()
  };
  computeCritterAnchor(config.kind, x, y, z, offsetU, offsetV, agent.from);
  agent.to.copy(agent.from);
  setCritterRoute(agent, terrainSeed, config);
  return agent;
}

export function buildCritterAgents(
  config: CritterConfig,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  maxAgents = 160
): CritterAgent[] {
  const agents: CritterAgent[] = [];
  if (density <= 0) return agents;
  const maxDistSq = maxDistance * maxDistance;

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (agents.length >= maxAgents) break;
    if (!isCritterHomeVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;
    if (!shouldPlaceCritter(x, y, z, density, terrainSeed, config)) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    agents.push(createCritterAgent(x, y, z, voxel.material, terrainSeed, config));
  }
  return agents;
}

function isCritterAgentStillValid(agent: CritterAgent): boolean {
  const current = voxelSystem.getVoxel(agent.x, agent.y, agent.z);
  const target = voxelSystem.getVoxel(agent.toX, agent.toY, agent.toZ);
  return isCritterTravelVoxel(current, agent.material) && isCritterTravelVoxel(target, agent.material);
}

function computeCritterAgentMatrix(agent: CritterAgent, rotationAlpha: number, target: THREE.Matrix4): THREE.Matrix4 {
  const t = clamp(agent.progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  _pos.copy(agent.from).lerp(agent.to, eased);

  _up.copy(FACE_NORMALS[dominantFaceForPosition(_pos)]);
  // Small hop over a one-voxel step up/down so the body doesn't clip the ledge.
  const levelLift = Math.abs(agent.to.dot(_up) - agent.from.dot(_up));
  if (levelLift > 0.5) _pos.addScaledVector(_up, Math.sin(Math.PI * eased) * 0.22);

  _forward.copy(agent.to).sub(agent.from);
  _forward.addScaledVector(_up, -_forward.dot(_up));
  if (_forward.lengthSq() < 0.0001) {
    deterministicTangentForUp(_up, _forward);
  } else {
    _forward.normalize();
  }
  _sideV.crossVectors(_forward, _up);
  if (_sideV.lengthSq() < 0.0001) {
    deterministicTangentForUp(_up, _sideV);
  } else {
    _sideV.normalize();
  }

  _basisM.makeBasis(_forward, _up, _sideV);
  _desired.setFromRotationMatrix(_basisM);
  agent.orientation.slerp(_desired, clamp(rotationAlpha, 0, 1));
  target.compose(_pos, agent.orientation, _scaleV);
  return target;
}

/**
 * Advance every agent and write instance matrices. Agents whose current or
 * target voxel was edited away (or changed material) respawn at home.
 */
export function updateCritterAgents(
  mesh: THREE.InstancedMesh,
  agents: CritterAgent[],
  deltaTime: number,
  terrainSeed: number,
  config: CritterConfig
): CritterBuildResult {
  const dt = clamp(deltaTime, 0, 0.12);
  const count = Math.min(agents.length, mesh.instanceMatrix.count);
  const rotationAlpha = 1 - Math.exp(-5 * dt);

  for (let i = 0; i < count; i++) {
    let agent = agents[i];
    if (!isCritterAgentStillValid(agent)) {
      const home = voxelSystem.getVoxel(agent.homeX, agent.homeY, agent.homeZ);
      if (home && isCritterTravelVoxel(home, agent.material)) {
        agent = createCritterAgent(agent.homeX, agent.homeY, agent.homeZ, agent.material, terrainSeed, config);
        agents[i] = agent;
      } else {
        // Home voxel is gone; park the critter at zero scale until a rebuild.
        _scratch.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, _scratch);
        continue;
      }
    }

    const distance = agent.from.distanceTo(agent.to);
    if (distance > 0.001) {
      agent.progress += dt * agent.speed / distance;
      while (agent.progress >= 1) {
        agent.progress -= 1;
        setCritterRoute(agent, terrainSeed, config);
        if (agent.from.distanceToSquared(agent.to) < 0.0001) {
          agent.progress = 0;
          break;
        }
      }
    } else {
      agent.progress = 0;
      setCritterRoute(agent, terrainSeed, config);
    }

    computeCritterAgentMatrix(agent, rotationAlpha, _scratch);
    mesh.setMatrixAt(i, _scratch);
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  return { count, voxelCount: count };
}

// -----------------------------------------------------------------------------
// Geometry — local space: +X forward (head at +X), ground at y=0.
// -----------------------------------------------------------------------------

function withCritterAttributes(
  geo: THREE.BufferGeometry,
  color: THREE.Color,
  segT: number,
  headX: number,
  tailX: number
): THREE.BufferGeometry {
  const work = geo.index ? geo.toNonIndexed() : geo;
  work.deleteAttribute('uv');
  work.computeVertexNormals();
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const seg = new Float32Array(pos.count);
  const span = Math.max(0.001, headX - tailX);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    // Per-vertex position along the body (0 tail -> 1 head) drives the gait; a
    // fixed per-part fallback (segT >= 0) pins accents like eyes to their part.
    seg[i] = segT >= 0 ? segT : clamp((pos.getX(i) - tailX) / span, 0, 1);
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aSegT', new THREE.BufferAttribute(seg, 1));
  return work;
}

function segmentBlob(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rz: number,
  color: THREE.Color,
  headX: number,
  tailX: number
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  geo.scale(rx, ry, rz);
  geo.translate(x, y, 0);
  return withCritterAttributes(geo, color, -1, headX, tailX);
}

/**
 * Earthworm: a slightly tapered chain of annular segments, half-settled into
 * the topsoil, with a paler clitellum band near the head.
 */
export function createWormGeometry(config: Pick<CritterConfig, 'bodyColor' | 'accentColor' | 'darkColor'>): THREE.BufferGeometry {
  const LENGTH = 0.42;
  const RADIUS = 0.026;
  const SEGMENTS = 8;
  const head = LENGTH / 2;
  const tail = -LENGTH / 2;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / (SEGMENTS - 1);
    const x = tail + t * LENGTH;
    // Taper both ends; worms are thinner at the tail.
    const taper = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85));
    const r = RADIUS * taper;
    // Clitellum band sits ~2/3 toward the head and reads paler.
    const isBand = t > 0.62 && t < 0.78;
    const color = isBand ? config.accentColor : config.bodyColor.clone().lerp(config.darkColor, 0.35 * (1 - t));
    parts.push(segmentBlob(x, r * 0.82, r * 1.28, r, r, color, head, tail));
  }
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge worm geometry');
  geo.computeVertexNormals();
  return geo;
}

/**
 * Caterpillar: plump ellipsoid segments with a bigger head, dorsal accent
 * stripe suggested by per-segment color alternation.
 */
export function createCaterpillarGeometry(config: Pick<CritterConfig, 'bodyColor' | 'accentColor' | 'darkColor'>): THREE.BufferGeometry {
  const LENGTH = 0.24;
  const RADIUS = 0.026;
  const SEGMENTS = 7;
  const head = LENGTH / 2 + RADIUS * 0.8;
  const tail = -LENGTH / 2;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / (SEGMENTS - 1);
    const x = tail + t * LENGTH;
    const r = RADIUS * (0.8 + 0.2 * Math.sin(Math.PI * t));
    const color = i % 2 === 0
      ? config.bodyColor
      : config.bodyColor.clone().lerp(config.accentColor, 0.55);
    parts.push(segmentBlob(x, r, r * 0.9, r, r * 0.92, color, head, tail));
  }
  // Head: slightly larger, darker.
  parts.push(segmentBlob(head - RADIUS * 0.4, RADIUS * 1.05, RADIUS * 1.05, RADIUS * 1.05, RADIUS, config.darkColor, head, tail));
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge caterpillar geometry');
  geo.computeVertexNormals();
  return geo;
}

export function createCritterGeometry(config: CritterConfig): THREE.BufferGeometry {
  return config.kind === 'worm' ? createWormGeometry(config) : createCaterpillarGeometry(config);
}

export function prepareCritterSeedAttribute(geometry: THREE.BufferGeometry, capacity: number): THREE.InstancedBufferAttribute {
  const existing = geometry.getAttribute('aCritterSeed') as THREE.InstancedBufferAttribute | undefined;
  if (existing && existing.count >= capacity) return existing;
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, capacity)), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aCritterSeed', attr);
  return attr;
}

export function writeCritterSeeds(geometry: THREE.BufferGeometry, agents: CritterAgent[]): void {
  const attr = geometry.getAttribute('aCritterSeed') as THREE.InstancedBufferAttribute | undefined;
  if (!attr) return;
  const n = Math.min(agents.length, attr.count);
  for (let i = 0; i < n; i++) attr.setX(i, agents[i].seed);
  attr.needsUpdate = true;
}

// -----------------------------------------------------------------------------
// Material — Standard PBR with the gait in the vertex shader.
// -----------------------------------------------------------------------------

const CRITTER_GAIT_GLSL: Record<CritterKind, string> = {
  // Peristalsis: a compression wave travels tail->head; segments bulge where
  // compressed. A soft lateral S-curve keeps the body from reading as a rod.
  worm: /* glsl */ `
    float wave = sin(uTime * 5.0 - aSegT * 9.42477 + phase);
    transformed.x += wave * 0.014 * uVisibility;
    float bulge = 1.0 + 0.16 * wave * uVisibility;
    transformed.y *= bulge;
    transformed.z *= bulge;
    transformed.z += sin(aSegT * 4.71238 + uTime * 1.3 + phase) * 0.016 * uVisibility;
    // Slow burrow settle: the whole body eases a touch into the soil and back.
    transformed.y -= (0.5 + 0.5 * sin(uTime * 0.22 + phase * 2.0)) * 0.012 * uVisibility;
  `,
  // Inchworm cycle: arch rises mid-body while tail draws in, then the body
  // extends flat; the head casts side to side searching between steps.
  caterpillar: /* glsl */ `
    float cycle = fract(uTime * 0.5 + phase * 0.5);
    float arch = smoothstep(0.05, 0.4, cycle) * (1.0 - smoothstep(0.5, 0.9, cycle));
    float archY = sin(3.14159 * clamp(aSegT, 0.0, 1.0));
    transformed.y += arch * 0.075 * archY * archY * uVisibility;
    transformed.x += arch * (0.5 - aSegT) * 0.05 * uVisibility;
    transformed.z += sin(uTime * 2.1 + phase) * 0.009 * smoothstep(0.72, 1.0, aSegT) * uVisibility;
  `
};

export function createCritterMaterial(config: CritterConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: config.kind === 'worm' ? 0.38 : 0.72, // worms glisten wet
    metalness: 0
  });

  material.userData.effectId = config.effectId;

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uVisibility = { value: 1 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSegT;
        attribute float aCritterSeed;
        uniform float uTime;
        uniform float uVisibility;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float phase = aCritterSeed * 6.28318;
        ${CRITTER_GAIT_GLSL[config.kind]}`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uVisibility;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (uVisibility < 0.01) discard;`
      );
  };

  material.customProgramCacheKey = () => `surface-critter-${config.kind}-v1`;
  return material;
}

/** Per-frame: time + reality-stage visibility (0 hides + freezes the layer). */
export function updateCritterMaterial(
  material: THREE.Material,
  time: number,
  quality: GraphicsQuality,
  reality: VoxelRealityEffects
): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  const id = material.userData.effectId as SurfaceEffectId | undefined;
  if (u.uTime && quality.animatedShaders) (u.uTime.value as number) = time;
  if (u.uVisibility) {
    (u.uVisibility.value as number) = quality.animatedShaders && id
      ? Math.min(1, Math.max(0, surfaceEffectVisibility(id, reality)))
      : 0;
  }
}

/** Distance critters are drawn/simulated: close-inspection layer only. */
export function critterMaxDistance(quality: GraphicsQuality): number {
  if (quality.voxelEffectMaxDistance <= 0) return 0;
  return Math.min(quality.voxelEffectMaxDistance, 26);
}
