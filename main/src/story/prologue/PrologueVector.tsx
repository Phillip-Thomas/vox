import React, { useEffect, useRef } from 'react';
import { PHOSPHOR } from './TerminalPrologue.tsx';
import { COLLAPSE_SECONDS, DIVE_SECONDS, vectorScene } from './prologueVectorState.ts';

// --- The prologue vector layer (Maze War rung, ~1974) ---------------------------------
//
// Vertices and edges ONLY, on one PERSISTENT canvas behind every terminal
// phase: a scrolling starfield; the hauler — the REAL ship's silhouette, its
// hull stations/wings/fins taken from utils/shipDesign.ts, resolving MORE
// edges as the voyage progresses (the fidelity ladder in miniature); and the
// destination CUBE WORLD growing with transit. Modes hand the eye off without
// a single frame swap: the ship flies in as the crawl's last words fade, holds
// at the berthing gantry through the manifest, aligns into the voyage
// formation, and at the end DIVES for the planet while the camera chases —
// the picture collapsing to a CRT scanline that the Pong court re-expands from.

type Vec3 = [number, number, number];
type Edge = [number, number];

const CUBE_VERTS: Vec3[] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];
const CUBE_EDGES: Edge[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

// --- The hauler: the main ship's own coordinates (see createShipHullGeometry) --------
// Hex hull stations, nose spike, delta wings, upturned wingtip fins, tail fin,
// nacelles — organized in DETAIL LAYERS that fade in with voyage progress.

function hexRing(x: number, r: number): Vec3[] {
  const ring: Vec3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 6) + (k * Math.PI) / 3;
    ring.push([x, r * Math.sin(a), r * Math.cos(a)]);
  }
  return ring;
}

interface ShipLayer {
  verts: Vec3[];
  edges: Edge[];
}

function buildShipLayers(): ShipLayer[] {
  const verts: Vec3[] = [];
  const layers: ShipLayer[] = [];
  const startLayer = () => {
    layers.push({ verts, edges: [] });
  };
  const V = (v: Vec3): number => {
    verts.push(v);
    return verts.length - 1;
  };
  const E = (a: number, b: number) => {
    layers[layers.length - 1].edges.push([a, b]);
  };

  // LAYER 0 — the base silhouette: three hull rings, longitudinals, nose, wings.
  startLayer();
  const ringA = hexRing(-1.72, 0.5).map(V);  // engine flare
  const ringB = hexRing(0.2, 0.52).map(V);   // mid hull
  const ringC = hexRing(1.05, 0.38).map(V);  // fore hull
  const nose = V([3.3, 0.04, 0]);
  for (const ring of [ringA, ringB, ringC]) {
    for (let k = 0; k < 6; k++) E(ring[k], ring[(k + 1) % 6]);
  }
  for (let k = 0; k < 6; k++) {
    E(ringA[k], ringB[k]);
    E(ringB[k], ringC[k]);
    E(ringC[k], nose);
  }
  // Delta wings (swept back, slight anhedral) — shipDesign's sheet corners.
  for (const s of [1, -1]) {
    const w0 = V([0.55, 0.05, 0.4 * s]);
    const w1 = V([-0.95, 0.02, 0.46 * s]);
    const w2 = V([-1.55, -0.16, 3.0 * s]);
    const w3 = V([-0.45, -0.13, 3.0 * s]);
    E(w0, w1); E(w1, w2); E(w2, w3); E(w3, w0);
  }

  // LAYER 1 — tail fin + upturned wingtip fins (the dragonfly gesture).
  startLayer();
  const t0 = V([-0.55, 0.5, 0]);
  const t1 = V([-1.62, 0.42, 0]);
  const t2 = V([-1.95, 1.25, 0]);
  const t3 = V([-1.35, 1.15, 0]);
  E(t0, t1); E(t1, t2); E(t2, t3); E(t3, t0);
  for (const s of [1, -1]) {
    const f0 = V([-0.45, -0.13, 3.0 * s]);
    const f1 = V([-1.55, -0.16, 3.0 * s]);
    const f2 = V([-1.35, 0.62, 3.28 * s]);
    const f3 = V([-0.75, 0.55, 3.24 * s]);
    E(f0, f1); E(f1, f2); E(f2, f3); E(f3, f0);
  }

  // LAYER 2 — fine detail: nose ring, dorsal spine, chin intake, nacelles.
  startLayer();
  const ringD = hexRing(2.1, 0.13).map(V);
  for (let k = 0; k < 6; k++) E(ringD[k], ringD[(k + 1) % 6]);
  const s0 = V([-1.3, 0.52, 0]);
  const s1 = V([0.6, 0.54, 0]);
  E(s0, s1); // dorsal spine ridge
  const c0 = V([0.4, -0.44, 0.17]);
  const c1 = V([1.4, -0.4, 0.17]);
  const c2 = V([1.4, -0.4, -0.17]);
  const c3 = V([0.4, -0.44, -0.17]);
  E(c0, c1); E(c1, c2); E(c2, c3); E(c3, c0); // chin intake wedge
  for (const s of [1, -1]) {
    const n0 = V([-1.05, -0.14, (1.05 - 0.16) * s]);
    const n1 = V([0.25, -0.14, (1.05 - 0.16) * s]);
    const n2 = V([0.25, -0.14, (1.05 + 0.16) * s]);
    const n3 = V([-1.05, -0.14, (1.05 + 0.16) * s]);
    E(n0, n1); E(n1, n2); E(n2, n3); E(n3, n0); // under-wing nacelles
  }

  return layers;
}

