import { useEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import storedVantages from './vantages.json';

// User-authored vantages (recorded via PoseRecorder, filed into vantages.json):
// exact camera pose pinned to a specific world/seed. Replayed verbatim — far
// better framing than computed vantages (e.g. a hand-picked coastline).
interface StoredVantage {
  name: string;
  world: [number, number];
  day: number | null;
  pos: [number, number, number];
  quat: [number, number, number, number];
  reason?: string;
}
const STORED = storedVantages as StoredVantage[];

// --- Verification harness camera + window.__game bridge ----------------------
//
// Mounted ONLY under ?agent=1 (debug). Replaces the FPS/ship camera with a
// scriptable makeDefault camera and exposes `window.__game` so a headed Playwright
// runner (tools/capture.mjs, real GPU) can:
//   • drive the camera to COMPUTED vantages (framed off the live scene, so shots
//     reliably show the canopy/coast/horizon instead of "looking at grass"),
//   • read real FPS / draw-call / triangle metrics,
//   • await ready() (world gen + a few painted frames).
//
// This is the official replacement for the throwaway `window.__three` hack and is
// the gate for the whole visual roadmap: every phase captures before/after here.

export interface AgentMetrics {
  fps: number;
  p50: number;
  p95: number;
  drawCalls: number;
  triangles: number;
}

export interface AgentGame {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Frame the camera on a named vantage computed from the live scene. */
  view: (name: string) => string;
  /** Explicit camera placement. */
  lookFrom: (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => void;
  /** Latest real-GPU performance sample. */
  metrics: () => AgentMetrics;
  /** Resolves once the world has generated and several frames have painted. */
  ready: () => Promise<void>;
  /** Available vantage names. */
  vantages: string[];
}

declare global {
  interface Window {
    __game?: AgentGame;
  }
}

interface AgentCameraProps {
  planetSize: number;
  /** Publish the camera position so grass/trees/water stream around the vantage. */
  onPositionChange?: (position: THREE.Vector3) => void;
}

const VANTAGES = ['overhead', 'underCanopy', 'coast', 'horizon', 'tree'] as const;

function instancedByKey(scene: THREE.Scene, re: RegExp): THREE.InstancedMesh | null {
  let found: THREE.InstancedMesh | null = null;
  scene.traverse(o => {
    if (found || !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const mat = (o as THREE.InstancedMesh).material as THREE.Material & {
      customProgramCacheKey?: () => string;
    };
    let key = '';
    try { key = mat?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
    if (re.test(key)) found = o as THREE.InstancedMesh;
  });
  return found;
}

// The instance (by translation) with the largest +Y — i.e. cleanly on the top
// face — gives reliable, repeatable framing.
function topInstancePos(mesh: THREE.InstancedMesh, out: THREE.Vector3): boolean {
  const arr = mesh.instanceMatrix.array as ArrayLike<number>;
  let bi = -1;
  let by = -Infinity;
  for (let i = 0; i < mesh.count; i++) {
    const y = arr[i * 16 + 13];
    if (y > by) { by = y; bi = i; }
  }
  if (bi < 0) return false;
  out.set(arr[bi * 16 + 12], arr[bi * 16 + 13], arr[bi * 16 + 14]);
  return true;
}

export default function AgentCamera({ planetSize, onPositionChange }: AgentCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);

  const frameTimes = useRef<number[]>([]);
  const lastTime = useRef(0);
  const frameCount = useRef(0);
  const sample = useRef<AgentMetrics>({ fps: 0, p50: 0, p95: 0, drawCalls: 0, triangles: 0 });

  // Suppress the (ground-thick) fog so distant vantages aren't washed out, like
  // OverviewCamera does. Phase 1 will validate fog separately at ground vantages.
  useEffect(() => {
    const prev = scene.fog;
    // keep fog for ground vantages; only thin it. Leave as-is for now (Phase 1
    // tunes fog) — the harness wants to SEE fog changes, so don't null it.
    return () => { scene.fog = prev; };
  }, [scene]);

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    const radial = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    const worldRadius = planetSize;

    const tangentFor = (up: THREE.Vector3, outV: THREE.Vector3) => {
      // any stable horizontal perpendicular to the radial up
      outV.set(0, 1, 0);
      if (Math.abs(up.y) > 0.95) outV.set(1, 0, 0);
      outV.cross(up).normalize();
    };

    // `streamAt` is the SURFACE point published as the "player position" so grass/
    // trees/water stream around the SUBJECT, not the (often far) camera — otherwise
    // distance culling empties the scene at overhead/horizon vantages.
    const apply = (p: THREE.Vector3, t: THREE.Vector3, streamAt: THREE.Vector3) => {
      cam.position.copy(p);
      cam.up.set(0, 1, 0);
      cam.lookAt(t);
      cam.updateMatrixWorld(true);
      onPositionChange?.(streamAt.clone());
    };

    const surfaceTop = () => new THREE.Vector3(0, worldRadius, 0);
    const overhead = (why: string): string => {
      apply(
        pos.set(worldRadius * 2.6, worldRadius * 1.7, worldRadius * 2.6),
        target.set(0, 0, 0),
        surfaceTop() // stream the top hemisphere (where the arrival site + its trees are)
      );
      return why;
    };

    const view = (name: string): string => {
      // User-authored vantage (exact pos+quat) takes precedence over computed ones.
      const stored = STORED.find(v => v.name === name);
      if (stored) {
        cam.position.set(stored.pos[0], stored.pos[1], stored.pos[2]);
        cam.quaternion.set(stored.quat[0], stored.quat[1], stored.quat[2], stored.quat[3]);
        cam.updateMatrixWorld(true);
        // stream around the surface beneath the pinned camera.
        const dir = cam.position.clone().normalize();
        onPositionChange?.(dir.multiplyScalar(worldRadius));
        return name;
      }
      if (name === 'overhead') return overhead('overhead');
      if (name === 'underCanopy' || name === 'tree') {
        const leaf = instancedByKey(scene, /tree-leaf/);
        if (leaf && leaf.count > 0 && topInstancePos(leaf, pos)) {
          const base = pos.clone();
          radial.copy(base).normalize();
          tangentFor(radial, tangent);
          const back = name === 'tree' ? 9 : 5;
          const eye = base.clone().addScaledVector(tangent, back).addScaledVector(radial, 2.2);
          apply(eye, base.clone().addScaledVector(radial, 4), base);
          return name;
        }
        return overhead(name + ':no-trees(overhead)');
      }
      if (name === 'coast') {
        const water = instancedByKey(scene, /water-blocks/);
        if (water && water.count > 0 && topInstancePos(water, pos)) {
          const wp = pos.clone();
          radial.copy(wp).normalize();
          tangentFor(radial, tangent);
          const eye = wp.clone().addScaledVector(tangent, 8).addScaledVector(radial, 5);
          apply(eye, wp.clone(), wp);
          return 'coast';
        }
        return overhead('coast:no-water(overhead)');
      }
      if (name === 'horizon') {
        // stand on the top face, look out toward the horizon (tangent) so terrain
        // meets sky — best vantage for fog / atmosphere. Stream around the eye.
        const surf = surfaceTop();
        radial.copy(surf).normalize();
        tangentFor(radial, tangent);
        const eye = surf.clone().addScaledVector(radial, 2.5);
        apply(eye, eye.clone().addScaledVector(tangent, 40).addScaledVector(radial, -2), eye);
        return 'horizon';
      }
      return overhead('unknown(overhead)');
    };

    const lookFrom = (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
      apply(pos.set(px, py, pz), target.set(tx, ty, tz), target.clone());
    };

    const ready = () => new Promise<void>(resolve => {
      const poll = () => {
        // a planet voxel mesh with instances + several painted frames = ready.
        const voxels = instancedByKey(scene, /voxel-pbr/);
        if (frameCount.current > 20 && voxels && voxels.count > 0) resolve();
        else setTimeout(poll, 50);
      };
      poll();
    });

    window.__game = {
      gl, scene, camera: cam,
      view, lookFrom,
      metrics: () => ({ ...sample.current }),
      ready,
      vantages: [...VANTAGES, ...STORED.map(v => v.name)]
    };

    // default vantage so the first frame isn't empty
    view('overhead');

    return () => { delete window.__game; };
  }, [gl, scene, planetSize, onPositionChange]);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (lastTime.current !== 0) {
      const dt = now - lastTime.current;
      const buf = frameTimes.current;
      buf.push(dt);
      if (buf.length > 90) buf.shift();
      if (buf.length >= 30) {
        const sorted = [...buf].sort((a, b) => a - b);
        const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
        sample.current = {
          fps: Math.round(1000 / mean),
          p50: +sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
          p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles
        };
      }
    }
    lastTime.current = now;
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={70}
      near={0.05}
      far={planetSize * 120}
      position={[planetSize * 2.6, planetSize * 1.7, planetSize * 2.6]}
    />
  );
}
