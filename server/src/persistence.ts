import type { Database } from './neon.js';
import { sharedMutationClaimForCommand, type SharedMutationClaim } from './commandAuthority.js';
import {
  defaultServerPlayerState,
  inventoryCreditsForAcceptedCommand,
  starterInventory,
  type AuthoritativeCommandResolution,
  type AuthoritativeStructureClaim,
  type AuthoritativePlayerStatePatch,
  type ItemStack,
  type ServerPlayerState
} from './economyAuthority.js';
import type { PlayerIdentity } from './protocol.js';
import type { LoadedRoomState, RoomState, ShardEvent } from './rooms.js';
import { metadataForWorldId } from './worldIdentity.js';

interface EventRow {
  seq: string | number;
  event_id: string;
  command_id: string | null;
  actor_player_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at_ms: string | number;
}

interface RoomRow {
  room_id: string;
  invite_code: string;
  owner_player_id: string;
  created_at_ms: string | number;
}

interface PlayerRow {
  player_id: string;
  display_name: string | null;
}

interface PlayerStateRow {
  vitals: Record<string, unknown> | null;
  maw: Record<string, unknown> | null;
  waterskin: Record<string, unknown> | null;
}

interface WorldShardRow {
  world_id: string;
}

interface CommandLookupRow {
  command_id: string;
}

export class CommandReplayMismatchError extends Error {
  constructor(commandId: string) {
    super(`Command ${commandId} was already used for a different command envelope.`);
    this.name = 'CommandReplayMismatchError';
  }
}

export class CommandConflictError extends Error {
  constructor(commandId: string) {
    super(`Command ${commandId} conflicts with an already accepted world mutation.`);
    this.name = 'CommandConflictError';
  }
}

export class CommandInventoryError extends Error {
  constructor(commandId: string) {
    super(`Command ${commandId} could not be paid from the authoritative player inventory.`);
    this.name = 'CommandInventoryError';
  }
}

export class MultiplayerPersistence {
  constructor(private readonly database: Database) {}

  get configured(): boolean {
    return this.database.configured;
  }

  async persistRoom(room: RoomState): Promise<void> {
    if (!this.configured) return;
    const owner = room.members.get(room.ownerPlayerId) ?? { playerId: room.ownerPlayerId };
    await this.upsertPlayer(owner);
    await this.database.query(
      `
        insert into rooms (room_id, invite_code, owner_player_id, created_at)
        values ($1::uuid, $2, $3, to_timestamp($4 / 1000.0))
        on conflict (room_id) do update
        set invite_code = excluded.invite_code,
            owner_player_id = excluded.owner_player_id
      `,
      [room.roomId, room.inviteCode, room.ownerPlayerId, room.createdAtMs]
    );

    for (const member of room.members.values()) {
      await this.persistRoomMember(room, member);
    }
    for (const worldId of room.shards.keys()) {
      await this.ensureWorldShard(room.roomId, worldId);
    }
  }

  async persistRoomMember(room: RoomState, player: PlayerIdentity): Promise<void> {
    if (!this.configured) return;
    await this.upsertPlayer(player);
    await this.database.query(
      `
        insert into room_members (room_id, player_id)
        values ($1::uuid, $2)
        on conflict (room_id, player_id) do nothing
      `,
      [room.roomId, player.playerId]
    );
  }

  async loadRoomByInvite(inviteCode: string): Promise<LoadedRoomState | null> {
    if (!this.configured) return null;
    const rooms = await this.database.query<RoomRow>(
      `
        select room_id::text, invite_code, owner_player_id,
               floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms
        from rooms
        where invite_code = $1
        limit 1
      `,
      [inviteCode]
    );
    const room = rooms[0];
    if (!room) return null;

    const members = await this.database.query<PlayerRow>(
      `
        select players.player_id, players.display_name
        from room_members
        join players on players.player_id = room_members.player_id
        where room_members.room_id = $1::uuid
        order by room_members.joined_at asc
      `,
      [room.room_id]
    );
    const shards = await this.database.query<WorldShardRow>(
      `
        select world_id
        from world_shards
        where room_id = $1::uuid
        order by updated_at desc, created_at desc
      `,
      [room.room_id]
    );
    const worldIds = shards.map(shard => shard.world_id);

    return {
      roomId: room.room_id,
      inviteCode: room.invite_code,
      ownerPlayerId: room.owner_player_id,
      createdAtMs: toNumber(room.created_at_ms),
      activeWorldId: worldIds[0],
      members: members.map(member => ({
        playerId: member.player_id,
        ...(member.display_name ? { displayName: member.display_name } : {})
      })),
      worldIds
    };
  }

