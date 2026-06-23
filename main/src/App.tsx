import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, Environment, KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import EfficientScene, { planetSize, SceneDebugState } from './components/EfficientScene.tsx';
import SkyController from './components/SkyController.tsx';
import Crosshair from './components/Crosshair.tsx';
import BenchmarkProbe, { BenchmarkSample } from './components/BenchmarkProbe.tsx';
import PostFX from './components/effects/PostFX.tsx';
import GalaxyImpostors from './components/GalaxyImpostors.tsx';
import TouchControls from './components/mobile/TouchControls.tsx';
import { isTouchDevice } from './utils/mobileInput.ts';
import PoseRecorder from './components/debug/PoseRecorder.tsx';
import SceneReadyProbe from './components/SceneReadyProbe.tsx';
import VantageToast from './components/hud/VantageToast.tsx';
import LookedAtIndicator from './components/hud/LookedAtIndicator.tsx';
import InventoryPanel from './components/hud/InventoryPanel.tsx';
import CrashFlash from './components/hud/CrashFlash.tsx';
import JetpackMeter from './components/hud/JetpackMeter.tsx';
import MawChargeMeter from './components/hud/MawChargeMeter.tsx';
import TargetReticle from './components/hud/TargetReticle.tsx';
import MiningProgress from './components/hud/MiningProgress.tsx';
import CockpitReadout from './components/hud/CockpitReadout.tsx';
import {
  DEFAULT_PROFILE,
  getGraphicsQuality,
  getQualityProfile,
  overrideGraphicsQuality,
  QualityProfile,
  QUALITY_PROFILES,
  setQualityProfile
} from './config/graphicsSettings.ts';
import type { CurrentWorld, WorldCoordinate } from './utils/worldCoordinates.ts';
import {
  coordinateKey,
  coordinatesEqual,
  createCurrentWorld,
  normalizeCoordinatePart
} from './utils/worldCoordinates.ts';
import { findHospitableStart } from './game/data/planetArchetypes.ts';
import { scheduleWorldPrewarm } from './utils/worldGenCache.ts';
import { scheduleGrassInstancePrewarm } from './utils/grassField.ts';
import type { ArrivalMode } from './utils/worldArrival.ts';
import { WarpDriver, WarpFlash } from './components/effects/WarpOverlay.tsx';
import {
  beginTravel,
  debugStartInDescent,
  debugStartInSpace,
  exitShip,
  notifyLanded,
  setArrivalHandler,
  useSpaceFlight
} from './state/spaceFlight.ts';
import { isWarpMetricsEnabled, markWarpMetric } from './utils/warpMetrics.ts';
import {
  useAppState,
  getAppStateSnapshot,
  setGameCanvas,
  getGameCanvas,
  returnToMenu
} from './state/appState.ts';
import LandingMenu from './components/ui/LandingMenu.tsx';
import PauseMenu, { type NavApi } from './components/ui/PauseMenu.tsx';
import CraftingPanel from './components/ui/CraftingPanel.tsx';
import AudioDirector from './components/audio/AudioDirector.tsx';
import { playSfx } from './audio/sfxEngine.ts';
import './App.css';

const SUN_POSITION: [number, number, number] = [100, 20, 100];

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

