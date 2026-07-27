import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, Environment, KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import EfficientScene, { planetSize, SceneDebugState } from './components/EfficientScene.tsx';
import SkyController from './components/SkyController.tsx';
import Crosshair from './components/Crosshair.tsx';
import BenchmarkProbe, { BenchmarkSample } from './components/BenchmarkProbe.tsx';
import PostFX from './components/effects/PostFX.tsx';
import GalaxyImpostors from './components/GalaxyImpostors.tsx';
import SystemCompanionBodies from './components/SystemCompanionBodies.tsx';
import SystemAnchorages from './components/SystemAnchorages.tsx';
import AnchorageApproachDriver from './components/AnchorageApproachDriver.tsx';
import AnchorageApproachHud from './components/hud/AnchorageApproachHud.tsx';
import SystemTravelProbe from './components/SystemTravelProbe.tsx';
import SystemTravelDriver from './components/SystemTravelDriver.tsx';
import TouchControls from './components/mobile/TouchControls.tsx';
import TouchDPad from './components/mobile/TouchDPad.tsx';
import CinematicHudVeil from './components/hud/CinematicHudVeil.tsx';
import {
  closeMobileHudDisclosure,
  getActiveMobileHudDisclosure,
  subscribeMobileHudDisclosure
} from './components/mobile/mobileHudDisclosure.ts';
import { isTouchDevice, releaseAllKeys } from './utils/mobileInput.ts';
import PoseRecorder from './components/debug/PoseRecorder.tsx';
import SceneReadyProbe from './components/SceneReadyProbe.tsx';
import VantageToast from './components/hud/VantageToast.tsx';
import ResourceGainToast from './components/hud/ResourceGainToast.tsx';
import LookedAtIndicator from './components/hud/LookedAtIndicator.tsx';
import InventoryPanel from './components/hud/InventoryPanel.tsx';
import CrashFlash from './components/hud/CrashFlash.tsx';
import LavaHeatVignette from './components/hud/LavaHeatVignette.tsx';
import VitalsMeter from './components/hud/VitalsMeter.tsx';
import { getInventoryTopOffset } from './components/hud/VitalsMeter.model.ts';
import InteractionPrompt from './components/hud/InteractionPrompt.tsx';
import BuildIndicator from './components/hud/BuildIndicator.tsx';
import TargetReticle from './components/hud/TargetReticle.tsx';
import MiningProgress from './components/hud/MiningProgress.tsx';
import CockpitReadout from './components/hud/CockpitReadout.tsx';
import MultiplayerStatusBadge from './components/hud/MultiplayerStatusBadge.tsx';
import OrbitalMinimap from './components/hud/OrbitalMinimap.tsx';
import HudCornerActions from './components/hud/HudCornerActions.tsx';
import {
  environmentResolutionForProfile,
  getGraphicsQuality,
  getQualityProfile,
  isSoftwareWebGLRenderer,
  overrideGraphicsQuality,
  readPersistedQualityProfile,
  resolveQualityProfileSelection,
  subscribeGraphicsQuality,
  setQualityProfile
} from './config/graphicsSettings.ts';
import {
  parseVoxelRealityStage,
  setVoxelRealityStage
} from './game/systems/realityRenderSystem.ts';
import type { CurrentWorld, WorldCoordinate } from './utils/worldCoordinates.ts';
import {
  coordinateKey,
  coordinatesEqual,
  createCurrentWorld,
  normalizeCoordinatePart
} from './utils/worldCoordinates.ts';
import { findHospitableStart } from './game/data/planetArchetypes.ts';
import { createOfflineCommandContext } from './game/gameplayCommands.ts';
import { ensureAnonymousPlayerSession } from './game/multiplayerAuth.ts';
import {
  getMultiplayerSessionSnapshot,
  requestMultiplayerPartyWarp,
  setMultiplayerPartyWarpHandler,
  subscribeMultiplayerSession
} from './game/multiplayerSession.ts';
import { getLocalActorId, subscribeLocalActorId } from './game/playerActors.ts';
import { worldIdentityFromCurrentWorld } from './game/worldIdentity.ts';
import { resolvePlanetProfile } from './game/PlanetProfile.ts';
import {
  buildStarSystemManifest,
  createPlanetIdentity,
  parsePlanetWorldId,
  type PlanetDescriptor
} from './game/starSystem.ts';
import { getCurrentDayPhase, setDayPhaseOffset } from './game/worldClock.ts';
import { toggleBuildMode, isBuildEnabled, selectPieceByIndex, setBuildEnabled, cycleBuildRotation, subscribeBuildState } from './game/systems/buildState.ts';
import { setFreeBuild, subscribeStructures } from './game/systems/structureSystem.ts';
import { setInstantHarvest } from './game/systems/harvestingSystem.ts';
import {
  loadGlobal,
  restoreGlobal,
  saveGlobal,
  saveWorld,
  saveVoxelEdits,
  savePlayerPose,
  setLocalPersistenceMode
} from './game/systems/persistence.ts';
import { voxelSystem } from './utils/efficientVoxelSystem.ts';
import { subscribeInventory } from './game/systems/inventorySystem.ts';
import { subscribeCampfires } from './game/systems/campfires.ts';
import { subscribeMaw } from './game/systems/mawSystem.ts';
import { getMilestones, hasMilestone, subscribeProgression } from './game/systems/progressionSystem.ts';
import { setMapViewOpen, toggleMapView } from './game/mapView.ts';
import MapOverlay from './components/hud/MapOverlay.tsx';

const milestoneCount = () => getMilestones().length;
import { subscribeTreeHarvest } from './game/systems/treeHarvest.ts';
import { subscribeStonePickup } from './game/systems/stonePickup.ts';
import { isDowned, subscribeVitals } from './game/systems/survivalVitals.ts';
import { subscribeWaterskin } from './game/systems/consumeSystem.ts';
import { subscribeShipRestoration } from './game/systems/shipRestoration.ts';
import { installKestrelFabricatorAccess } from './story/kestrelFabricator.ts';
import {
  hasWorldGenCacheEntry,
  hydrateWorldGenCacheFromPackedPayload,
  scheduleWorldPrewarm
} from './utils/worldGenCache.ts';
import { scheduleGrassInstancePrewarm } from './utils/grassField.ts';
import {
  WorldPrepCancelledError,
  WorldPrepClient
} from './utils/worldPrepClient.ts';
import { createWorldPrepRequest } from './utils/worldPrepProtocol.ts';
import type { ArrivalMode } from './utils/worldArrival.ts';
import { WarpDriver, WarpFlash } from './components/effects/WarpOverlay.tsx';
import {
  beginSystemHandoff,
  beginTravel,
  debugStartInDescent,
  debugStartInSpace,
  enterAtmosphere,
  exitShip,
  getSpaceFlightSnapshot,
  getWarp,
  notifyLanded,
  setArrivalHandler,
  useSpaceFlight
} from './state/spaceFlight.ts';
import { isPhysicalBoardingVehicleControlLocked } from './story/physicalBoarding.ts';
import {
  commitSystemBodyTarget,
  commitSystemPlanetHandoff,
  getSystemFlightSnapshot
} from './state/systemFlight.ts';
import {
  restoreShipFlightForWorld,
  shipFlightWorldContext
} from './state/shipFlightContinuity.ts';
import { isWarpMetricsEnabled, markWarpMetric } from './utils/warpMetrics.ts';
import {
  useAppState,
  getAppStateSnapshot,
  setGameCanvas,
  getGameCanvas,
  enterPlaying,
  resetSceneReady,
  returnToMenu
} from './state/appState.ts';
import LandingMenu from './components/ui/LandingMenu.tsx';
import StoryOverlays from './story/StoryOverlays.tsx';
import StoryDirectorDriver from './story/StoryDirectorDriver.tsx';
import VehicleSceneAvDriver from './story/VehicleSceneAvDriver.tsx';
import StoryDebugPanel, { storyDebugEnabled } from './story/StoryDebugPanel.tsx';
import {
  VEHICLE_SCENE_AV_EVENTS,
  activateVehicleSceneAvEvent,
  isTidegardenApproachAuthorityReady
} from './story/vehicleSceneAvAnchors.ts';
import {
  beginStory,
  deactivateStory,
  getStoryStateSnapshot,
  initStoryFromSave,
  restartStory,
  storyHudMask,
  STORY_MILESTONES,
  storyHudHideInventory,
  storyHudHideVitals,
  storyHudTakeover,
  storyUsesEmbodiedGuidanceHud,
  storyUsesEarlyTouchDpad,
  useStoryState
} from './story/storyState.ts';
import { getStoryInputPolicy } from './story/storyInputPolicy.ts';
import { subscribeStoryUiRequests } from './story/storyUiRequests.ts';
import { setStoryPaused } from './story/storyClock.ts';
import { isStoryWorld, STORY_COORDINATE } from './story/world/storyWorld.ts';
import {
  isTidegardenRouteOnline,
  resolveStoryBootWorldId,
  resolveStoryRuntimeWorldId,
  storySystemPopulationPolicy,
  TIDEGARDEN_WORLD_ID
} from './story/tidegardenRoute.ts';
import PauseMenu, { type NavApi } from './components/ui/PauseMenu.tsx';
import StoryCompletePanel from './components/ui/StoryCompletePanel.tsx';
import DeathSequenceOverlay from './components/hud/DeathSequenceOverlay.tsx';
import CraftingPanel from './components/ui/CraftingPanel.tsx';
import { requestSurvivalRecovery } from './game/systems/survivalRecovery.ts';
import AudioDirector from './components/audio/AudioDirector.tsx';
import { installGameAudioUnlockOnFirstTrustedGesture } from './audio/gameAudio.ts';
import { playSfx } from './audio/sfxEngine.ts';
import './App.css';

const SUN_POSITION: [number, number, number] = [100, 20, 100];