  async activateWorldShard(room: RoomState, worldId: string): Promise<void> {
    if (!this.configured) return;
    await this.ensureWorldShard(room.roomId, worldId);
    await this.database.query(
      `
        update world_shards
        set updated_at = now()
        where room_id = $1::uuid
          and world_id = $2
      `,
      [room.roomId, metadataForWorldId(worldId).worldId]
    );
  }

  async loadPlayerState(playerId: string): Promise<ServerPlayerState> {
    if (!this.configured) return defaultServerPlayerState();
    const rows = await this.database.query<PlayerStateRow>(
      `
        select vitals, maw, waterskin
        from player_state
        where player_id = $1
        limit 1
      `,
      [playerId]
    );
    return rowToPlayerState(rows[0]);
  }

  async appendCommandEvent(input: {
    room: RoomState;
    worldId: string;
    actor: PlayerIdentity;
    commandId: string;
    commandType: string;
    payload: Record<string, unknown>;
  }): Promise<ShardEvent> {
    if (!this.configured) {
      throw new Error('DATABASE_URL is not configured.');
    }

    await this.persistRoom(input.room);
    await this.persistRoomMember(input.room, input.actor);
    await this.ensureWorldShard(input.room.roomId, input.worldId);

    const claim = sharedMutationClaimForCommand(input.commandType, input.payload);
    if (claim) return this.appendClaimedCommandEvent(input, claim);
    return this.appendUnclaimedCommandEvent(input);
  }

