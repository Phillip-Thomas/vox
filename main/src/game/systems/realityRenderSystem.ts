export const VOXEL_REALITY_STAGES = ['bare', 'color', 'material', 'alive', 'paradox'] as const;

export type VoxelRealityStage = typeof VOXEL_REALITY_STAGES[number];

export interface VoxelRealityEffects {
  /** Color resolution: 0 is monochrome, 1 is full material color. */
  chroma: number;
  /** Procedural albedo, roughness, and normal detail on voxel faces. */
  detail: number;
  /** Organic richness for moss, grass soil, bark, and living surfaces. */
  organic: number;
  /** Wind-carried surface motion: sand dust, ash, frost, and dry soil wisps. */
  atmosphere: number;
  /** Heat/boil/ember behavior for lava and volcanic materials. */
  thermal: number;
  /** Frost, facets, internal glow, and crystal glints. */
  crystalline: number;
  /** Ore veining and metallic catch-light detail. */
  metal: number;
}

export interface VoxelRealitySnapshot {
  stage: VoxelRealityStage;
  effects: VoxelRealityEffects;
}

type Listener = (snapshot: VoxelRealitySnapshot) => void;

const DEFAULT_STAGE: VoxelRealityStage = 'alive';

export const VOXEL_REALITY_PRESETS: Record<VoxelRealityStage, VoxelRealityEffects> = {
  // Pure readable slabs: this supports the early black-and-white / unresolved
  // reality beat without touching device-quality settings.
  bare: {
    chroma: 0,
    detail: 0,
    organic: 0,
    atmosphere: 0,
    thermal: 0,
    crystalline: 0,
    metal: 0
  },
  // Color has arrived, but the material world has not resolved yet.
  color: {
    chroma: 1,
    detail: 0,
    organic: 0,
    atmosphere: 0,
    thermal: 0,
    crystalline: 0,
    metal: 0
  },
  // First material awakening: surfaces start to reveal texture and hazard cues.
  material: {
    chroma: 1,
    detail: 0.58,
    organic: 0.36,
    atmosphere: 0.28,
    thermal: 0.42,
    crystalline: 0.36,
    metal: 0.42
  },
  // Current production look: rich, alive, but still recognizably voxel.
  alive: {
    chroma: 1,
    detail: 1,
    organic: 1,
    atmosphere: 1,
    thermal: 0.92,
    crystalline: 0.92,
    metal: 0.86
  },
  // Later-dimension look: lets the story push the material system beyond normal.
  paradox: {
    chroma: 1,
    detail: 1.14,
    organic: 1.08,
    atmosphere: 1.18,
    thermal: 1.16,
    crystalline: 1.26,
    metal: 1.12
  }
};

let currentStage: VoxelRealityStage = DEFAULT_STAGE;
let overrides: Partial<VoxelRealityEffects> = {};
const listeners = new Set<Listener>();

function clampEffect(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1.5, Math.max(0, value));
}

function normalizeEffects(effects: VoxelRealityEffects): VoxelRealityEffects {
  return {
    chroma: clampEffect(effects.chroma),
    detail: clampEffect(effects.detail),
    organic: clampEffect(effects.organic),
    atmosphere: clampEffect(effects.atmosphere),
    thermal: clampEffect(effects.thermal),
    crystalline: clampEffect(effects.crystalline),
    metal: clampEffect(effects.metal)
  };
}

function snapshot(): VoxelRealitySnapshot {
  return {
    stage: currentStage,
    effects: normalizeEffects({ ...VOXEL_REALITY_PRESETS[currentStage], ...overrides })
  };
}

function notify() {
  const next = snapshot();
  listeners.forEach(fn => fn(next));
}

export function parseVoxelRealityStage(value: string | null | undefined): VoxelRealityStage | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (VOXEL_REALITY_STAGES as readonly string[]).includes(normalized)
    ? normalized as VoxelRealityStage
    : null;
}

export function getVoxelRealityStage(): VoxelRealityStage {
  return currentStage;
}

export function getVoxelRealityEffects(): VoxelRealityEffects {
  return snapshot().effects;
}

export function getVoxelRealitySnapshot(): VoxelRealitySnapshot {
  return snapshot();
}

export function setVoxelRealityStage(stage: VoxelRealityStage): void {
  if (currentStage === stage) return;
  currentStage = stage;
  notify();
}

export function overrideVoxelRealityEffects(patch: Partial<VoxelRealityEffects>): void {
  overrides = { ...overrides, ...patch };
  notify();
}

export function clearVoxelRealityOverrides(): void {
  if (Object.keys(overrides).length === 0) return;
  overrides = {};
  notify();
}

export function resetVoxelRealityRenderState(): void {
  currentStage = DEFAULT_STAGE;
  overrides = {};
  notify();
}

export function subscribeVoxelReality(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
