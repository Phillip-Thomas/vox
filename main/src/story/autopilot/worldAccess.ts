import type { CommandContext } from '../../game/commands.ts';
import { getRecipe } from '../../game/data/recipes.ts';
import type { ItemId } from '../../game/data/items.ts';
import { consumeItemCommand } from '../../game/gameplayCommands.ts';
import { dispatchGameplayCommand } from '../../game/commandDispatchAdapter.ts';
import { performPlayerCraft } from '../../game/playerCrafting.ts';

/** Bound by the actual player component, so actors/worlds cannot be invented. */
let playerContext: CommandContext | null = null;
export interface PlayerHarvestObservation { kind: string; coord: { x: number; y: number; z: number } }
let harvestObservation: (() => PlayerHarvestObservation | null) | null = null;
export function bindAutopilotPlayer(
  context: CommandContext,
  readHarvestTarget?: () => PlayerHarvestObservation | null
): () => void {
  playerContext = context;
  harvestObservation = readHarvestTarget ?? null;
  return () => {
    if (playerContext !== context) return;
    playerContext = null;
    harvestObservation = null;
  };
}


export const autopilotWorldAccess = {
  /** Observe the actual player's ordinary crosshair picker; never commit a harvest. */
  isLookingAtTree(coord: readonly number[]): boolean {
    const target = harvestObservation?.();
    return target?.kind === 'tree' && target.coord.x === coord[0]
      && target.coord.y === coord[1] && target.coord.z === coord[2];
  },
  craft(recipeId: Parameters<typeof getRecipe>[0]): boolean {
    return playerContext !== null && performPlayerCraft(playerContext, getRecipe(recipeId)).ok;
  },
  consume(itemId: ItemId): boolean {
    return playerContext !== null && dispatchGameplayCommand(
      () => consumeItemCommand(playerContext!, { itemId })
    ).ok;
  }
};
