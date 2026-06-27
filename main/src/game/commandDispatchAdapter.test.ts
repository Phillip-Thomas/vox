import { describe, expect, it } from 'vitest';
import { commandAccepted, type CommandAccepted } from './commands.ts';
import {
  dispatchGameplayCommandWithTransport,
  resolveMultiplayerCommandIntent,
  type GameplayCommandTransport,
  type MultiplayerCommandLane
} from './commandDispatchAdapter.ts';
import { createDomainEvent } from './events.ts';

function accepted(commandId = 'cmd-1'): CommandAccepted {
  return commandAccepted({ commandId }, [
    createDomainEvent({
      worldId: '0,0',
      actorId: 'alice',
      timeMs: 1,
      type: 'resource_taken',
      payload: { source: 'tree', coord: [1, 2, 3], id: 'wood', qty: 3 }
    })
  ], {
    rollback: { removeItems: [{ id: 'wood', qty: 3 }] }
  });
}

function transport(lane: MultiplayerCommandLane): GameplayCommandTransport & {
  sent: Array<{ commandType: string; payload: Record<string, unknown> }>;
  predictions: number;
  rollbacks: number;
} {
  const tx = {
    sent: [] as Array<{ commandType: string; payload: Record<string, unknown> }>,
    predictions: 0,
    rollbacks: 0,
    lane: () => lane,
    sendCommand(result: CommandAccepted, commandType: string, payload: Record<string, unknown>) {
      expect(result.ok).toBe(true);
      tx.sent.push({ commandType, payload });
      return true;
    },
    sendPrediction() {
      tx.predictions++;
      return 1;
    },
    rollback() {
      tx.rollbacks++;
    }
  };
  return tx;
}

describe('gameplay command dispatch adapter', () => {
  it('runs local commands without transport while offline', () => {
    const tx = transport('offline');
    let ran = false;

    const result = dispatchGameplayCommandWithTransport(() => {
      ran = true;
      return accepted();
    }, {}, tx);

    expect(result.ok).toBe(true);
    expect(ran).toBe(true);
    expect(tx.sent).toEqual([]);
  });

  it('resolves the first event as the online command intent by default', () => {
    const tx = transport('online');

    const result = dispatchGameplayCommandWithTransport(() => accepted(), {}, tx);

    expect(result.ok).toBe(true);
    expect(tx.sent).toEqual([{
      commandType: 'resource_taken',
      payload: { source: 'tree', coord: [1, 2, 3], id: 'wood', qty: 3 }
    }]);
  });

  it('supports explicit multiplayer intent payloads for multi-event local commands', () => {
    const intent = resolveMultiplayerCommandIntent(accepted(), {
      commandType: 'craft_campfire',
      payload: { recipeId: 'campfire', pos: [1, 2, 3], up: [0, 1, 0] }
    });

    expect(intent).toEqual({
      commandType: 'craft_campfire',
      payload: { recipeId: 'campfire', pos: [1, 2, 3], up: [0, 1, 0] }
    });
  });

  it('sends prediction hints through the same adapter', () => {
    const tx = transport('online');

    dispatchGameplayCommandWithTransport(() => accepted(), { multiplayer: { predict: true } }, tx);

    expect(tx.predictions).toBe(1);
    expect(tx.sent).toHaveLength(1);
  });

  it('blocks shared mutations while a co-op room is not connected', () => {
    const tx = transport('blocked');
    let ran = false;

    const result = dispatchGameplayCommandWithTransport(() => {
      ran = true;
      return accepted();
    }, {}, tx);

    expect(result.ok).toBe(false);
    expect(ran).toBe(false);
    expect(tx.sent).toEqual([]);
  });
});
