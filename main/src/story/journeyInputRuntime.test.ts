import { beforeEach, describe, expect, it } from 'vitest';
import {
  getJourneyInputSnapshot,
  recordJourneyGameplayHotkeyBoundary,
  recordJourneyInputSubmission,
  resetJourneyInputRuntime
} from './journeyInputRuntime.ts';

describe('journey input runtime', () => {
  beforeEach(resetJourneyInputRuntime);

  it('counts only gameplay shortcut candidates that reach the boundary', () => {
    recordJourneyGameplayHotkeyBoundary('KeyS', true);
    recordJourneyGameplayHotkeyBoundary('KeyG', true);

    const snapshot = getJourneyInputSnapshot();
    expect(snapshot.hotkeyActivations).toBe(1);
    expect(snapshot.events).toMatchObject([
      { type: 'gameplay-hotkey-boundary', code: 'KeyS', targetEditable: true }
    ]);
  });

  it('records application submissions independently from keyboard events', () => {
    recordJourneyInputSubmission('sdgsdg');

    expect(getJourneyInputSnapshot()).toMatchObject({
      submitCount: 1,
      lastSubmittedValue: 'sdgsdg',
      events: [{ type: 'application-submit', value: 'sdgsdg' }]
    });
  });
});
