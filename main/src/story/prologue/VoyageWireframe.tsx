import React, { useEffect, useRef } from 'react';
import { PHOSPHOR } from './TerminalPrologue.tsx';

// --- The voyage wireframe (Maze War rung, ~1974) --------------------------------------
//
// Vertices and edges ONLY: a phosphor vector scene behind the ledger — the
// hauler outline drifting through a scrolling starfield while the destination
// CUBE WORLD grows with voyage progress (the player literally watches the cubic
// construct approach — the earliest-3D rung doing foreshadowing). When the nav
// anomaly lands, the cube's vertices jitter: the same grammar the Pong game and
// the corruption inherit. Imperative canvas, paint-over trails, zero React churn.

interface VoyageWireframeProps {
  /** Live voyage progress 0..1 (drives the destination cube's approach). */
  progressRef: React.MutableRefObject<number>;
  /** Anomaly flag (vertex jitter) — set when the bridge card lands. */
  anomalyRef: React.MutableRefObject<boolean>;
}

type Vec3 = [number, number, number];

const CUBE_VERTS: Vec3[] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];
const CUBE_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

// The hauler: an elongated hexagonal prism + a tail fin, drawn as edges.
const HAULER_VERTS: Vec3[] = [
  [-3, 0.6, 0.6], [3, 0.6, 0.6], [3, -0.6, 0.6], [-3, -0.6, 0.6],
  [-3, 0.6, -0.6], [3, 0.6, -0.6], [3, -0.6, -0.6], [-3, -0.6, -0.6],
  [4.2, 0, 0], // nose
  [-3, 1.6, 0] // fin tip
];
const HAULER_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
  [1, 8], [2, 8], [5, 8], [6, 8],
  [0, 9], [4, 9]
];

const STAR_COUNT = 46;

const VoyageWireframe: React.FC<VoyageWireframeProps> = ({ progressRef, anomalyRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: (i * 137.5) % 1,
      y: ((i * 61.8) % 89) / 89,
      speed: 0.02 + ((i * 7) % 5) * 0.012
    }));
    let raf = 0;
    let last = performance.now();

    const project = (v: Vec3, cx: number, cy: number, scale: number, rotY: number, rotX: number, jitter: number): [number, number] => {
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
      return [cx + x1 * scale * f, cy + y1 * scale * f];
    };

    const drawShape = (verts: Vec3[], edges: Array<[number, number]>, cx: number, cy: number, scale: number, rotY: number, rotX: number, jitter: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const projected = verts.map(v => project(v, cx, cy, scale, rotY, rotX, jitter));
      for (const [a, b] of edges) {
        ctx.moveTo(projected[a][0], projected[a][1]);
        ctx.lineTo(projected[b][0], projected[b][1]);
      }
      ctx.stroke();
      // Vertices as bright points (the era drew its dots proudly).
      for (const [px, py] of projected) ctx.fillRect(px - 1, py - 1, 2, 2);
      ctx.globalAlpha = 1;
    };

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
      const progress = progressRef.current;
      const anomaly = anomalyRef.current;

      // Phosphor persistence.
      ctx.fillStyle = 'rgba(2,6,4,0.28)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = PHOSPHOR;
      ctx.fillStyle = PHOSPHOR;
      ctx.lineWidth = 1;

      // Starfield: right→left, the direction of travel.
      ctx.globalAlpha = 0.5;
      for (const star of stars) {
        star.x -= star.speed * dt;
        if (star.x < 0) star.x += 1;
        ctx.fillRect(star.x * w, star.y * h, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // The hauler, holding formation left-of-center with a slow drift.
      drawShape(
        HAULER_VERTS, HAULER_EDGES,
        w * 0.3, h * 0.42 + Math.sin(t * 0.5) * h * 0.015,
        w * 0.022, 0.18 + Math.sin(t * 0.22) * 0.05, 0.1,
        anomaly ? 0.12 : 0,
        0.9
      );

      // The destination: a cube world, growing out of the vector dark.
      const cubeScale = w * (0.012 + progress * 0.085);
      drawShape(
        CUBE_VERTS, CUBE_EDGES,
        w * 0.78, h * 0.4,
        cubeScale, t * 0.21, 0.42,
        anomaly ? 0.3 : 0,
        0.35 + progress * 0.6
      );
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

export default VoyageWireframe;