const App: React.FC = () => {
  const totalVoxels = planetSize ** 3;
  const [currentWorld, setCurrentWorld] = useState<CurrentWorld>(() => {
    // ?world=x,y -> spawn on foot directly on that coordinate's planet (debug: lets
    // you inspect a specific seed's terrain/trees without travelling there).
    try {
      const raw = new URLSearchParams(window.location.search).get('world');
      if (raw) {
        const [sx, sy] = raw.split(',');
        return createCurrentWorld({ x: normalizeCoordinatePart(Number(sx)), y: normalizeCoordinatePart(Number(sy)) });
      }
    } catch { /* ignore */ }
    // No ?world= override -> CRASH-LAND on a fresh but HOSPITABLE planet (verdant/
    // oceanic): trees, grass, biofiber, stone, no early hazard — the Primitive era's
    // necessities. Varies per session (random among hospitable), never 0,0-fixed.
    // Travel afterwards (Random/Set Course) is unconstrained.
    return createCurrentWorld(findHospitableStart());
  });
  const [previousWorld, setPreviousWorld] = useState<CurrentWorld | null>(null);
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode>('surface');
  const [targetX, setTargetX] = useState('1');
  const [targetY, setTargetY] = useState('0');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugColliders, setDebugColliders] = useState(false);
  const [debugState, setDebugState] = useState<SceneDebugState>({ player: null, planet: null });
  const [benchSample, setBenchSample] = useState<BenchmarkSample | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const isTouch = useMemo(() => isTouchDevice(), []);
  const flight = useSpaceFlight();
  const { phase: appPhase } = useAppState();
  const [paused, setPaused] = useState(false);
  const [craftingOpen, setCraftingOpen] = useState(false);
  // Ref mirror so the pointer-lock listener (bound once) can read the live value
  // without a stale closure — same trick the lock handler uses for app phase.
  const craftingOpenRef = useRef(false);

  // Open/close the Fabricator. Opening releases pointer lock so the cursor can
  // click recipes; the lock handler below knows to NOT treat that as a pause.
  const openCrafting = () => {
    if (getAppStateSnapshot().phase !== 'playing') return;
    craftingOpenRef.current = true;
    setCraftingOpen(true);
    setPaused(false);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const closeCrafting = () => {
    craftingOpenRef.current = false;
    setCraftingOpen(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  // Esc (and any pointer-lock loss / focus change) opens the pause + star map
  // while playing on desktop — a raw Esc keydown is swallowed during lock, so we
  // react to the lock state instead. Re-acquiring lock closes it.
  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement) { setPaused(false); return; }
      if (craftingOpenRef.current) return; // Fabricator released lock on purpose
      if (getAppStateSnapshot().phase === 'playing' && !isTouch) setPaused(true);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [isTouch]);

  // C toggles the Fabricator on foot; Esc closes it (its lock is already released,
  // so the lock-based pause path doesn't fire). Re-bound when pause/mode changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') {
        if (flight.controlMode !== 'fps' || getAppStateSnapshot().phase !== 'playing') return;
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

  const resumeFromPause = () => {
    setPaused(false);
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const quitToMenu = () => {
    setPaused(false);
    if (document.pointerLockElement) document.exitPointerLock();
    returnToMenu();
  };
  const currentWorldKey = coordinateKey(currentWorld.coordinate);

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
        scheduleWorldPrewarm(planetSize, world.seed, { terrainData: true, waterFaces: true });
        scheduleGrassInstancePrewarm(planetSize, world.seed);
        beginTravel(coordinate);
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
    scheduleWorldPrewarm(planetSize, world.seed, { terrainData: true, waterFaces: true });
    scheduleGrassInstancePrewarm(planetSize, world.seed);
    // Route through the warp: beginTravel plays the warp-in and the registered
    // arrival handler performs the real world swap at the white-out midpoint.
    beginTravel(world.coordinate);
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
    beginTravel(previousWorld.coordinate);
  };

  // ?bench=1 enables the perf probe; ?profile=ULTRA|HIGH|... selects quality;
  // ?painterly=1 force-enables the painterly look for testing.
  const { benchEnabled, profile, postProcess, overviewEnabled, agentEnabled, flyDebug, descentDebug, debugUiEnabled } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get('profile') ?? '').toUpperCase() as QualityProfile;
    const valid = requested in QUALITY_PROFILES ? requested : DEFAULT_PROFILE;
    if (valid !== getQualityProfile()) setQualityProfile(valid);
    if (params.get('painterly') === '1') overrideGraphicsQuality({ painterly: true });
    if (params.get('ao') === '0') overrideGraphicsQuality({ contactAO: false });
    if (params.get('outline') === '0') overrideGraphicsQuality({ outline: false });
    return {
      benchEnabled: params.get('bench') === '1',
      profile: valid,
      postProcess: getGraphicsQuality().postProcess,
      // ?overview=1 -> non-interactive overhead debug camera (water inspection).
      overviewEnabled: params.get('overview') === '1',
      // ?agent=1 -> verification harness: scriptable camera + window.__game bridge.
      agentEnabled: params.get('agent') === '1',
      // ?fly=1 -> jump straight into deep-space flight for runtime checks.
      flyDebug: params.get('fly') === '1',
      // ?descent=x,y -> load directly into the high-altitude descent over (x,y).
      descentDebug: (() => {
        const raw = params.get('descent');
        if (!raw) return null;
        const [sx, sy] = raw.split(',');
        return { x: normalizeCoordinatePart(Number(sx)), y: normalizeCoordinatePart(Number(sy)) };
      })(),
      // ?debug=1 -> reveal the developer overlays (voxel stats, collider toggle,
      // raw coordinate panel). Hidden from the production UI otherwise.
      debugUiEnabled: params.get('debug') === '1'
    };
  }, []);

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
      playSfx('exitShip');
      exitShip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flight.phase, flight.controlMode]);

  // Press H to hide/show the HUD panels (desktop). On mobile the corner toggle
  // button does the same via tap. Ignored while typing in the coordinate inputs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyH') return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      setHudVisible(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Travelling from the star map closes the menu and (desktop) re-grabs lock so
  // the warp plays in first person.
  const travel = (action: () => void) => {
    action();
    setPaused(false);
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
        { name: 'board', keys: ['KeyF'] },
      ]}
    >
      <AudioDirector terrainSeed={currentWorld.seed} />

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
          gl.toneMappingExposure = 1.0;
          // Stash the canvas so the DOM "Play Now" button can request pointer
          // lock directly inside the click gesture (see LandingMenu).
          setGameCanvas(gl.domElement);
        }}
      >
        {debugEnabled && <Stats />}
        {/* IBL-only: capture a representative midday sky once into an env
            cubemap so metallic blocks have reflections. No `background`; the
            visible sky comes from SkyController's dynamic <Sky> dome. */}
        <Environment frames={1} resolution={256}>
          <Sky sunPosition={SUN_POSITION} />
        </Environment>

        <SkyController terrainSeed={currentWorld.seed} />
        <GalaxyImpostors currentCoordinate={currentWorld.coordinate} planetSize={planetSize} />
        {/* Persistent warp driver — lives OUTSIDE the keyed EfficientScene so it
            keeps advancing across the world swap it fires at its midpoint. */}
        <WarpDriver />
        <SceneReadyProbe />
        <PoseRecorder coordinate={currentWorld.coordinate} />

        <EfficientScene
          key={currentWorldKey}
          terrainSeed={currentWorld.seed}
          debugColliders={debugColliders}
          arrivalMode={arrivalMode}
          overview={overviewEnabled}
          agent={agentEnabled}
          cinematic={appPhase === 'menu'}
          onGroundedChange={grounded => {
            if (grounded) {
              setArrivalMode(mode => mode === 'approach' ? 'surface' : mode);
              notifyLanded();
            }
          }}
          onDebugChange={debugEnabled ? setDebugState : undefined}
        />

        {benchEnabled && <BenchmarkProbe profile={profile} onSample={setBenchSample} />}

        {/* Phase 5: bloom (+ optional painterly) composer. Mounted only when
            the active profile enables postprocessing. */}
        {postProcess && <PostFX terrainSeed={currentWorld.seed} />}
      </Canvas>

      {/* Persistent warp flash (only fires during travel, harmless otherwise). */}
      <WarpFlash />

      {/* --- Landing screen (over the live cinematic render) --- */}
      <LandingMenu />

      {/* --- Minimal, diegetic in-game HUD --- */}
      {appPhase === 'playing' && (
        <>
          <Crosshair />
          <TargetReticle />
          {flight.controlMode === 'fps' && <MiningProgress />}
          {flight.controlMode === 'fps' && <JetpackMeter />}
          {flight.controlMode === 'fps' && <MawChargeMeter />}
          {flight.controlMode === 'flight' && <CrashFlash />}
          {flight.controlMode === 'fps' && <LookedAtIndicator />}
          {flight.controlMode === 'fps' && <InventoryPanel />}
          <CockpitReadout coordinateLabel={currentWorldKey} seed={currentWorld.seed} />
          {isTouch && <TouchControls controlMode={flight.controlMode} />}

          {/* Open the Fabricator (crafting). Desktop also has the C key; this is
              the touch/always-available entry point. On foot only. */}
          {flight.controlMode === 'fps' && (
            <button
              onClick={openCrafting}
              aria-label="Open fabricator (craft)"
              style={{
                position: 'absolute', top: 14, right: 66, width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#cfe8ff',
                background: 'rgba(8,13,24,0.55)', border: '1px solid rgba(125,211,252,0.28)',
                borderRadius: 12, cursor: 'pointer', padding: 0, zIndex: 20,
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
              }}
            >⚒</button>
          )}

          {/* Pause + star map. On desktop Esc also opens it (via pointer-lock
              loss); this button is the touch/always-available entry point. */}
          <button
            onClick={() => {
              craftingOpenRef.current = false; setCraftingOpen(false);
              if (document.pointerLockElement) document.exitPointerLock();
              setPaused(true);
            }}
            aria-label="Pause and open star map"
            style={{
              position: 'absolute', top: 14, right: 14, width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#cfe8ff',
              background: 'rgba(8,13,24,0.55)', border: '1px solid rgba(125,211,252,0.28)',
              borderRadius: 12, cursor: 'pointer', padding: 0, zIndex: 20,
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
            }}
          >☰</button>
        </>
      )}

      {/* --- Fabricator (crafting) --- */}
      <CraftingPanel open={craftingOpen} onClose={closeCrafting} />

      {/* --- Pause / star map menu --- */}
      <PauseMenu open={paused} onResume={resumeFromPause} onQuitToMenu={quitToMenu} nav={nav} />

      {/* --- Developer overlays (?debug=1) --- */}
      {debugUiEnabled && (
      <>
      <VantageToast />

      {benchEnabled && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          color: '#9effa1',
          fontFamily: 'monospace',
          fontSize: 12,
          background: 'rgba(0,0,0,0.8)',
          padding: '8px 10px',
          borderRadius: 6,
          lineHeight: 1.5
        }}>
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
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        display: hudVisible ? undefined : 'none'
      }}>
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
      </>
      )}
    </KeyboardControls>
  );
};

export default App;
