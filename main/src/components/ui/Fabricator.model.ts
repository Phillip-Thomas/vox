import { ALL_RECIPES, type Recipe } from '../../game/data/recipes.ts';
import { getAccessibleStations, type StationId } from '../../game/data/stations.ts';

export interface PublicFabricatorSection {
  stationId: StationId;
  recipes: Recipe[];
}

export function fabricatorAccessCopy(
  stations: readonly StationId[],
  storyActive: boolean
): string {
  const kestrelLinked = stations.some(station => station !== 'hand');
  if (kestrelLinked) return 'Kestrel-linked fabrication · earned patterns retained';
  return storyActive
    ? 'Primitive field assembly · none of this is regulation'
    : 'Portable field kit · primitive patterns only';
}

/** Recipes at the stations currently reachable from the field kit/world. */
export function getPublicFabricatorSections(
  recipeAllowed: (id: string) => boolean = () => true
): PublicFabricatorSection[] {
  return getAccessibleStations()
    .map(stationId => ({
      stationId,
      recipes: ALL_RECIPES.filter(recipe => (
        recipe.station === stationId
        && recipeAllowed(recipe.id)
      ))
    }))
    .filter(section => section.recipes.length > 0);
}