  async appendAuthoritativeCommandEvents(input: {
    room: RoomState;
    worldId: string;
    actor: PlayerIdentity;
    commandId: string;
    commandType: string;
    resolution: AuthoritativeCommandResolution;
  }): Promise<ShardEvent[]> {
    if (!this.configured) {
      throw new Error('DATABASE_URL is not configured.');
    }

    await this.persistRoom(input.room);
    await this.persistRoomMember(input.room, input.actor);
    await this.ensureWorldShard(input.room.roomId, input.worldId);

    const eventCount = input.resolution.events.length;
    if (eventCount <= 0) throw new Error(`Command ${input.commandId} did not resolve any events.`);
    const debit = toSqlStacks(input.resolution.debit);
    const credit = toSqlStacks(input.resolution.credit);
    const structureClaims = toSqlStructureClaims(input.resolution.structureClaims);
    const statePatch = toPlayerStatePatchSql(input.resolution.playerStatePatch);
    const defaultState = defaultServerPlayerState();

    const rows = await this.database.query<EventRow>(
      `
        with existing_command as (
          select command_id
          from world_commands
          where room_id = $1::uuid
            and world_id = $2
            and command_id = $3
          limit 1
        ),
        matching_events as (
          select world_events.seq, world_events.event_id, world_events.command_id,
                 world_events.actor_player_id, world_events.type, world_events.payload,
                 floor(extract(epoch from world_events.created_at) * 1000)::bigint as created_at_ms
          from world_events
          join world_commands
            on world_commands.room_id = world_events.room_id
           and world_commands.world_id = world_events.world_id
           and world_commands.command_id = world_events.command_id
          where world_events.room_id = $1::uuid
            and world_events.world_id = $2
            and world_events.command_id = $3
            and world_commands.actor_player_id = $4
            and world_commands.command_type = $5
            and world_commands.payload = $6::jsonb
          order by world_events.seq asc
        ),
        required_items as (
          select item_id, qty
          from jsonb_to_recordset($9::jsonb) as stack(item_id text, qty integer)
        ),
        missing_debit as (
          select 1
          from required_items
          left join player_inventory
            on player_inventory.player_id = $4
           and player_inventory.item_id = required_items.item_id
          where coalesce(player_inventory.qty, 0) < required_items.qty
          limit 1
        ),
        campfire_claim as (
          insert into world_campfires (
            room_id, world_id, campfire_id, owner_player_id, placed_by_player_id,
            position, up, state
          )
          select $1::uuid, $2, $11, $4, $4, $12::double precision[], $13::double precision[], $14::jsonb
          where $11::text is not null
            and not exists (select 1 from existing_command)
            and not exists (select 1 from missing_debit)
          on conflict do nothing
          returning 1
        ),
        campfire_ready as (
          select 1
          where $11::text is null
             or exists (select 1 from campfire_claim)
        ),
        structure_claims as (
          select mode, structure_id, required_structure_id, cell, face, type, material, state
          from jsonb_to_recordset($22::jsonb) as claim(
            mode text,
            structure_id text,
            required_structure_id text,
            cell integer[],
            face integer,
            type text,
            material text,
            state jsonb
          )
        ),
        inserted_structure_claims as (
          insert into world_structures (
            room_id, world_id, structure_id, owner_player_id, placed_by_player_id,
            cell, face, type, material, state
          )
          select $1::uuid, $2, structure_id, $4, $4, cell, face, type, material, state
          from structure_claims
          where mode = 'insert'
            and not exists (select 1 from existing_command)
            and not exists (select 1 from missing_debit)
          on conflict do nothing
          returning structure_id
        ),
        inserted_door_leaf_claims as (
          insert into world_structures (
            room_id, world_id, structure_id, owner_player_id, placed_by_player_id,
            cell, face, type, material, state
          )
          select $1::uuid, $2, claim.structure_id, existing.owner_player_id, $4,
                 claim.cell, claim.face, claim.type, claim.material, claim.state
          from structure_claims claim
          join world_structures existing
            on existing.room_id = $1::uuid
           and existing.world_id = $2
           and existing.structure_id = claim.required_structure_id
           and existing.type = 'doorway'
          where claim.mode = 'door_leaf'
            and not exists (select 1 from existing_command)
            and not exists (select 1 from missing_debit)
          on conflict do nothing
          returning structure_id
        ),
        structure_ready as (
          select 1
          where (select count(*) from structure_claims) = (
            (select count(*) from inserted_structure_claims)
            + (select count(*) from inserted_door_leaf_claims)
          )
        ),
        inserted_command as (
          insert into world_commands (
            room_id, world_id, command_id, actor_player_id, command_type, payload, status
          )
          select $1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending'
          where not exists (select 1 from existing_command)
            and not exists (select 1 from missing_debit)
            and exists (select 1 from campfire_ready)
            and exists (select 1 from structure_ready)
          on conflict (room_id, world_id, command_id) do nothing
          returning command_id
        ),
        debited as (
          update player_inventory
          set qty = player_inventory.qty - required_items.qty,
              updated_at = now()
          from required_items
          where player_inventory.player_id = $4
            and player_inventory.item_id = required_items.item_id
            and exists (select 1 from inserted_command)
          returning player_inventory.item_id
        ),
        deleted_zero as (
          delete from player_inventory
          where player_id = $4
            and qty = 0
            and exists (select 1 from inserted_command)
          returning item_id
        ),
        credit_items as (
          select item_id, qty
          from jsonb_to_recordset($10::jsonb) as stack(item_id text, qty integer)
        ),
        credited as (
          insert into player_inventory (player_id, item_id, qty, updated_at)
          select $4, item_id, qty, now()
          from credit_items
          where exists (select 1 from inserted_command)
          on conflict (player_id, item_id) do update
          set qty = player_inventory.qty + excluded.qty,
              updated_at = now()
          returning item_id
        ),
        player_state_update as (
          insert into player_state (player_id, vitals, maw, waterskin, updated_at)
          select $4,
                 coalesce($15::jsonb, $19::jsonb),
                 coalesce($16::jsonb, $20::jsonb),
                 coalesce($17::jsonb, $21::jsonb),
                 now()
          where $18::boolean
            and exists (select 1 from inserted_command)
          on conflict (player_id) do update
          set vitals = case
                when $15::jsonb is null then player_state.vitals
                else excluded.vitals
              end,
              maw = case
                when $16::jsonb is null then player_state.maw
                else excluded.maw
              end,
              waterskin = case
                when $17::jsonb is null then player_state.waterskin
                else excluded.waterskin
              end,
              updated_at = now()
          returning player_id
        ),
        next_seq as (
          update world_shards
          set seq = seq + $8::integer,
              updated_at = now()
          where room_id = $1::uuid
            and world_id = $2
            and exists (select 1 from inserted_command)
          returning seq
        ),
        event_rows as (
          select
            event.value->>'type' as type,
            event.value->'payload' as payload,
            event.ordinality
          from jsonb_array_elements($7::jsonb) with ordinality as event(value, ordinality)
        ),
        inserted_event as (
          insert into world_events (
            room_id, world_id, seq, event_id, command_id, actor_player_id, type, payload
          )
          select $1::uuid,
                 $2,
                 next_seq.seq - $8::integer + event_rows.ordinality,
                 $3 || ':' || (event_rows.ordinality - 1),
                 $3,
                 $4,
                 event_rows.type,
                 event_rows.payload
          from next_seq
          cross join event_rows
          returning seq, event_id, command_id, actor_player_id, type, payload,
                    floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms
        ),
        finalized_command as (
          update world_commands
          set first_seq = (select min(seq) from inserted_event),
              event_count = $8::integer,
              status = 'accepted',
              updated_at = now()
          where world_commands.room_id = $1::uuid
            and world_commands.world_id = $2
            and world_commands.command_id = $3
            and exists (select 1 from inserted_event)
          returning world_commands.command_id
        )
        select seq, event_id, command_id, actor_player_id, type, payload, created_at_ms
        from inserted_event
        union all
        select seq, event_id, command_id, actor_player_id, type, payload, created_at_ms
        from matching_events
        order by seq asc
      `,
      [
        input.room.roomId,
        input.worldId,
        input.commandId,
        input.actor.playerId,
        input.commandType,
        JSON.stringify(input.resolution.commandPayload),
        JSON.stringify(input.resolution.events),
        eventCount,
        JSON.stringify(debit),
        JSON.stringify(credit),
        input.resolution.campfireClaim?.campfireId ?? null,
        input.resolution.campfireClaim?.position ?? null,
        input.resolution.campfireClaim?.up ?? null,
        JSON.stringify(input.resolution.campfireClaim?.state ?? {}),
        statePatch.vitals,
        statePatch.maw,
        statePatch.waterskin,
        statePatch.hasPatch,
        JSON.stringify({ ...defaultState.vitals, exhausted: defaultState.exhausted }),
        JSON.stringify({ charge: defaultState.mawCharge }),
        JSON.stringify({ fill: defaultState.waterskinFill }),
        JSON.stringify(structureClaims)
      ]
    );

    const found = rows.length > 0
      ? rows
      : await this.loadMatchingCommandEvents(
        input.room.roomId,
        input.worldId,
        input.commandId,
        input.actor.playerId,
        input.commandType,
        input.resolution.commandPayload
      );
    if (found.length > 0) return found.map(rowToShardEvent);
    if (await this.hasCommand(input.room.roomId, input.worldId, input.commandId)) {
      throw new CommandReplayMismatchError(input.commandId);
    }
    if (
      input.resolution.campfireClaim
      && await this.hasCampfire(input.room.roomId, input.worldId, input.resolution.campfireClaim.campfireId)
    ) {
      throw new CommandConflictError(input.commandId);
    }
    if (
      input.resolution.structureClaims?.length
      && await this.hasStructureClaimConflict(input.room.roomId, input.worldId, input.resolution.structureClaims)
    ) {
      throw new CommandConflictError(input.commandId);
    }
    throw new CommandInventoryError(input.commandId);
  }

