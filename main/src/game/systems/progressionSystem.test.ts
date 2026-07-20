import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyProgressionSnapshot,
  hasMilestone,
  isClientOwnedMilestoneReceipt,
  markMilestone,
  resetProgression
} from './progressionSystem.ts';

describe('progression milestone ownership', () => {
  beforeEach(() => {
    resetProgression();
  });

  it('preserves the embodied Tidegarden aerial survey without preserving server-owned settlement facts', () => {
    const actorId = 'survey-pilot';
    const aerialSurvey = 'story:tidegarden:aerial-site-survey';
    const sharedSettlementFact = 'story:tidegarden:habitat-core-online';

    expect(isClientOwnedMilestoneReceipt(aerialSurvey)).toBe(true);
    expect(isClientOwnedMilestoneReceipt(sharedSettlementFact)).toBe(false);

    markMilestone(aerialSurvey, actorId);
    markMilestone(sharedSettlementFact, actorId);
    applyProgressionSnapshot({
      [actorId]: { era: 'emergent', milestones: [] }
    }, {
      replace: true,
      preserveClientOwnedMilestones: true
    });

    expect(hasMilestone(aerialSurvey, actorId)).toBe(true);
    expect(hasMilestone(sharedSettlementFact, actorId)).toBe(false);
  });
});
