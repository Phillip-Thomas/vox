import { beforeEach, describe, expect, it } from 'vitest';
import { createOfflineCommandContext, collectForageCommand } from './gameplayCommands.ts';
import { getLocalActorId, resetLocalActorId, setLocalActorId, subscribeLocalActorId } from './playerActors.ts';
import { createWorldIdentity } from './worldIdentity.ts';
import { addItem, getItemCount, resetAllInventories } from './systems/inventorySystem.ts';
import { getEquippedToolTier } from './systems/loadoutSystem.ts';
import {
  applyStamina,
  canSprint,
  getVitals,
  isStaminaExhausted,
  resetAllVitals,
  setVitals,
  tickOxygen
} from './systems/survivalVitals.ts';
import { getMawCharge, refuelFromInventory, resetAllMawState } from './systems/mawSystem.ts';
import { fillWaterskin, getWaterskinFill, resetAllWaterskins, useWaterskin } from './systems/consumeSystem.ts';
import { consumeJetpackFuel, getJetpackFuelAmount, resetAllJetpackFuel } from './systems/jetpackSystem.ts';
import { resetForagePickup } from './systems/foragePickup.ts';

beforeEach(() => {
  resetLocalActorId();
  resetAllInventories();
  resetAllVitals();
  resetAllMawState();
  resetAllWaterskins();
  resetAllJetpackFuel();
  resetForagePickup();
});

describe('actor-keyed player stores', () => {
  it('publishes local actor id changes for co-op command contexts', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeLocalActorId(() => seen.push(getLocalActorId()));

    setLocalActorId('firebase-player');
    setLocalActorId('firebase-player');
    resetLocalActorId();
    unsubscribe();
    setLocalActorId('after-unsubscribe');

    expect(seen).toEqual(['firebase-player', 'local']);
  });

  it('keeps inventory and loadout derived per actor while preserving local defaults', () => {
    addItem('stone_pickaxe', 1, 'alice');
    addItem('wood', 3, 'bob');

    expect(getItemCount('stone_pickaxe', 'alice')).toBe(1);
    expect(getItemCount('stone_pickaxe', 'bob')).toBe(0);
    expect(getItemCount('wood')).toBe(0);
    expect(getEquippedToolTier('alice')).toBe(1);
    expect(getEquippedToolTier('bob')).toBe(0);
  });

  it('keeps vitals, oxygen, and the stamina exhaustion latch per actor', () => {
    setVitals({ stamina: 1, oxygen: 100 }, 'alice');
    applyStamina(1, true, 'alice');
    tickOxygen(60, true, 'alice');

    expect(canSprint('alice')).toBe(false);
    expect(isStaminaExhausted('alice')).toBe(true);
    expect(getVitals('alice').oxygen).toBe(0);
    expect(canSprint('bob')).toBe(true);
    expect(getVitals('bob').oxygen).toBe(100);
  });

  it('keeps Maw charge and waterskin fill per actor', () => {
    addItem('biofuel', 1, 'alice');

    expect(refuelFromInventory('alice')).toBe(true);
    expect(getMawCharge('alice')).toBe(50);
    expect(getMawCharge('bob')).toBe(0);

    setVitals({ thirst: 50 }, 'alice');
    fillWaterskin(30, 'alice');
    expect(useWaterskin(10, 'alice')).toBe(10);
    expect(getWaterskinFill('alice')).toBe(20);
    expect(getVitals('alice').thirst).toBe(60);
    expect(getWaterskinFill('bob')).toBe(0);
  });

  it('keeps jetpack fuel per actor', () => {
    consumeJetpackFuel(0.5, 'alice');

    expect(getJetpackFuelAmount('alice')).toBeCloseTo(0.9);
    expect(getJetpackFuelAmount('bob')).toBeCloseTo(1.4);
  });

  it('uses command context actor when banking command rewards', () => {
    const ctx = createOfflineCommandContext(createWorldIdentity({ x: 0, y: 0 }), {
      actorId: 'alice'
    });

    expect(collectForageCommand(ctx, { x: 1, y: 2, z: 3, kind: 'root' }).ok).toBe(true);

    expect(getItemCount('root', 'alice')).toBe(1);
    expect(getItemCount('root')).toBe(0);
  });
});
