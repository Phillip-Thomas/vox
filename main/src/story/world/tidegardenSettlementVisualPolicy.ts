export const TIDEGARDEN_CORE_GLOW_TECHNIQUE = 'prewarmed-additive-unlit' as const;
export const TIDEGARDEN_DYNAMIC_HERO_LIGHT_COUNT = 0 as const;
export const TIDEGARDEN_SCANNER_RESIDENCY = 'resident-through-observation' as const;
export const TIDEGARDEN_SITE_RING_ROTATION_X = -Math.PI / 2;

export type TidegardenCoreVisualPhase = 'prewarm' | 'revealed';

/** Core resources exist from chapter entry; installation only reveals them. */
export function tidegardenCoreVisualPhase(coreOnline: boolean): TidegardenCoreVisualPhase {
  return coreOnline ? 'revealed' : 'prewarm';
}

/** Ease the interior tint at its real sphere boundary instead of popping it on. */
export function tidegardenInteriorGlowOpacity(input: {
  active: boolean;
  certified: boolean;
  distanceFromGlowCenter: number;
  pulse: number;
}): number {
  if (!input.active || !input.certified) return 0;
  const edgeFade = Math.max(0, Math.min(1, (3.4 - input.distanceFromGlowCenter) / 0.8));
  return (0.055 + Math.max(0, Math.min(1, input.pulse)) * 0.025) * edgeFade;
}
