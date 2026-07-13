import { seededUnit } from './worldCoordinates';

export const FAUNA_MODEL_SCHEMA_VERSION = 1 as const;

// Append-only. Saved worlds and future renderers may persist these stable ids.
export const FAUNA_KINDS = Object.freeze(
  ['grazer', 'woolly', 'runner', 'hopper', 'dragonfly', 'fish'] as const
);
export type FaunaKind = typeof FAUNA_KINDS[number];

export const FAUNA_KIND_ID: Readonly<Record<FaunaKind, number>> = Object.freeze({
  grazer: 0,
  woolly: 1,
  runner: 2,
  hopper: 3,
  dragonfly: 4,
  fish: 5
});

// These semantic lists are append-only for the same reason as FAUNA_KINDS.
export const FAUNA_REGIONS = Object.freeze([
  'body',
  'head',
  'frontLimb',
  'hindLimb',
  'ear',
  'tail',
  'mane',
  'horn',
  'wing',
  'fin',
  'eye',
  'hoof',
  'fleece'
] as const);
export type FaunaRegion = typeof FAUNA_REGIONS[number];
export const FAUNA_REGION_ID = Object.freeze(Object.fromEntries(
  FAUNA_REGIONS.map((region, index) => [region, index])
) as Record<FaunaRegion, number>);

export const FAUNA_JOINTS = Object.freeze([
  'root',
  'neck',
  'frontLeft',
  'frontRight',
  'hindLeft',
  'hindRight',
  'tail',
  'leftWing',
  'rightWing',
  'fin'
] as const);
export type FaunaJoint = typeof FAUNA_JOINTS[number];
export const FAUNA_JOINT_ID = Object.freeze(Object.fromEntries(
  FAUNA_JOINTS.map((joint, index) => [joint, index])
) as Record<FaunaJoint, number>);

export const FAUNA_MATERIAL_SLOTS = Object.freeze([
  'coat',
  'fleece',
  'skin',
  'eye',
  'horn',
  'hoof',
  'scale',
  'membrane',
  'bioluminescent'
] as const);
export type FaunaMaterialSlot = typeof FAUNA_MATERIAL_SLOTS[number];
export const FAUNA_MATERIAL_SLOT_ID = Object.freeze(Object.fromEntries(
  FAUNA_MATERIAL_SLOTS.map((slot, index) => [slot, index])
) as Record<FaunaMaterialSlot, number>);

export type FaunaBehavior = 'idle' | 'travel' | 'graze' | 'alert' | 'flee' | 'hop' | 'fly' | 'swim';
export type Vec3Tuple = readonly [number, number, number];
export type QuatTuple = readonly [number, number, number, number];

/** World-space and serialization conventions shared by every renderer adapter. */
export const FAUNA_SPACE_CONVENTION = Object.freeze({
  handedness: 'right',
  upAxis: '+y',
  localForwardAxis: '+x',
  quaternionOrder: 'xyzw',
  rotationMeaning: 'localToWorld',
  distanceUnit: 'worldUnit'
} as const);

export interface FaunaPoseState {
  readonly locomotion: number;
  readonly graze: number;
  readonly alert: number;
  readonly flee: number;
  readonly hop: number;
  readonly swim: number;
  readonly wingbeat: number;
  readonly turn: number;
  readonly breathe: number;
}

export interface FaunaRenderSnapshotV1 {
  readonly schemaVersion: typeof FAUNA_MODEL_SCHEMA_VERSION;
  readonly agentId: string;
  readonly kind: FaunaKind;
  readonly kindId: number;
  readonly morphologyId: number;
  readonly behavior: FaunaBehavior;
  readonly position: Vec3Tuple;
  readonly rotation: QuatTuple;
  readonly scale: Vec3Tuple;
  readonly velocity: Vec3Tuple;
  readonly forward: Vec3Tuple;
  readonly up: Vec3Tuple;
  /** Normalized locomotion cycle in [0, 1), never radians. */
  readonly locomotionPhase: number;
  /** Distance travelled per second in world units. */
  readonly locomotionSpeed: number;
  readonly pose: FaunaPoseState;
}