  private async appendUnclaimedCommandEvent(input: {
    room: RoomState;
    worldId: string;
    actor: PlayerIdentity;
    commandId: string;
    commandType: string;
    payload: Record<string, unknown>;
  }): Promise<ShardEvent> {
    const eventId = `${input.commandId}:0`;
    const credit = toSqlStacks(inventoryCreditsForAcceptedCommand(input.commandType, input.payload));
    const rows = await this.database.query<EventRow>(
      `
        with inserted_command as (
          insert into world_commands (
            room_id, world_id, command_id, actor_player_id, command_type, payload, status
          )
          values ($1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending')
          on conflict (room_id, world_id, command_id) do nothing
          returning command_id
        ),
        inventory_credit as (
          insert into player_inventory (player_id, item_id, qty, updated_at)
          select $4, item_id, qty, now()
          from jsonb_to_recordset($8::jsonb) as stack(item_id text, qty integer)
          where exists (select 1 from inserted_command)
          on conflict (player_id, item_id) do update
          set qty = player_inventory.qty + excluded.qty,
              updated_at = now()
          returning item_id
        ),
        next_seq as (
          update world_shards
          set seq = seq + 1,
              updated_at = now()
          where room_id = $1::uuid
            and world_id = $2
            and exists (select 1 from inserted_command)
          returning seq
        ),
        inserted_event as (
          insert into world_events (
            room_id, world_id, seq, event_id, command_id, actor_player_id, type, payload
          )
          select $1::uuid, $2, next_seq.seq, $7, $3, $4, $5, $6::jsonb
          from next_seq
          returning seq, event_id, command_id, actor_player_id, type, payload,
                    floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms
        ),
        finalized_command as (
          update world_commands
          set first_seq = inserted_event.seq,
              event_count = 1,
              status = 'accepted',
              updated_at = now()
          from inserted_event
          where world_commands.room_id = $1::uuid
            and world_commands.world_id = $2
            and world_commands.command_id = $3
          returning world_commands.command_id
        )
        select seq, event_id, command_id, actor_player_id, type, payload, created_at_ms
        from inserted_event
        union all
        select world_events.seq, world_events.event_id, world_events.command_id,
               world_events.actor_player_id, world_events.type, world_events.payload,
               floor(extract(epoch from world_events.created_at) * 1000)::bigint as created_at_ms
        from world_commands
        join world_events
          on world_events.room_id = world_commands.room_id
         and world_events.world_id = world_commands.world_id
         and world_events.command_id = world_commands.command_id
        where world_commands.room_id = $1::uuid
          and world_commands.world_id = $2
          and world_commands.command_id = $3
          and world_commands.actor_player_id = $4
          and world_commands.command_type = $5
          and world_commands.payload = $6::jsonb
          and not exists (select 1 from inserted_command)
        order by seq asc
        limit 1
      `,
      [
        input.room.roomId,
        input.worldId,
        input.commandId,
        input.actor.playerId,
        input.commandType,
        JSON.stringify(input.payload),
        eventId,
        JSON.stringify(credit)
      ]
    );

    const row = rows[0] ?? await this.loadMatchingCommandEvent(
      input.room.roomId,
      input.worldId,
      input.commandId,
      input.actor.playerId,
      input.commandType,
      input.payload
    );
    if (!row) {
      if (await this.hasCommand(input.room.roomId, input.worldId, input.commandId)) {
        throw new CommandReplayMismatchError(input.commandId);
      }
      throw new Error(`Command ${input.commandId} did not produce or find a persisted event.`);
    }
    return rowToShardEvent(row);
  }

