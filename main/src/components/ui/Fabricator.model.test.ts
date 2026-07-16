import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fabricatorAccessCopy, getPublicFabricatorSections } from './Fabricator.model.ts';
import { resetStationAccessSources, setStationAccessSource } from '../../game/data/stations.ts';

describe('public portable Fabricator', () => {
  beforeEach(() => resetStationAccessSources());
  afterEach(() => resetStationAccessSources());

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

  it('shows emergent recipes only while their world stations are reachable', () => {
    setStationAccessSource('wreck-bench', ['smelter', 'assembler']);
    const sections = getPublicFabricatorSections();
    expect(sections.map(section => section.stationId)).toEqual(['hand', 'smelter', 'assembler']);
    const ids = sections.flatMap(section => section.recipes.map(recipe => recipe.id));
    expect(ids).toContain('refined_alloy');
    expect(ids).toContain('lift_cell');
    expect(ids).toContain('logic_wafer');
    expect(ids).not.toContain('survey_lens_2');
    expect(fabricatorAccessCopy(['hand', 'smelter', 'assembler'], true)).toBe(
      'Kestrel-linked fabrication · earned patterns retained'
    );
  });
});
