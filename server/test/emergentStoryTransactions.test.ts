import { describe, expect, it } from 'vitest';
import { ECONOMY_CATALOG } from '../src/generated/economyCatalog.js';
import {
  defaultServerPlayerState,
  isServerAuthoritativeCommand,
  MAW_POND_OBSERVATION_MIN_MS,
  MAW_POSE_MAX_AGE_MS,
  MAW_PURPOSE_GAP_MIN_MS,
  resolveServerCanonicalCommandPayload,
  resolveServerAuthoritativeCommand,
  type AuthoritativeCommandResolution,
  type ServerPlayerState
} from '../src/economyAuthority.js';

const WORLD_ID = '0,0';

describe('authoritative emergent story transactions', () => {
  it('adopts the party-owned flight-ready Kestrel into one actor founding reserve', () => {
    const state = defaultServerPlayerState();
    expect(resolveServerAuthoritativeCommand(
      'kestrel_founding_reserve_claimed',
      {},
      state,
      { commandId: 'founding:wrong-world', worldId: WORLD_ID }
    )).toEqual({
      code: 'validation_failed',
      reason: 'The founding reserve follows the Kestrel to Tidegarden.'
    });
    expect(resolveServerAuthoritativeCommand(
      'kestrel_founding_reserve_claimed',
      {},
      state,
      { commandId: 'founding:unearned', worldId: '-1,-1:p1' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'The founding reserve requires an authoritative flight-ready Kestrel.'
    });

    const accepted = requireAccepted(resolveServerAuthoritativeCommand(
      'kestrel_founding_reserve_claimed',
      { reserveId: 'forged' },
      state,
      {
        commandId: 'founding:claim',
        worldId: '-1,-1:p1',
        sharedShipRepairStage: 'flight_ready'
      }
    ));
    expect(accepted.credit).toEqual(ECONOMY_CATALOG.storyTransactions.kestrelFoundingReserve);
    expect(accepted.events).toEqual([{
      type: 'kestrel_founding_reserve_claimed',
      payload: {
        reserveId: 'tidegarden-founding-loadout',
        outputs: ECONOMY_CATALOG.storyTransactions.kestrelFoundingReserve
      }
    }]);
    expect(accepted.playerStatePatch?.progression?.milestones).toContain(
      'story:kestrel:founding-reserve-claimed'
    );
    expect(accepted.playerStatePatch?.progression?.milestones).toEqual(expect.arrayContaining(
      ECONOMY_CATALOG.storyTransactions.shipRepairStages.map(
        transaction => `ship_repair:${transaction.stage}`
      )
    ));
    const migrated = withProgression(state, accepted);
    expect(requireAccepted(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'habitat_core' },
      migrated,
      { commandId: 'founding:core', worldId: '-1,-1:p1' }
    )).credit).toEqual([{ id: 'habitat_core', qty: 1 }]);
  });

  it('authorizes staged component knowledge from the party-owned Kestrel', () => {
    const novice = defaultServerPlayerState();
    expect(requireAccepted(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'lift_cell' },
      novice,
      { commandId: 'shared:lift', worldId: WORLD_ID, sharedShipRepairStage: 'hull_sealed' }
    )).credit).toEqual([{ id: 'lift_cell', qty: 1 }]);
    expect(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'logic_wafer' },
      novice,
      { commandId: 'shared:wafer:early', worldId: WORLD_ID, sharedShipRepairStage: 'hull_sealed' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'logic_wafer knowledge requires ship repair stage lift_online.'
    });
    expect(requireAccepted(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'logic_wafer' },
      novice,
      { commandId: 'shared:wafer', worldId: WORLD_ID, sharedShipRepairStage: 'lift_online' }
    )).credit).toEqual([{ id: 'logic_wafer', qty: 1 }]);
  });

  it('crafts the canonical Habitat Core once and permits only its exact replay', () => {
    const context = { commandId: 'story:habitat-core:craft', worldId: '-1,-1:p1' };
    const flightReady = flightReadyPlayerState();
    expect(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'habitat_core' },
      defaultServerPlayerState(),
      context
    )).toEqual({
      code: 'validation_failed',
      reason: 'habitat_core knowledge requires ship repair stage flight_ready.'
    });
    const first = requireAccepted(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      {
        recipeId: 'habitat_core',
        inputs: [{ id: 'stone', qty: 1 }],
        outputs: [{ id: 'habitat_core', qty: 99 }]
      },
      flightReady,
      context
    ));
    expect(first.debit).toEqual(ECONOMY_CATALOG.recipes.find(
      recipe => recipe.id === 'habitat_core'
    )?.inputs);
    expect(first.credit).toEqual([{ id: 'habitat_core', qty: 1 }]);
    const after = withProgression(flightReady, first);
    expect(after.progression.milestones).toContain('story:item:habitat-core:crafted');

    const replay = requireAccepted(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'habitat_core' },
      after,
      context
    ));
    expect(replay.playerStatePatch?.progression).toEqual(after.progression);

    expect(resolveServerAuthoritativeCommand(
      'recipe_crafted',
      { recipeId: 'habitat_core' },
      after,
      { commandId: 'story:habitat-core:duplicate', worldId: '-1,-1:p1' }
    )).toEqual({ code: 'validation_failed', reason: 'Unique recipe was already crafted.' });
  });

  it('requires the canonical origin-world Maw ritual receipt and server-observed attendance', () => {
    const playerState = defaultServerPlayerState();
    const beginCommandId = 'story:maw-repair:ritual-begun';
    const repairCommandId = 'story:maw-repair';

    expect(isServerAuthoritativeCommand('maw_repair_begun')).toBe(true);
    expect(resolveServerAuthoritativeCommand(
      'maw_repair_begun',
      {},
      playerState,
      { commandId: beginCommandId, worldId: WORLD_ID, playerId: 'alice', serverTimeMs: 1_000 }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw repair ritual belongs to the origin world.'
    });
    expect(resolveServerAuthoritativeCommand(
      'maw_repaired',
      { ritualBeginCommandId: beginCommandId },
      playerState,
      {
        commandId: repairCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 9_000,
        worldEvents: []
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw repair requires an accepted ritual-begun receipt.'
    });

    const begun = requireAccepted(resolveServerAuthoritativeCommand(
      'maw_repair_begun',
      { elapsedMs: 999_999 },
      playerState,
      {
        commandId: beginCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 1_000,
        worldEvents: []
      }
    ));
    expect(begun.commandPayload).toEqual({});
    expect(begun.events).toEqual([{
      type: 'maw_repair_begun',
      payload: { ritualBeginCommandId: beginCommandId, ritualSeconds: 8 }
    }]);
    const worldEvents = [{
      type: 'maw_repair_begun',
      commandId: beginCommandId,
      playerId: 'alice',
      timeMs: 1_000,
      payload: { ritualBeginCommandId: beginCommandId, ritualSeconds: 8 }
    }];
    const completionContext = {
      commandId: repairCommandId,
      worldId: '-1,-1',
      playerId: 'alice',
      serverTimeMs: 8_999,
      worldEvents
    };
    expect(resolveServerAuthoritativeCommand(
      'maw_repaired',
      { ritualBeginCommandId: beginCommandId, elapsedMs: 999_999 },
      playerState,
      completionContext
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw repair ritual attendance is not complete.'
    });
    expect(resolveServerAuthoritativeCommand(
      'maw_repaired',
      { ritualBeginCommandId: beginCommandId },
      playerState,
      { ...completionContext, worldId: '0,0', serverTimeMs: 9_000 }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw repair belongs to the origin world.'
    });

    const resolution = requireAccepted(resolveServerAuthoritativeCommand(
      'maw_repaired',
      {
        ritualBeginCommandId: beginCommandId,
        elapsedMs: 0,
        inputs: [{ id: 'stone', qty: 1 }],
        outputs: [{ id: 'void_maw', qty: 999 }]
      },
      playerState,
      { ...completionContext, serverTimeMs: 9_000 }
    ));

    expect(resolution.commandPayload).toEqual({ ritualBeginCommandId: beginCommandId });
    expect(resolution.debit).toEqual(ECONOMY_CATALOG.storyTransactions.mawRepair.inputs);
    expect(resolution.credit).toEqual(ECONOMY_CATALOG.storyTransactions.mawRepair.outputs);
    expect(resolution.events).toEqual([{
      type: 'maw_repaired',
      payload: { ritualBeginCommandId: beginCommandId, minimumAttendanceMs: 8_000 }
    }]);

    const after = withProgression(playerState, resolution);
    expect(resolveServerAuthoritativeCommand(
      'maw_repaired',
      { ritualBeginCommandId: beginCommandId },
      after,
      { ...completionContext, serverTimeMs: 12_000 }
    )).toEqual(resolution);
  });

  it('orders Maw direction and pond receipts by actor, server time, safe mine proof, and fresh pose', () => {
    const repairCommandId = 'maw:repair';
    const directionCommandId = 'maw:direction';
    const pondBeginCommandId = 'maw:pond:begin';
    const pondCommandId = 'maw:pond:complete';
    let state: ServerPlayerState = {
      ...defaultServerPlayerState(),
      progression: { era: 'emergent', milestones: ['maw_repaired'] }
    };
    const repairEvent = {
      type: 'maw_repaired',
      commandId: repairCommandId,
      playerId: 'alice',
      timeMs: 1_000,
      payload: { ritualBeginCommandId: 'maw:repair:begun', minimumAttendanceMs: 8_000 }
    };

    expect(resolveServerCanonicalCommandPayload('voxel_mined', {
      coord: [0, 0, 0],
      blockId: 'stone',
      toolId: 'iron_maw'
    }, { worldId: '-1,-1' })).toMatchObject({
      commandPayload: { blockId: 'stone', toolId: 'iron_maw' }
    });
    expect(resolveServerCanonicalCommandPayload('voxel_mined', {
      coord: [0, 0, 0],
      blockId: 'stone',
      toolId: 'forged_void_maw'
    }, { worldId: '-1,-1' })).toMatchObject({
      commandPayload: { blockId: 'stone', toolId: null }
    });

    expect(isServerAuthoritativeCommand('maw_first_direction_resolved')).toBe(true);
    expect(isServerAuthoritativeCommand('maw_pond_observation_begun')).toBe(true);
    expect(isServerAuthoritativeCommand('maw_pond_resonance_observed')).toBe(true);
    expect(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'lowered-and-listened' },
      state,
      {
        commandId: directionCommandId,
        worldId: '0,0',
        playerId: 'alice',
        serverTimeMs: 30_000,
        worldEvents: [repairEvent]
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw first direction belongs to the origin world.'
    });
    expect(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'lowered-and-listened' },
      state,
      {
        commandId: directionCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 1_000 + MAW_PURPOSE_GAP_MIN_MS - 1,
        worldEvents: [repairEvent]
      }
    )).toEqual({ code: 'validation_failed', reason: 'Maw purpose gap is not complete.' });

    expect(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'harmless-test', elapsedMs: 999_999 },
      state,
      {
        commandId: directionCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_000,
        worldEvents: [repairEvent, {
          type: 'voxel_mined',
          commandId: 'maw:forged-test',
          playerId: 'alice',
          timeMs: 3_000,
          payload: { blockId: 'lava', toolId: 'iron_maw' }
        }]
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw harmless test requires an accepted safe-block mine receipt from the repaired Maw.'
    });

    expect(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'harmless-test' },
      state,
      {
        commandId: directionCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_000,
        worldEvents: [repairEvent, {
          type: 'voxel_mined',
          commandId: 'bob:safe-test',
          playerId: 'bob',
          timeMs: 3_000,
          payload: { blockId: 'stone', toolId: 'iron_maw' }
        }]
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw harmless test requires an accepted safe-block mine receipt from the repaired Maw.'
    });

    const mineEvent = {
      type: 'voxel_mined',
      commandId: 'maw:safe-test',
      playerId: 'alice',
      timeMs: 3_000,
      payload: { blockId: 'stone', toolId: 'iron_maw' }
    };
    const direction = requireAccepted(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'harmless-test', elapsedMs: 0, targetKind: 'lava' },
      state,
      {
        commandId: directionCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_000,
        worldEvents: [repairEvent, mineEvent]
      }
    ));
    expect(direction.commandPayload).toEqual({ choice: 'harmless-test' });
    expect(direction.events).toEqual([{
      type: 'maw_first_direction_resolved',
      payload: {
        choice: 'harmless-test',
        repairCommandId,
        proofCommandId: 'maw:safe-test',
        targetKind: 'stone',
        minimumPurposeGapMs: MAW_PURPOSE_GAP_MIN_MS
      }
    }]);
    state = withProgression(state, direction);
    expect(state.progression.milestones).toEqual(expect.arrayContaining([
      'story:maw:first-direction-resolved',
      'story:maw:first-direction:harmless-test'
    ]));
    const directionEvent = {
      type: 'maw_first_direction_resolved',
      commandId: directionCommandId,
      playerId: 'alice',
      timeMs: 3_000,
      payload: direction.events[0]!.payload
    };
    expect(requireAccepted(resolveServerAuthoritativeCommand(
      'maw_first_direction_resolved',
      { choice: 'harmless-test' },
      state,
      {
        commandId: directionCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 30_000,
        worldEvents: [repairEvent, mineEvent, directionEvent]
      }
    )).events).toEqual(direction.events);

    expect(resolveServerAuthoritativeCommand(
      'maw_pond_observation_begun',
      { visible: true, elapsedMs: 999_999 },
      state,
      {
        commandId: pondBeginCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_100,
        worldEvents: [repairEvent, mineEvent, directionEvent]
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw pond observation requires a fresh authenticated pose.'
    });
    expect(resolveServerAuthoritativeCommand(
      'maw_pond_observation_begun',
      {},
      state,
      {
        commandId: pondBeginCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_100,
        worldEvents: [repairEvent, mineEvent, directionEvent],
        authenticatedPose: {
          playerId: 'alice',
          worldId: '-1,-1',
          seq: 10,
          receivedAtMs: 3_100 - MAW_POSE_MAX_AGE_MS - 1
        }
      }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Maw pond observation requires a fresh authenticated pose.'
    });

    const pondBegin = requireAccepted(resolveServerAuthoritativeCommand(
      'maw_pond_observation_begun',
      { visible: true, cameraAlignment: 1, elapsedMs: 999_999 },
      state,
      {
        commandId: pondBeginCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_100,
        worldEvents: [repairEvent, mineEvent, directionEvent],
        authenticatedPose: {
          playerId: 'alice',
          worldId: '-1,-1',
          seq: 10,
          receivedAtMs: 3_099
        }
      }
    ));
    expect(pondBegin.commandPayload).toEqual({});
    expect(pondBegin.events).toEqual([{
      type: 'maw_pond_observation_begun',
      payload: {
        observationBeginCommandId: pondBeginCommandId,
        directionCommandId,
        poseSeq: 10,
        maximumPoseAgeMs: MAW_POSE_MAX_AGE_MS,
        minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
        physicalProximityCertified: false
      }
    }]);
    const pondBeginEvent = {
      type: 'maw_pond_observation_begun',
      commandId: pondBeginCommandId,
      playerId: 'alice',
      timeMs: 3_100,
      payload: pondBegin.events[0]!.payload
    };
    expect(resolveServerAuthoritativeCommand(
      'maw_pond_resonance_observed',
      { observationBeginCommandId: pondBeginCommandId, elapsedMs: 999_999 },
      state,
      {
        commandId: pondCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_100 + MAW_POND_OBSERVATION_MIN_MS - 1,
        worldEvents: [repairEvent, mineEvent, directionEvent, pondBeginEvent],
        authenticatedPose: {
          playerId: 'alice',
          worldId: '-1,-1',
          seq: 11,
          receivedAtMs: 3_200
        }
      }
    )).toEqual({ code: 'validation_failed', reason: 'Maw pond observation hold is not complete.' });

    const pond = requireAccepted(resolveServerAuthoritativeCommand(
      'maw_pond_resonance_observed',
      {
        observationBeginCommandId: pondBeginCommandId,
        elapsedMs: 0,
        playerAtShore: true,
        cameraAlignment: 1
      },
      state,
      {
        commandId: pondCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 3_100 + MAW_POND_OBSERVATION_MIN_MS,
        worldEvents: [repairEvent, mineEvent, directionEvent, pondBeginEvent],
        authenticatedPose: {
          playerId: 'alice',
          worldId: '-1,-1',
          seq: 12,
          receivedAtMs: 3_100 + MAW_POND_OBSERVATION_MIN_MS
        }
      }
    ));
    expect(pond.commandPayload).toEqual({ observationBeginCommandId: pondBeginCommandId });
    expect(pond.events).toEqual([{
      type: 'maw_pond_resonance_observed',
      payload: {
        observationBeginCommandId: pondBeginCommandId,
        directionCommandId,
        beginPoseSeq: 10,
        completionPoseSeq: 12,
        minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
        physicalProximityCertified: false
      }
    }]);
    state = withProgression(state, pond);
    expect(state.progression.milestones).toContain('story:maw:pond-resonance-visible');

    const pondEvent = {
      type: 'maw_pond_resonance_observed',
      commandId: pondCommandId,
      playerId: 'alice',
      timeMs: 3_650,
      payload: pond.events[0]!.payload
    };
    expect(requireAccepted(resolveServerAuthoritativeCommand(
      'maw_pond_resonance_observed',
      { observationBeginCommandId: pondBeginCommandId },
      state,
      {
        commandId: pondCommandId,
        worldId: '-1,-1',
        playerId: 'alice',
        serverTimeMs: 30_000,
        worldEvents: [repairEvent, mineEvent, directionEvent, pondBeginEvent, pondEvent]
      }
    )).events).toEqual(pond.events);
  });

  it('persists one server-accepted Tidegarden site before foundation authority', () => {
    let state = defaultServerPlayerState();
    const relationship = requireAccepted(resolveServerAuthoritativeCommand(
      'tidegarden_relationship_attended',
      {
        relationshipId: 'tideline-root-water-exchange',
        waterDepth: 2
      },
      state,
      {
        commandId: 'story:tidegarden:relationship',
        worldId: '-1,-1:p1',
        playerId: 'alice'
      }
    ));
    state = withProgression(state, relationship);
    const context = {
      commandId: 'story:tidegarden:site',
      worldId: '-1,-1:p1',
      playerId: 'alice',
      worldEvents: [{
        type: 'tidegarden_relationship_attended',
        payload: { relationshipId: 'tideline-root-water-exchange' },
        playerId: 'alice'
      }]
    };
    expect(resolveServerAuthoritativeCommand(
      'tidegarden_site_chosen',
      {
        worldId: '-1,-1:p1',
        cell: [4, 25, -4],
        supportCell: [4, 24, -4],
        up: [0, 1, 0]
      },
      state,
      { ...context, commandId: 'story:tidegarden:site:forged', playerId: 'bob' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Attend a Tidegarden relationship before choosing a site.'
    });
    const accepted = requireAccepted(resolveServerAuthoritativeCommand(
      'tidegarden_site_chosen',
      {
        worldId: '-1,-1:p1',
        cell: [4, 25, -4],
        supportCell: [4, 24, -4],
        up: [0, 1, 0]
      },
      state,
      context
    ));
    expect(accepted.events).toEqual([{
      type: 'tidegarden_site_chosen',
      payload: {
        worldId: '-1,-1:p1',
        cell: [4, 25, -4],
        supportCell: [4, 24, -4],
        up: [0, 1, 0]
      }
    }]);
    const progressed = withProgression(state, accepted);
    expect(progressed.progression.milestones).toContain(
      'story:tidegarden:site-chosen:v1:4,25,-4|4,24,-4|0,1,0'
    );
    expect(resolveServerAuthoritativeCommand(
      'tidegarden_site_chosen',
      {
        worldId: '-1,-1:p1',
        cell: [5, 25, -4],
        supportCell: [5, 24, -4],
        up: [0, 1, 0]
      },
      progressed,
      { ...context, commandId: 'story:tidegarden:site:second' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'A different Tidegarden site was already chosen.'
    });
  });

  it('rejects unknown, skipped, and repeated ship stages', () => {
    expect(isServerAuthoritativeCommand('ship_repair_stage')).toBe(true);
    expect(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: 'range_coil_online' },
      defaultServerPlayerState(),
      { commandId: 'unknown', worldId: WORLD_ID }
    )).toEqual({ code: 'validation_failed', reason: 'Unknown ship repair stage.' });

    expect(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: 'frame_restored' },
      defaultServerPlayerState(),
      { commandId: 'skip-bench', worldId: WORLD_ID }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Ship repair stage must advance from wrecked to bench_online.'
    });

    const bench = requireAccepted(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: 'bench_online' },
      defaultServerPlayerState(),
      { commandId: 'repair:bench', worldId: WORLD_ID }
    ));
    const afterBench = withProgression(defaultServerPlayerState(), bench);
    expect(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: 'bench_online' },
      afterBench,
      { commandId: 'repeat-with-new-id', worldId: WORLD_ID }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Ship repair stage must advance from bench_online to frame_restored.'
    });
  });

  it('canonicalizes every stage BOM and keeps exact replays free of progression drift', () => {
    let state = defaultServerPlayerState();
    const committed: Array<{
      stage: (typeof ECONOMY_CATALOG.storyTransactions.shipRepairStages)[number]['stage'];
      commandId: string;
    }> = [];

    for (const [index, transaction] of ECONOMY_CATALOG.storyTransactions.shipRepairStages.entries()) {
      const commandId = `story:ship-repair:${transaction.stage}`;
      const context = { commandId, worldId: WORLD_ID };
      const resolution = requireAccepted(resolveServerAuthoritativeCommand(
        'ship_repair_stage',
        {
          stage: transaction.stage,
          from: 'flight_ready',
          inputs: [{ id: 'stone', qty: 1 }],
          costs: [{ id: 'void_glass', qty: 999 }],
          outputs: [{ id: 'range_coil', qty: 999 }]
        },
        state,
        context
      ));
      const expectedFrom = index === 0
        ? 'wrecked'
        : ECONOMY_CATALOG.storyTransactions.shipRepairStages[index - 1]!.stage;

      expect(resolution.commandPayload).toEqual({ stage: transaction.stage });
      expect(resolution.debit).toEqual(transaction.inputs);
      expect(resolution.credit).toEqual([]);
      expect(resolution.events).toEqual([{
        type: 'ship_repair_stage',
        payload: { from: expectedFrom, to: transaction.stage }
      }]);

      state = withProgression(state, resolution);
      committed.push({ stage: transaction.stage, commandId });

      const immediateReplay = requireAccepted(resolveServerAuthoritativeCommand(
        'ship_repair_stage',
        { stage: transaction.stage, inputs: [{ id: 'void_core', qty: 999 }] },
        state,
        context
      ));
      expect(immediateReplay.commandPayload).toEqual(resolution.commandPayload);
      expect(immediateReplay.events).toEqual(resolution.events);
      expect(immediateReplay.playerStatePatch?.progression).toEqual(state.progression);
    }

    expect(state.progression.era).toBe('emergent');
    expect(state.progression.milestones).toContain('story:route:tidegarden:online');
    for (const { stage } of committed) {
      expect(state.progression.milestones).toContain(`ship_repair:${stage}`);
    }

    // Exact replay also migrates a flight-ready receipt written by an older
    // server that did not yet persist the route milestone.
    const flightReady = committed.at(-1)!;
    const legacyFlightReadyState = {
      ...state,
      progression: {
        ...state.progression,
        milestones: state.progression.milestones.filter(
          milestone => milestone !== 'story:route:tidegarden:online'
        )
      }
    };
    const migratedFlightReadyReplay = requireAccepted(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: flightReady.stage },
      legacyFlightReadyState,
      { commandId: flightReady.commandId, worldId: WORLD_ID }
    ));
    expect(migratedFlightReadyReplay.playerStatePatch?.progression?.milestones).toContain(
      'story:route:tidegarden:online'
    );

    const first = committed[0]!;
    const lateReplay = requireAccepted(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: first.stage },
      state,
      { commandId: first.commandId, worldId: WORLD_ID }
    ));
    expect(lateReplay.events).toEqual([{
      type: 'ship_repair_stage',
      payload: { from: 'wrecked', to: 'bench_online' }
    }]);
    expect(lateReplay.playerStatePatch?.progression).toEqual(state.progression);

    expect(resolveServerAuthoritativeCommand(
      'ship_repair_stage',
      { stage: first.stage },
      state,
      { commandId: first.commandId, worldId: '1,0' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Ship repair stage must advance from flight_ready; restoration is already complete.'
    });
  });
});

function requireAccepted(
  result: ReturnType<typeof resolveServerAuthoritativeCommand>
): AuthoritativeCommandResolution {
  expect(result).not.toBeNull();
  expect(result).not.toHaveProperty('code');
  if (!result || 'code' in result) throw new Error('Expected an accepted authoritative transaction.');
  return result;
}

function withProgression(
  state: ServerPlayerState,
  resolution: AuthoritativeCommandResolution
): ServerPlayerState {
  const progression = resolution.playerStatePatch?.progression;
  if (!progression) throw new Error('Story transaction did not provide a progression patch.');
  return { ...state, progression };
}

function flightReadyPlayerState(): ServerPlayerState {
  return {
    ...defaultServerPlayerState(),
    progression: {
      era: 'emergent',
      milestones: ECONOMY_CATALOG.storyTransactions.shipRepairStages.map(
        transaction => `ship_repair:${transaction.stage}`
      )
    }
  };
}
