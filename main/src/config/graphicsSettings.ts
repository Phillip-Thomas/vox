// Central graphics quality configuration.
//
// Every expensive rendering effect added by the shader/rendering upgrade is
// gated by one of these flags so the whole pipeline can be dialed down per
// device. There was no pre-existing performance-profile system, so this module
// is the single source of truth going forward.

export type WaterReflections = 'none' | 'fresnel' | 'screenspace';

export interface GraphicsQuality {
  /** Triplanar procedural surface detail on voxels (Phase 1). */
  triplanarDetail: boolean;
  /** Baked per-corner ambient occlusion on voxels (Phase 1). */
  bakedAO: boolean;
  /** Animate emissive pulsing / time-driven shader effects. */
  animatedShaders: boolean;
  /** Sun-lit cloud banks + crepuscular shafts on the sky dome (pricey: +~4 fbm). */
  skyClouds: boolean;
  /** Grass blades per eligible grass voxel (0 disables grass). (Phase 3) */
  grassDensity: number;
  /** Max world-space distance grass is drawn from the camera. (Phase 3) */
  grassMaxDistance: number;
  /** Probability (0..1) a grass voxel sprouts a tree (0 disables trees). */
  treeDensity: number;
  /** Max world-space distance trees are drawn from the camera (0 = no cull). */
  treeMaxDistance: number;
  /** Water reflection technique. (Phase 4) */
  waterReflections: WaterReflections;
  /** Animate the water surface. (Phase 4) */
  waterAnimated: boolean;
  /** Enable the postprocessing composer (bloom / painterly). (Phase 5) */
  postProcess: boolean;
  /** Use the painterly (Kuwahara) look instead of plain bloom. (Phase 5) */
  painterly: boolean;
  /** Unified per-biome + time-of-day color grade (cohesion pass). */
  colorGrade: boolean;
  /** Screen-space contact ambient occlusion (N8AO) — grounds objects. */
  contactAO: boolean;
  /** Stylized depth outline (edge darkening) — locks the look. */
  outline: boolean;
}

export type QualityProfile = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POTATO';

export const QUALITY_PROFILES: Record<QualityProfile, GraphicsQuality> = {
  ULTRA: {
    triplanarDetail: true,
    bakedAO: true,
    animatedShaders: true,
    skyClouds: true,
    grassDensity: 6,
    grassMaxDistance: 80,
    treeDensity: 0.04,
    treeMaxDistance: 160,
    waterReflections: 'screenspace',
    waterAnimated: true,
    postProcess: true,
    painterly: false,
    colorGrade: true,
    contactAO: true,
    outline: true
  },
  HIGH: {
    triplanarDetail: true,
    bakedAO: true,
    animatedShaders: true,
    skyClouds: true,
    grassDensity: 4,
    grassMaxDistance: 60,
    treeDensity: 0.03,
    treeMaxDistance: 120,
    waterReflections: 'fresnel',
    waterAnimated: true,
    postProcess: true,
    painterly: false,
    colorGrade: true,
    contactAO: true,
    outline: true
  },
  MEDIUM: {
    triplanarDetail: false,
    bakedAO: true,
    animatedShaders: true,
    skyClouds: false,
    grassDensity: 2,
    grassMaxDistance: 40,
    treeDensity: 0.02,
    treeMaxDistance: 80,
    waterReflections: 'fresnel',
    waterAnimated: true,
    postProcess: false,
    painterly: false,
    colorGrade: false,
    contactAO: false,
    outline: false
  },
  LOW: {
    triplanarDetail: false,
    bakedAO: true,
    animatedShaders: false,
    skyClouds: false,
    grassDensity: 1,
    grassMaxDistance: 24,
    treeDensity: 0.015,
    treeMaxDistance: 50,
    waterReflections: 'fresnel',
    waterAnimated: false,
    postProcess: false,
    painterly: false,
    colorGrade: false,
    contactAO: false,
    outline: false
  },
  POTATO: {
    triplanarDetail: false,
    bakedAO: false,
    animatedShaders: false,
    skyClouds: false,
    grassDensity: 0,
    grassMaxDistance: 0,
    treeDensity: 0,
    treeMaxDistance: 0,
    waterReflections: 'none',
    waterAnimated: false,
    postProcess: false,
    painterly: false,
    colorGrade: false,
    contactAO: false,
    outline: false
  }
};

export const DEFAULT_PROFILE: QualityProfile = 'HIGH';

let currentProfile: QualityProfile = DEFAULT_PROFILE;
let current: GraphicsQuality = { ...QUALITY_PROFILES[DEFAULT_PROFILE] };
const listeners = new Set<(q: GraphicsQuality) => void>();

export function getGraphicsQuality(): GraphicsQuality {
  return current;
}

export function getQualityProfile(): QualityProfile {
  return currentProfile;
}

export function setQualityProfile(profile: QualityProfile) {
  currentProfile = profile;
  current = { ...QUALITY_PROFILES[profile] };
  listeners.forEach(fn => fn(current));
}

/** Override individual flags (e.g. for debugging) without switching profile. */
export function overrideGraphicsQuality(patch: Partial<GraphicsQuality>) {
  current = { ...current, ...patch };
  listeners.forEach(fn => fn(current));
}

export function subscribeGraphicsQuality(fn: (q: GraphicsQuality) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
