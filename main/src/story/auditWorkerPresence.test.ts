import { describe, expect, it } from 'vitest';
import { shouldMountAuditWorker } from './auditWorkerPresence.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

describe('W-7744 physical presence policy', () => {
  it('does not unmount the actor at the A4 to Chapter 5 handoff', () => {
    expect(shouldMountAuditWorker('ch4', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('ch5', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('ch6', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('ch7', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('ch8', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('ch9', STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(shouldMountAuditWorker('complete', STORY_PRIMARY_WORLD_ID)).toBe(true);
  });

  it('never duplicates W-7744 onto Tidegarden or pre-arrival Origin', () => {
    expect(shouldMountAuditWorker('ch3', STORY_PRIMARY_WORLD_ID)).toBe(false);
    expect(shouldMountAuditWorker('ch5', TIDEGARDEN_WORLD_ID)).toBe(false);
    expect(shouldMountAuditWorker('complete', TIDEGARDEN_WORLD_ID)).toBe(false);
  });
});
