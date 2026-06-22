import { useSyncExternalStore } from 'react';

/**
 * Top-level app shell state: which screen we're on, and whether the live world
 * has painted cleanly enough to reveal.
 *
 * Like {@link ./spaceFlight.ts} this is a singleton EXTERNAL store (not React
 * context) because BOTH the DOM shell (LandingMenu / GameHud, outside <Canvas>)
 * AND in-Canvas probes (SceneReadyProbe, MenuCamera) must read/write it, and
 * React context does not cross the react-three-fiber reconciler boundary.
 *
 *   phase:      'menu'  -> landing screen over a live cinematic render of the world
 *               'playing' -> on foot / in the ship
 *   sceneReady: false until the voxel mesh is populated AND a few frames have
 *               painted — gates the loading screen and the menu's Play button so
 *               the first-load "messed up rendering" flash is never visible.
 */

export type AppPhase = 'menu' | 'playing';

export interface AppStateSnapshot {
  phase: AppPhase;
  sceneReady: boolean;
}

/** Frames that must paint AFTER the terrain mesh is populated before we reveal. */
const READY_FRAMES = 8;

/**
 * Debug deep-links jump straight into the world and must SKIP the landing menu,
 * matching the existing ?fly/?descent/?world/?agent/?overview entry points in
 * App.tsx. Computed once from the URL at module load.
 */
function computeDeepLink(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return (
    p.has('world') ||
    p.get('fly') === '1' ||
    p.has('descent') ||
    p.get('agent') === '1' ||
    p.get('overview') === '1'
  );
}

const DEEP_LINK = computeDeepLink();

let snapshot: AppStateSnapshot = {
  phase: DEEP_LINK ? 'playing' : 'menu',
  sceneReady: false
};

// Not part of the snapshot: these mutate every frame / often and must NOT
// trigger re-renders. We only emit when `sceneReady` actually flips.
let terrainPopulated = false;
let framesPainted = 0;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<AppStateSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppStateSnapshot {
  return snapshot;
}

export function useAppState(): AppStateSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-hook live read for per-frame loops / event handlers. */
export function getAppStateSnapshot(): AppStateSnapshot {
  return snapshot;
}

/** True when launched via a debug deep-link (menu skipped). */
export function isDebugDeepLink(): boolean {
  return DEEP_LINK;
}

// --- phase transitions ------------------------------------------------------

/** Leave the landing menu and enter gameplay. The ONLY mutation "Play" triggers. */
export function enterPlaying(): void {
  if (snapshot.phase === 'playing') return;
  setSnapshot({ phase: 'playing' });
}

/** Return to the landing menu (Quit to menu). */
export function returnToMenu(): void {
  if (snapshot.phase === 'menu') return;
  setSnapshot({ phase: 'menu' });
}

// --- scene-ready signal -----------------------------------------------------

function maybeReady(): void {
  if (!snapshot.sceneReady && terrainPopulated && framesPainted >= READY_FRAMES) {
    setSnapshot({ sceneReady: true });
  }
}

/** Called once the voxel mesh is populated (EfficientPlanet populate effect). */
export function markTerrainPopulated(): void {
  terrainPopulated = true;
  maybeReady();
}

/** Called every frame by the in-Canvas counter. Cheap until ready, then a no-op. */
export function markFramePainted(): void {
  if (snapshot.sceneReady) return;
  framesPainted++;
  maybeReady();
}

/** Drop the ready signal on a world swap (EfficientPlanet effect cleanup). */
export function resetSceneReady(): void {
  terrainPopulated = false;
  framesPainted = 0;
  if (snapshot.sceneReady) setSnapshot({ sceneReady: false });
}

// --- canvas handle (for pointer lock from the DOM Play button) --------------

let gameCanvas: HTMLCanvasElement | null = null;

/** Stash the WebGL canvas (Canvas onCreated) so DOM UI can request pointer lock. */
export function setGameCanvas(el: HTMLCanvasElement | null): void {
  gameCanvas = el;
}

export function getGameCanvas(): HTMLCanvasElement | null {
  return gameCanvas;
}