  private async appendClaimedCommandEvent(input: {
    room: RoomState;
    worldId: string;
    actor: PlayerIdentity;
    commandId: string;
    commandType: string;
    payload: Record<string, unknown>;
  }, claim: SharedMutationClaim): Promise<ShardEvent> {
    const claimSql = this.claimSql(claim, input.worldId);
    const inventoryParam = 8 + claimSql.params.length;
    const credit = toSqlStacks(inventoryCreditsForAcceptedCommand(input.commandType, input.payload));
    const eventId = `${input.commandId}:0`;
    const rows = await this.database.query<EventRow>(
      `
        with existing_command as (
          select command_id
          from world_commands
          where room_id = $1::uuid
            and world_id = $2
            and command_id = $3
          limit 1
        ),
        matching_event as (
          select world_events.seq, world_events.event_id, world_events.command_id,
                 world_events.actor_player_id, world_events.type, world_events.payload,
                 floor(extract(epoch from world_events.created_at) * 1000)::bigint as created_at_ms
          from world_events
          join world_commands
            on world_commands.room_id = world_events.room_id
           and world_commands.world_id = world_events.world_id
           and world_commands.command_id = world_events.command_id
          where world_events.room_id = $1::uuid
            and world_events.world_id = $2
            and world_events.command_id = $3
            and world_commands.actor_player_id = $4
            and world_commands.command_type = $5
            and world_commands.payload = $6::jsonb
          order by world_events.seq asc
          limit 1
        ),
        claim as (
          ${claimSql.sql}
        ),
        inserted_command as (
          insert into world_commands (
            room_id, world_id, command_id, actor_player_id, command_type, payload, status
          )
          select $1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending'
          where exists (select 1 from claim)
            and not exists (select 1 from existing_command)
          on conflict (room_id, world_id, command_id) do nothing
          returning command_id
        ),
        inventory_credit as (
          insert into player_inventory (player_id, item_id, qty, updated_at)
          select player_id, item_id, qty, now()
          from (
            select $4::text as player_id, item_id, qty
            from jsonb_to_recordset($${inventoryParam}::jsonb) as stack(item_id text, qty integer)
            where exists (select 1 from inserted_command)
            union all
            select player_id, item_id, qty
            from claim
            where player_id is not null
              and item_id is not null
              and qty > 0
              and exists (select 1 from inserted_command)
          ) as inventory_rows
          on conflict (player_id, item_id) do update
          set qty = player_inventory.qty + excluded.qty,
              updated_at = now()
          returning item_id
        ),
        next_seq as (
          update world_shards
          set seq = seq + 1,
              updated_at = now()
          where room_id = $1::uuid
            and world_id = $2
            and exists (select 1 from inserted_command)
          returning seq
        ),
        inserted_event as (
          insert into world_events (
            room_id, world_id, seq, event_id, command_id, actor_player_id, type, payload
          )
          select $1::uuid, $2, next_seq.seq, $7, $3, $4, $5, $6::jsonb
          from next_seq
          returning seq, event_id, command_id, actor_player_id, type, payload,
                    floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms
        ),
        finalized_command as (
          update world_commands
          set first_seq = inserted_event.seq,
              event_count = 1,
              status = 'accepted',
              updated_at = now()
          from inserted_event
          where world_commands.room_id = $1::uuid
            and world_commands.world_id = $2
            and world_commands.command_id = $3
          returning world_commands.command_id
        )
        select seq, event_id, command_id, actor_player_id, type, payload, created_at_ms
        from inserted_event
        union all
        select seq, event_id, command_id, actor_player_id, type, payload, created_at_ms
        from matching_event
        order by seq asc
        limit 1
      `,
      [
        input.room.roomId,
        input.worldId,
        input.commandId,
        input.actor.playerId,
        input.commandType,
        JSON.stringify(input.payload),
        eventId,
        ...claimSql.params,
        JSON.stringify(credit)
      ]
    );

    const row = rows[0] ?? await this.loadMatchingCommandEvent(
      input.room.roomId,
      input.worldId,
      input.commandId,
      input.actor.playerId,
      input.commandType,
      input.payload
    );
    if (!row) {
      if (await this.hasCommand(input.room.roomId, input.worldId, input.commandId)) {
        throw new CommandReplayMismatchError(input.commandId);
      }
      throw new CommandConflictError(input.commandId);
    }
    return rowToShardEvent(row);
  }

