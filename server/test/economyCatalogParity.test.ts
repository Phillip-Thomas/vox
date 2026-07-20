import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ECONOMY_CATALOG } from '../src/generated/economyCatalog.js';
import {
  SERVER_BUILD_MATERIALS,
  SERVER_BUILD_PIECES,
  SERVER_ITEM_IDS,
  SERVER_PUBLIC_DEMO_RECIPE_IDS,
  SERVER_STORY_RECIPE_IDS,
  SERVER_RECIPES,
  authoritativeBuildCost,
  defaultServerPlayerState,
  resolveServerAuthoritativeCommand
} from '../src/economyAuthority.js';

const canonicalCatalog = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../shared/economyCatalog.json', import.meta.url)),
  'utf8'
));

describe('shared economy catalog server parity', () => {
  it('keeps the checked-in server binding byte-semantically aligned with the canonical catalog', () => {
    expect(ECONOMY_CATALOG).toEqual(canonicalCatalog);
  });

  it('exposes the same item, recipe, material, and complete build-piece rules', () => {
    expect(SERVER_ITEM_IDS).toEqual(ECONOMY_CATALOG.itemIds);
    expect(Object.values(SERVER_RECIPES)).toEqual(ECONOMY_CATALOG.recipes);
    expect(Object.values(SERVER_BUILD_MATERIALS)).toEqual(ECONOMY_CATALOG.buildMaterials);
    expect(Object.values(SERVER_BUILD_PIECES)).toEqual(ECONOMY_CATALOG.buildPieces);
  });

  it('uses canonical recipe BOMs while preserving the primitive and bounded story gates', () => {
    expect(SERVER_PUBLIC_DEMO_RECIPE_IDS).toEqual(ECONOMY_CATALOG.publicDemoRecipeIds);
    expect(SERVER_STORY_RECIPE_IDS).toEqual(ECONOMY_CATALOG.storyRecipeIds);
    const availableIds = new Set<string>([
      ...SERVER_PUBLIC_DEMO_RECIPE_IDS,
      ...SERVER_STORY_RECIPE_IDS
    ]);
    const flightReadyState = {
      ...defaultServerPlayerState(),
      progression: {
        era: 'emergent' as const,
        milestones: ECONOMY_CATALOG.storyTransactions.shipRepairStages.map(
          transaction => `ship_repair:${transaction.stage}`
        )
      }
    };

    for (const recipe of ECONOMY_CATALOG.recipes) {
      const resolution = resolveServerAuthoritativeCommand(
        'recipe_crafted',
        {
          recipeId: recipe.id,
          inputs: [{ id: 'void_glass', qty: 999 }],
          outputs: [{ id: 'void_core', qty: 999 }]
        },
        flightReadyState,
        { commandId: `craft:${recipe.id}`, worldId: '-1,-1:p1' }
      );

      if (!availableIds.has(recipe.id)) {
        expect(resolution).toEqual({
          code: 'validation_failed',
          reason: 'Recipe is not available in the authoritative field economy.'
        });
        continue;
      }

      expect(resolution).toMatchObject({
        commandPayload: {
          recipeId: recipe.id,
          inputs: recipe.inputs,
          outputs: recipe.outputs
        },
        debit: recipe.inputs,
        credit: recipe.outputs
      });
    }
  });

  it('uses the canonical unique Maw transaction and ignores forged costs', () => {
    const ritualBeginCommandId = 'catalog:maw:ritual-begun';
    expect(ECONOMY_CATALOG.storyTransactions.mawRepair).toMatchObject({
      originWorldId: '-1,-1',
      ritualSeconds: 8
    });
    expect(resolveServerAuthoritativeCommand(
      'maw_repaired',
      {
        ritualBeginCommandId,
        elapsedMs: 999_999,
        inputs: [{ id: 'stone', qty: 1 }],
        outputs: [{ id: 'void_maw', qty: 99 }]
      },
      defaultServerPlayerState(),
      {
        commandId: 'catalog:maw:repair',
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 8_000,
        worldEvents: [{
          type: 'maw_repair_begun',
          commandId: ritualBeginCommandId,
          playerId: 'alice',
          timeMs: 0,
          payload: { ritualBeginCommandId, ritualSeconds: 8 }
        }]
      }
    )).toMatchObject({
      commandPayload: { ritualBeginCommandId },
      debit: ECONOMY_CATALOG.storyTransactions.mawRepair.inputs,
      credit: ECONOMY_CATALOG.storyTransactions.mawRepair.outputs
    });
    expect(ECONOMY_CATALOG.recipes.map(recipe => recipe.id)).not.toContain('iron_maw');
  });

  it('derives every authoritative build BOM from the canonical rules', () => {
    for (const piece of ECONOMY_CATALOG.buildPieces) {
      for (const material of ECONOMY_CATALOG.buildMaterials) {
        expect(authoritativeBuildCost(piece.type, material.id)).toEqual([{
          id: material.resource,
          qty: Math.max(1, Math.ceil(piece.costUnits * material.costMul))
        }]);
      }
    }
  });

  it('canonicalizes a 1x2 wall into two linked claims with one four-wood debit', () => {
    const resolution = resolveServerAuthoritativeCommand(
      'structure_placed',
      { cell: [4, 5, 6], face: 0, type: 'tall_wall', material: 'wood', up: 2 },
      defaultServerPlayerState(),
      { commandId: 'wall:1x2', worldId: '0,0', playerId: 'alice' }
    );

    expect(resolution).toMatchObject({
      commandPayload: { cell: [4, 5, 6], face: 0, type: 'tall_wall', material: 'wood', up: 2 },
      debit: [{ id: 'wood', qty: 4 }],
      events: [{ type: 'structure_placed', payload: { type: 'tall_wall' } }],
      structureClaims: [
        { structureId: 'slot:4,5,6:0', state: { tall: 'lower', partner: [4, 6, 6] } },
        { structureId: 'slot:4,6,6:0', state: { tall: 'upper', partner: [4, 5, 6] } }
      ]
    });

    expect(resolveServerAuthoritativeCommand(
      'structure_placed',
      { cell: [4, 5, 6], face: 2, type: 'tall_wall', material: 'wood', up: 2 },
      defaultServerPlayerState(),
      { commandId: 'wall:invalid-frame', worldId: '0,0', playerId: 'alice' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Two-cell panel build-up must be perpendicular to its wall face.'
    });
  });
});
