import {
  createMultiplayerConnection,
  type JsonObject,
  type MultiplayerConnection,
  type MultiplayerServerMessage,
  type MultiplayerSocketStatus
} from './multiplayerClient.ts';
import type { CommandRejectCode, CommandResult } from './commands.ts';
import type { DomainEvent } from './events.ts';
import {
  ensureAnonymousPlayerSession,
  getFirebaseClientConfig,
  getMultiplayerStateServerUrl,
  isCoopAuthEnabled,
  type MultiplayerAuthEnv
} from './multiplayerAuth.ts';
import { getLocalActorId, resetLocalActorId, setLocalActorId } from './playerActors.ts';
import {
  applyReplicatedWorldSnapshotEvents,
  applyReplicatedWorldEvent,
  applyRemotePoseSnapshot,
  applyRemotePoseUpdate,
  toPosePayload
} from './multiplayerReplication.ts';
import {
  clearRemotePlayerPoses,
  getPlayerPose,
  removePlayerPose
} from './systems/playerPoseSystem.ts';
import { clearServerWorldClock, setServerWorldClock } from './worldClock.ts';
import { applyRejectedCommandRollback } from './multiplayerReconciliation.ts';

export type MultiplayerSessionStatus =
  | 'offline'
  | 'disabled'
  | 'config_missing'
  | 'signing_in'
  | 'connecting'
  | 'authenticating'
  | 'ready'
  | 'creating'
  | 'joining'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface MultiplayerSessionSnapshot {
  status: MultiplayerSessionStatus;
  enabled: boolean;
  serverUrl: string | null;
  playerId: string | null;
  roomId: string | null;
  inviteCode: string | null;
  worldId: string | null;
  seq: number;
  error: string | null;
}

export interface MultiplayerConfigStatus {
  ok: boolean;
  enabled: boolean;
  serverUrl: string | null;
  reason: 'ready' | 'disabled' | 'missing_firebase_config' | 'missing_state_server_url';
}

type Listener = () => void;
type PoseTimer = ReturnType<typeof setInterval>;
type ReconnectTimer = ReturnType<typeof setTimeout>;
type WorldEventMessage = Extract<MultiplayerServerMessage, { type: 'world_event' }>;
type CoopSessionAction =
  | { type: 'create'; startWorldId: string }
  | { type: 'join'; inviteCode: string }
  | { type: 'resume'; inviteCode: string; worldId: string; lastAppliedSeq: number };
type PendingReliableCommand = {
  rootCommandId: string;
  commandId: string;
  actorId: string;
  worldId: string;
  rollback?: unknown;
  deferredEvents: DomainEvent[];
  deferredStartIndex: number;
};

export const MULTIPLAYER_POSE_PUBLISH_INTERVAL_MS = 33;

let connection: MultiplayerConnection | null = null;
let poseTimer: PoseTimer | null = null;
let reconnectTimer: ReconnectTimer | null = null;
let connectionGeneration = 0;
let reconnectAttempts = 0;
let activeEnv: MultiplayerAuthEnv | null = null;
let lastSentPoseSeq = 0;
const pendingWorldEventsByWorld = new Map<string, Map<number, WorldEventMessage>>();
const requestedWorldEventBackfill = new Map<string, number>();
const pendingReliableCommands = new Map<string, PendingReliableCommand>();
const AUTHORITATIVE_GATE_EVENT_TYPES = new Set(['voxel_mined', 'resource_taken', 'structure_placed']);
let snapshot: MultiplayerSessionSnapshot = {
  status: 'offline',
  enabled: isCoopAuthEnabled(),
  serverUrl: getMultiplayerStateServerUrl(),
  playerId: null,
  roomId: null,
  inviteCode: null,
  worldId: null,
  seq: 0,
  error: null
};

const listeners = new Set<Listener>();

export function subscribeMultiplayerSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMultiplayerSessionSnapshot(): MultiplayerSessionSnapshot {
  return snapshot;
}