function webGLRendererName(renderer: THREE.WebGLRenderer): string | null {
  try {
    const context = renderer.getContext();
    const debug = context.getExtension('WEBGL_debug_renderer_info') as {
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const value = context.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

interface SystemReactProfileSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

function recordSystemReactProfile(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
): void {
  const win = window as unknown as { __paravoxiaSystemReactProfiles?: SystemReactProfileSample[] };
  const samples = win.__paravoxiaSystemReactProfiles ?? [];
  samples.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
  if (samples.length > 80) samples.splice(0, samples.length - 80);
  win.__paravoxiaSystemReactProfiles = samples;
}

const buttonBase: React.CSSProperties = {
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12
};

const inputBase: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  color: 'white',
  background: '#111827',
  border: '1px solid #334155',
  borderRadius: 4,
  fontFamily: 'monospace'
};

const debugCloseButton: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#cbd5e1',
  background: 'rgba(15,23,42,0.9)',
  border: '1px solid rgba(148,163,184,0.5)',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  zIndex: 1,
  pointerEvents: 'auto'
};

const mobileDebugDockStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(10px + env(safe-area-inset-top, 0px))',
  left: 'calc(10px + env(safe-area-inset-left, 0px))',
  right: 'calc(10px + env(safe-area-inset-right, 0px))',
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
  pointerEvents: 'none'
};

const mobileDebugButtonRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'auto'
};

const mobileDebugPill: React.CSSProperties = {
  minHeight: 38,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: '#d8f3ff',
  background: 'rgba(8,13,24,0.82)',
  border: '1px solid rgba(125,211,252,0.35)',
  borderRadius: 999,
  padding: '8px 11px',
  fontFamily: 'monospace',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  cursor: 'pointer',
  touchAction: 'manipulation',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
};

const mobileDebugMiniButton: React.CSSProperties = {
  width: 38,
  height: 38,
  color: '#d8f3ff',
  background: 'rgba(8,13,24,0.82)',
  border: '1px solid rgba(125,211,252,0.28)',
  borderRadius: 999,
  fontFamily: 'monospace',
  fontSize: 16,
  cursor: 'pointer',
  touchAction: 'manipulation',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
};

const mobileDebugSheet: React.CSSProperties = {
  marginTop: 52,
  width: 'min(360px, 100%)',
  maxHeight: 'min(360px, 38vh)',
  display: 'flex',
  flexDirection: 'column',
  color: '#e6eef7',
  background: 'rgba(8,13,24,0.9)',
  border: '1px solid rgba(125,211,252,0.32)',
  borderRadius: 8,
  boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  pointerEvents: 'auto',
  touchAction: 'pan-y',
  backdropFilter: 'blur(16px) saturate(120%)',
  WebkitBackdropFilter: 'blur(16px) saturate(120%)'
};

const mobileDebugSheetHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 46,
  padding: '8px 8px 8px 12px',
  borderBottom: '1px solid rgba(125,211,252,0.18)'
};

const mobileDebugScroll: React.CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: '10px 12px 12px',
  fontFamily: 'monospace',
  fontSize: 11,
  lineHeight: 1.45
};

const mobileDebugRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  padding: '5px 0',
  borderBottom: '1px solid rgba(148,163,184,0.14)',
  overflowWrap: 'anywhere'
};

const mobileDebugSectionLabel: React.CSSProperties = {
  margin: '12px 0 6px',
  color: '#7dd3fc',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0
};

function parseCurrentWorldId(worldId: string): CurrentWorld | null {
  const address = parsePlanetWorldId(worldId);
  if (!address) return null;
  const identity = createPlanetIdentity(address);
  return {
    worldId: identity.worldId,
    coordinate: { ...identity.address.system },
    seed: identity.seed
  };
}