  async listWorldEvents(roomId: string, worldId: string, sinceSeq = 0): Promise<ShardEvent[]> {
    if (!this.configured) return [];
    const rows = await this.database.query<EventRow>(
      `
        select seq, event_id, command_id, actor_player_id, type, payload,
               floor(extract(epoch from created_at) * 1000)::bigint as created_at_ms
        from world_events
        where room_id = $1::uuid
          and world_id = $2
          and seq > $3
        order by seq asc
      `,
      [roomId, worldId, sinceSeq]
    );
    return rows.map(rowToShardEvent);
  }

  private claimSql(claim: SharedMutationClaim, worldId: string): { sql: string; params: unknown[] } {
    switch (claim.kind) {
      case 'voxel_mined': {
        const metadata = metadataForWorldId(worldId);
        return {
          sql: `
            insert into world_voxel_edits (
              room_id, world_id, x, y, z, removed, generation_schema_version, generation_fingerprint
            )
            select $1::uuid, $2, $8, $9, $10, true, $11, $12
            where not exists (select 1 from existing_command)
            on conflict do nothing
            returning null::text as player_id, null::text as item_id, 0::integer as qty
          `,
          params: [
            claim.coord[0],
            claim.coord[1],
            claim.coord[2],
            metadata.generationSchemaVersion,
            0
          ]
        };
      }
      case 'resource_taken':
        return {
          sql: `
            insert into world_collectibles (
              room_id, world_id, collectible_type, coord, taken_by_player_id
            )
            select $1::uuid, $2, $8, $9::integer[], $4
            where not exists (select 1 from existing_command)
            on conflict do nothing
            returning null::text as player_id, null::text as item_id, 0::integer as qty
          `,
          params: [claim.collectibleType, claim.coord]
        };
      case 'structure_placed':
        return {
          sql: `
            insert into world_structures (
              room_id, world_id, structure_id, owner_player_id, placed_by_player_id,
              cell, face, type, material, state
            )
            select $1::uuid, $2, $8, $4, $4, $9::integer[], $10, $11, $12, $13::jsonb
            where not exists (select 1 from existing_command)
            on conflict do nothing
            returning null::text as player_id, null::text as item_id, 0::integer as qty
          `,
          params: [
            claim.structureId,
            claim.cell,
            claim.face,
            claim.structureType,
            claim.material,
            JSON.stringify(claim.state)
          ]
        };
      case 'structure_removed':
        return {
          sql: `
            delete from world_structures
            using (
              select ids.structure_id,
                     ids.refund,
                     target.owner_player_id,
                     target.type,
                     target.material
              from (
                select structure_id, owner_player_id, cell, face, type, material, state
                from world_structures
                where room_id = $1::uuid
                  and world_id = $2
                  and structure_id in ($8, $9)
                  and not exists (select 1 from existing_command)
                order by case when structure_id = $8 then 0 else 1 end
                limit 1
              ) as target
              cross join lateral (
                values
                  (target.structure_id, true),
                  (
                    case when target.type = 'doorway'
                      then 'door:' || array_to_string(target.cell, ',') || ':' || target.face::text
                      else null
                    end,
                    false
                  ),
                  (
                    case when jsonb_typeof(target.state->'partner') = 'array'
                      then 'slot:'
                           || (target.state->'partner'->>0)
                           || ','
                           || (target.state->'partner'->>1)
                           || ','
                           || (target.state->'partner'->>2)
                           || ':'
                           || target.face::text
                      else null
                    end,
                    false
                  ),
                  (
                    case when target.type = 'doorway'
                           and jsonb_typeof(target.state->'partner') = 'array'
                      then 'door:'
                           || (target.state->'partner'->>0)
                           || ','
                           || (target.state->'partner'->>1)
                           || ','
                           || (target.state->'partner'->>2)
                           || ':'
                           || target.face::text
                      else null
                    end,
                    false
                  )
              ) as ids(structure_id, refund)
              where ids.structure_id is not null
            ) as target_ids
            where world_structures.room_id = $1::uuid
              and world_structures.world_id = $2
              and world_structures.structure_id = target_ids.structure_id
            returning
                   case when target_ids.refund then target_ids.owner_player_id else null end as player_id,
                   case when target_ids.refund and target_ids.material = 'wood' then 'wood' else null end as item_id,
                   case when target_ids.refund then case target_ids.type
                     when 'foundation' then 2
                     when 'wall' then 1
                     when 'ceiling' then 1
                     when 'doorway' then 1
                     when 'window' then 1
                     when 'gable' then 0
                     when 'stairs' then 2
                     when 'sloped_roof' then 1
                     when 'ladder' then 0
                     when 'door' then 1
                     else 0
                   end else 0 end::integer as qty
          `,
          params: [claim.structureId, claim.alternateStructureId]
        };
    }
  }

