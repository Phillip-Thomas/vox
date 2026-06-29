import { MaterialType } from '../types/materials.ts';
import { buildPlanetArtDirection, type EcologyLayer, type PlanetArtDirection, type PlanetEcology } from './planetArtDirection.ts';

export function buildPlanetEcology(seed: number): PlanetEcology {
  return buildPlanetArtDirection(seed).ecology;
}

export function isMaterialEligibleForEcology(
  ecologyOrDirection: PlanetEcology | PlanetArtDirection,
  layer: EcologyLayer,
  material: MaterialType
): boolean {
  const ecology = 'ecology' in ecologyOrDirection ? ecologyOrDirection.ecology : ecologyOrDirection;
  return ecology.materialEligibility[layer].includes(material);
}

export function surfaceEffectWeight(
  ecologyOrDirection: PlanetEcology | PlanetArtDirection,
  effect: string
): number {
  const ecology = 'ecology' in ecologyOrDirection ? ecologyOrDirection.ecology : ecologyOrDirection;
  return ecology.surfaceEffectWeights[effect] ?? 0;
}

export function expectedEcologyLayers(direction: PlanetArtDirection): EcologyLayer[] {
  return (Object.keys(direction.ecology.materialEligibility) as EcologyLayer[])
    .filter(layer => direction.ecology.materialEligibility[layer].length > 0);
}

export function shouldExpectOrganicCanopy(direction: PlanetArtDirection): boolean {
  return direction.ecology.richness > 0.35 &&
    direction.ecology.materialEligibility.trees.some(material =>
      material === MaterialType.GRASS || material === MaterialType.DIRT || material === MaterialType.SAND
    );
}
