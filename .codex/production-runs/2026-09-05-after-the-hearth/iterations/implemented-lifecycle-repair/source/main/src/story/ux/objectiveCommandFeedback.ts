import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { isDebrisCollected, requiredDebrisSalvageComplete } from '../debrisSalvage.ts';
import { storyNow } from '../storyClock.ts';
import { readGuidedObjectiveRestore } from './objectiveRestore.ts';
import { cancelPendingStoryUxFeedback } from './feedbackCues.ts';
import type { CommandAccepted } from '../../game/commands.ts';
import { acknowledgeGuidedStoryCompletion, acknowledgeGuidedStoryProgress, getActiveGuidedStoryObjective, publishEarlyObjectiveReceipt } from './objectiveDirector.ts';

// These are the counted resources already named by the corresponding authored
// objective. Irrelevant pickups cannot sound like progress on a different task.
const COUNTED_ITEMS: Readonly<Record<string, readonly string[]>> = {
  'ch1:fixed:calibrate-extractor': ['biofiber'],
  'ch1:raster:extract-fiber-quota': ['biofiber'],
  'ch3:gather:collect-materials': ['wood', 'biofiber', 'stone'],
  'ch3:gather:recover-flint': ['flint'],
  'ch3:forage:find-food': ['berry', 'root']
};
const CRAFT_OUTPUT: Readonly<Record<string, string>> = {
  'ch3:gather:craft-hatchet': 'stone_hatchet',
  'ch3:gather:craft-pickaxe': 'stone_pickaxe',
  'ch3:gather:craft-biofuel': 'biofuel'
};
interface Stack { id: string; qty: number }
const stacks = (value: unknown): Stack[] => Array.isArray(value) ? value.filter((row): row is Stack => !!row && typeof row.id === 'string' && Number.isFinite(row.qty) && row.qty > 0) : [];

let receiptRestore = -1;
const earlyEvents = new Set<string>();

/** Final local transactions only; seeding and optimistic transport never call this seam. */
export function acknowledgeObjectiveCommand(result: CommandAccepted, localActorId: string): void {
  const objective = getActiveGuidedStoryObjective();
  if (!objective) return;
  for (const event of result.events) {
    if (event.actorId !== localActorId || !event.payload || typeof event.payload !== 'object') continue;
    const payload = event.payload as Record<string, unknown>;
    const gained = event.type === 'voxel_mined' ? stacks(payload.drops)
      : event.type === 'resource_taken' ? stacks([payload]) : [];
    if (/^ch1:(fixed|raster):/.test(objective.id)) {
      const restoreVersion = readGuidedObjectiveRestore().version;
      if (receiptRestore !== restoreVersion) { receiptRestore = restoreVersion; earlyEvents.clear(); }
      if (earlyEvents.has(event.eventId)) continue;
      earlyEvents.add(event.eventId);
      cancelPendingStoryUxFeedback('later-action');
      const fiber = gained.filter(item => item.id === 'biofiber').reduce((sum, item) => sum + item.qty, 0);
      const fixed = objective.id === 'ch1:fixed:calibrate-extractor';
      const raster = objective.id === 'ch1:raster:extract-fiber-quota';
      if (event.type === 'voxel_mined' && fiber > 0 && (fixed || raster)) {
        const total = getItemCount('biofiber');
        const threshold = fixed ? 1 : 6;
        if (total - fiber >= threshold) continue;
        if (total >= threshold && total - fiber < threshold && (fixed ? isDebrisCollected(0) : requiredDebrisSalvageComplete() && getItemCount('stone') >= 4)) {
          acknowledgeGuidedStoryCompletion(objective.id, true, {
            receiptId: event.eventId, expectedSuccessor: fixed ? 'ch1:fixed:cross-camera-cell' : null
          });
        } else acknowledgeGuidedStoryProgress(event.eventId);
        publishEarlyObjectiveReceipt(event.eventId, 'BIOFIBER LOGGED.', storyNow());
      }
      continue;
    }
    if (gained.some(item => COUNTED_ITEMS[objective.id]?.includes(item.id))) acknowledgeGuidedStoryProgress(event.eventId);
    const crafted = event.type === 'recipe_crafted' && stacks(payload.outputs).some(item => item.id === CRAFT_OUTPUT[objective.id]);
    const campfire = event.type === 'campfire_placed' && objective.id === 'ch3:gather:craft-campfire';
    const meal = event.type === 'item_consumed' && Number(payload.food) > 0 && objective.id === 'ch3:forage:eat-held-food';
    if (crafted || campfire || meal) acknowledgeGuidedStoryCompletion(objective.id, true);
  }
}