  private async loadMatchingCommandEvent(
    roomId: string,
    worldId: string,
    commandId: string,
    actorPlayerId: string,
    commandType: string,
    payload: Record<string, unknown>
  ): Promise<EventRow | null> {
    const rows = await this.database.query<EventRow>(
      `
        select world_events.seq, world_events.event_id, world_events.command_id,
               world_events.actor_player_id, world_events.type, world_events.payload,
               floor(extract(epoch from world_events.created_at) * 1000)::bigint as created_at_ms
        from world_events
        join world_commands
          on world_commands.room_id = world_events.room_id
         and world_commands.world_id = world_events.world_id
         and world_commands.command_id = world_events.command_id
        where world_events.room_id = $1::uuid
          and world_events.world_id = $2
          and world_events.command_id = $3
          and world_commands.actor_player_id = $4
          and world_commands.command_type = $5
          and world_commands.payload = $6::jsonb
        order by world_events.seq asc
        limit 1
      `,
      [roomId, worldId, commandId, actorPlayerId, commandType, JSON.stringify(payload)]
    );
    return rows[0] ?? null;
  }

  private async loadMatchingCommandEvents(
    roomId: string,
    worldId: string,
    commandId: string,
    actorPlayerId: string,
    commandType: string,
    payload: Record<string, unknown>
  ): Promise<EventRow[]> {
    return this.database.query<EventRow>(
      `
        select world_events.seq, world_events.event_id, world_events.command_id,
               world_events.actor_player_id, world_events.type, world_events.payload,
               floor(extract(epoch from world_events.created_at) * 1000)::bigint as created_at_ms
        from world_events
        join world_commands
          on world_commands.room_id = world_events.room_id
         and world_commands.world_id = world_events.world_id
         and world_commands.command_id = world_events.command_id
        where world_events.room_id = $1::uuid
          and world_events.world_id = $2
          and world_events.command_id = $3
          and world_commands.actor_player_id = $4
          and world_commands.command_type = $5
          and world_commands.payload = $6::jsonb
        order by world_events.seq asc
      `,
      [roomId, worldId, commandId, actorPlayerId, commandType, JSON.stringify(payload)]
    );
  }

  private async hasCommand(roomId: string, worldId: string, commandId: string): Promise<boolean> {
    const rows = await this.database.query<CommandLookupRow>(
      `
        select command_id
        from world_commands
        where room_id = $1::uuid
          and world_id = $2
          and command_id = $3
        limit 1
      `,
      [roomId, worldId, commandId]
    );
    return rows.length > 0;
  }

  private async hasCampfire(roomId: string, worldId: string, campfireId: string): Promise<boolean> {
    const rows = await this.database.query<{ campfire_id: string }>(
      `
        select campfire_id
        from world_campfires
        where room_id = $1::uuid
          and world_id = $2
          and campfire_id = $3
        limit 1
      `,
      [roomId, worldId, campfireId]
    );
    return rows.length > 0;
  }

  private async hasStructureClaimConflict(
    roomId: string,
    worldId: string,
    claims: AuthoritativeStructureClaim[]
  ): Promise<boolean> {
    for (const claim of claims) {
      if (claim.mode === 'insert') {
        if (await this.hasStructure(roomId, worldId, claim.structureId)) return true;
        continue;
      }
      if (await this.hasStructure(roomId, worldId, claim.structureId)) return true;
      if (!await this.hasStructure(roomId, worldId, claim.requiredStructureId, 'doorway')) return true;
    }
    return false;
  }

  private async hasStructure(roomId: string, worldId: string, structureId: string, type?: string): Promise<boolean> {
    const rows = await this.database.query<{ structure_id: string }>(
      `
        select structure_id
        from world_structures
        where room_id = $1::uuid
          and world_id = $2
          and structure_id = $3
          and ($4::text is null or type = $4)
        limit 1
      `,
      [roomId, worldId, structureId, type ?? null]
    );
    return rows.length > 0;
  }

  private async upsertPlayer(player: PlayerIdentity): Promise<void> {
    const inserted = await this.database.query<{ player_id: string }>(
      `
        insert into players (player_id, display_name, last_seen_at)
        values ($1, $2, now())
        on conflict (player_id) do nothing
        returning player_id
      `,
      [player.playerId, player.displayName ?? null]
    );
    if (inserted.length > 0) {
      const defaultState = defaultServerPlayerState();
      for (const stack of starterInventory()) {
        await this.database.query(
          `
            insert into player_inventory (player_id, item_id, qty, updated_at)
            values ($1, $2, $3, now())
            on conflict (player_id, item_id) do nothing
          `,
          [player.playerId, stack.id, stack.qty]
        );
      }
      await this.database.query(
        `
          insert into player_state (player_id, vitals, maw, waterskin, updated_at)
          values ($1, $2::jsonb, $3::jsonb, $4::jsonb, now())
          on conflict (player_id) do nothing
        `,
        [
          player.playerId,
          JSON.stringify({ ...defaultState.vitals, exhausted: defaultState.exhausted }),
          JSON.stringify({ charge: defaultState.mawCharge }),
          JSON.stringify({ fill: defaultState.waterskinFill })
        ]
      );
    }
    await this.database.query(
      `
        update players
        set display_name = coalesce($2, display_name),
            last_seen_at = now()
        where player_id = $1
      `,
      [player.playerId, player.displayName ?? null]
    );
  }

