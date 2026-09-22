import type { CommandContext, CommandResult } from './commands.ts';
import type { Recipe } from './data/recipes.ts';
import { getAccessibleStations } from './data/stations.ts';
import { craftAndPlaceCampfireCommand, craftRecipeCommand } from './gameplayCommands.ts';
import { dispatchGameplayCommand } from './commandDispatchAdapter.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../state/playerFrame.ts';
import { getPlayerSubmergence } from '../state/playerSubmersion.ts';
import { isFeetInLava } from '../state/playerLavaImmersion.ts';
import { isFabricatorRecipeAllowed } from '../story/storyInputPolicy.ts';
import { commandRejected } from './commands.ts';

/** The Fabricator's transaction, shared by its button and the virtual player. */
export function performPlayerCraft(context: CommandContext, recipe: Recipe, commandId?: string): CommandResult {
  if (!isFabricatorRecipeAllowed(recipe.id)) {
    return commandRejected({ commandId: `craft:${recipe.id}` }, 'validation_failed', 'recipe unavailable in this story beat');
  }
  const craftContext = { stations: getAccessibleStations() };
  if (recipe.id !== 'campfire') {
    return dispatchGameplayCommand(() => craftRecipeCommand(context, { recipe, craftContext, commandId }), {
      multiplayer: { commandType: 'recipe_crafted', payload: { recipeId: recipe.id } }
    });
  }
  if (getPlayerSubmergence() > 0.2 || isFeetInLava()) {
    return commandRejected({ commandId: 'craft:campfire' }, 'validation_failed', 'campfire needs dry ground');
  }
  const up = getPlayerUp();
  const feet = getPlayerWorldPosition().addScaledVector(up, -1.1);
  return dispatchGameplayCommand(
    () => craftAndPlaceCampfireCommand(context, { recipe, craftContext, position: feet, up, commandId }),
    { multiplayer: { commandType: 'craft_campfire', payload: {
      recipeId: recipe.id, pos: [feet.x, feet.y, feet.z], up: [up.x, up.y, up.z]
    } } }
  );
}
