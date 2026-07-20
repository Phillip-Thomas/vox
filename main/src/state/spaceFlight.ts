import { useSyncExternalStore } from 'react';
import type { WorldCoordinate } from '../utils/worldCoordinates.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import {
  setPlayerFlightState
} from '../game/systems/playerFlightSystem.ts';
import type {
  SpaceFlightSnapshot,
  WarpRuntime,
  ShardHandoffState
} from '../game/playerFlight.ts';
import {
  finishWarpMetrics,
  markWarpMetric,
  startWarpMetrics
} from '../utils/warpMetrics.ts';

export type {
  ControlMode,
  FlightPhase,
  SpaceFlightSnapshot,
  WarpKind,
  WarpRuntime
} from '../game/playerFlight.ts';

/**
 * Travel state machine for No Man's Sky-style seamless inter-world flight.
 *
 * This is a singleton EXTERNAL store (not React context) on purpose: the travel
 * state must be read by BOTH the DOM HUD (outside <Canvas>) and in-Canvas
 * components (ShipController, WarpOverlay, SkyController/SpaceSky). React context
 * does not cross the react-three-fiber reconciler boundary, so a subscribe-based
 * store read via useSyncExternalStore is the only thing that works in both trees
 * without a fragile context bridge.
 *
 * The flight loop:
 *   surface/fps  --board(F)-->  surface/flight (in the parked ship)
 *                --climb past altitude threshold-->  launch (warp-out)
 *                --warp midpoint-->  deep_space/flight  (fly 6-DOF among impostors)
 *                --aim at a world + approach threshold-->  approach (warp-in)
 *                --warp midpoint: swap voxel world-->  descent/flight
 *                --touch down (onGroundedChange)-->  surface/flight (landed)
 *                --exit(F)-->  surface/fps
 *
 * `phase`/`controlMode`/`destination`/`target` live in a React snapshot (they
 * change only at boundaries, so re-renders are infrequent). The per-frame warp
 * progress lives in a separate MUTABLE runtime object that is NOT part of the
 * snapshot — overlay/cockpit read it every frame without triggering re-renders.
 */

/** Seconds for a full interstellar warp (white-out included). */
export const WARP_DURATION = 1.2;
/** Seconds for the short atmosphere-crossing "mini warp". */
export const MINI_WARP_DURATION = 0.85;
/** Maximum extra peak-cover hold while the exact destination paints. */
export const SYSTEM_HANDOFF_MAX_HOLD = 0.75;

/** Altitude (world units above the planet surface radius ~50) that auto-launches. */
export const LAUNCH_ALTITUDE = 130;

// --- internal state ---------------------------------------------------------

let snapshot: SpaceFlightSnapshot = {
  phase: 'surface',
  controlMode: 'fps',
  destination: null,
  target: null
};

const warp: WarpRuntime = {
  active: false,
  progress: 0,
  kind: 'travel',
  duration: WARP_DURATION,
  intensity: 1,
  midpointFired: false
};

export interface AtmosphereExitReceipt {
  readonly previousPhase: 'descent';
  readonly phase: 'deep_space';
  readonly controlMode: 'flight';
}

export interface ShipExitReceipt {
  readonly phase: 'surface';
  readonly previousControlMode: 'flight';
  readonly controlMode: 'fps';
}

const ATMOSPHERE_EXIT_RECEIPT: AtmosphereExitReceipt = Object.freeze({
  previousPhase: 'descent',
  phase: 'deep_space',
  controlMode: 'flight'
});
const SHIP_EXIT_RECEIPT: ShipExitReceipt = Object.freeze({
  phase: 'surface',
  previousControlMode: 'flight',
  controlMode: 'fps'
});

const listeners = new Set<() => void>();
const atmosphereExitListeners = new Set<(receipt: AtmosphereExitReceipt) => void>();
const shipExitListeners = new Set<(receipt: ShipExitReceipt) => void>();
let localFlightSeq = 0;

/**
 * Handler the host (App.tsx) registers to perform the ACTUAL world swap
 * (setCurrentWorld + arrivalMode='approach') at the warp midpoint, while the
 * screen is fully white. Kept out of this module so the store stays Three/React
 * agnostic.
 */
let arrivalHandler: ((dest: WorldCoordinate) => void) | null = null;