const App: React.FC = () => {
  const [queryParams] = useState(() => new URLSearchParams(window.location.search));
  const [graphicsBoot] = useState(() => {
    const persisted = readPersistedQualityProfile();
    const selection = resolveQualityProfileSelection(queryParams.get('profile'), persisted);
    setQualityProfile(selection.profile, { persist: false });
    if (queryParams.get('painterly') === '1') overrideGraphicsQuality({ painterly: true });
    if (queryParams.get('ao') === '0') overrideGraphicsQuality({ contactAO: false });
    if (queryParams.get('outline') === '0') overrideGraphicsQuality({ outline: false });
    return {
      allowAutomaticSoftwareFallback: selection.source === 'default'
    };
  });
  const graphicsQuality = useSyncExternalStore(
    subscribeGraphicsQuality,
    getGraphicsQuality,
    getGraphicsQuality
  );
  const profile = getQualityProfile();
  const environmentResolution = environmentResolutionForProfile(profile);
  const softwareFallbackAppliedRef = useRef(false);
  const totalVoxels = planetSize ** 3;
  // Load the saved game ONCE, before children mount: restores global stores
  // (inventory/maw/era) and gives us the base coordinate to spawn back at.
  const [bootSave] = useState(() => {
    const s = loadGlobal();
    if (s) { restoreGlobal(s); if (s.dayPhase != null) setDayPhaseOffset(s.dayPhase); }
    // AFTER restore (milestones loaded): handle ?story= deep links / resume state.
    initStoryFromSave();
    return s;
  });
  const [currentWorld, setCurrentWorld] = useState<CurrentWorld>(() => {
    // ?world=x,y -> spawn on foot directly on that coordinate's planet (debug: lets
    // you inspect a specific seed's terrain/trees without travelling there).
    try {
      const raw = new URLSearchParams(window.location.search).get('world');
      if (raw) {
        const parsed = parseCurrentWorldId(raw);
        if (parsed) return parsed;
      }
    } catch { /* ignore */ }
    // Story mode plays on ONE pinned planet (deterministic props/quota/vantages).
    // The completed slice ('done' — story inactive, chapter complete) is the
    // SAME world at its earned stage, not a fresh random start.
    const bootStory = getStoryStateSnapshot();
    if (bootStory.active || bootStory.chapter === 'complete') {
      const storyResumeWorld = parseCurrentWorldId(resolveStoryBootWorldId(
        bootSave?.lastPlanetWorldId,
        isTidegardenRouteOnline(),
        bootStory
      ));
      return storyResumeWorld ?? createCurrentWorld(STORY_COORDINATE);
    }
    // Returning player -> spawn back at your saved base (so reloads don't strand you).
    if (bootSave?.lastPlanetWorldId) {
      const address = parsePlanetWorldId(bootSave.lastPlanetWorldId);
      if (address) {
        const planet = createPlanetIdentity(address);
        return {
          worldId: planet.worldId,
          coordinate: planet.coordinate,
          seed: planet.seed
        };
      }
    }
    if (bootSave?.lastWorld) return createCurrentWorld(bootSave.lastWorld);
    // Fresh game -> CRASH-LAND on a HOSPITABLE planet (verdant/oceanic): trees, grass,
    // biofiber, stone, no early hazard — the Primitive era's necessities.
    return createCurrentWorld(findHospitableStart());
  });
  const currentWorldRef = useRef(currentWorld);
  currentWorldRef.current = currentWorld;
  const pendingPartyWorldHandoffRef = useRef<string | null>(null);
  const suppressWorldCleanupSaveRef = useRef(new Set<string>());
  const [previousWorld, setPreviousWorld] = useState<CurrentWorld | null>(null);
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode>(() => {
    const context = shipFlightWorldContext(currentWorld);
    if (context) restoreShipFlightForWorld(context);
    return getSpaceFlightSnapshot().phase === 'descent' ? 'approach' : 'surface';
  });
  const [targetX, setTargetX] = useState('1');
  const [targetY, setTargetY] = useState('0');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugColliders, setDebugColliders] = useState(false);
  const [debugState, setDebugState] = useState<SceneDebugState>({ player: null, planet: null });
  const [debugHudVisible, setDebugHudVisible] = useState(true);
  const [mobileDebugOpen, setMobileDebugOpen] = useState(false);
  const [buildHudTick, setBuildHudTick] = useState(0);
  const [benchSample, setBenchSample] = useState<BenchmarkSample | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const isTouch = useMemo(() => isTouchDevice(), []);
  const activeMobileHudDisclosure = useSyncExternalStore(
    subscribeMobileHudDisclosure,
    getActiveMobileHudDisclosure,
    () => null
  );
  const flight = useSpaceFlight();
  const { phase: appPhase, sceneReady: appSceneReady } = useAppState();
  useEffect(() => {
    if (appPhase !== 'playing') return undefined;
    return installGameAudioUnlockOnFirstTrustedGesture();
  }, [appPhase]);
  const story = useStoryState();
  // Milestone-gated HUD (the ch3 sense introductions) re-renders on progression.
  useSyncExternalStore(subscribeProgression, milestoneCount, milestoneCount);
  const tidegardenRouteOnline = isTidegardenRouteOnline();
  const storyRuntimeWorldId = story.active
    ? resolveStoryRuntimeWorldId(
        currentWorld.worldId,
        tidegardenRouteOnline,
        story,
        getSystemFlightSnapshot().activePlanetId
      )
    : currentWorld.worldId;
  const storyWorldSwapPending = story.active && storyRuntimeWorldId !== currentWorld.worldId;
  const [paused, setPaused] = useState(false);
  const [objectiveJournalOpen, setObjectiveJournalOpen] = useState(false);
  const hudBlockingOverlayOpen = objectiveJournalOpen
    || (isTouch && activeMobileHudDisclosure !== null);
  const [storyCompleteOpen, setStoryCompleteOpen] = useState(false);
  const [pendingCompletedSiteEntry, setPendingCompletedSiteEntry] = useState(false);
  const setPauseState = useCallback((next: boolean) => {
    setStoryPaused(next);
    setPaused(next);
  }, []);
  useEffect(() => () => setStoryPaused(false), []);
  // The second hearth is a handback, not a modal victory screen. Completion
  // leaves pointer lock, movement, and the living world untouched; the panel is
  // retained only for its explicit developer preview/replay surface.
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [localActorId, setLocalActorIdState] = useState(() => getLocalActorId());
  const downed = useSyncExternalStore(
    subscribeVitals,
    () => isDowned(localActorId),
    () => false
  );
  const downedRef = useRef(downed);
  downedRef.current = downed;
  // Ref mirror so the pointer-lock listener (bound once) can read the live value
  // without a stale closure — same trick the lock handler uses for app phase.
  const craftingOpenRef = useRef(false);

  const setObjectiveJournalState = useCallback((open: boolean) => {
    releaseAllKeys();
    if (open) {
      closeMobileHudDisclosure();
      craftingOpenRef.current = false;
      setCraftingOpen(false);
      setMapViewOpen(false);
    }
    setObjectiveJournalOpen(open);
  }, []);

  useEffect(() => {
    setStoryPaused(paused || hudBlockingOverlayOpen);
  }, [paused, hudBlockingOverlayOpen]);

  useEffect(() => {
    let cancelled = false;
    ensureAnonymousPlayerSession()
      .then(session => {
        if (!session || cancelled) return;
        console.info('[co-op] Firebase anonymous session ready', { uid: session.uid });
      })
      .catch(error => {
        if (!cancelled) console.warn('[co-op] Firebase anonymous sign-in failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeLocalActorId(() => setLocalActorIdState(getLocalActorId())), []);
  useEffect(() => subscribeBuildState(() => setBuildHudTick(n => n + 1)), []);
  useEffect(
    () => installKestrelFabricatorAccess(() => currentWorld.worldId),
    [currentWorld.worldId]
  );

  useEffect(() => {
    if (!downed) return;
    craftingOpenRef.current = false;
    setCraftingOpen(false);
    setMapViewOpen(false);
    setBuildEnabled(false);
    closeMobileHudDisclosure();
    setObjectiveJournalOpen(false);
    setPauseState(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [downed, setPauseState]);

  // Entering story mode from the menu swaps to the pinned story world. The swap
  // happens behind the (opaque) prologue overlay while the app phase is still
  // 'menu', so the remount + regeneration are never visible.
  useEffect(() => {
    if (!story.active) return;
    const storyWorldId = storyRuntimeWorldId;
    if (currentWorld.worldId === storyWorldId) return;
    const storyWorld = parseCurrentWorldId(storyWorldId) ?? createCurrentWorld(STORY_COORDINATE);
    setPreviousWorld(currentWorld);
    resetSceneReady();
    setCurrentWorld(storyWorld);
    setArrivalMode(story.beat === 'ch8-landfall' ? 'approach' : 'surface');
  }, [story, storyRuntimeWorldId, currentWorld]);

  // Open/close the Fabricator. Opening releases pointer lock so the cursor can
  // click recipes; the lock handler below knows to NOT treat that as a pause.
  const openCrafting = () => {
    if (getAppStateSnapshot().phase !== 'playing') return;
    closeMobileHudDisclosure();
    setObjectiveJournalOpen(false);
    craftingOpenRef.current = true;
    setCraftingOpen(true);
    setPauseState(false);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const closeCrafting = () => {
    craftingOpenRef.current = false;
    setCraftingOpen(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  // Authored transactions close the Fabricator before camera, captions, or
  // interaction ownership changes. This is a request channel, not a story
  // dependency on React-local UI state.
  useEffect(() => subscribeStoryUiRequests(request => {
    if (request.type === 'close-crafting' && craftingOpenRef.current) closeCrafting();
  // closeCrafting intentionally follows the live touch/pointer-lock mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isTouch]);

  // Esc (and any pointer-lock loss / focus change) opens the pause + star map
  // while playing on desktop — a raw Esc keydown is swallowed during lock, so we
  // react to the lock state instead. Re-acquiring lock closes it.
  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement) { setPauseState(false); return; }
      if (downedRef.current) return;
      if (craftingOpenRef.current) return; // Fabricator released lock on purpose
      if (getAppStateSnapshot().phase === 'playing' && !isTouch) setPauseState(true);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [isTouch, setPauseState]);

  // M toggles the survey chart (the nav era's overhead view, retained as a
  // tool). Story saves unlock it by completing the nav rung; from then on the
  // gate is POLICY-DRIVEN, not a beat whitelist: any beat with free look and
  // live feet has the chart (cutscenes freeze the feet, feed eras own the
  // look — both refuse it by construction).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM') return;
      if (isDowned()) return;
      if (paused) return;
      if (flight.controlMode !== 'fps' || getAppStateSnapshot().phase !== 'playing') return;
      const policy = getStoryInputPolicy();
      if (policy.lookMode !== 'free') return;
      const s = getStoryStateSnapshot();
      if (hasMilestone(STORY_MILESTONES.started) && !hasMilestone(STORY_MILESTONES.ch1Nav)) return;
      if (s.active && policy.moveSpeedScale <= 0) return;
      toggleMapView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flight.controlMode, paused]);

  // Any beat change closes the chart (cutscenes own the camera).
  useEffect(() => {
    setMapViewOpen(false);
    closeMobileHudDisclosure();
    setObjectiveJournalOpen(false);
  }, [story.beat, flight.controlMode]);

  // C toggles the Fabricator on foot; Esc closes it (its lock is already released,
  // so the lock-based pause path doesn't fire). Re-bound when pause/mode changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') {
        if (isDowned()) return;
        if (flight.controlMode !== 'fps' || getAppStateSnapshot().phase !== 'playing') return;
        if (!getStoryInputPolicy().allowCraft) return; // story chapters gate the Fabricator
        if (craftingOpenRef.current) closeCrafting();
        else if (!paused) openCrafting();
      } else if (e.code === 'Escape' && craftingOpenRef.current) {
        closeCrafting();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, isTouch, flight.controlMode]);

  // B toggles build mode (on foot); 1..9, 0, and - select build pieces. Build
  // mode keeps pointer lock — it does NOT release the cursor like the Fabricator.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isDowned()) return;
      if (flight.controlMode !== 'fps' || getAppStateSnapshot().phase !== 'playing') return;
      if (craftingOpenRef.current || paused) return;
      if (!getStoryInputPolicy().allowBuild) return; // story chapters gate build mode
      if (e.code === 'KeyB') toggleBuildMode();
      else if (isBuildEnabled() && e.code === 'KeyR') cycleBuildRotation(); // R rotates while building (reset is suppressed in build mode)
      else if (isBuildEnabled() && e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        selectPieceByIndex(n === 0 ? 9 : n - 1); // 1..9 → 0..8, 0 → 10th piece
      } else if (isBuildEnabled() && e.code === 'Minus') selectPieceByIndex(10);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, flight.controlMode]);

  // Leaving foot mode (ship/menu) exits build mode.
  useEffect(() => { if (flight.controlMode !== 'fps') setBuildEnabled(false); }, [flight.controlMode]);

  const resumeFromPause = () => {
    setPauseState(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const quitToMenu = () => {
    setPauseState(false);
    if (document.pointerLockElement) document.exitPointerLock();
    deactivateStory(); // progress is already checkpointed in milestones
    returnToMenu();
  };

  const continueAtCompletedSite = () => {
    setStoryCompleteOpen(false);
    setPauseState(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const returnCompletedToMenu = () => {
    setStoryCompleteOpen(false);
    setPauseState(false);
    if (document.pointerLockElement) document.exitPointerLock();
    returnToMenu();
  };

  const recoverFromDowned = () => {
    requestSurvivalRecovery();
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* canvas click remains available */ }
    }
  };

  const replayStoryFromBeginning = () => {
    setStoryCompleteOpen(false);
    setPauseState(false);
    if (document.pointerLockElement) document.exitPointerLock();
    returnToMenu();
    // restartStory destructively clears both authored planets. Suppress the
    // normal old-world cleanup save once, or React's p1 unmount would write the
    // just-cleared base back into storage from the still-mounted field stores.
    suppressWorldCleanupSaveRef.current.add(currentWorld.worldId);
    restartStory();
    const replayWorld = createCurrentWorld(STORY_COORDINATE);
    setPreviousWorld(null);
    setCurrentWorld(replayWorld);
    setArrivalMode('surface');
    resetSceneReady();
    saveGlobal(replayWorld, getCurrentDayPhase());
  };

  const returnToCompletedStorySite = () => {
    beginStory();
    const siteWorld = parseCurrentWorldId(TIDEGARDEN_WORLD_ID)
      ?? createCurrentWorld(STORY_COORDINATE);
    setPendingCompletedSiteEntry(true);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
    if (currentWorld.worldId !== siteWorld.worldId) {
      setPreviousWorld(currentWorld);
      resetSceneReady();
      setCurrentWorld(siteWorld);
    }
    setArrivalMode('surface');
  };

  const toggleBuildHud = () => {
    if (flight.controlMode !== 'fps' || getAppStateSnapshot().phase !== 'playing') return;
    closeMobileHudDisclosure();
    setObjectiveJournalOpen(false);
    craftingOpenRef.current = false;
    setCraftingOpen(false);
    setPauseState(false);
    toggleBuildMode();
  };
  const pauseAndOpenStarMap = () => {
    closeMobileHudDisclosure();
    setObjectiveJournalOpen(false);
    craftingOpenRef.current = false;
    setCraftingOpen(false);
    if (document.pointerLockElement) document.exitPointerLock();
    setPauseState(true);
  };
  const currentWorldKey = currentWorld.worldId;
  const buildModeOpen = useMemo(() => isBuildEnabled(), [buildHudTick]);
  const inventoryTopOffset = useMemo(() => getInventoryTopOffset(isTouch), [isTouch]);
  // Whether the survey chart is openable right now — the same POLICY gate the
  // desktop [M] key applies (App.tsx onKey above). Drives the touch CHART
  // affordance (corner menu + pause reference) so touch matches the keyboard.
  const chartInputPolicy = getStoryInputPolicy();
  const chartAvailable = flight.controlMode === 'fps'
    && chartInputPolicy.lookMode === 'free'
    && !(hasMilestone(STORY_MILESTONES.started) && !hasMilestone(STORY_MILESTONES.ch1Nav))
    && !(story.active && chartInputPolicy.moveSpeedScale <= 0);
  const currentWorldIdentity = useMemo(() => worldIdentityFromCurrentWorld(currentWorld), [currentWorld.worldId, currentWorld.seed]);
  const activePlanetProfile = useMemo(
    () => resolvePlanetProfile({
      worldId: currentWorldIdentity.worldId,
      seed: currentWorldIdentity.seed
    }).profile,
    [currentWorldIdentity.worldId, currentWorldIdentity.seed]
  );
  useEffect(() => {
    if (!pendingCompletedSiteEntry || appPhase !== 'menu' || !appSceneReady) return;
    if (!isStoryWorld(currentWorld.coordinate)) return;
    // This runs after the old world's effect cleanup/autosave and after the new
    // Story scene has painted, so lastWorld cannot be overwritten by the world
    // we just left and the landing shell never reveals an unready destination.
    saveGlobal(currentWorldIdentity, getCurrentDayPhase());
    setPendingCompletedSiteEntry(false);
    enterPlaying();
  }, [appPhase, appSceneReady, currentWorld.coordinate, currentWorldIdentity, pendingCompletedSiteEntry]);
  const commandContext = useMemo(
    () => createOfflineCommandContext(currentWorldIdentity, { actorId: localActorId }),
    [currentWorldIdentity.worldId, currentWorldIdentity.generationSchemaVersion, localActorId]
  );

  useEffect(() => {
    const syncLocalPersistenceMode = () => {
      const session = getMultiplayerSessionSnapshot();
      setLocalPersistenceMode(session.roomId || session.status === 'connected' ? 'multiplayer' : 'offline');
    };
    syncLocalPersistenceMode();
    return subscribeMultiplayerSession(syncLocalPersistenceMode);
  }, []);

  useEffect(() => {
    const alignToCoopWorld = () => {
      const session = getMultiplayerSessionSnapshot();
      if (session.status !== 'connected' || !session.worldId || session.worldId === currentWorldIdentity.worldId) return;
      const world = parseCurrentWorldId(session.worldId);
      if (!world) return;
      if (pendingPartyWorldHandoffRef.current === session.worldId) return;
      const warp = getWarp();
      // Party warp broadcasts arrive before their visual handoff completes.
      // Keep rendering the source planet while either interstellar or
      // same-system exposure owns the midpoint swap.
      if (warp.active) return;
      setPreviousWorld(currentWorld);
      setCurrentWorld(world);
      setArrivalMode('surface');
      setTargetX(String(world.coordinate.x));
      setTargetY(String(world.coordinate.y));
    };
    alignToCoopWorld();
    return subscribeMultiplayerSession(alignToCoopWorld);
  }, [currentWorld, currentWorldIdentity.worldId]);

  // Register the warp-midpoint arrival handler: the actual world swap fires while
  // the screen is fully white, so the EfficientScene remount + regen are hidden.
  // Re-registered when currentWorld changes so "previous" tracks the world we
  // were on at the moment of departure.
  useEffect(() => {
    setArrivalHandler(coordinate => {
      markWarpMetric('app:arrival_handler:start', { x: coordinate.x, y: coordinate.y });
      const world = createCurrentWorld(coordinate);
      if (coordinatesEqual(world.coordinate, currentWorld.coordinate)) return;
      setPreviousWorld(currentWorld);
      setCurrentWorld(world);
      setArrivalMode('approach');
      setTargetX(String(world.coordinate.x));
      setTargetY(String(world.coordinate.y));
      markWarpMetric('app:arrival_handler:state_queued', {
        x: world.coordinate.x,
        y: world.coordinate.y,
        seed: world.seed
      });
    });
    return () => setArrivalHandler(null);
  }, [currentWorld]);

  useEffect(() => {
    if (!isWarpMetricsEnabled()) return;
    const win = window as unknown as {
      __paravoxiaWarpProbe?: { travelTo: (x: number, y: number) => void };
    };
    const probe = {
      travelTo: (x: number, y: number) => {
        const coordinate = {
          x: normalizeCoordinatePart(x),
          y: normalizeCoordinatePart(y)
        };
        if (coordinatesEqual(coordinate, currentWorld.coordinate)) return;
        const world = createCurrentWorld(coordinate);
        scheduleWorldPrewarm(planetSize, world.seed, {
          worldId: world.worldId,
          terrainData: true,
          waterFaces: true
        });
        scheduleGrassInstancePrewarm(planetSize, world.seed, world.worldId);
        if (!requestMultiplayerPartyWarp(coordinate)) beginTravel(coordinate);
      }
    };
    win.__paravoxiaWarpProbe = probe;
    return () => {
      if (win.__paravoxiaWarpProbe === probe) {
        delete win.__paravoxiaWarpProbe;
      }
    };
  }, [currentWorld.coordinate]);
  const compactOverlay = useMemo(
    () => (typeof window === 'undefined' ? false : window.innerWidth <= 700),
    []
  );

  const nearbyWorlds = useMemo(() => {
    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];

    return offsets.map(([dx, dy]) => createCurrentWorld({
      x: currentWorld.coordinate.x + dx,
      y: currentWorld.coordinate.y + dy
    }));
  }, [currentWorld.coordinate.x, currentWorld.coordinate.y]);

  const jumpToWorld = (world: CurrentWorld) => {
    if (coordinatesEqual(world.coordinate, currentWorld.coordinate)) return;
    scheduleWorldPrewarm(planetSize, world.seed, {
      worldId: world.worldId,
      terrainData: true,
      waterFaces: true
    });
    scheduleGrassInstancePrewarm(planetSize, world.seed, world.worldId);
    // Route through the warp: beginTravel plays the warp-in and the registered
    // arrival handler performs the real world swap at the white-out midpoint.
    if (!requestMultiplayerPartyWarp(world.coordinate)) beginTravel(world.coordinate);
  };

  const jumpToCoordinate = (coordinate: WorldCoordinate) => {
    jumpToWorld(createCurrentWorld(coordinate));
  };

  const jumpToTarget = () => {
    jumpToCoordinate({
      x: normalizeCoordinatePart(Number(targetX)),
      y: normalizeCoordinatePart(Number(targetY))
    });
  };

  const jumpToRandomWorld = () => {
    jumpToWorld(createCurrentWorld({
      x: Math.floor(Math.random() * 201) - 100,
      y: Math.floor(Math.random() * 201) - 100
    }));
  };

  const returnToPreviousWorld = () => {
    if (!previousWorld) return;
    if (!requestMultiplayerPartyWarp(previousWorld.coordinate)) beginTravel(previousWorld.coordinate);
  };

  // ?bench=1 enables the perf probe; ?profile=ULTRA|HIGH|... selects quality;
  // ?painterly=1 force-enables the painterly look for testing.
  // ?voxelStage=bare|color|material|alive|paradox previews plot-gated rendering.
  const {
    benchEnabled,
    overviewEnabled,
    agentEnabled,
    atlasCapture,
    flyDebug,
    descentDebug,
    debugUiEnabled,
    storyCompletePreview,
    systemBodiesEnabled,
    systemBodyCountOverride,
    systemProbeEnabled
  } = useMemo(() => {
    const params = queryParams;
    const voxelStage = parseVoxelRealityStage(params.get('voxelStage') ?? params.get('realityStage'));
    if (voxelStage) setVoxelRealityStage(voxelStage);
    const systemBodies = params.get('systemBodies') ?? params.get('multiplanet');
    const requestedBodyCount = Number(systemBodies);
    const systemBodyCountOverride = requestedBodyCount === 1
      || requestedBodyCount === 2
      || requestedBodyCount === 3
      ? requestedBodyCount as 1 | 2 | 3
      : undefined;
    return {
      benchEnabled: params.get('bench') === '1',
      // ?overview=1 -> non-interactive overhead debug camera (water inspection).
      overviewEnabled: params.get('overview') === '1',
      // ?agent=1 -> verification harness: scriptable camera + window.__game bridge.
      agentEnabled: params.get('agent') === '1',
      // ?atlas=1 -> clean procedural capture: no player HUD overlays.
      atlasCapture: params.get('atlas') === '1',
      // ?fly=1 -> jump straight into deep-space flight for runtime checks.
      flyDebug: params.get('fly') === '1',
      // ?descent=x,y -> load directly into the high-altitude descent over (x,y).
      descentDebug: (() => {
        const raw = params.get('descent');
        if (!raw) return null;
        const [sx, sy] = raw.split(',');
        return { x: normalizeCoordinatePart(Number(sx)), y: normalizeCoordinatePart(Number(sy)) };
      })(),
      systemBodiesEnabled: systemBodies !== '0',
      systemBodyCountOverride,
      systemProbeEnabled: params.get('systemprobe') === '1',
      // ?debug=1 -> reveal the developer overlays (voxel stats, collider toggle,
      // raw coordinate panel). Hidden from the production UI otherwise.
      debugUiEnabled: params.get('debug') === '1',
      storyCompletePreview: import.meta.env.DEV && params.get('storyCompletePreview') === '1'
    };
  }, [queryParams]);

  const currentSystemManifest = useMemo(
    () => {
      if (isStoryWorld(currentWorld.coordinate)) {
        const storyPopulation = storySystemPopulationPolicy(tidegardenRouteOnline);
        return buildStarSystemManifest(currentWorld.coordinate, storyPopulation.forceSingleBody
          ? { forceSingleBody: true }
          : { bodyCountOverride: storyPopulation.bodyCount });
      }
      const address = parsePlanetWorldId(currentWorld.worldId) ?? {
        system: currentWorld.coordinate,
        slot: 0 as const
      };
      const minimumBodyCount = (address.slot + 1) as 1 | 2 | 3;
      const bodyCountOverride = systemBodyCountOverride === undefined
        ? (minimumBodyCount > 1 ? minimumBodyCount : undefined)
        : Math.max(systemBodyCountOverride, minimumBodyCount) as 1 | 2 | 3;
      return buildStarSystemManifest(currentWorld.coordinate, {
        ...(bodyCountOverride === undefined ? {} : { bodyCountOverride })
      });
    },
    [
      currentWorld.coordinate.x,
      currentWorld.coordinate.y,
      currentWorld.worldId,
      systemBodyCountOverride,
      tidegardenRouteOnline
    ]
  );
  const currentPlanetAddress = useMemo(
    () => parsePlanetWorldId(currentWorld.worldId) ?? {
      system: currentWorld.coordinate,
      slot: 0 as const
    },
    [currentWorld.coordinate, currentWorld.worldId]
  );
  const activePlanetDescriptor = useMemo(
    () => currentSystemManifest.planets.find(planet => planet.worldId === currentWorld.worldId)
      ?? currentSystemManifest.planets[0],
    [currentSystemManifest, currentWorld.worldId]
  );
  const systemTravelEnabled = systemBodiesEnabled
    && (!isStoryWorld(currentWorld.coordinate) || tidegardenRouteOnline)
    && currentSystemManifest.planets.length > 1;

  const worldPrepClientRef = useRef<WorldPrepClient | null>(null);
  const worldPrepGenerationRef = useRef(0);
  useEffect(() => () => {
    worldPrepGenerationRef.current += 1;
    worldPrepClientRef.current?.dispose();
    worldPrepClientRef.current = null;
  }, []);

  /**
   * Docking clearance granted: hand off from the ship to the station interior.
   *
   * A navigation rather than an in-place scene swap, and that is a deliberate
   * limitation rather than a shortcut worth hiding. The interior wants a walking
   * near plane of eight centimetres; system space wants a far plane a hundred
   * kilometres out. They cannot share a depth buffer, so the two are separate
   * scenes with separate cameras — and swapping between them in place means
   * unmounting the live planet runtime and rebuilding it on undock, which is a
   * multi-second stall and a real risk to the story runtime's state.
   *
   * The interior this reaches is the shipped one, not a copy. What is missing is
   * only the seamlessness: the trip out of the station is a reload rather than a
   * hatch. That is the next piece of integration, and it is worth doing properly
   * rather than doing badly now.
   */
  const enterAnchorage = useCallback((body: { address: { system: { x: number; y: number }; index: number } }) => {
    const { system, index } = body.address;
    const params = new URLSearchParams(window.location.search);
    params.set('anchorage', `${system.x},${system.y},${index}`);
    // No approach: the ship already flew it. Arriving goes straight to the lock.
    params.delete('approach');
    window.location.assign(`${window.location.pathname}?${params.toString()}`);
  }, []);

  const prepareSystemTarget = useCallback(async (planet: PlanetDescriptor): Promise<boolean> => {
    if (hasWorldGenCacheEntry(planetSize, planet.seed, planet.worldId)) return true;
    const generation = ++worldPrepGenerationRef.current;
    const client = worldPrepClientRef.current ?? new WorldPrepClient();
    worldPrepClientRef.current = client;
    const activationEpoch = getSystemFlightSnapshot().activationEpoch;
    const request = createWorldPrepRequest({
      requestId: `system:${planet.worldId}:${activationEpoch}`,
      worldId: planet.worldId,
      seed: planet.seed,
      planetSize,
      activationEpoch
    });

    try {
      const payload = await client.prepare(request);
      await hydrateWorldGenCacheFromPackedPayload(payload, {
        budgetMs: 2.5,
        isCancelled: () => generation !== worldPrepGenerationRef.current
          || getSystemFlightSnapshot().activationEpoch !== activationEpoch
      });
      return generation === worldPrepGenerationRef.current
        && getSystemFlightSnapshot().activationEpoch === activationEpoch
        && hasWorldGenCacheEntry(planetSize, planet.seed, planet.worldId);
    } catch (error) {
      if (
        !(error instanceof WorldPrepCancelledError)
        && generation === worldPrepGenerationRef.current
        && getSystemFlightSnapshot().activationEpoch === activationEpoch
      ) {
        console.warn('[system-travel] Target preparation failed', {
          worldId: planet.worldId,
          error
        });
      }
      return false;
    }
  }, []);

  const cancelSystemTargetPreparation = useCallback(() => {
    worldPrepGenerationRef.current += 1;
    worldPrepClientRef.current?.cancel('System target lock was released');
  }, []);

  const isSystemTargetReady = useCallback(
    (worldId: string) => {
      const planet = currentSystemManifest.planets.find(candidate => candidate.worldId === worldId);
      return Boolean(planet && hasWorldGenCacheEntry(planetSize, planet.seed, planet.worldId));
    },
    [currentSystemManifest]
  );

  const beginPreparedSystemTargetHandoff = useCallback((
    planet: PlanetDescriptor,
    onAbort: () => void
  ): boolean => {
    if (
      (isStoryWorld(currentWorld.coordinate) && !tidegardenRouteOnline)
      || currentWorld.worldId === planet.worldId
    ) return false;
    if (!hasWorldGenCacheEntry(planetSize, planet.seed, planet.worldId)) return false;
    const liveFlight = getSpaceFlightSnapshot();
    if (liveFlight.controlMode !== 'flight' || liveFlight.phase !== 'deep_space') return false;

    const activationEpoch = getSystemFlightSnapshot().activationEpoch;
    const sourceWorldId = currentWorld.worldId;
    let committedEpoch: number | null = null;
    return beginSystemHandoff({
      worldId: planet.worldId,
      activationEpoch,
      isCurrent: () => {
        const systemFlight = getSystemFlightSnapshot();
        const spaceFlight = getSpaceFlightSnapshot();
        return currentWorldRef.current.worldId === sourceWorldId
          && systemFlight.systemId === planet.systemId
          && systemFlight.activationEpoch === activationEpoch
          && systemFlight.target?.kind === 'system_body'
          && systemFlight.target.worldId === planet.worldId
          && spaceFlight.controlMode === 'flight'
          && spaceFlight.phase === 'deep_space'
          && hasWorldGenCacheEntry(planetSize, planet.seed, planet.worldId);
      },
      onMidpoint: () => {
        committedEpoch = commitSystemPlanetHandoff({
          worldId: planet.worldId,
          renderOrigin: planet.systemPosition,
          expectedActivationEpoch: activationEpoch
        });
        resetSceneReady();
        enterAtmosphere();
        setCurrentWorld({
          worldId: planet.worldId,
          coordinate: { ...planet.coordinate },
          seed: planet.seed
        });
        pendingPartyWorldHandoffRef.current = null;
        setArrivalMode('approach');
        return true;
      },
      readyToReveal: () => {
        const systemFlight = getSystemFlightSnapshot();
        const spaceFlight = getSpaceFlightSnapshot();
        const sceneReady = getAppStateSnapshot().sceneReady;
        const ready = committedEpoch !== null
          && currentWorldRef.current.worldId === planet.worldId
          && systemFlight.activePlanetId === planet.worldId
          && systemFlight.activationEpoch === committedEpoch
          && sceneReady;
        if (ready && isTidegardenApproachAuthorityReady({
          targetWorldId: planet.worldId,
          currentWorldId: currentWorldRef.current.worldId,
          activePlanetId: systemFlight.activePlanetId,
          committedEpoch,
          activationEpoch: systemFlight.activationEpoch,
          sceneReady,
          locationMode: systemFlight.locationMode,
          controlMode: spaceFlight.controlMode,
          phase: spaceFlight.phase
        })) {
          activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.crossingApproach);
        }
        return ready;
      },
      onAbort
    });
  }, [currentWorld, tidegardenRouteOnline]);

  const activateSystemTarget = useCallback((planet: PlanetDescriptor, onAbort: () => void): boolean => {
    if (getMultiplayerSessionSnapshot().status === 'connected') {
      return requestMultiplayerPartyWarp(planet.worldId, { onRejected: onAbort });
    }
    return beginPreparedSystemTargetHandoff(planet, onAbort);
  }, [beginPreparedSystemTargetHandoff]);

  useEffect(() => {
    setMultiplayerPartyWarpHandler(handoff => {
      const world = parseCurrentWorldId(handoff.worldId);
      if (!world || world.worldId === currentWorldRef.current.worldId) return;
      const sameSystem = coordinatesEqual(world.coordinate, currentWorldRef.current.coordinate);
      if (!sameSystem) {
        scheduleWorldPrewarm(planetSize, world.seed, {
          worldId: world.worldId,
          terrainData: true,
          waterFaces: true
        });
        scheduleGrassInstancePrewarm(planetSize, world.seed, world.worldId);
        beginTravel(world.coordinate);
        return;
      }

      const planet = currentSystemManifest.planets.find(candidate => candidate.worldId === world.worldId);
      if (!planet) {
        setPreviousWorld(currentWorldRef.current);
        resetSceneReady();
        setCurrentWorld(world);
        setArrivalMode('approach');
        return;
      }

      pendingPartyWorldHandoffRef.current = world.worldId;
      void prepareSystemTarget(planet).then(ready => {
        if (!ready || currentWorldRef.current.worldId === world.worldId) {
          pendingPartyWorldHandoffRef.current = null;
          return;
        }
        const flight = getSpaceFlightSnapshot();
        if (flight.controlMode === 'flight' && flight.phase === 'deep_space') {
          const target = getSystemFlightSnapshot().target;
          if (target?.kind !== 'system_body' || target.worldId !== planet.worldId) {
            commitSystemBodyTarget(planet.address);
          }
          if (beginPreparedSystemTargetHandoff(planet, () => {
            pendingPartyWorldHandoffRef.current = null;
          })) return;
        }

        // A party member who is not currently piloting still follows the
        // authoritative room world. They arrive in the destination scene while
        // the pilot keeps the full exposure-driven handoff.
        pendingPartyWorldHandoffRef.current = null;
        setPreviousWorld(currentWorldRef.current);
        resetSceneReady();
        setCurrentWorld(world);
        setArrivalMode('approach');
      }).catch(() => {
        pendingPartyWorldHandoffRef.current = null;
        setPreviousWorld(currentWorldRef.current);
        resetSceneReady();
        setCurrentWorld(world);
        setArrivalMode('approach');
      });
    });
    return () => setMultiplayerPartyWarpHandler(null);
  }, [beginPreparedSystemTargetHandoff, currentSystemManifest, prepareSystemTarget]);

  // ?debug=1 → free building (no resource cost) so the build catalog can be tested.
  useEffect(() => { setFreeBuild(debugUiEnabled); setInstantHarvest(debugUiEnabled); }, [debugUiEnabled]);

  const showDebugHud = debugUiEnabled && appPhase === 'playing';

  // If the URL enters/leaves debug mode in a hot dev session, restore the overlay
  // affordance instead of leaving the user with permanently hidden controls.
  useEffect(() => {
    setDebugHudVisible(true);
    setMobileDebugOpen(false);
  }, [debugUiEnabled, appPhase]);
  const mobileDebugLayout = isTouch;
  const debugPanelsOpen = debugHudVisible && (!mobileDebugLayout || mobileDebugOpen);
  const hideDebugHud = () => {
    setMobileDebugOpen(false);
    setDebugHudVisible(false);
  };
  const reopenDebugHud = () => {
    setDebugHudVisible(true);
    setMobileDebugOpen(mobileDebugLayout);
  };

  // Autosave: persist this world's data (debounced on store changes, and on tab
  // hide / unload to catch a server kill). Saving on cleanup captures the OLD world
  // BEFORE the field reset-then-load wipes its stores on a world change.
  useEffect(() => {
    const world = currentWorldIdentity;
    let lastVoxelVersion = -1;
    // `withVoxels`: save the terrain diff only on LIVE paths (world is still loaded,
    // deletedTerrain intact). On a world-change cleanup we MUST skip it — EfficientPlanet's
    // own cleanup saves voxels before its reset() clears them, and that child cleanup runs
    // BEFORE this parent cleanup (so reading deletedTerrain here would be empty).
    const doSave = (withVoxels: boolean) => {
      saveGlobal(world, getCurrentDayPhase());
      saveWorld(world);
      savePlayerPose(world);
      if (withVoxels) {
        const v = voxelSystem.getEditVersion();
        if (v !== lastVoxelVersion) { lastVoxelVersion = v; saveVoxelEdits(world); }
      }
    };
    let timer = 0;
    const schedule = () => { if (timer) return; timer = window.setTimeout(() => { timer = 0; doSave(true); }, 700); };
    const unsubs = [
      subscribeStructures(schedule), subscribeInventory(schedule), subscribeCampfires(schedule),
      subscribeMaw(schedule), subscribeProgression(schedule), subscribeTreeHarvest(schedule),
      subscribeStonePickup(schedule), voxelSystem.subscribeVoxelEdits(schedule),
      subscribeVitals(schedule), subscribeWaterskin(schedule), subscribeShipRestoration(schedule)
      // eat/drink + waterskin fill + ship flight boundary/pose checkpoints
    ];
    // Movement/time don't fire a store event, so tick a light save (pose + day) to
    // survive a server kill while just walking around.
    const periodic = window.setInterval(() => { saveGlobal(world, getCurrentDayPhase()); savePlayerPose(world); }, 20000);
    const onHidden = () => { if (document.visibilityState === 'hidden') doSave(true); };
    document.addEventListener('visibilitychange', onHidden);
    const onUnload = () => doSave(true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(periodic);
      unsubs.forEach(u => u());
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onUnload);
      if (!suppressWorldCleanupSaveRef.current.delete(world.worldId)) {
        doSave(false); // structures/global/pose of the world we're leaving (voxels: EfficientPlanet)
      }
    };
  }, [currentWorld.coordinate, currentWorldIdentity]);

  // ?fly=1: drop straight into deep-space flight (once, on mount).
  useEffect(() => {
    if (flyDebug) debugStartInSpace();
    if (descentDebug) {
      setCurrentWorld(createCurrentWorld(descentDebug));
      setArrivalMode('approach');
      debugStartInDescent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit the ship with F once landed back on the surface (FPS<->flight toggle is
  // handled per-mode: boarding lives in SpaceshipPlaceholder, exit lives here).
  useEffect(() => {
    if (!(flight.phase === 'surface' && flight.controlMode === 'flight')) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyF' || event.repeat) return;
      if (paused) return;
      if (isPhysicalBoardingVehicleControlLocked()) return;
      playSfx('exitShip');
      exitShip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flight.phase, flight.controlMode, paused]);

  // Press H to hide/show the HUD panels (desktop). On mobile the corner toggle
  // button does the same via tap. Ignored while typing in the coordinate inputs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyH') return;
      if (paused) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      setHudVisible(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused]);

  // Travelling from the star map closes the menu and (desktop) re-grabs lock so
  // the warp plays in first person.
  const travel = (action: () => void) => {
    if (getStoryStateSnapshot().active) return;
    action();
    setPauseState(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const nav: NavApi = {
    currentLabel: currentWorldKey,
    seed: currentWorld.seed,
    arrivalLabel: arrivalMode === 'approach' ? 'HIGH ORBIT' : 'SURFACE',
    targetX,
    targetY,
    setTargetX,
    setTargetY,
    onSetCourse: () => travel(jumpToTarget),
    onRandom: () => travel(jumpToRandomWorld),
    onPrevious: () => travel(returnToPreviousWorld),
    hasPrevious: !!previousWorld,
    nearby: nearbyWorlds.map(world => ({
      label: coordinateKey(world.coordinate),
      onClick: () => travel(() => jumpToWorld(world))
    }))
  };

  return (
    <KeyboardControls
      map={[
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] },
        { name: 'reset', keys: ['KeyR'] },
        { name: 'delete', keys: ['KeyE'] },
        { name: 'interact', keys: ['KeyF'] }, // primary context interact: drink/door/board/eat
        { name: 'deconstruct', keys: ['KeyX'] },
        { name: 'sprint', keys: ['ShiftLeft', 'ShiftRight'] },
        { name: 'eat', keys: ['KeyG'] }, // consume food / sip waterskin (its own key, not the F prompt)
        { name: 'descend', keys: ['ControlLeft', 'KeyZ'] },
      ]}
    >
      <AudioDirector
        terrainSeed={currentWorld.seed}
        worldId={currentWorldIdentity.worldId}
      />

      <Canvas
        shadows={false}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        performance={{
          min: 0.5,
          max: 1.0,
          debounce: 200
        }}
        frameloop="always"
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.94;
          if (
            graphicsBoot.allowAutomaticSoftwareFallback
            && !softwareFallbackAppliedRef.current
            && isSoftwareWebGLRenderer(webGLRendererName(gl))
          ) {
            softwareFallbackAppliedRef.current = true;
            // A silent automatic safety rail, not a preference: explicit URL
            // profiles and saved player choices win, and this is never persisted.
            setQualityProfile('POTATO', { persist: false });
          }
          // Stash the canvas so the DOM "Play Now" button can request pointer
          // lock directly inside the click gesture (see LandingMenu).
          setGameCanvas(gl.domElement);
        }}
      >
        {showDebugHud && debugPanelsOpen && debugEnabled && <Stats />}
        {/* IBL-only: capture a representative midday sky once into an env
            cubemap so metallic blocks have reflections. No `background`; the
            visible sky comes from SkyController's dynamic <Sky> dome. */}
        {environmentResolution !== null && (
          <Environment
            key={`environment-${profile}-${environmentResolution}`}
            frames={1}
            resolution={environmentResolution}
          >
            <Sky sunPosition={SUN_POSITION} />
          </Environment>
        )}

        <SkyController
          terrainSeed={currentWorld.seed}
          worldId={currentWorldIdentity.worldId}
          activePlanetSystemPosition={activePlanetDescriptor.systemPosition}
        />
        <GalaxyImpostors
          currentCoordinate={currentWorld.coordinate}
          planetSize={planetSize}
          activePlanetSystemPosition={activePlanetDescriptor.systemPosition}
        />
        {systemBodiesEnabled && (
          <SystemCompanionBodies
            currentCoordinate={currentWorld.coordinate}
            planetSize={planetSize}
            activePlanetSlot={currentPlanetAddress.slot}
            activePlanetSystemPosition={activePlanetDescriptor.systemPosition}
            forceSingleBody={isStoryWorld(currentWorld.coordinate) && !tidegardenRouteOnline}
            bodyCountOverride={currentSystemManifest.planets.length as 1 | 2 | 3}
          />
        )}
        {/*
          Stations. Sibling of SystemCompanionBodies and gated by the same flag,
          because both answer "what else is in this system" and a build with system
          bodies switched off should not sprout a kilometre of hull. Most systems
          have none and the component returns null for those.
        */}
        {systemBodiesEnabled && (
          <>
            <SystemAnchorages
              currentCoordinate={currentWorld.coordinate}
              systemSeed={currentSystemManifest.systemSeed}
            />
            <AnchorageApproachDriver
              currentCoordinate={currentWorld.coordinate}
              systemSeed={currentSystemManifest.systemSeed}
              onDock={enterAnchorage}
            />
          </>
        )}
        <SystemTravelDriver
          manifest={currentSystemManifest}
          activePlanetId={activePlanetDescriptor.worldId}
          enabled={systemTravelEnabled}
          isTargetReady={isSystemTargetReady}
          onPrepareTarget={prepareSystemTarget}
          onCancelTarget={cancelSystemTargetPreparation}
          onActivateTarget={activateSystemTarget}
        />
        {/* Persistent warp driver — lives OUTSIDE the keyed EfficientScene so it
            keeps advancing across the world swap it fires at its midpoint. */}
        <WarpDriver />
        <VehicleSceneAvDriver />
        {/* Story director tick — same placement rationale as WarpDriver. */}
        <StoryDirectorDriver
          paused={paused || hudBlockingOverlayOpen || downed || storyCompleteOpen || storyCompletePreview}
          planetRadius={planetSize}
        />
        <SceneReadyProbe />
        <PoseRecorder coordinate={currentWorld.coordinate} />

        <React.Profiler
          id="active-planet-runtime"
          onRender={systemProbeEnabled ? recordSystemReactProfile : () => undefined}
        >
          <EfficientScene
            key={`${currentWorldKey}:${story.runId}`}
            commandContext={commandContext}
            graphicsProfile={profile}
            graphicsQuality={graphicsQuality}
            activePlanetSystemPosition={activePlanetDescriptor.systemPosition}
            terrainSeed={currentWorld.seed}
            debugColliders={debugColliders}
            arrivalMode={arrivalMode}
            overview={overviewEnabled}
            agent={agentEnabled}
            cinematic={appPhase === 'menu' || storyWorldSwapPending}
            paused={paused || hudBlockingOverlayOpen || storyCompleteOpen || storyCompletePreview}
            profileSystemTravel={systemProbeEnabled}
            onGroundedChange={grounded => {
              if (grounded) {
                setArrivalMode(mode => mode === 'approach' ? 'surface' : mode);
                notifyLanded();
              }
            }}
            onDebugChange={showDebugHud && debugPanelsOpen && debugEnabled ? setDebugState : undefined}
          />
        </React.Profiler>

        {benchEnabled && <BenchmarkProbe profile={profile} onSample={setBenchSample} />}
        {systemProbeEnabled && (
          <SystemTravelProbe
            systemId={currentSystemManifest.systemId}
            activeWorldId={currentWorldIdentity.worldId}
            bodyIds={currentSystemManifest.planets.map(planet => planet.worldId)}
            activeFullWorldCount={1}
            locationMode={flight.phase}
            profile={profile}
          />
        )}

        {/* Phase 5: bloom (+ optional painterly) composer. Mounted only when
            the active profile enables postprocessing. */}
        {graphicsQuality.postProcess && (
          <PostFX
            key={`postfx-${profile}`}
            terrainSeed={currentWorld.seed}
            planetProfile={activePlanetProfile}
          />
        )}
      </Canvas>

      {/* Persistent warp flash (only fires during travel, harmless otherwise). */}
      <WarpFlash />

      {/* --- Landing screen (over the live cinematic render) --- */}
      <LandingMenu
        startWorldId={currentWorldIdentity.worldId}
        onReplayStory={replayStoryFromBeginning}
        onReturnToStorySite={returnToCompletedStorySite}
        returningToStorySite={pendingCompletedSiteEntry}
      />

      {/* --- Story overlays (prologue terminal / regulation feed / captions) --- */}
      <StoryOverlays
        objectiveJournalOpen={objectiveJournalOpen}
        onObjectiveJournalOpenChange={setObjectiveJournalState}
      />
      {/* Dev: beat teleporter (any ?story= session or ?debug=1). */}
      {storyDebugEnabled() && <StoryDebugPanel />}

      {/* --- Minimal, diegetic in-game HUD (the story feed replaces it in Ch1-2) --- */}
      {appPhase === 'playing' && !atlasCapture && !storyHudTakeover(story) && (
        <>
          {/* Critical safety warnings stay IMMEDIATE — never faded by a
              cinematic (the letterbox must not swallow crash/heat danger). */}
          {flight.controlMode === 'flight' && <CrashFlash />}
          {flight.controlMode === 'fps' && <LavaHeatVignette />}
          {/* Everything else is informational chrome: it fades under a
              letterboxed cinematic and restores on decay. */}
          <CinematicHudVeil>
            {flight.controlMode === 'fps' && <Crosshair />}
            <TargetReticle />
            {flight.controlMode === 'flight' && <AnchorageApproachHud />}
            {flight.controlMode === 'fps' && <MiningProgress />}
            {flight.controlMode === 'fps' && !storyHudHideVitals() && <VitalsMeter />}
            {flight.controlMode === 'fps' && <BuildIndicator />}
            {flight.controlMode === 'fps' && <LookedAtIndicator />}
            {flight.controlMode === 'fps' && <InteractionPrompt />}
            {flight.controlMode === 'fps' && <ResourceGainToast />}
            {flight.controlMode === 'fps' && !(isTouch && buildModeOpen) && !storyHudHideInventory() && (
              <InventoryPanel topOffset={inventoryTopOffset} />
            )}
            {/* Ship / star-map affordances stay hidden while the story is live. */}
            {!storyHudMask(story) && (
              <>
                <OrbitalMinimap
                  coordinateLabel={currentWorldKey}
                  worldId={currentWorldIdentity.worldId}
                  planetSize={planetSize}
                />
                <CockpitReadout coordinateLabel={currentWorldKey} />
                <MultiplayerStatusBadge />
              </>
            )}
            <HudCornerActions
              controlMode={flight.controlMode}
              buildModeOpen={buildModeOpen}
              allowBuild={getStoryInputPolicy().allowBuild}
              allowCraft={getStoryInputPolicy().allowCraft}
              allowChart={chartAvailable}
              onToggleBuild={toggleBuildHud}
              onOpenCrafting={openCrafting}
              onOpenChart={() => setMapViewOpen(true)}
              onPause={pauseAndOpenStarMap}
              pauseLabel={story.active ? 'Pause' : 'Pause and open star map'}
            />
          </CinematicHudVeil>
        </>
      )}

      {/* The Regulation Feed may still own Ch1/2 chrome after the camera enters
          the body, but embodied objectives must remain physically playable on
          touch. Early fixed-camera acts keep their authored input takeover. */}
      {appPhase === 'playing'
        && !atlasCapture
        && isTouch
        && !paused
        && !hudBlockingOverlayOpen
        && !downed
        && !storyCompleteOpen
        && !storyCompletePreview
        && (
          <CinematicHudVeil>
            {/* Free/embodied eras: the analog joystick + action cluster. */}
            {(!storyHudTakeover(story) || storyUsesEmbodiedGuidanceHud(story))
              && <TouchControls controlMode={flight.controlMode} />}
            {/* Early monochrome-ladder beats: the themed discrete D-PAD
                (mutually exclusive with TouchControls by beat predicate). */}
            {storyUsesEarlyTouchDpad(story) && <TouchDPad />}
          </CinematicHudVeil>
        )}

      {/* --- Survey chart chrome ([M] overhead view) --- */}
      <MapOverlay />

      {/* --- Fabricator (crafting) --- */}
      <CraftingPanel open={craftingOpen} onClose={closeCrafting} commandContext={commandContext} />

      {/* --- Pause / star map menu --- */}
      <PauseMenu
        open={paused && !downed && !storyCompleteOpen && !storyCompletePreview}
        onResume={resumeFromPause}
        onQuitToMenu={quitToMenu}
        nav={nav}
        travelEnabled={!story.active}
        controlsContext={{
          device: isTouch ? 'touch' : 'desktop',
          mode: flight.controlMode === 'flight' ? 'flight' : buildModeOpen ? 'build' : 'fps',
          storyActive: story.active,
          allowBuild: getStoryInputPolicy().allowBuild,
          allowCraft: getStoryInputPolicy().allowCraft,
          allowChart: chartAvailable,
          moveSpeedScale: getStoryInputPolicy().moveSpeedScale,
          allowJump: getStoryInputPolicy().allowJump,
          allowSprint: getStoryInputPolicy().allowSprint,
          lookMode: getStoryInputPolicy().lookMode
        }}
      />

      <StoryCompletePanel
        open={storyCompleteOpen || storyCompletePreview}
        onContinue={continueAtCompletedSite}
        onReturnToMenu={returnCompletedToMenu}
        onReplay={replayStoryFromBeginning}
      />

      {/* Death sequence: collapse -> substrate -> panel -> rewake. The overlay
          owns the sequence machine's edges and mounts the DownedPanel itself
          once the reflective beat has played (see DeathSequenceOverlay). */}
      <DeathSequenceOverlay
        playing={appPhase === 'playing'}
        downed={downed}
        onRecover={recoverFromDowned}
        onReturnToMenu={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          returnToMenu();
        }}
      />

      {/* --- Developer overlays (?debug=1) --- */}
      {showDebugHud && (
        <>
          {!debugHudVisible && (
            mobileDebugLayout ? (
              <div style={mobileDebugDockStyle}>
                <div style={mobileDebugButtonRow}>
                  <button type="button" onClick={reopenDebugHud} style={mobileDebugPill}>
                    DBG <span style={{ opacity: 0.64, fontWeight: 500 }}>{currentWorldKey}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={reopenDebugHud}
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  zIndex: 30,
                  color: '#cfe8ff',
                  background: 'rgba(8,13,24,0.78)',
                  border: '1px solid rgba(125,211,252,0.35)',
                  borderRadius: 999,
                  padding: '7px 10px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
                }}
              >Show debug HUDs</button>
            )
          )}

          {debugHudVisible && (
            mobileDebugLayout ? (
              <>
                <VantageToast />
                <div style={mobileDebugDockStyle}>
                  {!mobileDebugOpen ? (
                    <div style={mobileDebugButtonRow}>
                      <button type="button" onClick={() => setMobileDebugOpen(true)} style={mobileDebugPill}>
                        DBG <span style={{ opacity: 0.64, fontWeight: 500 }}>{currentWorldKey}</span>
                      </button>
                      <button type="button" aria-label="Hide debug HUDs" onClick={hideDebugHud} style={mobileDebugMiniButton}>×</button>
                    </div>
                  ) : (
                    <section aria-label="Mobile debug HUD" style={mobileDebugSheet}>
                      <div style={mobileDebugSheetHeader}>
                        <div style={{ flex: 1, minWidth: 0, fontFamily: 'monospace' }}>
                          <div style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 700 }}>DEBUG</div>
                          <div style={{ color: 'rgba(207,224,255,0.68)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {currentWorldKey} / {flight.controlMode}
                          </div>
                        </div>
                        <button type="button" onClick={() => setMobileDebugOpen(false)} style={{ ...buttonBase, height: 34, padding: '0 10px', backgroundColor: '#172554' }}>
                          Min
                        </button>
                        <button type="button" aria-label="Hide debug HUDs" onClick={hideDebugHud} style={mobileDebugMiniButton}>×</button>
                      </div>

                      <div style={mobileDebugScroll}>
                        {benchEnabled && (
                          <>
                            <div style={mobileDebugSectionLabel}>Bench {profile}</div>
                            {benchSample ? (
                              <>
                                <div style={mobileDebugRow}><span>FPS</span><strong>~{benchSample.fps}</strong></div>
                                <div style={mobileDebugRow}><span>p50 / p95</span><strong>{benchSample.p50} / {benchSample.p95} ms</strong></div>
                                <div style={mobileDebugRow}><span>Draws</span><strong>{benchSample.drawCalls}</strong></div>
                                <div style={mobileDebugRow}><span>Triangles</span><strong>{benchSample.triangles.toLocaleString()}</strong></div>
                              </>
                            ) : (
                              <div style={{ opacity: 0.72 }}>measuring...</div>
                            )}
                          </>
                        )}

                        <div style={mobileDebugSectionLabel}>Runtime</div>
                        <div style={mobileDebugRow}><span>World</span><strong>{currentWorldKey}</strong></div>
                        <div style={mobileDebugRow}><span>Seed</span><strong>{currentWorld.seed}</strong></div>
                        <div style={mobileDebugRow}><span>Ship</span><strong>{arrivalMode === 'approach' ? 'approach' : 'landed'}</strong></div>
                        <div style={mobileDebugRow}><span>Flight</span><strong>{flight.phase} / {flight.controlMode}</strong></div>
                        <div style={mobileDebugRow}><span>Total voxels</span><strong>{totalVoxels.toLocaleString()}</strong></div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '8px 0 4px' }}>
                          <input
                            type="checkbox"
                            checked={debugEnabled}
                            onChange={event => setDebugEnabled(event.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#38bdf8' }}
                          />
                          Runtime debug
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '4px 0 8px', opacity: debugEnabled ? 1 : 0.45 }}>
                          <input
                            type="checkbox"
                            checked={debugColliders}
                            disabled={!debugEnabled}
                            onChange={event => setDebugColliders(event.target.checked)}
                            style={{ width: 18, height: 18, accentColor: '#38bdf8' }}
                          />
                          Colliders
                        </label>

                        {debugEnabled && (
                          <>
                            <div style={mobileDebugSectionLabel}>Telemetry</div>
                            <div style={mobileDebugRow}><span>Face</span><strong>{debugState.player?.face ?? 'top'}</strong></div>
                            <div style={mobileDebugRow}><span>Target</span><strong>{debugState.player?.targetFace ?? 'none'}</strong></div>
                            <div style={mobileDebugRow}><span>Grounded</span><strong>{debugState.player?.grounded ? 'yes' : 'no'}</strong></div>
                            <div style={mobileDebugRow}><span>Controls</span><strong>{debugState.player?.controlsActive ? 'locked' : 'idle'}</strong></div>
                            <div style={mobileDebugRow}><span>Speed</span><strong>{(debugState.player?.speed ?? 0).toFixed(2)}</strong></div>
                            <div style={mobileDebugRow}><span>Gravity</span><strong>{(debugState.player?.gravity ?? [0, -9.81, 0]).map(value => value.toFixed(1)).join(', ')}</strong></div>
                            <div style={mobileDebugRow}><span>Position</span><strong>{(debugState.player?.position ?? [0, 0, 0]).map(value => value.toFixed(1)).join(', ')}</strong></div>
                            <div style={mobileDebugRow}><span>World ID</span><strong>{debugState.planet?.worldId ?? 0}</strong></div>
                            <div style={mobileDebugRow}><span>Exposed voxels</span><strong>{debugState.planet?.exposedVoxels ?? 0}</strong></div>
                            <div style={mobileDebugRow}><span>Colliders</span><strong>{debugState.planet?.activeColliders ?? 0}</strong></div>
                          </>
                        )}

                        <div style={mobileDebugSectionLabel}>Course</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            X
                            <input
                              type="number"
                              value={targetX}
                              onChange={event => setTargetX(event.target.value)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') jumpToTarget();
                              }}
                              style={inputBase}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            Y
                            <input
                              type="number"
                              value={targetY}
                              onChange={event => setTargetY(event.target.value)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') jumpToTarget();
                              }}
                              style={inputBase}
                            />
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 6 }}>
                          <button onClick={jumpToTarget} style={{ ...buttonBase, minHeight: 34, padding: '7px 8px', backgroundColor: '#0369a1' }}>
                            Set
                          </button>
                          <button onClick={jumpToRandomWorld} style={{ ...buttonBase, minHeight: 34, padding: '7px 8px', backgroundColor: '#7c2d12' }}>
                            Random
                          </button>
                          <button
                            onClick={returnToPreviousWorld}
                            disabled={!previousWorld}
                            style={{
                              ...buttonBase,
                              minHeight: 34,
                              padding: '7px 8px',
                              backgroundColor: previousWorld ? '#374151' : '#1f2937',
                              color: previousWorld ? 'white' : '#64748b',
                              cursor: previousWorld ? 'pointer' : 'default'
                            }}
                          >
                            Prev
                          </button>
                        </div>

                        <div style={mobileDebugSectionLabel}>Nearby</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {nearbyWorlds.map(world => (
                            <button
                              key={coordinateKey(world.coordinate)}
                              onClick={() => jumpToWorld(world)}
                              style={{
                                ...buttonBase,
                                minHeight: 32,
                                padding: '6px 8px',
                                backgroundColor: '#172554',
                                border: '1px solid #1e3a8a',
                                fontSize: 11,
                                fontFamily: 'monospace'
                              }}
                            >
                              {coordinateKey(world.coordinate)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <>
                <VantageToast />

                <div>
                  {benchEnabled && (
                    <div style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 30,
                      pointerEvents: 'auto',
                      color: '#9effa1',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      background: 'rgba(0,0,0,0.8)',
                      padding: '8px 34px 8px 10px',
                      borderRadius: 6,
                      lineHeight: 1.5
                    }}>
                      <button type="button" aria-label="Hide debug HUDs" onClick={hideDebugHud} style={debugCloseButton}>×</button>
                      <div><strong>BENCH</strong> - {profile}</div>
                      {benchSample ? (
                        <>
                          <div>fps ~{benchSample.fps}</div>
                          <div>p50 {benchSample.p50} ms</div>
                          <div>p95 {benchSample.p95} ms</div>
                          <div>draws {benchSample.drawCalls}</div>
                          <div>tris {benchSample.triangles.toLocaleString()}</div>
                        </>
                      ) : (
                        <div>measuring...</div>
                      )}
                    </div>
                  )}

                  <div style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    zIndex: 30,
                    pointerEvents: 'auto',
                    color: 'white',
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '10px 38px 10px 10px',
                    borderRadius: '5px',
                    display: hudVisible ? undefined : 'none'
                  }}>
                    <button type="button" aria-label="Hide debug HUDs" onClick={hideDebugHud} style={debugCloseButton}>×</button>
                    <h3>Efficient Voxel System</h3>
                    <p>WASD: Move</p>
                    <p>Space: Jump</p>
                    <p>R: Reset</p>
                    <p>E: Delete voxel</p>
                    <p>Only surface voxels rendered!</p>
                    <p>Total voxels: {totalVoxels.toLocaleString()}</p>
                    <p>Coordinate: {currentWorldKey}</p>
                    <p>Seed: {currentWorld.seed}</p>
                    <p>Ship: {arrivalMode === 'approach' ? 'approach' : 'landed'}</p>
                    <label style={{ display: 'block', marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={debugEnabled}
                        onChange={event => setDebugEnabled(event.target.checked)}
                      /> Debug
                    </label>
                    <label style={{ display: 'block', marginTop: 4, opacity: debugEnabled ? 1 : 0.45 }}>
                      <input
                        type="checkbox"
                        checked={debugColliders}
                        disabled={!debugEnabled}
                        onChange={event => setDebugColliders(event.target.checked)}
                      /> Colliders
                    </label>
                    {debugEnabled && (
                      <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.35 }}>
                        <div>Face: {debugState.player?.face ?? 'top'}</div>
                        <div>Target: {debugState.player?.targetFace ?? 'none'}</div>
                        <div>Grounded: {debugState.player?.grounded ? 'yes' : 'no'}</div>
                        <div>Controls: {debugState.player?.controlsActive ? 'locked' : 'idle'}</div>
                        <div>Speed: {(debugState.player?.speed ?? 0).toFixed(2)}</div>
                        <div>Gravity: {(debugState.player?.gravity ?? [0, -9.81, 0]).map(value => value.toFixed(1)).join(', ')}</div>
                        <div>Position: {(debugState.player?.position ?? [0, 0, 0]).map(value => value.toFixed(1)).join(', ')}</div>
                        <div>World: {debugState.planet?.worldId ?? 0}</div>
                        <div>Voxels: {debugState.planet?.exposedVoxels ?? 0}</div>
                        <div>Colliders: {debugState.planet?.activeColliders ?? 0}</div>
                      </div>
                    )}
                  </div>

                  <div style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    left: compactOverlay ? 10 : 'auto',
                    zIndex: 30,
                    pointerEvents: 'auto',
                    display: hudVisible ? undefined : 'none',
                    color: 'white',
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '15px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    width: compactOverlay ? 'auto' : 'min(260px, calc(100vw - 20px))',
                    maxWidth: 'calc(100vw - 20px)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere'
                  }}>
                    <button type="button" aria-label="Hide debug HUDs" onClick={hideDebugHud} style={debugCloseButton}>×</button>
                    <h4 style={{ margin: '0 0 10px 0', color: '#7dd3fc' }}>World Coordinates</h4>

                    <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10, overflowWrap: 'anywhere' }}>
                      <div>Current: {currentWorldKey}</div>
                      <div>Seed: {currentWorld.seed}</div>
                      <div>Arrival: {arrivalMode === 'approach' ? 'high altitude' : 'surface'}</div>
                      <div>Flight: {flight.phase} / {flight.controlMode}</div>
                      <div>LOD: one voxel world + visual neighbors</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                        X
                        <input
                          type="number"
                          value={targetX}
                          onChange={event => setTargetX(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') jumpToTarget();
                          }}
                          style={inputBase}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                        Y
                        <input
                          type="number"
                          value={targetY}
                          onChange={event => setTargetY(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') jumpToTarget();
                          }}
                          style={inputBase}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 6 }}>
                      <button
                        onClick={jumpToTarget}
                        style={{ ...buttonBase, padding: '7px 8px', backgroundColor: '#0369a1' }}
                      >
                        Set Course
                      </button>
                      <button
                        onClick={jumpToRandomWorld}
                        style={{ ...buttonBase, padding: '7px 8px', backgroundColor: '#7c2d12' }}
                      >
                        Random
                      </button>
                      <button
                        onClick={returnToPreviousWorld}
                        disabled={!previousWorld}
                        style={{
                          ...buttonBase,
                          padding: '7px 8px',
                          backgroundColor: previousWorld ? '#374151' : '#1f2937',
                          color: previousWorld ? 'white' : '#64748b',
                          cursor: previousWorld ? 'pointer' : 'default'
                        }}
                      >
                        Previous
                      </button>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 11, color: '#cbd5e1' }}>
                      Nearby
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      marginTop: 6
                    }}>
                      {nearbyWorlds.map(world => (
                        <button
                          key={coordinateKey(world.coordinate)}
                          onClick={() => jumpToWorld(world)}
                          style={{
                            ...buttonBase,
                            padding: '6px 8px',
                            backgroundColor: '#172554',
                            border: '1px solid #1e3a8a',
                            fontSize: 11,
                            fontFamily: 'monospace'
                          }}
                        >
                          {coordinateKey(world.coordinate)}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 10, opacity: 0.68, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                      Set Course loads the destination as the active voxel planet. Distant worlds are visual-only LOD.
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </>
      )}
    </KeyboardControls>
  );
};

export default App;
