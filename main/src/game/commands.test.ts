import { describe, expect, it } from 'vitest';
import { CommandDispatcher, commandAccepted, dispatchCommand, registerCommandHandler } from './commands.ts';
import { createDomainEvent } from './events.ts';
import { createSimulationRng } from './rng.ts';
import { createWorldIdentity } from './worldIdentity.ts';

function testContext() {
  return {
    actorId: 'player-1',
    world: createWorldIdentity({ x: 0, y: 0 }),
    rng: createSimulationRng('cmd-test'),
    now: () => 123
  };
}

describe('command dispatcher', () => {
  it('dispatches registered commands and emits accepted events', () => {
    const dispatcher = new CommandDispatcher();
    const emitted: string[] = [];
    const context = { ...testContext(), emit: (event: { type: string }) => emitted.push(event.type) };
    dispatcher.register('test_command', command => commandAccepted(command, [
      createDomainEvent({
        eventId: 'evt_cmd',
        timeMs: context.now(),
        worldId: command.worldId,
        actorId: command.actorId,
        type: 'resource_taken',
        payload: { id: 'stone' }
      })
    ]));

    const result = dispatcher.dispatch({
      commandId: 'cmd_1',
      type: 'test_command',
      actorId: 'player-1',
      worldId: '0,0',
      payload: {}
    }, context);

    expect(result.ok).toBe(true);
    expect(emitted).toEqual(['resource_taken']);
  });

  it('rejects actor/world mismatches before handlers run', () => {
    const dispatcher = new CommandDispatcher();
    const context = testContext();

    expect(dispatcher.dispatch({
      commandId: 'cmd_actor',
      type: 'test_command',
      actorId: 'other',
      worldId: '0,0',
      payload: {}
    }, context)).toMatchObject({ ok: false, code: 'invalid_actor' });

    expect(dispatcher.dispatch({
      commandId: 'cmd_world',
      type: 'test_command',
      actorId: 'player-1',
      worldId: '9,9',
      payload: {}
    }, context)).toMatchObject({ ok: false, code: 'invalid_world' });
  });

  it('returns the cached result for idempotent retries', () => {
    const dispatcher = new CommandDispatcher();
    const context = testContext();
    let calls = 0;
    dispatcher.register('test_command', command => {
      calls++;
      return commandAccepted(command);
    });
    const command = {
      commandId: 'cmd_retry',
      type: 'test_command',
      actorId: 'player-1',
      worldId: '0,0',
      payload: {}
    };

    const first = dispatcher.dispatch(command, context);
    const second = dispatcher.dispatch(command, context);

    expect(first).toBe(second);
    expect(calls).toBe(1);
  });

  it('carries deltas and rollback data from accepted commands', () => {
    const dispatcher = new CommandDispatcher();
    const context = { ...testContext(), state: { inventory: 'test-accessor' } };
    dispatcher.register('predictable_command', command => commandAccepted(command, [], {
      deltas: [{ store: 'inventory', op: 'add', id: 'stone', qty: 1 }],
      rollback: [{ store: 'inventory', op: 'remove', id: 'stone', qty: 1 }]
    }));

    expect(dispatcher.dispatch({
      commandId: 'cmd_prediction',
      type: 'predictable_command',
      actorId: 'player-1',
      worldId: '0,0',
      payload: {}
    }, context)).toMatchObject({
      ok: true,
      deltas: [{ store: 'inventory', op: 'add', id: 'stone', qty: 1 }],
      rollback: [{ store: 'inventory', op: 'remove', id: 'stone', qty: 1 }]
    });
  });
});

describe('default command dispatcher', () => {
  it('supports in-process registration and dispatch', () => {
    const unregister = registerCommandHandler('default_test', command => commandAccepted(command));
    try {
      expect(dispatchCommand({
        commandId: 'cmd_default',
        type: 'default_test',
        actorId: 'player-1',
        worldId: '0,0',
        payload: {}
      }, testContext())).toMatchObject({ ok: true });
    } finally {
      unregister();
    }
  });
});