// Story boarding can replace the legacy one-frame surface/fps -> surface/flight
// switch with a physical hatch transaction. The interceptor is registered only
// while that exterior exists; sandbox and later landings keep the direct path.
let shipBoardingInterceptor: (() => boolean) | null = null;
let shipExitInterceptor: (() => boolean) | null = null;

export interface SystemHandoffOptions {
  worldId: string;
  activationEpoch: number;
  isCurrent: () => boolean;
  onMidpoint: () => boolean;
  readyToReveal: () => boolean;
  onAbort?: (reason: SystemHandoffAbortReason) => void;
}

export type SystemHandoffAbortReason =
  | 'lease_invalidated'
  | 'midpoint_rejected'
  | 'midpoint_error'
  | 'driver_unmounted'
  | 'reset';

interface ActiveSystemHandoff extends SystemHandoffOptions {
  observedNotReady: boolean;
  holdStartedAtMs: number | null;
  timeoutReported: boolean;
  releaseAuthorized: boolean;
  committed: boolean;
  abortNotified: boolean;
}

let systemHandoff: ActiveSystemHandoff | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<SpaceFlightSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  publishLocalFlightState();
  emit();
}

function currentHandoffState(): ShardHandoffState | undefined {
  if (warp.kind !== 'travel') return undefined;
  if (warp.active) {
    return {
      status: warp.midpointFired ? 'midpoint' : 'requested',
      destination: snapshot.destination
    };
  }
  if (warp.progress >= 1 && snapshot.destination) {
    return {
      status: 'complete',
      destination: snapshot.destination
    };
  }
  return undefined;
}

function publishLocalFlightState(): void {
  setPlayerFlightState({
    playerId: getLocalActorId(),
    seq: ++localFlightSeq,
    timeMs: Date.now(),
    ...snapshot,
    handoff: currentHandoffState()
  });
}

// --- subscription (useSyncExternalStore) ------------------------------------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fires only after leaveAtmosphere successfully commits descent -> deep_space. */
export function subscribeAtmosphereExit(
  listener: (receipt: AtmosphereExitReceipt) => void
): () => void {
  atmosphereExitListeners.add(listener);
  return () => atmosphereExitListeners.delete(listener);
}

/** Fires only after exitShip successfully commits surface/flight -> surface/fps. */
export function subscribeShipExit(listener: (receipt: ShipExitReceipt) => void): () => void {
  shipExitListeners.add(listener);
  return () => shipExitListeners.delete(listener);
}

function getSnapshot(): SpaceFlightSnapshot {
  return snapshot;
}

export function useSpaceFlight(): SpaceFlightSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Non-hook live snapshot read for per-frame loops (e.g. ShipController.useFrame)
 * that need the current phase without subscribing/re-rendering.
 */
export function getSpaceFlightSnapshot(): SpaceFlightSnapshot {
  return snapshot;
}

// --- warp runtime accessors -------------------------------------------------

export function getWarp(): WarpRuntime {
  return warp;
}

/** Overlay opacity: 0 at the ends, peak (intensity) at the white-out midpoint. */
export function warpOpacity(): number {
  if (!warp.active) return 0;
  return Math.sin(Math.min(warp.progress, 1) * Math.PI) * warp.intensity;
}

// --- host wiring ------------------------------------------------------------

export function setArrivalHandler(handler: ((dest: WorldCoordinate) => void) | null): void {
  arrivalHandler = handler;
}

/** Return false from the interceptor to hold the control transfer at the hatch. */
export function setShipBoardingInterceptor(interceptor: (() => boolean) | null): () => void {
  shipBoardingInterceptor = interceptor;
  return () => {
    if (shipBoardingInterceptor === interceptor) shipBoardingInterceptor = null;
  };
}

/** Return false from the interceptor to hold a landed-ship exit transaction. */
export function setShipExitInterceptor(interceptor: (() => boolean) | null): () => void {
  shipExitInterceptor = interceptor;
  return () => {
    if (shipExitInterceptor === interceptor) shipExitInterceptor = null;
  };
}

// --- actions ----------------------------------------------------------------

/** Board the parked ship from foot. */
export function enterShip(): boolean {
  if (snapshot.phase !== 'surface' || snapshot.controlMode !== 'fps') return false;
  if (shipBoardingInterceptor && !shipBoardingInterceptor()) return false;
  setSnapshot({ controlMode: 'flight' });
  return true;
}

