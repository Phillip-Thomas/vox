import { beforeEach, describe, expect, it } from 'vitest';
import {
  acknowledgeJourneyProbePreparation,
  getJourneyProbePreparationSnapshot,
  recordJourneyProbePreparation,
  resetJourneyProbePreparationForTests,
  type JourneyProbePrepareEventDetail
} from './journeyProbePreparation.ts';

describe('journey probe preparation evidence', () => {
  beforeEach(resetJourneyProbePreparationForTests);

  it('lets a mounted story surface acknowledge the exact diagnostic assistance', () => {
    const detail: JourneyProbePrepareEventDetail = {
      scenarioId: 'input:voyage-worker-name',
      storyBeat: 'voyage',
      handled: false,
      handlerId: null,
      evidence: null
    };
    acknowledgeJourneyProbePreparation(detail, 'voyage-ledger', {
      path: 'naming-interstitial',
      realInputPreserved: true
    });

    expect(detail).toMatchObject({
      handled: true,
      handlerId: 'voyage-ledger',
      evidence: {
        path: 'naming-interstitial',
        realInputPreserved: true
      }
    });
  });

  it('keeps a prepared receipt stable across runner polling', () => {
    const first = recordJourneyProbePreparation(
      'interaction:persistent-scar-arbitration',
      'ch7-reconstruct',
      {
        status: 'prepared',
        handlerId: 'wreck-diagnostic-gaze',
        evidence: { movedPlayer: false }
      }
    );
    const repeated = recordJourneyProbePreparation(
      'interaction:persistent-scar-arbitration',
      'ch7-reconstruct',
      { status: 'waiting', reason: 'target-not-ready' }
    );

    expect(first.status).toBe('prepared');
    expect(repeated).toEqual(first);
    expect(getJourneyProbePreparationSnapshot()).toEqual(first);
  });
});
