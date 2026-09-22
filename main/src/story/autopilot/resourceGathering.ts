import type { RailRuntime } from '../autopilot.ts';
import type { EmergentMovieSettlementBinding } from '../emergentMovieRuntime.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { isTreeHarvested } from '../../game/systems/treeHarvest.ts';
import { planConstructionTree, type ConstructionTreePlan } from './constructionTreePlan.ts';

let collectionKey = '';
let selected: ConstructionTreePlan | null = null;
let previousClock = -1;
let diagnostics: object | null = null;
export const getConstructionGatheringSnapshot = () => diagnostics;

/** Walk, aim, then hold the real extractor only on the selected living tree. */
export function gatherConstructionWood(ctx: RailRuntime, binding: EmergentMovieSettlementBinding): boolean {
  ctx.controls.delete = false;
  const home = ctx.habitatGoal ?? ctx.getPlayerWorldPosition();
  const key = `${binding.commandContext.world.worldId}:${home.toArray().join(',')}`;
  if (key !== collectionKey || ctx.beatClock < previousClock) selected = null;
  collectionKey = key;
  previousClock = ctx.beatClock;
  if (getItemCount('wood', binding.commandContext.actorId) >= ctx.emergentMovieConstructionWoodNeeded()) {
    selected = null;
    diagnostics = null;
    return true;
  }
  if (selected && isTreeHarvested(...selected.coord)) selected = null;
  selected ??= planConstructionTree(ctx.constructionTreeTargets, ctx.getPlayerWorldPosition(), home,
    binding.terrain, binding.planetSize, isTreeHarvested);
  diagnostics = { wood: getItemCount('wood', binding.commandContext.actorId),
    needed: ctx.emergentMovieConstructionWoodNeeded(), home: home.toArray(),
    tree: selected?.coord ?? null, approach: selected?.approach.toArray() ?? null,
    aim: selected?.aim.toArray() ?? null, pickerMatches: false };
  if (!selected) return false;
  const distance = ctx.walkToward(selected.approach, 0.55, 0, selected.aim, 8);
  const pickerMatches = ctx.autopilotWorldAccess.isLookingAtTree(selected.coord);
  diagnostics = { ...diagnostics, pickerMatches };
  ctx.controls.delete = distance <= 0.65 && pickerMatches;
  return false;
}
