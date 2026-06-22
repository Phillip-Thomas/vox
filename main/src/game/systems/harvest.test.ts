import { describe, it, expect, beforeEach } from 'vitest';
import { MaterialType } from '../../types/materials.ts';
import { dropsForBlock, dropsForMaterial, harvestMaterial, harvestVoxel } from './harvestingSystem.ts';
import { getInventory, getResourceCount, resetInventory, addResource, subscribeInventory, totalItems } from './inventorySystem.ts';
import { RESOURCES } from '../data/resources.ts';

beforeEach(() => resetInventory());

describe('dropsForMaterial', () => {
  it('maps materials to their block drops', () => {
    expect(dropsForMaterial(MaterialType.GRASS)).toContain('biofiber');
    expect(dropsForMaterial(MaterialType.COPPER)).toContain('copper_ore');
    expect(dropsForMaterial(MaterialType.SAND)).toContain('silica');
    expect(dropsForMaterial(MaterialType.BASALT)).toEqual(expect.arrayContaining(['stone', 'basalt_glass']));
    expect(dropsForMaterial(MaterialType.CRYSTAL)).toEqual(expect.arrayContaining(['silica', 'charged_crystal']));
  });

  it('lava and dirt yield nothing harvestable', () => {
    expect(dropsForMaterial(MaterialType.LAVA)).toEqual([]);
    expect(dropsForMaterial(MaterialType.DIRT)).toEqual([]);
  });
});

describe('dropsForBlock / harvestVoxel', () => {
  it('adds deposit identity without duplicating block drops', () => {
    const deposit = { resourceId: 'charged_crystal' as const, richness: 1, scanLevel: 2 };
    expect(dropsForBlock('crystal_crust', deposit)).toEqual(expect.arrayContaining(['silica', 'charged_crystal']));
    expect(dropsForBlock('crystal_crust', deposit).filter(id => id === 'charged_crystal')).toHaveLength(1);
  });

  it('blocks harvesting when the tool tier is too low and does not bank drops', () => {
    const result = harvestVoxel({ blockId: 'basalt', toolTier: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('tool_tier');
    expect(totalItems()).toBe(0);
  });

  it('banks deposit resources when harvest permission succeeds', () => {
    const deposit = { resourceId: 'copper_ore' as const, richness: 1.2, scanLevel: 1 };
    const result = harvestVoxel({ blockId: 'copper_block', deposit, toolTier: 1 });
    expect(result.success).toBe(true);
    expect(result.drops.some(drop => drop.id === 'copper_ore')).toBe(true);
    expect(getResourceCount('copper_ore')).toBeGreaterThan(0);
  });
});

describe('inventory store', () => {
  it('accumulates and resets', () => {
    addResource('stone', 3);
    addResource('stone', 2);
    expect(getResourceCount('stone')).toBe(5);
    expect(totalItems()).toBe(5);
    resetInventory();
    expect(totalItems()).toBe(0);
  });

  it('notifies subscribers', () => {
    let hits = 0;
    const unsub = subscribeInventory(() => hits++);
    addResource('silica', 1);
    expect(hits).toBe(1);
    unsub();
    addResource('silica', 1);
    expect(hits).toBe(1); // no longer notified
  });
});

describe('harvestMaterial', () => {
  it('banks drops within each resource yield range', () => {
    const drops = harvestMaterial(MaterialType.COPPER);
    expect(drops.length).toBe(1);
    const d = drops[0];
    expect(d.id).toBe('copper_ore');
    const [lo, hi] = RESOURCES.copper_ore.yield;
    expect(d.qty).toBeGreaterThanOrEqual(lo);
    expect(d.qty).toBeLessThanOrEqual(hi);
    expect(getResourceCount('copper_ore')).toBe(d.qty);
  });

  it('harvesting lava yields nothing', () => {
    expect(harvestMaterial(MaterialType.LAVA)).toEqual([]);
    expect(totalItems()).toBe(0);
  });

  it('inventory total reflects repeated harvests', () => {
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const drops = harvestMaterial(MaterialType.GRASS); // biofiber
      total += drops.reduce((s, d) => s + d.qty, 0);
    }
    expect(getInventory().biofiber).toBe(total);
    expect(total).toBeGreaterThan(0);
  });
});