/** Leave the landed ship and return to on-foot control. */
export function exitShip(): boolean {
  if (snapshot.phase !== 'surface' || snapshot.controlMode !== 'flight') return false;
  if (shipExitInterceptor && !shipExitInterceptor()) return false;
  setSnapshot({ controlMode: 'fps' });
  for (const listener of shipExitListeners) listener(SHIP_EXIT_RECEIPT);
  return true;
}

/**
 * Begin a travel warp-in to a destination world. Valid from deep space (primary,
 * immersive path) or from the menu (fast travel) — either way the world swap is
 * performed by the registered arrival handler at the white-out midpoint.
 */
export function beginTravel(dest: WorldCoordinate): void {
  if (warp.active) return;
  startWarpMetrics(`${dest.x},${dest.y}`);
  warp.active = true;
  warp.progress = 0;
  warp.kind = 'travel';
  warp.duration = WARP_DURATION;
  warp.intensity = 1;
  warp.midpointFired = false;
  markWarpMetric('travel:begin', { x: dest.x, y: dest.y, durationMs: WARP_DURATION * 1000 });
  setSnapshot({ phase: 'approach', destination: dest, target: dest });
}

/**
 * Begin the short atmospheric transition veil. No world swap: the continuous
 * altitude blend already keeps the sky and local bodies stable while the phase
 * flips at the veil midpoint. 'enter' from deep_space → descent; 'leave' from
 * descent → deep_space.
 */
export function beginAtmosphereWarp(dir: 'enter' | 'leave'): void {
  if (warp.active) return;
  if (snapshot.controlMode !== 'flight') return;
  if (dir === 'enter' && snapshot.phase !== 'deep_space') return;
  if (dir === 'leave' && snapshot.phase !== 'descent') return;
  warp.active = true;
  warp.progress = 0;
  warp.kind = dir;
  warp.duration = MINI_WARP_DURATION;
  warp.intensity = 0.82; // softer than the full interstellar white-out
  warp.midpointFired = false;
}

/**
 * Cover only the final local representation/owner handoff. Canonical travel has
 * already happened physically; this never publishes an interstellar destination.
 */
export function beginSystemHandoff(options: SystemHandoffOptions): boolean {
  if (warp.active) return false;
  if (snapshot.controlMode !== 'flight' || snapshot.phase !== 'deep_space') return false;
  systemHandoff = {
    ...options,
    observedNotReady: false,
    holdStartedAtMs: null,
    timeoutReported: false,
    releaseAuthorized: false,
    committed: false,
    abortNotified: false
  };
  startWarpMetrics(`system:${options.worldId}`);
  warp.active = true;
  warp.progress = 0;
  warp.kind = 'system_handoff';
  warp.duration = MINI_WARP_DURATION;
  warp.intensity = 0.94;
  warp.midpointFired = false;
  markWarpMetric('system_handoff:begin', {
    worldId: options.worldId,
    activationEpoch: options.activationEpoch,
    durationMs: MINI_WARP_DURATION * 1000
  });
  return true;
}

/** Revoke a pre-commit local handoff and fade the veil back to the old scene. */
export function cancelSystemHandoff(reason: SystemHandoffAbortReason): boolean {
  const handoff = systemHandoff;
  if (!handoff || !warp.active || warp.kind !== 'system_handoff') return false;
  if (!handoff.committed) notifySystemHandoffAbort(handoff, reason);
  handoff.releaseAuthorized = true;
  if (!warp.midpointFired) {
    if (warp.progress <= 0) {
      finishWarpMetrics('system_handoff:cancelled');
      systemHandoff = null;
      warp.active = false;
      warp.progress = 0;
      return true;
    }
    // Mirror the current intensity onto the receding half; no midpoint commit runs.
    warp.progress = Math.max(0.5, 1 - warp.progress);
    warp.midpointFired = true;
  }
  return true;
}

/** Set/clear the impostor the player is currently aiming at while flying. */
export function setTarget(target: WorldCoordinate | null): void {
  if (target === snapshot.target) return;
  if (
    target && snapshot.target &&
    target.x === snapshot.target.x && target.y === snapshot.target.y
  ) {
    return;
  }
  setSnapshot({ target });
}