export function resolveMultiplayerConfig(env: MultiplayerAuthEnv = import.meta.env): MultiplayerConfigStatus {
  const enabled = isCoopAuthEnabled(env);
  const serverUrl = getMultiplayerStateServerUrl(env);
  if (!enabled) return { ok: false, enabled, serverUrl, reason: 'disabled' };
  if (!getFirebaseClientConfig(env)) return { ok: false, enabled, serverUrl, reason: 'missing_firebase_config' };
  if (!serverUrl) return { ok: false, enabled, serverUrl, reason: 'missing_state_server_url' };
  return { ok: true, enabled, serverUrl, reason: 'ready' };
}

export async function createCoopRoom(startWorldId: string, env: MultiplayerAuthEnv = import.meta.env): Promise<void> {
  await beginCoopSession({ type: 'create', startWorldId }, env);
}

export async function joinCoopRoom(inviteCode: string, env: MultiplayerAuthEnv = import.meta.env): Promise<void> {
  await beginCoopSession({ type: 'join', inviteCode: inviteCode.trim().toUpperCase() }, env);
}

export function disconnectCoopRoom(): void {
  connectionGeneration++;
  clearReconnectTimer();
  connection?.close();
  connection = null;
  activeEnv = null;
  reconnectAttempts = 0;
  stopPoseForwarding();
  clearWorldEventBackfillState();
  clearPendingReliableCommands();
  clearServerWorldClock();
  clearRemotePlayerPoses(snapshot.playerId ?? getLocalActorId());
  if (snapshot.playerId) removePlayerPose(snapshot.playerId);
  resetLocalActorId();
  setSnapshot({
    ...snapshot,
    status: 'offline',
    playerId: null,
    roomId: null,
    inviteCode: null,
    worldId: null,
    seq: 0,
    error: null
  });
}

export function sendMultiplayerWorldCommand(input: {
  commandId: string;
  commandType: string;
  worldId: string;
  payload: Record<string, unknown>;
}): boolean {
  if (!connection || snapshot.status !== 'connected' || snapshot.worldId !== input.worldId) return false;
  connection.send({
    type: 'command',
    commandId: input.commandId,
    commandType: input.commandType,
    worldId: input.worldId,
    payload: input.payload
  });
  return true;
}

export function sendMultiplayerCommandEvents(result: CommandResult): number {
  if (!result.ok) return 0;
  const gateIndex = result.events.findIndex(event => AUTHORITATIVE_GATE_EVENT_TYPES.has(event.type));
  if (gateIndex >= 0) {
    let sent = 0;
    for (let index = 0; index < gateIndex; index++) {
      if (sendMultiplayerDomainEvent(result.commandId, result.events[index], index)) sent++;
    }

    const gateEvent = result.events[gateIndex];
    const commandId = multiplayerEventCommandId(result.commandId, gateEvent, gateIndex);
    if (sendMultiplayerDomainEvent(result.commandId, gateEvent, gateIndex)) {
      pendingReliableCommands.set(commandId, {
        rootCommandId: result.commandId,
        commandId,
        actorId: gateEvent.actorId,
        worldId: gateEvent.worldId,
        rollback: result.rollback,
        deferredEvents: result.events.slice(gateIndex + 1),
        deferredStartIndex: gateIndex + 1
      });
      sent++;
    }
    return sent;
  }

  let sent = 0;
  result.events.forEach((event, index) => {
    const commandId = multiplayerEventCommandId(result.commandId, event, index);
    if (sendMultiplayerDomainEvent(result.commandId, event, index)) {
      if (index === 0 && result.rollback !== undefined) {
        pendingReliableCommands.set(commandId, {
          rootCommandId: result.commandId,
          commandId,
          actorId: event.actorId,
          worldId: event.worldId,
          rollback: result.rollback,
          deferredEvents: [],
          deferredStartIndex: index + 1
        });
      }
      sent++;
    }
  });
  return sent;
}

