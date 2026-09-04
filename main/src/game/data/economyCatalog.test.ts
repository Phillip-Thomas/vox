import { describe, expect, it } from 'vitest';
import { ALL_ITEM_IDS, ITEMS } from './items.ts';
import { ALL_RECIPES, RECIPES } from './recipes.ts';
import { ALL_STATION_IDS, PORTABLE_DEMO_STATION_IDS, getAccessibleStations } from './stations.ts';
import { ERA_ORDER } from './eras.ts';
import { BUILD_PIECES, BUILD_PIECE_ORDER } from './buildPieces.ts';
import { ALL_BUILD_MATERIALS, BUILD_MATERIALS, pieceCost } from './buildMaterials.ts';
import { ECONOMY_CATALOG } from './generatedEconomyCatalog.ts';

describe('shared economy catalog client binding', () => {
  it('exposes every canonical item, station, era, recipe, material, and build piece', () => {
    expect(ALL_ITEM_IDS).toEqual(ECONOMY_CATALOG.itemIds);
    expect(Object.keys(ITEMS)).toEqual(ECONOMY_CATALOG.itemIds);
    expect(ALL_ITEM_IDS.every(id => ITEMS[id]?.id === id)).toBe(true);

    expect(ALL_STATION_IDS).toEqual(ECONOMY_CATALOG.stationIds);
    expect(ERA_ORDER).toEqual(ECONOMY_CATALOG.eraIds);
    expect(ALL_RECIPES).toEqual(ECONOMY_CATALOG.recipes);
    expect(Object.values(RECIPES)).toEqual(ECONOMY_CATALOG.recipes);
    expect(ALL_BUILD_MATERIALS.map(id => BUILD_MATERIALS[id])).toEqual(
      ECONOMY_CATALOG.buildMaterials
    );
    expect(BUILD_PIECE_ORDER.map(type => BUILD_PIECES[type])).toEqual(
      ECONOMY_CATALOG.buildPieces
    );
  });

  it('keeps the public build restricted to the primitive field kit', () => {
    expect(PORTABLE_DEMO_STATION_IDS).toEqual(ECONOMY_CATALOG.publicDemoStationIds);
    expect(getAccessibleStations()).toEqual(ECONOMY_CATALOG.publicDemoStationIds);
    expect(
      ALL_RECIPES
        .filter(recipe => getAccessibleStations().includes(recipe.station))
        .map(recipe => recipe.id)
    ).toEqual(ECONOMY_CATALOG.publicDemoRecipeIds);
  });

  it('keeps the Maw repair and drowned memory unique and non-craftable', () => {
    expect(ECONOMY_CATALOG.storyTransactions.mawRepair).toMatchObject({
      originWorldId: '-1,-1',
      ritualSeconds: 8
    });
    expect(ALL_ITEM_IDS).toEqual(expect.arrayContaining([
      'maw_repair_kit',
      'kestrel_keel_memory',
      'iron_maw'
    ]));
    expect(ALL_RECIPES.map(recipe => recipe.id)).not.toContain('iron_maw');
    expect(ALL_RECIPES.flatMap(recipe => recipe.outputs.map(output => output.id))).not.toContain('maw_repair_kit');
    expect(ALL_RECIPES.flatMap(recipe => recipe.outputs.map(output => output.id))).not.toContain('kestrel_keel_memory');
  });

  it('binds the one Habitat Core to the canonical assembler BOM and durable receipt', () => {
    expect(ITEMS.habitat_core).toMatchObject({
      kind: 'placeable',
      stackable: false
    });
    expect(RECIPES.habitat_core).toMatchObject({
      station: 'assembler',
      era: 'emergent',
      uniqueReceipt: 'story:item:habitat-core:crafted',
      inputs: [
        { id: 'strut_frame', qty: 1 },
        { id: 'logic_wafer', qty: 1 },
        { id: 'refined_alloy', qty: 1 }
      ],
      outputs: [{ id: 'habitat_core', qty: 1 }]
    });
  });

  it('keeps the issued bonded cell real, unique, and outside every craft recipe', () => {
    expect(ITEMS.bonded_cell).toMatchObject({
      id: 'bonded_cell',
      kind: 'component',
      stackable: false
    });
    expect(ALL_RECIPES.map(recipe => recipe.id)).not.toContain('bonded_cell');
    expect(ALL_RECIPES.flatMap(recipe => recipe.outputs.map(output => output.id)))
      .not.toContain('bonded_cell');
  });

  it('keeps every recipe BOM closed over canonical item IDs', () => {
    const itemIds = new Set<string>(ECONOMY_CATALOG.itemIds);
    const recipeIds = new Set<string>();

    for (const recipe of ALL_RECIPES) {
      expect(recipeIds.has(recipe.id)).toBe(false);
      recipeIds.add(recipe.id);
      expect(recipe.outputs).toEqual([{ id: recipe.id, qty: 1 }]);
      for (const stack of [...recipe.inputs, ...recipe.outputs]) {
        expect(itemIds.has(stack.id)).toBe(true);
        expect(Number.isInteger(stack.qty) && stack.qty > 0).toBe(true);
      }
    }
  });

  it('derives every build BOM from the canonical piece and material rules', () => {
    for (const piece of ECONOMY_CATALOG.buildPieces) {
      for (const material of ECONOMY_CATALOG.buildMaterials) {
        expect(pieceCost(piece.type, material.id)).toEqual([{
          id: material.resource,
          qty: Math.max(1, Math.ceil(piece.costUnits * material.costMul))
        }]);
      }
    }
  });

  it('exposes a four-wood 1x2 wall before the legacy 1x1 half-wall', () => {
    expect(BUILD_PIECE_ORDER.slice(0, 3)).toEqual(['foundation', 'tall_wall', 'wall']);
    expect(BUILD_PIECES.tall_wall).toMatchObject({
      name: 'Wall (1x2)',
      heightUnits: 2,
      costUnits: 4,
      seals: true
    });
    expect(BUILD_PIECES.wall).toMatchObject({
      name: 'Half Wall (1x1)',
      costUnits: 2,
      seals: true
    });
  });
});