/**
 * Enter the atmosphere of the currently-loaded world (deep space OR a landed
 * ship lifting off → atmospheric descent flight). Altitude-driven, seamless — no
 * warp; the only warp is the interstellar beginTravel.
 */
export function enterAtmosphere(): void {
  if (snapshot.controlMode !== 'flight') return;
  if (snapshot.phase !== 'deep_space' && snapshot.phase !== 'surface') return;
  setSnapshot({ phase: 'descent' });
}

/** Leave the atmosphere back into deep space (climbing out). Seamless. */
export function leaveAtmosphere(): void {
  if (snapshot.controlMode !== 'flight') return;
  if (snapshot.phase !== 'descent') return;
  setSnapshot({ phase: 'deep_space', destination: null });
  for (const listener of atmosphereExitListeners) listener(ATMOSPHERE_EXIT_RECEIPT);
}

/** Called from the surface grounding callback once the ship touches down. */
export function notifyLanded(): void {
  if (snapshot.phase !== 'descent') return;
  setSnapshot({ phase: 'surface', destination: null });
}

/**
 * DEBUG (?fly=1): drop straight into deep-space flight, skipping the walk to the
 * ship + launch. Used by headless runtime checks and manual inspection.
 */
export function debugStartInSpace(): void {
  discardSystemHandoff('reset');
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot({ phase: 'deep_space', controlMode: 'flight', destination: null, target: null });
}

/**
 * DEBUG (?descent=x,y): drop straight into the high-altitude descent over an
 * already-loaded world, skipping the warp. The host sets currentWorld +
 * arrivalMode='approach' alongside this so ShipController spawns looking down.
 */
export function debugStartInDescent(): void {
  discardSystemHandoff('reset');
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot({ phase: 'descent', controlMode: 'flight', destination: null, target: null });
}

/**
 * Rehydrate an already-completed boarding boundary at a parked surface ship.
 * This restores control ownership only: the Story layer remains responsible
 * for proving (or reconstructing) the durable physical-boarding receipts.
 */
export function restoreBoardedSurfaceFlight(): void {
  discardSystemHandoff('reset');
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot({ phase: 'surface', controlMode: 'flight', destination: null, target: null });
}

/**
 * Rehydrate the coarse flight state that accompanies a persisted canonical ship
 * pose. Unlike the debug entry points this is a save boundary: it restores only
 * a location mode already validated by the ship-restoration layer and never
 * advances travel, landing, or Story evidence.
 */
export function restoreFlightAtLocation(
  locationMode: 'surface' | 'atmosphere' | 'local_space'
): void {
  discardSystemHandoff('reset');
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot(locationMode === 'surface'
    ? { phase: 'surface', controlMode: 'fps', destination: null, target: null }
    : locationMode === 'atmosphere'
      ? { phase: 'descent', controlMode: 'flight', destination: null, target: null }
      : { phase: 'deep_space', controlMode: 'flight', destination: null, target: null });
}

/** Reset to a clean on-foot surface state (e.g. first spawn / hard reset). */
export function resetTravel(): void {
  discardSystemHandoff('reset');
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot({ phase: 'surface', controlMode: 'fps', destination: null, target: null });
}

/**
 * Advance the warp each frame. Called from a single in-Canvas driver
 * (WarpOverlay). Mutates the warp runtime directly; only fires React snapshot
 * changes at the midpoint and at completion, where the white-out hides them.
 */
