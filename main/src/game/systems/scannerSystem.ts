import { buildPlanetManifest, type PlanetManifest } from '../generation/buildPlanetManifest';
import { RESOURCES, type ResourceId } from '../data/resources';

export interface ScanPlanetInput {
  seed: number;
  scanLevel: number;
}

export type ScannedPlanetManifest = PlanetManifest;

function visibleAt(scanLevel: number, resourceId: ResourceId): boolean {
  return RESOURCES[resourceId].scanLevel <= scanLevel;
}

export function scanPlanet(input: ScanPlanetInput): ScannedPlanetManifest {
  const manifest = buildPlanetManifest(input.seed);
  const resources = [
    ...manifest.commonResources,
    ...manifest.rareResources,
    ...manifest.hiddenResources
  ];
  const hidden = resources.filter(resourceId => !visibleAt(input.scanLevel, resourceId));

  return {
    ...manifest,
    commonResources: manifest.commonResources.filter(resourceId => visibleAt(input.scanLevel, resourceId)),
    rareResources: [
      ...manifest.rareResources.filter(resourceId => visibleAt(input.scanLevel, resourceId)),
      ...manifest.hiddenResources.filter(resourceId => visibleAt(input.scanLevel, resourceId))
    ],
    hiddenResources: hidden.filter((resourceId, index, all) => all.indexOf(resourceId) === index)
  };
}
