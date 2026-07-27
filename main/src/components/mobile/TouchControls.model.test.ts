import { describe, expect, it } from 'vitest';
import { KEY_CODES } from '../../utils/mobileInput.ts';
import {
  createTouchActionGrid,
  createTouchActionSpecs,
  staleHeldTouchActionCodes
} from './TouchControls.model.ts';

describe('touch action layout model', () => {
  it('keeps every required on-foot story action and removes the mobile dive button', () => {
    const actions = createTouchActionSpecs('fps', false);

    expect(actions.map(action => action.id)).toEqual(['eat', 'use', 'mine', 'jump']);
    expect(actions.find(action => action.id === 'eat')?.code).toBe(KEY_CODES.eat);
    expect(actions.find(action => action.id === 'eat')?.label).toBe('CONSUME');
    expect(actions).toHaveLength(4);
    expect(actions.some(action => action.code === KEY_CODES.descend)).toBe(false);
  });

  it('anchors normal on-foot actions as a bottom-right right angle', () => {
    const grid = createTouchActionGrid('fps', false);
    const actions = createTouchActionSpecs('fps', false);

    expect(grid.templateAreas).toBe('"eat use" "mine primary"');
    expect(actions.find(action => action.id === 'jump')?.area).toBe('primary');
    expect(actions.find(action => action.id === 'mine')?.area).toBe('mine');
    expect(actions.find(action => action.id === 'use')?.area).toBe('use');
  });

  it('adds a hold-to-sprint button to the on-foot grid only when policy allows it', () => {
    const withoutSprint = createTouchActionSpecs('fps', false, false);
    expect(withoutSprint.map(action => action.id)).toEqual(['eat', 'use', 'mine', 'jump']);

    const withSprint = createTouchActionSpecs('fps', false, true);
    const sprint = withSprint.find(action => action.id === 'sprint');
    expect(sprint?.label).toBe('SPRINT');
    expect(sprint?.code).toBe(KEY_CODES.sprint);
    expect(sprint?.code).toBe('ShiftLeft'); // the desktop Shift run cue.
    expect(withSprint.map(action => action.id)).toEqual(['eat', 'use', 'mine', 'sprint', 'jump']);
  });

  it('only grows the on-foot grid to three rows when sprint is present', () => {
    expect(createTouchActionGrid('fps', false, false).templateAreas).toBe('"eat use" "mine primary"');
    const withSprint = createTouchActionGrid('fps', false, true);
    expect(withSprint.templateAreas).toBe('"eat use" "mine sprint" ". primary"');
    expect(withSprint.templateRows).toBe('66px 66px 78px');
  });

  it('never surfaces sprint in build or flight modes', () => {
    expect(createTouchActionSpecs('flight', false, true).some(action => action.id === 'sprint')).toBe(false);
    expect(createTouchActionSpecs('fps', true, true).some(action => action.id === 'sprint')).toBe(false);
  });

  it('keeps required build and flight controls available', () => {
    expect(createTouchActionSpecs('fps', true).map(action => action.code)).toEqual([
      KEY_CODES.deconstruct,
      KEY_CODES.buildRotate,
      KEY_CODES.jump,
      KEY_CODES.mine
    ]);
    expect(createTouchActionSpecs('flight', false).map(action => action.code)).toEqual([
      KEY_CODES.rollLeft,
      KEY_CODES.rollRight,
      KEY_CODES.board,
      KEY_CODES.jump
    ]);
  });
});

describe('touch action held-code reconciliation (disappear-while-held)', () => {
  it('releases a held SPRINT when build mode hides it', () => {
    // Holding SPRINT (ShiftLeft) as build mode opens: sprint leaves the grid.
    expect(staleHeldTouchActionCodes([KEY_CODES.sprint], 'fps', true, false))
      .toEqual([KEY_CODES.sprint]);
  });

  it('releases a held SPRINT when the story policy revokes it (still on foot)', () => {
    expect(staleHeldTouchActionCodes([KEY_CODES.sprint], 'fps', false, false))
      .toEqual([KEY_CODES.sprint]);
  });

  it('keeps a held SPRINT while it is still a live button', () => {
    expect(staleHeldTouchActionCodes([KEY_CODES.sprint], 'fps', false, true)).toEqual([]);
  });

  it('carries a held code over when a surviving button still binds it (MINE→build PLACE share KeyE)', () => {
    // KeyE is MINE on foot and PLACE in build mode — the hold stays valid.
    expect(staleHeldTouchActionCodes([KEY_CODES.mine], 'fps', true, false)).toEqual([]);
  });

  it('releases a held USE (KeyF) that has no button in the build grid', () => {
    expect(staleHeldTouchActionCodes([KEY_CODES.board], 'fps', true, false))
      .toEqual([KEY_CODES.board]);
  });

  it('is a no-op when nothing is held', () => {
    expect(staleHeldTouchActionCodes([], 'fps', true, true)).toEqual([]);
  });
});