export function sendMultiplayerAuthoritativeCommand(
  result: CommandResult,
  commandType: string,
  payload: Record<string, unknown>
): boolean {
  if (!result.ok) return false;
  const firstEvent = result.events[0];
  const worldId = snapshot.status === 'connected' && snapshot.worldId
    ? snapshot.worldId
    : firstEvent?.worldId;
  const actorId = firstEvent?.actorId ?? snapshot.playerId;
  if (!worldId || !actorId) return false;
  const sent = sendMultiplayerWorldCommand({
    commandId: result.commandId,
    commandType,
    worldId,
    payload
  });
  if (!sent) return false;
  pendingReliableCommands.set(result.commandId, {
    rootCommandId: result.commandId,
    commandId: result.commandId,
    actorId,
    worldId,
    rollback: result.rollback,
    deferredEvents: [],
    deferredStartIndex: 0
  });
  return true;
}

async function beginCoopSession(
  action: CoopSessionAction,
  env: MultiplayerAuthEnv
): Promise<void> {
  const config = resolveMultiplayerConfig(env);
  if (!config.ok || !config.serverUrl) {
    setSnapshot({
      ...snapshot,
      enabled: config.enabled,
      serverUrl: config.serverUrl,
      status: config.reason === 'disabled' ? 'disabled' : 'config_missing',
      error: configMessage(config.reason)
    });
    return;
  }

  connectionGeneration++;
  clearReconnectTimer();
  connection?.close();
  connection = null;
  activeEnv = env;
  reconnectAttempts = 0;
  stopPoseForwarding();
  clearWorldEventBackfillState();
  clearPendingReliableCommands();
  clearServerWorldClock();
  clearRemotePlayerPoses(snapshot.playerId ?? getLocalActorId());
  setSnapshot({
    ...emptyConnectedFields(snapshot),
    enabled: true,
    serverUrl: config.serverUrl,
    status: 'signing_in',
    error: null
  });

  try {
    const playerSession = await ensureAnonymousPlayerSession(env);
    if (!playerSession) throw new Error('Firebase anonymous sign-in is not configured.');
    setSnapshot({ ...snapshot, playerId: playerSession.uid, status: 'connecting' });
    const generation = connectionGeneration;
    connection = createMultiplayerConnection({
      serverUrl: config.serverUrl,
      token: playerSession.idToken,
      onStatus: status => handleSocketStatus(status, generation),
      onError: message => handleSocketError(message, generation),
      onMessage: message => {
        if (generation === connectionGeneration) handleServerMessage(message, action);
      }
    });
    if (action.type === 'create') {
      setSnapshot({ ...snapshot, status: 'creating' });
      connection.createRoom(action.startWorldId);
    } else {
      setSnapshot({ ...snapshot, status: action.type === 'resume' ? 'reconnecting' : 'joining' });
      connection.joinRoom(
        action.inviteCode,
        action.type === 'resume'
          ? { worldId: action.worldId, lastAppliedSeq: action.lastAppliedSeq }
          : undefined
      );
    }
  } catch (error) {
    connection = null;
    setSnapshot({
      ...snapshot,
      status: 'error',
      error: error instanceof Error ? error.message : 'Could not start co-op session.'
    });
  }
}

function handleSocketStatus(status: MultiplayerSocketStatus, generation: number): void {
  if (generation !== connectionGeneration) return;
  if (status === 'ready') {
    setSnapshot({
      ...snapshot,
      status: snapshot.status === 'joining' || snapshot.status === 'creating' || snapshot.status === 'reconnecting'
        ? snapshot.status
        : 'ready'
    });
  } else if (status === 'closed') {
    stopPoseForwarding();
    if (canReconnect()) {
      scheduleReconnect();
    } else {
      clearRemotePlayerPoses(snapshot.playerId ?? getLocalActorId());
      setSnapshot({ ...snapshot, status: snapshot.roomId ? 'closed' : 'offline' });
    }
  } else if (status === 'error') {
    stopPoseForwarding();
    if (canReconnect()) {
      scheduleReconnect();
    } else {
      clearRemotePlayerPoses(snapshot.playerId ?? getLocalActorId());
      setSnapshot({ ...snapshot, status });
    }
  } else {
    setSnapshot({ ...snapshot, status });
  }
}

function handleSocketError(message: string, generation: number): void {
  if (generation !== connectionGeneration) return;
  if (canReconnect()) {
    scheduleReconnect(message);
    return;
  }
  setSnapshot({ ...snapshot, status: 'error', error: message });
}

