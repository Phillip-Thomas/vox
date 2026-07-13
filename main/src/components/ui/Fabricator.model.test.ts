import { describe, expect, it } from 'vitest';
import { getPublicFabricatorSections } from './Fabricator.model.ts';

describe('public portable Fabricator', () => {
  it('shows exactly the six reachable primitive recipes at the hand kit', () => {
    const sections = getPublicFabricatorSections();
    expect(sections.map(section => section.stationId)).toEqual(['hand']);
    expect(sections.flatMap(section => section.recipes.map(recipe => recipe.id))).toEqual([
      'biofuel', 'stone_hatchet', 'stone_pickaxe', 'torch', 'campfire', 'waterskin'
    ]);
  });

  it('never exposes later stations, Maw upgrades, suits, or travel modules', () => {
    const ids = getPublicFabricatorSections().flatMap(section => section.recipes.map(recipe => recipe.id));
    expect(ids).not.toContain('iron_maw');
    expect(ids).not.toContain('thermal_carapace');
    expect(ids).not.toContain('range_coil');
  });
});