const SHIP_LAYERS = buildShipLayers();
const SHIP_VERTS = SHIP_LAYERS[0].verts; // shared vertex pool

const STAR_COUNT = 110;
const DEBRIS_COUNT = 14;

/** Deterministic per-index hash (no lattice artifacts — actual scatter). */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smooth(k: number): number {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
}

const PrologueVector: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // A real sky: scattered (hashed, no rows), mostly faint pinpricks with a
    // few bright ones, each twinkling on its own clock. Drift is imperceptible
    // until the voyage — static stars leave no phosphor dashes.
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
      const bright = hash01(i * 3 + 2);
      return {
        x: hash01(i * 3),
        y: hash01(i * 3 + 1),
        speed: 0.008 + hash01(i * 5 + 4) * 0.05,
        size: bright > 0.92 ? 2.2 : bright > 0.7 ? 1.6 : 1,
        base: 0.18 + bright * 0.5,
        twinklePhase: hash01(i * 7 + 5) * Math.PI * 2,
        twinkleRate: 0.4 + hash01(i * 7 + 6) * 1.8
      };
    });
    // Dive debris: streaks shed by the planet, flying at the ship.
    const debris = Array.from({ length: DEBRIS_COUNT }, (_, i) => ({
      seed: (i * 97.3) % 1,
      delay: (i * 0.13) % 1.4
    }));
    let raf = 0;
    let last = performance.now();
    // The ship's smoothed screen state (all modes ease this, never snap it).
    const ship = { x: 1.35, y: 0.42, scale: 0.006, alpha: 0, yaw: 0.18 };

    const project = (
      v: Vec3, cx: number, cy: number, scale: number,
      rotY: number, rotX: number, jitter: number
    ): [number, number] => {
      let [x, y, z] = v;
      if (jitter > 0) {
        x += (Math.random() - 0.5) * jitter;
        y += (Math.random() - 0.5) * jitter;
        z += (Math.random() - 0.5) * jitter;
      }
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const f = 5 / (5 + z2);
      return [cx + x1 * scale * f, cy - y1 * scale * f];
    };

    const drawEdges = (
      verts: Vec3[], edges: Edge[], cx: number, cy: number, scale: number,
      rotY: number, rotX: number, jitter: number, alpha: number
    ) => {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const projected = verts.map(v => project(v, cx, cy, scale, rotY, rotX, jitter));
      for (const [a, b] of edges) {
        ctx.moveTo(projected[a][0], projected[a][1]);
        ctx.lineTo(projected[b][0], projected[b][1]);
      }
      ctx.stroke();
      for (const [px, py] of projected) ctx.fillRect(px - 1, py - 1, 2, 2);
      ctx.globalAlpha = 1;
    };

    // Reused projection buffer for the ship's shared vertex pool.
    const shipProjected: Array<[number, number]> = SHIP_VERTS.map(() => [0, 0]);

    const drawShip = (w: number, h: number, jitter: number, detail: number) => {
      const cx = ship.x * w;
      const cy = ship.y * h;
      const scale = ship.scale * w;
      // Project the shared pool ONCE, then stroke each detail layer from it.
      for (let i = 0; i < SHIP_VERTS.length; i++) {
        const p = project(SHIP_VERTS[i], cx, cy, scale, ship.yaw, 0.1, jitter);
        shipProjected[i][0] = p[0];
        shipProjected[i][1] = p[1];
      }
      // Layer alphas: the ship RESOLVES as the voyage progresses.
      const alphas = [
        ship.alpha,
        ship.alpha * smooth((detail - 0.15) / 0.3),
        ship.alpha * smooth((detail - 0.55) / 0.3)
      ];
      SHIP_LAYERS.forEach((layer, i) => {
        const alpha = alphas[i];
        if (alpha <= 0.01) return;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const [a, b] of layer.edges) {
          ctx.moveTo(shipProjected[a][0], shipProjected[a][1]);
          ctx.lineTo(shipProjected[b][0], shipProjected[b][1]);
        }
        ctx.stroke();
        for (const [a, b] of layer.edges) {
          ctx.fillRect(shipProjected[a][0] - 1, shipProjected[a][1] - 1, 2, 2);
          ctx.fillRect(shipProjected[b][0] - 1, shipProjected[b][1] - 1, 2, 2);
        }
      });
      ctx.globalAlpha = 1;
    };

    const ease = (current: number, target: number, rate: number, dt: number): number =>
      current + (target - current) * Math.min(1, 1 - Math.exp(-rate * dt));

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        ctx.fillStyle = '#020604';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const w = canvas.width;
      const h = canvas.height;
      const t = now / 1000;
      const { mode, progress, anomaly } = vectorScene;
      const modeT = (now - vectorScene.modeAt) / 1000;

      // Court mode: the oscilloscope's opaque canvas covers this layer — after
      // a short fade-to-black, painting is pure waste. Park the loop.
      if (mode === 'court') {
        if (modeT < 1.2) {
          ctx.fillStyle = 'rgba(2,6,4,0.28)';
          ctx.fillRect(0, 0, w, h);
        }
        return;
      }

      // Phosphor persistence.
      ctx.fillStyle = 'rgba(2,6,4,0.28)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = PHOSPHOR;
      ctx.fillStyle = PHOSPHOR;
      ctx.lineWidth = 1;

      // Dive framing: the whole scene squashes to a scanline at the very end
      // (the CRT switching modes — the Pong court re-expands from this line).
      const diveK = mode === 'dive' ? Math.min(1, modeT / DIVE_SECONDS) : 0;
      const collapseK = mode === 'dive'
        ? smooth((modeT - (DIVE_SECONDS - COLLAPSE_SECONDS)) / COLLAPSE_SECONDS)
        : 0;
      if (collapseK > 0) {
        ctx.save();
        ctx.translate(0, h / 2);
        ctx.scale(1, Math.max(0.015, 1 - collapseK));
        ctx.translate(0, -h / 2);
      }

      // Starfield: near-static chaos at rest (twinkle, no drift-dashes), a slow
      // right→left current once the voyage is underway, racing in the dive.
      const starRate = mode === 'voyage' ? 0.5 + progress * 1.2
        : mode === 'dive' ? 4 + diveK * 7
        : 0.06;
      for (const star of stars) {
        star.x -= star.speed * starRate * dt;
        if (star.x < 0) star.x += 1;
        const twinkle = 0.75 + 0.25 * Math.sin(t * star.twinkleRate + star.twinklePhase);
        ctx.globalAlpha = star.base * twinkle;
        const streak = mode === 'dive' ? star.size + diveK * 26 : star.size;
        ctx.fillRect(star.x * w, star.y * h, streak, star.size);
      }
      ctx.globalAlpha = 1;

      // --- Ship state per mode (all eased — no snaps, ever) -----------------------
      let jitter = anomaly ? 0.12 : 0;
      let detail = mode === 'voyage' || mode === 'dive' ? progress : 0.2;
      if (mode === 'void') {
        ship.alpha = ease(ship.alpha, 0, 3, dt);
        ship.x = 1.35;
        ship.y = 0.42;
        ship.scale = 0.008;
      } else if (mode === 'enter') {
        // The fly-in: decelerating from off-frame right as the crawl fades.
        const k = smooth(Math.min(1, modeT / 2.8));
        ship.alpha = Math.min(1, modeT / 0.8) * 0.9;
        ship.x = 1.25 - (1.25 - 0.62) * k;
        ship.y = 0.44 + (1 - k) * 0.05;
        ship.scale = 0.012 + 0.010 * k;
        ship.yaw = 0.34 - 0.16 * k;
      } else if (mode === 'dock') {
        ship.alpha = ease(ship.alpha, 0.9, 4, dt);
        ship.x = ease(ship.x, 0.62, 2.4, dt);
        ship.y = 0.44 + Math.sin(t * 0.4) * 0.008;
        ship.scale = ease(ship.scale, 0.022, 2.4, dt);
        ship.yaw = ease(ship.yaw, 0.18 + Math.sin(t * 0.22) * 0.03, 3, dt);
        // The berthing gantry: a dock arm + brackets, blinking a service light.
        ctx.globalAlpha = 0.45;
        const gy = 0.44 * h;
        ctx.beginPath();
        ctx.moveTo(w * 0.97, gy - h * 0.16);
        ctx.lineTo(w * 0.80, gy - h * 0.16);
        ctx.lineTo(w * 0.80, gy);
        ctx.moveTo(w * 0.97, gy + h * 0.14);
        ctx.lineTo(w * 0.84, gy + h * 0.14);
        ctx.lineTo(w * 0.84, gy + h * 0.02);
        ctx.stroke();
        if (Math.floor(t * 1.4) % 2 === 0) ctx.fillRect(w * 0.80 - 2, gy - 2, 4, 4);
        ctx.globalAlpha = 1;
      } else if (mode === 'voyage') {
        // Aligning into the Oregon Trail formation, then holding with a drift
        // that grows restless as the transit wears on.
        ship.alpha = ease(ship.alpha, 0.9, 4, dt);
        ship.x = ease(ship.x, 0.3, 1.6, dt);
        ship.y = 0.40 + Math.sin(t * (0.5 + progress * 0.5)) * (0.012 + progress * 0.012);
        ship.scale = ease(ship.scale, 0.020, 2, dt);
        ship.yaw = 0.18 + Math.sin(t * 0.22) * (0.05 + progress * 0.05);
        // Thruster pulse: engine dashes, more insistent late in the transit.
        if (progress > 0.25) {
          ctx.globalAlpha = 0.35 * Math.abs(Math.sin(t * (2 + progress * 3)));
          const ex = ship.x * w - 2.2 * ship.scale * w;
          const ey = ship.y * h;
          ctx.fillRect(ex - 10 - progress * 12, ey - 1, 8 + progress * 10, 2);
          ctx.globalAlpha = 1;
        }
      } else if (mode === 'dive') {
        // THE DIVE: the ship banks toward the planet and accelerates offscreen;
        // the camera chases — the cube rushes to center-frame and swallows it.
        const accel = smooth(Math.min(1, modeT / (DIVE_SECONDS - COLLAPSE_SECONDS)));
        ship.alpha = 0.9;
        ship.x = 0.3 + accel * accel * 1.15;
        ship.y = ease(ship.y, 0.42, 3, dt);
        ship.yaw = ease(ship.yaw, -0.05, 2.5, dt); // nose leveling INTO the dive
        ship.scale = 0.020 - accel * 0.008;        // pulling away from the camera
        jitter = 0.2 + accel * 0.25;
        detail = 1;
        // Debris shed by the planet, streaking at the ship (right → left).
        ctx.globalAlpha = 0.8;
        for (const b of debris) {
          const bt = modeT - b.delay;
          if (bt <= 0) continue;
          const bx = 1.05 - ((bt * (0.55 + b.seed * 0.5)) % 1.3);
          const by = 0.12 + ((b.seed * 7.7) % 0.76);
          const len = 8 + b.seed * 18 + accel * 24;
          ctx.fillRect(bx * w, by * h, len, 1.6);
        }
        ctx.globalAlpha = 1;
      }

      // The destination cube world.
      if (mode === 'voyage' || mode === 'dive') {
        const chase = mode === 'dive' ? smooth(Math.min(1, modeT / (DIVE_SECONDS - COLLAPSE_SECONDS * 0.6))) : 0;
        const cubeX = 0.78 - chase * 0.28;              // the chase re-centers it
        const cubeY = 0.4 + chase * 0.1;
        const grow = mode === 'dive' ? Math.exp(chase * 3.1) : 1;
        const cubeScale = w * (0.012 + Math.min(1, progress) * 0.085) * grow;
        drawEdges(
          CUBE_VERTS, CUBE_EDGES,
          cubeX * w, cubeY * h,
          cubeScale, t * 0.21, 0.42,
          (anomaly ? 0.3 : 0) + chase * 0.2,
          Math.min(1, 0.35 + progress * 0.6 + chase * 0.4)
        );
      }

      if (ship.alpha > 0.02) drawShip(w, h, jitter, detail);

      if (collapseK > 0) {
        ctx.restore();
        // The scanline itself brightens as the picture collapses into it.
        ctx.globalAlpha = collapseK * 0.9;
        ctx.fillRect(0, h / 2 - 1, w, 2);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.85 }}
    />
  );
};

export default PrologueVector;