function handleServerMessage(
  message: MultiplayerServerMessage,
  action: CoopSessionAction
): void {
  switch (message.type) {
    case 'auth_ok':
      const previousActorId = getLocalActorId();
      setLocalActorId(message.player.playerId);
      if (previousActorId !== message.player.playerId) removePlayerPose(previousActorId);
      setSnapshot({
        ...snapshot,
        playerId: message.player.playerId,
        status: action.type === 'create'
          ? 'creating'
          : action.type === 'resume'
            ? 'reconnecting'
            : 'joining'
      });
      return;
    case 'room_created':
      setSnapshot({
        ...snapshot,
        roomId: message.roomId,
        inviteCode: message.inviteCode,
        playerId: message.ownerPlayerId,
        error: null
      });
      return;
    case 'room_joined':
      reconnectAttempts = 0;
      clearReconnectTimer();
      setSnapshot({
        ...snapshot,
        status: 'connected',
        roomId: message.roomId,
        inviteCode: message.inviteCode,
        playerId: message.playerId,
        worldId: message.worldId,
        error: null
      });
      startPoseForwarding();
      return;
    case 'world_snapshot':
      applyServerWorldClock(message.snapshot, message.worldId);
      applyRemotePoseSnapshot(message.snapshot, message.worldId, snapshot.playerId);
      applyReplicatedWorldSnapshotEvents(message.snapshot, message.worldId, {
        localPlayerId: snapshot.playerId
      });
      clearBufferedWorldEvents(message.worldId, message.seq);
      setSnapshot({ ...snapshot, seq: message.seq, worldId: message.worldId });
      subscribeWorldFromCursor(message.worldId, message.seq);
      acknowledgeWorldEvents(message.worldId, message.seq);
      return;
    case 'world_event':
      handleWorldEvent(message);
      return;
    case 'command_accepted':
      handleCommandAccepted(message);
      if (message.seq > snapshot.seq + 1) {
        requestWorldEventBackfill(message.worldId, snapshot.seq);
        return;
      }
      setSnapshot({ ...snapshot, seq: Math.max(snapshot.seq, message.seq), worldId: message.worldId });
      acknowledgeWorldEvents(message.worldId, message.seq);
      return;
    case 'command_rejected':
      handleCommandRejected(message);
      return;
    case 'prediction_rollback':
      handlePredictionRollback(message);
      return;
    case 'pose_update':
      applyRemotePoseUpdate(message, snapshot.playerId);
      return;
    case 'error':
      setSnapshot({ ...snapshot, status: 'error', error: message.message });
      return;
    case 'disconnect':
      stopPoseForwarding();
      clearRemotePlayerPoses(snapshot.playerId ?? getLocalActorId());
      setSnapshot({ ...snapshot, status: 'closed', error: message.reason });
      return;
    default:
      return;
  }
}

