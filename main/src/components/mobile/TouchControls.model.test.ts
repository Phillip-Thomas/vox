import { describe, expect, it } from 'vitest';
import { KEY_CODES } from '../../utils/mobileInput.ts';
import { createTouchActionGrid, createTouchActionSpecs } from './TouchControls.model.ts';

describe('touch action layout model', () => {
  it('uses exactly three normal on-foot actions and removes the mobile dive button', () => {
    const actions = createTouchActionSpecs('fps', false);

    expect(actions.map(action => action.id)).toEqual(['use', 'mine', 'jump']);
    expect(actions).toHaveLength(3);
    expect(actions.some(action => action.code === KEY_CODES.descend)).toBe(false);
  });

  it('anchors normal on-foot actions as a bottom-right right angle', () => {
    const grid = createTouchActionGrid('fps', false);
    const actions = createTouchActionSpecs('fps', false);

    expect(grid.templateAreas).toBe('". use" "mine primary"');
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