export function tickWarp(dt: number, timestampMs = currentTimeMs()): void {
  if (!warp.active) return;
  if (warp.kind === 'system_handoff' && warp.midpointFired && holdSystemHandoffAtPeak(timestampMs)) {
    return;
  }
  warp.progress += dt / warp.duration;

  if (!warp.midpointFired && warp.progress >= 0.5) {
    warp.midpointFired = true;
    if (warp.kind === 'travel') {
      // Interstellar arrival: swap the active voxel world (host handler) and drop
      // the ship into the destination system's DEEP SPACE — NOT straight into the
      // atmosphere. controlMode is forced to 'flight' so menu fast-travel also
      // arrives piloting the ship in space.
      const dest = snapshot.destination;
      markWarpMetric('travel:midpoint', { progress: warp.progress });
      if (dest && arrivalHandler) arrivalHandler(dest);
      markWarpMetric('travel:midpoint_handler_returned');
      setSnapshot({ phase: 'deep_space', controlMode: 'flight' });
      markWarpMetric('travel:deep_space_snapshot_set');
    } else if (warp.kind === 'enter') {
      // Atmospheric veil midpoint; celestial visuals already follow altitude.
      enterAtmosphere();
    } else if (warp.kind === 'leave') {
      // Atmospheric veil midpoint; celestial visuals already follow altitude.
      leaveAtmosphere();
    } else {
      warp.progress = 0.5;
      const handoff = systemHandoff;
      markWarpMetric('system_handoff:midpoint', {
        worldId: handoff?.worldId ?? null,
        activationEpoch: handoff?.activationEpoch ?? null
      });
      if (!handoff) {
        markWarpMetric('system_handoff:missing_lease');
      } else if (!safeSystemHandoffCurrent(handoff)) {
        notifySystemHandoffAbort(handoff, 'lease_invalidated');
      } else {
        try {
          if (handoff.onMidpoint()) {
            handoff.committed = true;
          } else {
            notifySystemHandoffAbort(handoff, 'midpoint_rejected');
          }
        } catch (error) {
          markWarpMetric('system_handoff:midpoint_error', {
            message: error instanceof Error ? error.message : String(error)
          });
          notifySystemHandoffAbort(handoff, 'midpoint_error');
        }
      }
      if (handoff?.committed && holdSystemHandoffAtPeak(timestampMs)) return;
    }
  }

  if (warp.progress >= 1) {
    warp.active = false;
    warp.progress = 1;
    if (warp.kind === 'travel') finishWarpMetrics();
    if (warp.kind === 'system_handoff') {
      markWarpMetric('system_handoff:complete', {
        committed: systemHandoff?.committed ?? false,
        aborted: systemHandoff?.abortNotified ?? false
      });
      finishWarpMetrics('system_handoff:end');
      systemHandoff = null;
    }
    publishLocalFlightState();
  }
}

function holdSystemHandoffAtPeak(timestampMs: number): boolean {
  const handoff = systemHandoff;
  if (!handoff || !handoff.committed) return false;
  if (handoff.releaseAuthorized) return false;
  let ready = false;
  try {
    ready = handoff.readyToReveal();
  } catch {
    ready = false;
  }
  if (!ready) handoff.observedNotReady = true;
  if (handoff.holdStartedAtMs === null) handoff.holdStartedAtMs = timestampMs;
  const holdSeconds = Math.max(0, timestampMs - handoff.holdStartedAtMs) / 1000;
  if (handoff.observedNotReady && ready) {
    handoff.releaseAuthorized = true;
    markWarpMetric('system_handoff:renderer_ready', { holdMs: holdSeconds * 1000 });
    return false;
  }

  if (holdSeconds >= SYSTEM_HANDOFF_MAX_HOLD) {
    handoff.releaseAuthorized = true;
    if (!handoff.timeoutReported) {
      handoff.timeoutReported = true;
      markWarpMetric('system_handoff:renderer_timeout', { holdMs: holdSeconds * 1000 });
    }
    return false;
  }
  warp.progress = 0.5;
  return true;
}

function safeSystemHandoffCurrent(handoff: ActiveSystemHandoff): boolean {
  try {
    return handoff.isCurrent();
  } catch (error) {
    markWarpMetric('system_handoff:lease_check_error', {
      message: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

function notifySystemHandoffAbort(
  handoff: ActiveSystemHandoff,
  reason: SystemHandoffAbortReason
): void {
  if (handoff.abortNotified) return;
  handoff.abortNotified = true;
  handoff.releaseAuthorized = true;
  markWarpMetric('system_handoff:abort', { reason, worldId: handoff.worldId });
  try {
    handoff.onAbort?.(reason);
  } catch (error) {
    markWarpMetric('system_handoff:abort_callback_error', {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function discardSystemHandoff(reason: SystemHandoffAbortReason): void {
  if (!systemHandoff) return;
  if (!systemHandoff.committed) notifySystemHandoffAbort(systemHandoff, reason);
  if (warp.kind === 'system_handoff') finishWarpMetrics(`system_handoff:${reason}`);
  systemHandoff = null;
}

function currentTimeMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
