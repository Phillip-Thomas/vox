import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addItem, getItemCount, resetInventory } from '../../game/systems/inventorySystem.ts';
import { resetProgression } from '../../game/systems/progressionSystem.ts';
import { collectDebris, requiredDebrisSalvageComplete, debrisSalvageComplete, setDebrisScattered, subscribeDebrisCollectionReceipt } from '../debrisSalvage.ts';
import { commandAccepted } from '../../game/commands.ts';
import { acknowledgeObjectiveCommand } from './objectiveCommandFeedback.ts';
import { activateGuidedStoryObjective, beginGuidedObjectiveRestore, resetGuidedObjectiveFeedbackForTests } from './objectiveDirector.ts';
import { subscribeStoryUxFeedback, type StoryUxFeedbackCue } from './feedbackCues.ts';

let cues: StoryUxFeedbackCue[] = [], unsubscribe: () => void;
beforeEach(() => { resetGuidedObjectiveFeedbackForTests(); cues = []; unsubscribe = subscribeStoryUxFeedback(cue => cues.push(cue)); });
afterEach(() => { unsubscribe(); resetGuidedObjectiveFeedbackForTests(); });
const activate = (id: string) => activateGuidedStoryObjective({ id, kind: 'interact', markerLabel: 'TARGET', workOrder: ['GATHER.'], requiresMarker: false });
const transaction = (type: string, payload: unknown, actorId = 'local') => commandAccepted({ commandId: 'command-1' }, [{ eventId: 'event-1', type, payload, actorId, worldId: 'home', timeMs: 10 }]);

describe('confirmed objective transaction feedback', () => {
  it('acknowledges one relevant positive count change, with no remote or duplicate receipts', () => {
    activate('ch3:gather:collect-materials'); cues = [];
    acknowledgeObjectiveCommand(transaction('resource_taken', { id: 'berry', qty: 1 }), 'local');
    acknowledgeObjectiveCommand(transaction('resource_taken', { id: 'stone', qty: 1 }, 'remote'), 'local');
    acknowledgeObjectiveCommand(transaction('resource_taken', { id: 'stone', qty: 0 }), 'local');
    const accepted = transaction('voxel_mined', { drops: [{ id: 'stone', qty: 2 }] });
    acknowledgeObjectiveCommand(accepted, 'local'); acknowledgeObjectiveCommand(accepted, 'local');
    expect(cues.map(cue => cue.type)).toEqual(['objective-progress']);
  });
  it('acknowledges the actual craft output once without clearing the current published objective', () => {
    activate('ch3:gather:craft-hatchet'); cues = [];
    acknowledgeObjectiveCommand(transaction('recipe_crafted', { outputs: [{ id: 'biofuel', qty: 1 }] }), 'local');
    const craft = transaction('recipe_crafted', { outputs: [{ id: 'stone_hatchet', qty: 1 }] });
    acknowledgeObjectiveCommand(craft, 'local'); acknowledgeObjectiveCommand(craft, 'local');
    expect(cues.map(cue => cue.type)).toEqual(['objective-complete']);
  });
  it('rejects seeding notifications before restore publication, then accepts a real later action', () => {
    activate('ch3:gather:collect-materials'); cues = [];
    beginGuidedObjectiveRestore('seed');
    const take = transaction('resource_taken', { id: 'stone', qty: 1 });
    acknowledgeObjectiveCommand(take, 'local');
    expect(cues).toEqual([]);
    activate('ch3:gather:collect-materials');
    expect(cues).toEqual([]);
    acknowledgeObjectiveCommand(take, 'local');
    expect(cues.map(cue => cue.type)).toEqual(['objective-progress']);
  });
});

describe('early finalized local receipts', () => {
  beforeEach(() => { resetInventory(); resetProgression(); beginGuidedObjectiveRestore('seed', true); });
  it('emits after all native loot and requires only the first three physical receipts', () => {
    setDebrisScattered(6); const observed: number[][] = [];
    const stop = subscribeDebrisCollectionReceipt(receipt => observed.push([receipt.index, getItemCount('wood'), getItemCount('stone')]));
    collectDebris(0); collectDebris(0); collectDebris(1); collectDebris(2); stop();
    expect(observed).toEqual([[0, 2, 2], [1, 2, 3], [2, 3, 4]]);
    expect(requiredDebrisSalvageComplete()).toBe(true); expect(debrisSalvageComplete()).toBe(false);
  });
  it('completes the first real positive harvest once, never adds a progress cue', () => {
    collectDebris(0); activate('ch1:fixed:calibrate-extractor'); cues = []; addItem('biofiber', 1);
    const result = transaction('voxel_mined', { drops: [{ id: 'biofiber', qty: 1 }] });
    acknowledgeObjectiveCommand(result, 'local'); acknowledgeObjectiveCommand(result, 'local');
    expect(cues.map(cue => cue.type)).toEqual(['objective-complete']);
  });
  it('rejects wrong phase, empty yield, and remote transactions', () => {
    activate('ch1:fixed:recover-first-debris'); cues = [];
    acknowledgeObjectiveCommand(transaction('voxel_mined', { drops: [{ id: 'biofiber', qty: 1 }] }), 'local');
    expect(cues).toEqual([]);
    activate('ch1:fixed:calibrate-extractor'); cues = [];
    acknowledgeObjectiveCommand(transaction('voxel_mined', { drops: [] }), 'local');
    acknowledgeObjectiveCommand(transaction('voxel_mined', { drops: [{ id: 'biofiber', qty: 1 }] }, 'remote'), 'local');
    expect(cues).toEqual([]);
  });
  it('does not claim a new completion when the threshold was already earned', () => {
    collectDebris(0); addItem('biofiber', 3); activate('ch1:fixed:calibrate-extractor'); cues = [];
    addItem('biofiber', 1); acknowledgeObjectiveCommand(transaction('voxel_mined', { drops: [{ id: 'biofiber', qty: 1 }] }), 'local');
    expect(cues).toEqual([]);
  });
});