function applyServerWorldClock(snapshotPayload: JsonObject, worldId: string): void {
  const worldTimeMs = readFiniteNumber(snapshotPayload.worldTimeMs);
  if (worldTimeMs === null) return;
  setServerWorldClock({
    worldId,
    worldTimeMs,
    updatedAtMs: Date.now()
  });
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function handleWorldEvent(message: WorldEventMessage): void {
  if (message.seq <= snapshot.seq) return;
  if (message.seq > snapshot.seq + 1) {
    bufferWorldEvent(message);
    requestWorldEventBackfill(message.worldId, snapshot.seq);
    return;
  }

  applyWorldEventMessage(message);
  drainBufferedWorldEvents(message.worldId);
}

function applyWorldEventMessage(message: WorldEventMessage): void {
  applyReplicatedWorldEvent(message.event, {
    localPlayerId: snapshot.playerId,
    ignoreLocalPlayer: true,
    worldId: message.worldId
  });
  setSnapshot({ ...snapshot, seq: Math.max(snapshot.seq, message.seq), worldId: message.worldId });
  acknowledgeWorldEvents(message.worldId, message.seq);
}

function bufferWorldEvent(message: WorldEventMessage): void {
  const pending = pendingWorldEventsByWorld.get(message.worldId) ?? new Map<number, WorldEventMessage>();
  pending.set(message.seq, message);
  pendingWorldEventsByWorld.set(message.worldId, pending);
}

function drainBufferedWorldEvents(worldId: string): void {
  const pending = pendingWorldEventsByWorld.get(worldId);
  if (!pending) {
    requestedWorldEventBackfill.delete(worldId);
    return;
  }

  for (;;) {
    const next = pending.get(snapshot.seq + 1);
    if (!next) break;
    pending.delete(next.seq);
    applyWorldEventMessage(next);
  }

  if (pending.size === 0) {
    pendingWorldEventsByWorld.delete(worldId);
    requestedWorldEventBackfill.delete(worldId);
  }
}

function clearBufferedWorldEvents(worldId: string, throughSeq: number): void {
  const pending = pendingWorldEventsByWorld.get(worldId);
  if (pending) {
    for (const seq of pending.keys()) {
      if (seq <= throughSeq) pending.delete(seq);
    }
    if (pending.size === 0) pendingWorldEventsByWorld.delete(worldId);
  }
  const requestedSince = requestedWorldEventBackfill.get(worldId);
  if (requestedSince !== undefined && requestedSince <= throughSeq) {
    requestedWorldEventBackfill.delete(worldId);
  }
}

function requestWorldEventBackfill(worldId: string, sinceSeq: number): void {
  if (!connection || snapshot.status !== 'connected') return;
  const requestedSince = requestedWorldEventBackfill.get(worldId);
  if (requestedSince !== undefined && requestedSince <= sinceSeq) return;
  requestedWorldEventBackfill.set(worldId, sinceSeq);
  connection.send({ type: 'subscribe_world', worldId, lastAppliedSeq: sinceSeq });
}

function subscribeWorldFromCursor(worldId: string, lastAppliedSeq: number): void {
  if (!connection || snapshot.status !== 'connected') return;
  connection.send({ type: 'subscribe_world', worldId, lastAppliedSeq });
}

function acknowledgeWorldEvents(worldId: string, appliedSeq: number): void {
  if (!connection || snapshot.status !== 'connected') return;
  connection.send({ type: 'ack_world_events', worldId, appliedSeq });
}

function clearWorldEventBackfillState(): void {
  pendingWorldEventsByWorld.clear();
  requestedWorldEventBackfill.clear();
}

function clearPendingReliableCommands(): void {
  pendingReliableCommands.clear();
}

function handleCommandAccepted(message: Extract<MultiplayerServerMessage, { type: 'command_accepted' }>): void {
  const pending = pendingReliableCommands.get(message.commandId);
  if (!pending) return;
  pendingReliableCommands.delete(message.commandId);
  sendDeferredMultiplayerEvents(pending);
}

function handleCommandRejected(message: Extract<MultiplayerServerMessage, { type: 'command_rejected' }>): void {
  const pending = pendingReliableCommands.get(message.commandId);
  if (!pending) return;
  pendingReliableCommands.delete(message.commandId);
  applyRejectedCommandRollback(pending.rollback, {
    actorId: pending.actorId,
    rejectCode: message.code as CommandRejectCode
  });
  if (message.code === 'conflict') requestWorldEventBackfill(pending.worldId, snapshot.seq);
}

function handlePredictionRollback(message: Extract<MultiplayerServerMessage, { type: 'prediction_rollback' }>): void {
  const pending = pendingReliableCommands.get(message.commandId);
  const actorId = pending?.actorId ?? snapshot.playerId;
  if (!actorId) return;
  if (pending) pendingReliableCommands.delete(message.commandId);
  applyRejectedCommandRollback(message.rollback, {
    actorId,
    rejectCode: 'stale'
  });
}

function sendDeferredMultiplayerEvents(pending: PendingReliableCommand): void {
  pending.deferredEvents.forEach((event, offset) => {
    sendMultiplayerDomainEvent(pending.rootCommandId, event, pending.deferredStartIndex + offset);
  });
}

function canReconnect(): boolean {
  return Boolean(activeEnv && snapshot.serverUrl && snapshot.inviteCode && snapshot.worldId && snapshot.status !== 'offline');
}

function scheduleReconnect(message = 'Connection lost. Reconnecting...'): void {
  if (!canReconnect() || reconnectTimer) return;
  const delayMs = Math.min(1000 * 2 ** reconnectAttempts, 10000);
  reconnectAttempts++;
  setSnapshot({ ...snapshot, status: 'reconnecting', error: message });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void reconnectCoopSession();
  }, delayMs);
}

