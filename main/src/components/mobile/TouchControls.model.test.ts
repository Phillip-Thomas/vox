import { describe, expect, it } from 'vitest';
import { KEY_CODES } from '../../utils/mobileInput.ts';
import { createTouchActionGrid, createTouchActionSpecs } from './TouchControls.model.ts';

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