export interface FaunaMorphologyDefinitionV1 {
  readonly schemaVersion: typeof FAUNA_MODEL_SCHEMA_VERSION;
  readonly kind: FaunaKind;
  readonly kindId: number;
  readonly morphologyId: number;
  readonly phenotype: FaunaPhenotype;
}

/** A self-contained renderer handoff with shared morphology data sent once per kind. */
export interface FaunaRenderFrameV1 {
  readonly schemaVersion: typeof FAUNA_MODEL_SCHEMA_VERSION;
  readonly morphologies: readonly FaunaMorphologyDefinitionV1[];
  readonly snapshots: readonly FaunaRenderSnapshotV1[];
}

export interface FaunaRendererAdapter<Handle = unknown> {
  readonly schemaVersion: typeof FAUNA_MODEL_SCHEMA_VERSION;
  sync(frame: FaunaRenderFrameV1): Handle;
  dispose(handle: Handle): void;
}

export interface FaunaPhenotype {
  readonly morphologyId: number;
  readonly mass: number;
  readonly bodyLength: number;
  readonly bodyHeight: number;
  readonly bodyWidth: number;
  readonly shoulderHeight: number;
  readonly hipHeight: number;
  readonly limbSlenderness: number;
  readonly neckLength: number;
  readonly neckRise: number;
  readonly muzzleLength: number;
  readonly earScale: number;
  readonly earSplay: number;
  readonly tailLength: number;
  readonly tailLift: number;
  readonly appendageScale: number;
  readonly fleece: number;
  readonly crest: number;
}

export interface FaunaSpeciesDefinition {
  readonly kind: FaunaKind;
  readonly stableId: number;
  readonly strideCyclesPerUnit: number;
  readonly strideLength: number;
  readonly bodyClearance: number;
  readonly defaultBehavior: FaunaBehavior;
  readonly regions: readonly FaunaRegion[];
  readonly materialSlots: readonly FaunaMaterialSlot[];
}

const COMMON_MAMMAL_REGIONS: readonly FaunaRegion[] = Object.freeze([
  'body', 'head', 'frontLimb', 'hindLimb', 'ear', 'tail', 'eye', 'hoof'
]);

function defineSpecies(definition: FaunaSpeciesDefinition): FaunaSpeciesDefinition {
  return Object.freeze({
    ...definition,
    regions: Object.freeze([...definition.regions]),
    materialSlots: Object.freeze([...definition.materialSlots])
  });
}

export const FAUNA_SPECIES: Readonly<Record<FaunaKind, FaunaSpeciesDefinition>> = Object.freeze({
  grazer: defineSpecies({
    kind: 'grazer', stableId: 0, strideCyclesPerUnit: 0.56, strideLength: 1.65,
    bodyClearance: 1.45, defaultBehavior: 'travel',
    regions: [...COMMON_MAMMAL_REGIONS, 'mane', 'horn'],
    materialSlots: ['coat', 'skin', 'eye', 'horn', 'hoof']
  }),
  woolly: defineSpecies({
    kind: 'woolly', stableId: 1, strideCyclesPerUnit: 0.72, strideLength: 1.05,
    bodyClearance: 0.9, defaultBehavior: 'travel',
    regions: [...COMMON_MAMMAL_REGIONS, 'fleece', 'horn'],
    materialSlots: ['coat', 'fleece', 'skin', 'eye', 'horn', 'hoof']
  }),
  runner: defineSpecies({
    kind: 'runner', stableId: 2, strideCyclesPerUnit: 1.1, strideLength: 0.82,
    bodyClearance: 0.82, defaultBehavior: 'travel',
    regions: COMMON_MAMMAL_REGIONS,
    materialSlots: ['coat', 'skin', 'eye', 'hoof']
  }),
  hopper: defineSpecies({
    kind: 'hopper', stableId: 3, strideCyclesPerUnit: 0.85, strideLength: 0.72,
    bodyClearance: 0.78, defaultBehavior: 'hop',
    regions: COMMON_MAMMAL_REGIONS,
    materialSlots: ['coat', 'skin', 'eye', 'hoof']
  }),
  dragonfly: defineSpecies({
    kind: 'dragonfly', stableId: 4, strideCyclesPerUnit: 2.2, strideLength: 0.45,
    bodyClearance: 0.62, defaultBehavior: 'fly',
    regions: ['body', 'head', 'wing', 'eye'],
    materialSlots: ['skin', 'eye', 'membrane', 'bioluminescent']
  }),
  fish: defineSpecies({
    kind: 'fish', stableId: 5, strideCyclesPerUnit: 1.4, strideLength: 0.64,
    bodyClearance: 0.52, defaultBehavior: 'swim',
    regions: ['body', 'head', 'tail', 'fin', 'eye'],
    materialSlots: ['scale', 'eye', 'membrane', 'bioluminescent']
  })
});

