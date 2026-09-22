import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bindAutopilotPlayer, autopilotWorldAccess } from '../autopilot/worldAccess.ts';
import { performPlayerCraft } from '../../game/playerCrafting.ts';
import { createOfflineCommandContext } from '../../game/gameplayCommands.ts';
import { createWorldIdentity } from '../../game/worldIdentity.ts';
import { RECIPES } from '../../game/data/recipes.ts';
import { resetInventory, addItem, getItemCount } from '../../game/systems/inventorySystem.ts';
import { resetCampfires, getCampfires } from '../../game/systems/campfires.ts';
import { resetShipRestoration } from '../../game/systems/shipRestoration.ts';
import { resetPlayerSubmersion } from '../../state/playerSubmersion.ts';
import { resetLavaImmersion, setLocalLavaImmersion } from '../../state/playerLavaImmersion.ts';
import { setPlayerWorldPosition, setPlayerUp } from '../../state/playerFrame.ts';
import { BEAT_RAILS } from '../autopilot/rails.ts';

function materialInventory(): void {
  addItem('flint', 2); addItem('biofuel', 1); addItem('wood', 3);
}
const context = () => createOfflineCommandContext(createWorldIdentity({ x: 0, y: 0 }));
const resultSnapshot = () => ({
  wood: getItemCount('wood'), flint: getItemCount('flint'), biofuel: getItemCount('biofuel'),
  fire: getCampfires().map(({ pos, up, ownerId }) => ({ pos, up, ownerId }))
});
beforeEach(() => {
  resetInventory(); resetCampfires(); resetShipRestoration(); resetPlayerSubmersion(); resetLavaImmersion();
  setPlayerWorldPosition(new THREE.Vector3(3, 50, 7)); setPlayerUp(new THREE.Vector3(0, 1, 0));
});

describe('screening / player parity', () => {
  it('registers an executable rail for all 29 driven beats', () => {
    expect(Object.keys(BEAT_RAILS)).toHaveLength(29);
    expect(Object.values(BEAT_RAILS).every(rail => typeof rail === 'function')).toBe(true);
  });
  it('the UI and movie use the same craft and placement transaction and consume the same inventory', () => {
    materialInventory();
    expect(performPlayerCraft(context(), RECIPES.campfire).ok).toBe(true);
    const player = resultSnapshot();
    resetInventory(); resetCampfires(); materialInventory();
    const unbind = bindAutopilotPlayer(context());
    expect(autopilotWorldAccess.craft('campfire')).toBe(true);
    expect(resultSnapshot()).toEqual(player);
    expect(player.fire[0].pos).toEqual([3, 48.9, 7]);
    unbind();
  });
  it('cannot craft without materials or a mounted player, and rejects unsafe ground without spending inputs', () => {
    const unbind = bindAutopilotPlayer(context());
    expect(autopilotWorldAccess.craft('campfire')).toBe(false);
    expect(getCampfires()).toHaveLength(0);
    materialInventory(); setLocalLavaImmersion(1, true, false);
    expect(autopilotWorldAccess.craft('campfire')).toBe(false);
    expect(getItemCount('wood')).toBe(3);
    unbind(); resetLavaImmersion();
    expect(autopilotWorldAccess.craft('campfire')).toBe(false);
  });
  it('only holds extraction when the actual player picker sees the selected tree', () => {
    let target = { kind: 'flora', coord: { x: 1, y: 25, z: 2 } };
    const release = bindAutopilotPlayer(context(), () => target);
    expect(autopilotWorldAccess.isLookingAtTree([1, 25, 2])).toBe(false);
    target = { ...target, kind: 'tree' };
    expect(autopilotWorldAccess.isLookingAtTree([1, 25, 2])).toBe(true);
    expect(autopilotWorldAccess.isLookingAtTree([2, 25, 2])).toBe(false);
    release();
    expect(autopilotWorldAccess.isLookingAtTree([1, 25, 2])).toBe(false);
  });
  it('releasing an obsolete player binding preserves the current world binding', () => {
    const releaseOld = bindAutopilotPlayer(context());
    const releaseNew = bindAutopilotPlayer(context());
    releaseOld(); materialInventory();
    expect(autopilotWorldAccess.craft('campfire')).toBe(true);
    releaseNew();
  });
  it('extracts through player controls, resolves interactions, and docks through the existing player commit', () => {
    const player = readFileSync(resolve(__dirname, '../../components/EfficientPlayer.tsx'), 'utf8');
    const primitives = readFileSync(resolve(__dirname, '../autopilot/primitives.ts'), 'utf8');
    const panel = readFileSync(resolve(__dirname, '../../components/ui/CraftingPanel.tsx'), 'utf8');
    expect(player).toContain('bindAutopilotPlayer(commandContext, () => pickHarvestTarget(cameraRef.current))');
    expect(player).toContain('pickHarvestTarget(camera)');
    expect(panel).toContain('performPlayerCraft(commandContext, recipe)');
    expect(primitives).toContain('resolveStoryInteraction(null, getPlayerWorldPosition())');
    expect(primitives).toContain('commitSpaceStationDock()');
  });
});
