import { describe, expect, it } from 'vitest';
import { createControlsReference } from './ControlsReference.model.ts';

describe('ControlsReference model', () => {
  it('shows the complete desktop overview without changing bindings', () => {
    const sections = createControlsReference({ device: 'desktop', mode: 'overview' });
    expect(sections.map(section => section.id)).toEqual(['global', 'foot', 'interaction', 'build', 'ship']);
    const labels = sections.flatMap(section => section.actions.map(action => `${action.key}:${action.label}`));
    expect(labels).toContain('Shift:Sprint');
    expect(labels).toContain('G:Eat / drink from waterskin');
    expect(labels).toContain('Q / E:Roll');
    expect(labels).toContain('X:Remove structure');
  });

  it('prioritizes the current Story mode and omits unavailable actions', () => {
    const sections = createControlsReference({
      device: 'desktop', mode: 'fps', storyActive: true, allowBuild: false, allowCraft: false,
      moveSpeedScale: 0, allowJump: false, allowSprint: false, lookMode: 'feed'
    });
    expect(sections.map(section => section.title)).toEqual([
      'Global', 'On foot · current'
    ]);
    const keys = sections.flatMap(section => section.actions.map(action => action.key));
    expect(keys).not.toContain('M');
    expect(keys).not.toContain('B');
    expect(keys).not.toContain('C');
    expect(keys).not.toContain('Space');
    expect(keys).not.toContain('Shift');
    expect(sections[1].actions).toContainEqual({ key: '—', label: 'Movement held by Story' });
    expect(sections[1].actions).toContainEqual({ key: 'Mouse', label: 'Constrained survey' });
  });

  it('uses the existing touch action vocabulary for each mode', () => {
    expect(createControlsReference({ device: 'touch', mode: 'fps' })[1].actions.map(action => action.key))
      .toEqual(['Left stick', 'Right side', 'JUMP', 'MINE', 'USE']);
    expect(createControlsReference({ device: 'touch', mode: 'build' })[1].actions.map(action => action.key))
      .toContain('PLACE');
    expect(createControlsReference({ device: 'touch', mode: 'flight' })[1].actions.map(action => action.key))
      .toContain('LAND');
    expect(createControlsReference({ device: 'touch', mode: 'fps' })[0].actions.map(action => action.key))
      .toEqual(['B', 'C', 'M']);
    expect(createControlsReference({ device: 'desktop', mode: 'flight' })[0].actions.map(action => action.key))
      .not.toContain('M');
    expect(createControlsReference({
      device: 'touch', mode: 'fps', storyActive: true,
      moveSpeedScale: 0.55, allowJump: false, lookMode: 'side'
    })[1].actions).toEqual([
      { key: 'Left stick', label: 'Left / right Story movement' },
      { key: '—', label: 'Story camera' },
      { key: 'MINE', label: 'Mine / harvest' },
      { key: 'USE', label: 'Use / Story interaction' }
    ]);
    expect(createControlsReference({
      device: 'touch', mode: 'fps', storyActive: true,
      moveSpeedScale: 0, allowJump: false, lookMode: 'feed'
    })[1].actions).toContainEqual({ key: 'Right side', label: 'Constrained survey' });
  });
});
