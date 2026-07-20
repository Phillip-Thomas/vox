import { describe, expect, it } from 'vitest';
import { shouldMountAuditWorker } from './auditWorkerPresence.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

describe('W-7744 physical presence policy', () => {
  it('keeps the live exit mounted only until its short post-tear route completes', () => {
    expect(shouldMountAuditWorker('ch4', STORY_PRIMARY_WORLD_ID, false)).toBe(true);
    expect(shouldMountAuditWorker('ch4', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('ch5', STORY_PRIMARY_WORLD_ID, false)).toBe(false);
    expect(shouldMountAuditWorker('ch5', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('ch6', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('ch7', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('ch8', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('ch9', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
    expect(shouldMountAuditWorker('complete', STORY_PRIMARY_WORLD_ID, true)).toBe(false);
  });

  it('never duplicates W-7744 onto Tidegarden or pre-arrival Origin', () => {
    expect(shouldMountAuditWorker('ch3', STORY_PRIMARY_WORLD_ID, false)).toBe(false);
    expect(shouldMountAuditWorker('ch4', TIDEGARDEN_WORLD_ID, false)).toBe(false);
    expect(shouldMountAuditWorker('complete', TIDEGARDEN_WORLD_ID, true)).toBe(false);
  });
});