async function reconnectCoopSession(): Promise<void> {
  if (!activeEnv || !snapshot.inviteCode || !snapshot.worldId) return;
  const action: CoopSessionAction = {
    type: 'resume',
    inviteCode: snapshot.inviteCode,
    worldId: snapshot.worldId,
    lastAppliedSeq: snapshot.seq
  };
  const env = activeEnv;
  connectionGeneration++;
  connection?.close();
  connection = null;
  stopPoseForwarding();
  setSnapshot({ ...snapshot, status: 'reconnecting', error: null });

  try {
    const playerSession = await ensureAnonymousPlayerSession(env);
    if (!playerSession) throw new Error('Firebase anonymous sign-in is not configured.');
    const generation = connectionGeneration;
    connection = createMultiplayerConnection({
      serverUrl: snapshot.serverUrl ?? getMultiplayerStateServerUrl(env) ?? '',
      token: playerSession.idToken,
      onStatus: status => handleSocketStatus(status, generation),
      onError: message => handleSocketError(message, generation),
      onMessage: message => {
        if (generation === connectionGeneration) handleServerMessage(message, action);
      }
    });
    connection.joinRoom(action.inviteCode, { worldId: action.worldId, lastAppliedSeq: action.lastAppliedSeq });
  } catch (error) {
    scheduleReconnect(error instanceof Error ? error.message : 'Could not reconnect co-op session.');
  }
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function startPoseForwarding(): void {
  stopPoseForwarding();
  lastSentPoseSeq = 0;
  poseTimer = setInterval(publishLocalPose, MULTIPLAYER_POSE_PUBLISH_INTERVAL_MS);
  publishLocalPose();
}

function stopPoseForwarding(): void {
  if (!poseTimer) return;
  clearInterval(poseTimer);
  poseTimer = null;
}

function publishLocalPose(): void {
  if (!connection || snapshot.status !== 'connected' || !snapshot.playerId || !snapshot.worldId) return;
  const pose = getPlayerPose(snapshot.playerId);
  if (!pose || pose.worldId !== snapshot.worldId || pose.seq <= lastSentPoseSeq) return;
  lastSentPoseSeq = pose.seq;
  connection.send({
    type: 'pose_update',
    worldId: pose.worldId,
    seq: pose.seq,
    pose: toPosePayload(pose)
  });
}

function setSnapshot(next: MultiplayerSessionSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function sendMultiplayerDomainEvent(commandId: string, event: DomainEvent, index: number): boolean {
  const payload = toJsonObject(event.payload);
  if (!payload) return false;
  const worldId = snapshot.status === 'connected' && snapshot.worldId ? snapshot.worldId : event.worldId;
  return sendMultiplayerWorldCommand({
    commandId: multiplayerEventCommandId(commandId, event, index),
    commandType: event.type,
    worldId,
    payload
  });
}

function multiplayerEventCommandId(commandId: string, event: DomainEvent, index: number): string {
  return `${commandId}:${event.eventId ?? index}`;
}

function toJsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function emptyConnectedFields(current: MultiplayerSessionSnapshot): MultiplayerSessionSnapshot {
  return {
    ...current,
    playerId: null,
    roomId: null,
    inviteCode: null,
    worldId: null,
    seq: 0
  };
}

function configMessage(reason: MultiplayerConfigStatus['reason']): string {
  switch (reason) {
    case 'disabled':
      return 'Co-op alpha is off for this build.';
    case 'missing_firebase_config':
      return 'Firebase web app config is required before co-op can sign in.';
    case 'missing_state_server_url':
      return 'State server URL is required before co-op can connect.';
    case 'ready':
      return '';
  }
}
