import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, Environment, KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import EfficientScene, { planetSize, SceneDebugState, TERRAIN_SEEDS } from './components/EfficientScene.tsx';
import SkyController from './components/SkyController.tsx';
import Crosshair from './components/Crosshair.tsx';
import BenchmarkProbe, { BenchmarkSample } from './components/BenchmarkProbe.tsx';
import PostFX from './components/effects/PostFX.tsx';
import {
  DEFAULT_PROFILE,
  getGraphicsQuality,
  getQualityProfile,
  overrideGraphicsQuality,
  QualityProfile,
  QUALITY_PROFILES,
  setQualityProfile
} from './config/graphicsSettings.ts';
import './App.css';

const SUN_POSITION: [number, number, number] = [100, 20, 100];

const App: React.FC = () => {
  const totalVoxels = planetSize ** 3; // planetSize cubed
  const [terrainSeed, setTerrainSeed] = useState(TERRAIN_SEEDS.DEFAULT);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugColliders, setDebugColliders] = useState(false);
  const [debugState, setDebugState] = useState<SceneDebugState>({ player: null, planet: null });
  const [benchSample, setBenchSample] = useState<BenchmarkSample | null>(null);

  // ?bench=1 enables the perf probe; ?profile=ULTRA|HIGH|... selects quality;
  // ?painterly=1 force-enables the painterly look for testing.
  const { benchEnabled, profile, postProcess, overviewEnabled } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get('profile') ?? '').toUpperCase() as QualityProfile;
    const valid = requested in QUALITY_PROFILES ? requested : DEFAULT_PROFILE;
    if (valid !== getQualityProfile()) setQualityProfile(valid);
    if (params.get('painterly') === '1') overrideGraphicsQuality({ painterly: true });
    return {
      benchEnabled: params.get('bench') === '1',
      profile: valid,
      postProcess: getGraphicsQuality().postProcess,
      // ?overview=1 -> non-interactive overhead debug camera (water inspection).
      overviewEnabled: params.get('overview') === '1'
    };
  }, []);

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
      ]}
    >
      <Canvas
        shadows={false}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
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
        }}
      >
        {debugEnabled && <Stats />}
        {/* IBL-only: capture a representative midday sky once into an env
            cubemap so metallic blocks have reflections. No `background` — the
            visible sky now comes from SkyController's dynamic <Sky> dome, and
            this static capture must not fight it. */}
        <Environment frames={1} resolution={256}>
          <Sky sunPosition={SUN_POSITION} />
        </Environment>

        {/* Owns the visible sky, day/night sun + ambient, fog and stars. */}
        <SkyController />

        <EfficientScene
          terrainSeed={terrainSeed}
          debugColliders={debugColliders}
          overview={overviewEnabled}
          onDebugChange={setDebugState}
        />

        {benchEnabled && <BenchmarkProbe profile={profile} onSample={setBenchSample} />}

        {/* Phase 5: bloom (+ optional painterly) composer. Mounted only when
            the active profile enables postprocessing; otherwise the renderer's
            ACES tone mapping path is left exactly as-is (MEDIUM/LOW/POTATO
            unchanged). Last child so its passes composite over everything. */}
        {postProcess && <PostFX />}
      </Canvas>
      <Crosshair />

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
          <div><strong>BENCH</strong> · {profile}</div>
          {benchSample ? (
            <>
              <div>fps ~{benchSample.fps}</div>
              <div>p50 {benchSample.p50} ms</div>
              <div>p95 {benchSample.p95} ms</div>
              <div>draws {benchSample.drawCalls}</div>
              <div>tris {benchSample.triangles.toLocaleString()}</div>
            </>
          ) : (
            <div>measuring…</div>
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
        borderRadius: '5px'
      }}>
        <h3>Efficient Voxel System</h3>
        <p>WASD: Move</p>
        <p>Space: Jump</p>
        <p>R: Reset</p>
        <p>E: Delete voxel</p>
        <p>Only surface voxels rendered!</p>
        <p>Total voxels: {totalVoxels.toLocaleString()}</p>
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

      {/* Terrain Controls UI */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        minWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>🏔️ Terrain Presets</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.DEFAULT)}
            style={{
              padding: '6px 12px',
              backgroundColor: terrainSeed === TERRAIN_SEEDS.DEFAULT ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🌍 Default Terrain
          </button>

          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.MOUNTAINS)}
            style={{
              padding: '6px 12px',
              backgroundColor: terrainSeed === TERRAIN_SEEDS.MOUNTAINS ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🏔️ Mountain World
          </button>

          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.HILLS)}
            style={{
              padding: '6px 12px',
              backgroundColor: terrainSeed === TERRAIN_SEEDS.HILLS ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🏞️ Rolling Hills
          </button>

          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.VALLEYS)}
            style={{
              padding: '6px 12px',
              backgroundColor: terrainSeed === TERRAIN_SEEDS.VALLEYS ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🏜️ Deep Valleys
          </button>

          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.ISLANDS)}
            style={{
              padding: '6px 12px',
              backgroundColor: terrainSeed === TERRAIN_SEEDS.ISLANDS ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🏝️ Island World
          </button>

          <button
            onClick={() => setTerrainSeed(TERRAIN_SEEDS.RANDOM())}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🎲 Random Terrain
          </button>
        </div>

        <div style={{ marginTop: '12px', fontSize: '11px', opacity: 0.8 }}>
          <strong>Current Seed:</strong> {terrainSeed}
        </div>

        <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.6 }}>
          Terrain updates automatically!
        </div>
      </div>
    </KeyboardControls>
  );
};

export default App;
