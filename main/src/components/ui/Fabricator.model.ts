import { ALL_RECIPES, type Recipe } from '../../game/data/recipes.ts';
import { getAccessibleStations, type StationId } from '../../game/data/stations.ts';

export interface PublicFabricatorSection {
  stationId: StationId;
  recipes: Recipe[];
}

/** The public portable kit is intentionally primitive-only for this demo. */
export function getPublicFabricatorSections(
  recipeAllowed: (id: string) => boolean = () => true
): PublicFabricatorSection[] {
  return getAccessibleStations()
    .map(stationId => ({
      stationId,
      recipes: ALL_RECIPES.filter(recipe => (
        recipe.station === stationId
        && recipe.era === 'primitive'
        && recipeAllowed(recipe.id)
      ))
    }))
    .filter(section => section.recipes.length > 0);
}