const BASE_PHENOTYPE: Readonly<Record<FaunaKind, Omit<FaunaPhenotype, 'morphologyId'>>> = {
  grazer: {
    mass: 0.76, bodyLength: 1, bodyHeight: 0.74, bodyWidth: 0.62,
    shoulderHeight: 1, hipHeight: 0.94, limbSlenderness: 0.72,
    neckLength: 1, neckRise: 0.9, muzzleLength: 1, earScale: 1,
    earSplay: 0.36, tailLength: 0.82, tailLift: 0.18,
    appendageScale: 1, fleece: 0.08, crest: 0.54
  },
  woolly: {
    mass: 1, bodyLength: 0.88, bodyHeight: 0.9, bodyWidth: 1,
    shoulderHeight: 0.88, hipHeight: 0.86, limbSlenderness: 0.82,
    neckLength: 0.52, neckRise: 0.28, muzzleLength: 0.72, earScale: 0.72,
    earSplay: 0.72, tailLength: 0.34, tailLift: 0.4,
    appendageScale: 0.78, fleece: 1, crest: 0.2
  },
  runner: {
    mass: 0.52, bodyLength: 1.08, bodyHeight: 0.62, bodyWidth: 0.48,
    shoulderHeight: 0.82, hipHeight: 0.74, limbSlenderness: 0.62,
    neckLength: 0.58, neckRise: 0.38, muzzleLength: 1.22, earScale: 1.14,
    earSplay: 0.24, tailLength: 1.18, tailLift: 0.58,
    appendageScale: 0.84, fleece: 0.22, crest: 0.12
  },
  hopper: {
    mass: 0.38, bodyLength: 0.78, bodyHeight: 0.7, bodyWidth: 0.64,
    shoulderHeight: 0.5, hipHeight: 1.08, limbSlenderness: 0.68,
    neckLength: 0.3, neckRise: 0.5, muzzleLength: 0.62, earScale: 1.36,
    earSplay: 0.24, tailLength: 0.24, tailLift: 0.8,
    appendageScale: 0.72, fleece: 0.18, crest: 0.04
  },
  dragonfly: {
    mass: 0.18, bodyLength: 1.2, bodyHeight: 0.34, bodyWidth: 0.28,
    shoulderHeight: 0.4, hipHeight: 0.4, limbSlenderness: 0.42,
    neckLength: 0.1, neckRise: 0.1, muzzleLength: 0.1, earScale: 0,
    earSplay: 0, tailLength: 1.15, tailLift: 0,
    appendageScale: 1, fleece: 0, crest: 0.28
  },
  fish: {
    mass: 0.48, bodyLength: 1.1, bodyHeight: 0.9, bodyWidth: 0.34,
    shoulderHeight: 0.4, hipHeight: 0.4, limbSlenderness: 0,
    neckLength: 0.08, neckRise: 0, muzzleLength: 0.58, earScale: 0,
    earSplay: 0, tailLength: 0.92, tailLift: 0,
    appendageScale: 1, fleece: 0, crest: 0.74
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function vary(seed: number, salt: number, amplitude: number): number {
  return 1 + (seededUnit(seed | 0, salt) - 0.5) * amplitude * 2;
}

export function buildFaunaPhenotype(terrainSeed: number, kind: FaunaKind): FaunaPhenotype {
  const base = BASE_PHENOTYPE[kind];
  const kindId = FAUNA_KIND_ID[kind];
  const salt = 880 + kindId * 31;
  return Object.freeze({
    morphologyId: Math.floor(seededUnit(terrainSeed | 0, salt) * 0x7fffffff),
    mass: clamp(base.mass * vary(terrainSeed, salt + 1, 0.12), 0.12, 1.2),
    bodyLength: clamp(base.bodyLength * vary(terrainSeed, salt + 2, 0.1), 0.62, 1.32),
    bodyHeight: clamp(base.bodyHeight * vary(terrainSeed, salt + 3, 0.1), 0.25, 1.15),
    bodyWidth: clamp(base.bodyWidth * vary(terrainSeed, salt + 4, 0.1), 0.2, 1.2),
    shoulderHeight: clamp(base.shoulderHeight * vary(terrainSeed, salt + 5, 0.08), 0.34, 1.2),
    hipHeight: clamp(base.hipHeight * vary(terrainSeed, salt + 6, 0.08), 0.34, 1.2),
    limbSlenderness: clamp(base.limbSlenderness * vary(terrainSeed, salt + 7, 0.1), 0.34, 1.1),
    neckLength: clamp(base.neckLength * vary(terrainSeed, salt + 8, 0.12), 0.08, 1.28),
    neckRise: clamp(base.neckRise * vary(terrainSeed, salt + 9, 0.12), 0, 1.18),
    muzzleLength: clamp(base.muzzleLength * vary(terrainSeed, salt + 10, 0.12), 0.08, 1.4),
    earScale: clamp(base.earScale * vary(terrainSeed, salt + 11, 0.14), 0, 1.6),
    earSplay: clamp(base.earSplay * vary(terrainSeed, salt + 12, 0.16), 0, 1),
    tailLength: clamp(base.tailLength * vary(terrainSeed, salt + 13, 0.14), 0.08, 1.5),
    tailLift: clamp(base.tailLift + (seededUnit(terrainSeed | 0, salt + 14) - 0.5) * 0.2, 0, 1),
    appendageScale: clamp(base.appendageScale * vary(terrainSeed, salt + 15, 0.12), 0.42, 1.3),
    fleece: clamp(base.fleece * vary(terrainSeed, salt + 16, 0.12), 0, 1.2),
    crest: clamp(base.crest * vary(terrainSeed, salt + 17, 0.18), 0, 1.2)
  });
}

export function buildFaunaMorphologyDefinition(
  terrainSeed: number,
  kind: FaunaKind
): FaunaMorphologyDefinitionV1 {
  const phenotype = buildFaunaPhenotype(terrainSeed, kind);
  return Object.freeze({
    schemaVersion: FAUNA_MODEL_SCHEMA_VERSION,
    kind,
    kindId: FAUNA_KIND_ID[kind],
    morphologyId: phenotype.morphologyId,
    phenotype
  });
}

export function buildFaunaMorphologyTable(terrainSeed: number): readonly FaunaMorphologyDefinitionV1[] {
  return Object.freeze(FAUNA_KINDS.map(kind => buildFaunaMorphologyDefinition(terrainSeed, kind)));
}

export function normalizeFaunaLocomotionPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  return ((phase % 1) + 1) % 1;
}

export function emptyFaunaPose(): FaunaPoseState {
  return {
    locomotion: 0,
    graze: 0,
    alert: 0,
    flee: 0,
    hop: 0,
    swim: 0,
    wingbeat: 0,
    turn: 0,
    breathe: 0
  };
}

export function clampFaunaPose(pose: FaunaPoseState): FaunaPoseState {
  return Object.fromEntries(Object.entries(pose).map(([key, value]) => [
    key,
    clamp(Number.isFinite(value) ? value : 0, -1, 1)
  ])) as unknown as FaunaPoseState;
}