  private async ensureWorldShard(roomId: string, worldId: string): Promise<void> {
    const metadata = metadataForWorldId(worldId);
    await this.database.query(
      `
        insert into worlds (
          world_id, coordinate_x, coordinate_y, seed, generation_schema_version, updated_at
        )
        values ($1, $2, $3, $4, $5, now())
        on conflict (world_id) do update
        set coordinate_x = excluded.coordinate_x,
            coordinate_y = excluded.coordinate_y,
            seed = excluded.seed,
            generation_schema_version = excluded.generation_schema_version,
            updated_at = now()
      `,
      [
        metadata.worldId,
        metadata.coordinateX,
        metadata.coordinateY,
        metadata.seed,
        metadata.generationSchemaVersion
      ]
    );
    await this.database.query(
      `
        insert into world_shards (room_id, world_id)
        values ($1::uuid, $2)
        on conflict (room_id, world_id) do nothing
      `,
      [roomId, metadata.worldId]
    );
  }
}

export function rowToShardEvent(row: EventRow): ShardEvent {
  return {
    seq: toNumber(row.seq),
    eventId: row.event_id,
    ...(row.command_id ? { commandId: row.command_id } : {}),
    type: row.type,
    playerId: row.actor_player_id,
    payload: row.payload,
    timeMs: toNumber(row.created_at_ms)
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toSqlStacks(stacks: ItemStack[]): Array<{ item_id: string; qty: number }> {
  return stacks.map(stack => ({ item_id: stack.id, qty: stack.qty }));
}

function toSqlStructureClaims(claims: AuthoritativeStructureClaim[] | undefined): Array<{
  mode: string;
  structure_id: string;
  required_structure_id: string | null;
  cell: [number, number, number];
  face: number;
  type: string;
  material: string;
  state: Record<string, unknown>;
}> {
  return (claims ?? []).map(claim => ({
    mode: claim.mode,
    structure_id: claim.structureId,
    required_structure_id: claim.mode === 'door_leaf' ? claim.requiredStructureId : null,
    cell: claim.cell,
    face: claim.face,
    type: claim.structureType,
    material: claim.material,
    state: claim.state
  }));
}

function toPlayerStatePatchSql(patch: AuthoritativePlayerStatePatch | undefined): {
  vitals: string | null;
  maw: string | null;
  waterskin: string | null;
  hasPatch: boolean;
} {
  if (!patch) return { vitals: null, maw: null, waterskin: null, hasPatch: false };
  const vitals = patch.vitals
    ? JSON.stringify({ ...patch.vitals, exhausted: patch.exhausted ?? false })
    : null;
  const maw = patch.mawCharge !== undefined
    ? JSON.stringify({ charge: patch.mawCharge })
    : null;
  const waterskin = patch.waterskinFill !== undefined
    ? JSON.stringify({ fill: patch.waterskinFill })
    : null;
  return {
    vitals,
    maw,
    waterskin,
    hasPatch: vitals !== null || maw !== null || waterskin !== null
  };
}

function rowToPlayerState(row: PlayerStateRow | undefined): ServerPlayerState {
  const defaults = defaultServerPlayerState();
  if (!row) return defaults;
  const vitals = row.vitals ?? {};
  const maw = row.maw ?? {};
  const waterskin = row.waterskin ?? {};
  return {
    vitals: {
      health: readFiniteNumber(vitals.health, defaults.vitals.health),
      hunger: readFiniteNumber(vitals.hunger, defaults.vitals.hunger),
      thirst: readFiniteNumber(vitals.thirst, defaults.vitals.thirst),
      warmth: readFiniteNumber(vitals.warmth, defaults.vitals.warmth),
      stamina: readFiniteNumber(vitals.stamina, defaults.vitals.stamina),
      oxygen: readFiniteNumber(vitals.oxygen, defaults.vitals.oxygen)
    },
    exhausted: typeof vitals.exhausted === 'boolean' ? vitals.exhausted : defaults.exhausted,
    mawCharge: readFiniteNumber(maw.charge, defaults.mawCharge),
    waterskinFill: readFiniteNumber(waterskin.fill, defaults.waterskinFill)
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
