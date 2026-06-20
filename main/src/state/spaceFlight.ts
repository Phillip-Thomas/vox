import { useSyncExternalStore } from 'react';
import type { WorldCoordinate } from '../utils/worldCoordinates.ts';

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

export type FlightPhase = 'surface' | 'launch' | 'deep_space' | 'approach' | 'descent';
export type ControlMode = 'fps' | 'flight';
export type WarpDirection = 'out' | 'in';

export interface SpaceFlightSnapshot {
  phase: FlightPhase;
  controlMode: ControlMode;
  /** Locked-in destination once a travel warp has begun. */
  destination: WorldCoordinate | null;
  /** Impostor currently aimed at / locked while flying (pre-travel). */
  target: WorldCoordinate | null;
}

export interface WarpRuntime {
  active: boolean;
  /** 0..1 across the whole effect; peak white-out at 0.5. */
  progress: number;
  direction: WarpDirection;
  /** Set once the midpoint side-effects (world swap / phase change) have fired. */
  midpointFired: boolean;
}

/** Seconds for a full warp transition (white-out included). */
export const WARP_DURATION = 1.2;

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
  direction: 'out',
  midpointFired: false
};

const listeners = new Set<() => void>();

/**
 * Handler the host (App.tsx) registers to perform the ACTUAL world swap
 * (setCurrentWorld + arrivalMode='approach') at the warp midpoint, while the
 * screen is fully white. Kept out of this module so the store stays Three/React
 * agnostic.
 */
let arrivalHandler: ((dest: WorldCoordinate) => void) | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<SpaceFlightSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

// --- subscription (useSyncExternalStore) ------------------------------------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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

/** Overlay opacity: 0 at the ends, 1 at the white-out midpoint. */
export function warpOpacity(): number {
  if (!warp.active) return 0;
  return Math.sin(Math.min(warp.progress, 1) * Math.PI);
}

// --- host wiring ------------------------------------------------------------

export function setArrivalHandler(handler: ((dest: WorldCoordinate) => void) | null): void {
  arrivalHandler = handler;
}

// --- actions ----------------------------------------------------------------

/** Board the parked ship from foot. */
export function enterShip(): void {
  if (snapshot.phase !== 'surface' || snapshot.controlMode !== 'fps') return;
  setSnapshot({ controlMode: 'flight' });
}

/** Leave the landed ship and return to on-foot control. */
export function exitShip(): void {
  if (snapshot.phase !== 'surface' || snapshot.controlMode !== 'flight') return;
  setSnapshot({ controlMode: 'fps' });
}

/** Begin the cosmetic warp-out that lifts the player from atmosphere to space. */
export function beginLaunch(): void {
  if (snapshot.phase !== 'surface' || snapshot.controlMode !== 'flight') return;
  if (warp.active) return;
  warp.active = true;
  warp.progress = 0;
  warp.direction = 'out';
  warp.midpointFired = false;
  setSnapshot({ phase: 'launch' });
}

/**
 * Begin a travel warp-in to a destination world. Valid from deep space (primary,
 * immersive path) or from the menu (fast travel) — either way the world swap is
 * performed by the registered arrival handler at the white-out midpoint.
 */
export function beginTravel(dest: WorldCoordinate): void {
  if (warp.active) return;
  warp.active = true;
  warp.progress = 0;
  warp.direction = 'in';
  warp.midpointFired = false;
  setSnapshot({ phase: 'approach', destination: dest, target: dest });
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
  warp.active = false;
  warp.progress = 0;
  warp.midpointFired = false;
  setSnapshot({ phase: 'deep_space', controlMode: 'flight', destination: null, target: null });
}

/** Reset to a clean on-foot surface state (e.g. first spawn / hard reset). */
export function resetTravel(): void {
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
export function tickWarp(dt: number): void {
  if (!warp.active) return;
  warp.progress += dt / WARP_DURATION;

  if (!warp.midpointFired && warp.progress >= 0.5) {
    warp.midpointFired = true;
    if (warp.direction === 'out') {
      // Surface -> deep space. No coordinate change; the planet we left simply
      // recedes below as the impostor field takes over.
      setSnapshot({ phase: 'deep_space' });
    } else {
      // Travel arrival: swap the active voxel world (host handler) into a
      // high-altitude approach over the new planet. controlMode is left as-is —
      // immersive travel keeps you in the ship ('flight'); menu fast-travel from
      // foot stays 'fps' and reuses the existing approach-descent controller.
      const dest = snapshot.destination;
      if (dest && arrivalHandler) arrivalHandler(dest);
      setSnapshot({ phase: 'descent' });
    }
  }

  if (warp.progress >= 1) {
    warp.active = false;
    warp.progress = 1;
  }
}
