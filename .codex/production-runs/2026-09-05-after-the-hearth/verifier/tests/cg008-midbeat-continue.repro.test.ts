/**
 * RUN-LOCAL VERIFIER REPRODUCTION — not game source, not a game test file.
 * Lives outside main/src and is executed only through
 * verifier/tests/vitest.verifier.config.ts, so the shipped suite is unchanged.
 *
 * Target: the carried, explicitly-unresolved CG008 concern in
 * producer-lifecycle-source-review.json — "a VALID mid-drawing/testing restore
 * BEFORE routeTested, or a common restore BEFORE reciprocalCrossed, was not
 * addressed". The repaired RECEIPT_SATISFIED_ANCHORS map is keyed only on the
 * FINAL transaction milestones, so this asks whether an INTERMEDIATE save is
 * covered too. It imports the REAL signedSceneAvRuntime and the REAL
 * progression system; nothing is stubbed or spied.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { markMilestone, resetProgression } from '../../../../../main/src/game/systems/progressionSystem.ts';
import { resetEmergentStoryEvents } from '../../../../../main/src/story/emergentStoryEvents.ts';
import {
  activateSignedSceneAnchorById,
  enterSignedSceneAvBeat,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime
} from '../../../../../main/src/story/signedSceneAvRuntime.ts';

afterEach(() => {
  resetEmergentStoryEvents();
  resetSignedSceneAvRuntime('sandbox');
  resetProgression();
});

const history = () => getSignedSceneAvDebugSnapshot().activationHistoryAnchorIds;

describe('CG008 — mid-beat Continue BEFORE the final transaction receipt', () => {
  it('MEASURE: a session that really opened and started the survey, then Continued before route-tested', () => {
    // ---- session 1: the player physically earns the early survey anchors.
    resetProgression();
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-survey');
    const live: Record<string, boolean> = {};
    for (const id of ['anc.cg.repeated-measure', 'anc.cg.demonstration-opened', 'anc.cg.survey-started', 'anc.cg.trace-drawn']) {
      live[id] = activateSignedSceneAnchorById(id);
    }
    expect(live).toEqual({
      'anc.cg.repeated-measure': true,
      'anc.cg.demonstration-opened': true,
      'anc.cg.survey-started': true,
      'anc.cg.trace-drawn': true
    });

    // ---- Continue: the run ends mid-drawing. The route is NOT tested yet, so
    // story:ch13-route-tested legitimately does not exist. Beat entry clears
    // activatedAnchorIds; the durable facts that DO exist are re-applied.
    // NOTE: the whole source declares only SIX durable ch13 milestones
    // (route-tested, reciprocal-crossed, origin-landed, complete, return-chosen,
    // fault-reviewed). There is NO intermediate survey receipt to restore, so a
    // mid-drawing save can carry none. This is the real restored condition.
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-survey');

    // ---- the player now performs the NEXT NEW action: she offers the span.
    const offered = activateSignedSceneAnchorById('anc.cg.route-offered');
    // and then actually tests it.
    const tested = activateSignedSceneAnchorById('anc.cg.route-tested');
    console.log(JSON.stringify({
      case: 'mid-survey-continue-before-route-tested',
      routeOfferedActivated: offered,
      routeTestedActivated: tested,
      historyAfterContinue: history()
    }));
    expect({ offered, tested }).toEqual({ offered: true, tested: true });
  });

  it('MEASURE: a common session that really took the reference at H, then Continued before the crossing', () => {
    resetProgression();
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-common');
    expect(activateSignedSceneAnchorById('anc.cg.reciprocal-reference')).toBe(true);

    // Continue mid-crossing: he reached and holds H, she has not finished the
    // eighteen units, so story:ch13-reciprocal-crossed does not exist.
    // Again, no intermediate receipt exists for "he is holding H". The restored
    // snapshot's common.stage is 'holding-h', so commonGroundDirector's
    // positioning-to-h -> holding-h transition (the ONLY noteAnchor call site
    // for anc.cg.reciprocal-reference, commonGroundDirector.ts:1234) never runs
    // again after the restore.
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-common');

    // The real code marks the crossing milestone BEFORE noting the anchor
    // (commonGroundDirector.ts:1256-1257), so reproduce that exact order.
    markMilestone('story:ch13-reciprocal-crossed');
    const crossed = activateSignedSceneAnchorById('anc.cg.reciprocal-crossed');
    console.log(JSON.stringify({
      case: 'mid-common-continue-before-reciprocal-crossed',
      reciprocalCrossedActivated: crossed,
      historyAfterContinue: history()
    }));
    expect(crossed).toBe(true);
  });

  it('CONTROL: the same two beats with NO Continue activate in order (proves the harness itself is sound)', () => {
    resetProgression();
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-survey');
    for (const id of ['anc.cg.repeated-measure', 'anc.cg.demonstration-opened', 'anc.cg.survey-started', 'anc.cg.trace-drawn', 'anc.cg.route-offered', 'anc.cg.route-tested']) {
      expect(activateSignedSceneAnchorById(id), id).toBe(true);
    }
    resetProgression();
    resetSignedSceneAvRuntime('sandbox');
    enterSignedSceneAvBeat('ch13-common');
    expect(activateSignedSceneAnchorById('anc.cg.reciprocal-reference')).toBe(true);
    expect(activateSignedSceneAnchorById('anc.cg.reciprocal-crossed')).toBe(true);
  });

  it('CONTEXT: which milestone names does the repaired receipt map actually accept?', () => {
    // The map is keyed on the FINAL receipts only. If the runtime's real
    // intermediate save carries a different milestone, it cannot be seen.
    resetProgression();
    resetSignedSceneAvRuntime('sandbox');
    markMilestone('story:ch13-route-tested');
    enterSignedSceneAvBeat('ch13-survey');
    const withFinalReceipt = activateSignedSceneAnchorById('anc.cg.route-offered');
    console.log(JSON.stringify({ case: 'final-receipt-held', routeOfferedActivated: withFinalReceipt }));
    expect(withFinalReceipt).toBe(true);
  });
});
