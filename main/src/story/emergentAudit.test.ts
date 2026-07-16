import { beforeEach, describe, expect, it } from 'vitest';
import { hasMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  getVoxelRealityStage,
  resetVoxelRealityRenderState,
  setVoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  commitA4Alive,
  commitA4FieldPackTear,
  commitA4HerdCrest,
  commitA4PondResponse,
  commitA4WorkerFlight,
  commitAuditMismatch,
  commitComplianceAct,
  commitProtectedTreeToolAttempt,
  commitTreeRefusal,
  EMERGENT_AUDIT_MILESTONES,
  FIELD_PACK_DROPPED_MILESTONE
} from './emergentAudit.ts';

describe('audit, compliance, refusal, and A4 authority', () => {
  beforeEach(() => {
    resetProgression();
    resetEmergentStoryEvents();
    resetVoxelRealityRenderState();
    setVoxelRealityStage('material');
  });

  it('enforces the three mismatches and two physical compliance acts in order', () => {
    expect(commitAuditMismatch('tree', '-1,-1').reason).toBe('out-of-order');
    expect(commitAuditMismatch('fire', '-1,-1').ok).toBe(true);
    expect(commitAuditMismatch('life', '-1,-1').ok).toBe(true);
    expect(commitAuditMismatch('tree', '-1,-1').ok).toBe(true);

    expect(commitComplianceAct('fire', false, '-1,-1').reason).toBe('physical-action-required');
    expect(commitComplianceAct('organics', true, '-1,-1').reason).toBe('out-of-order');
    expect(commitComplianceAct('fire', true, '-1,-1').ok).toBe(true);
    expect(commitComplianceAct('organics', true, '-1,-1').ok).toBe(true);
    expect(hasMilestone(EMERGENT_AUDIT_MILESTONES.regressionSettled)).toBe(true);
  });

  it('requires a harmless protected-tool refusal before lowercase no', () => {
    for (const mismatch of ['fire', 'life', 'tree'] as const) commitAuditMismatch(mismatch, '-1,-1');
    commitComplianceAct('fire', true, '-1,-1');
    commitComplianceAct('organics', true, '-1,-1');
    expect(commitTreeRefusal('-1,-1')).toMatchObject({ ok: false, reason: 'out-of-order' });
    expect(commitProtectedTreeToolAttempt('-1,-1').ok).toBe(true);
    expect(commitTreeRefusal('-1,-1').ok).toBe(true);
    expect(getEmergentStoryEvents().slice(-3).map(event => event.type)).toEqual([
      'protected_tree_tool_refused',
      'tree_refusal_available',
      'refusal_committed'
    ]);
  });

  it('orders visible pond, grounded herd, worker flight and branch tear after A4', () => {
    for (const mismatch of ['fire', 'life', 'tree'] as const) commitAuditMismatch(mismatch, '-1,-1');
    commitComplianceAct('fire', true, '-1,-1');
    commitComplianceAct('organics', true, '-1,-1');
    commitProtectedTreeToolAttempt('-1,-1');
    commitTreeRefusal('-1,-1');

    expect(commitA4FieldPackTear(true, true, true, '-1,-1').reason).toBe('out-of-order');
    expect(commitA4Alive('-1,-1').ok).toBe(true);
    expect(getVoxelRealityStage()).toBe('alive');
    expect(hasMilestone(FIELD_PACK_DROPPED_MILESTONE)).toBe(false);
    expect(hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive)).toBe(true);
    expect(commitA4PondResponse(false, '-1,-1').reason).toBe('physical-action-required');
    expect(commitA4PondResponse(true, '-1,-1').ok).toBe(true);
    expect(commitA4HerdCrest(2, 1, '-1,-1').reason).toBe('physical-action-required');
    expect(commitA4HerdCrest(5, 2.4, '-1,-1').ok).toBe(true);
    expect(commitA4WorkerFlight(false, 2, '-1,-1').reason).toBe('physical-action-required');
    expect(commitA4WorkerFlight(true, 2, '-1,-1').ok).toBe(true);
    expect(commitA4FieldPackTear(true, false, true, '-1,-1').reason)
      .toBe('vegetation-contact-required');
    expect(commitA4FieldPackTear(true, true, true, '-1,-1').ok).toBe(true);
    expect(hasMilestone(FIELD_PACK_DROPPED_MILESTONE)).toBe(true);
    expect(getEmergentStoryEvents().slice(-5).map(event => event.type)).toEqual([
      'reality_stage_committed',
      'a4_pond_response_visible',
      'a4_herd_route_visible',
      'a4_w7744_fault_recorded',
      'field_pack_dropped'
    ]);
    expect(commitA4Alive('-1,-1').idempotent).toBe(true);
  });
});
