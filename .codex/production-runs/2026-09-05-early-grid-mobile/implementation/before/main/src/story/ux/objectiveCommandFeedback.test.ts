import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
