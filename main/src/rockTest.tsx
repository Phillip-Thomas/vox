// =============================================================================
// ROCK TEST HARNESS — isolated, well-lit viewer for the loose-stone prop.
// =============================================================================
//
// WHY: debugging the scattered stones in the live game is slow (right planet,
// right spot, framing, lighting). This renders the EXACT same geometry + material
// (buildStoneGeometry + createStoneMaterial from utils/looseStone) in a clean
// scene so shape, shading, and — crucially — FACE WINDING are unambiguous.
//
// The right column applies the in-game surface-orientation basis (tangent/up/
// bitangent) to each instance; if that basis is LEFT-handed it mirrors the mesh
// and you see the inside faces. The left column is identity (ground truth). They
// should look identical — if the right column looks inside-out, the field's basis
// is wrong.
//
// USE: npm run dev, open http://localhost:5173/rock-test.html  (orbit/zoom).
// Dev-only entry (separate Vite html) — never touches the game bundle.
// =============================================================================

import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildStoneGeometry, createStoneMaterial } from './utils/looseStone.ts';
import { deterministicTangentForUp } from './utils/surfaceControls.ts';

const COLS = 5;
const ROWS = 4;
const SPACING = 2.2;

// A deterministic per-cell instance matrix: random yaw + tilt + scale, like the
// field. `mirrored` reproduces the OLD left-handed basis to demonstrate the bug.
function cellMatrix(i: number, mirrored: boolean): THREE.Matrix4 {
  const h = (n: number) => {
    const s = Math.sin((i + 1) * n) * 43758.5453;
    return s - Math.floor(s);
  };
  const up = new THREE.Vector3(h(12.9) * 2 - 1, 1, h(78.2) * 2 - 1).normalize();
  const tangent = new THREE.Vector3();
  deterministicTangentForUp(up, tangent);
  const bitangent = new THREE.Vector3();
  if (mirrored) bitangent.crossVectors(up, tangent).normalize();   // left-handed (bug)
  else bitangent.crossVectors(tangent, up).normalize();            // right-handed (fixed)
  const basis = new THREE.Matrix4().makeBasis(tangent, up, bitangent);
  const yaw = new THREE.Matrix4().makeRotationY(h(11.1) * Math.PI * 2);
  const s = 0.7 + h(29.3) * 0.6;
  const scale = new THREE.Matrix4().makeScale(s, s * 0.7, s);
  return basis.multiply(yaw).multiply(scale);
}

function Rocks({ mirrored, x }: { mirrored: boolean; x: number }) {
  const geometry = useMemo(() => buildStoneGeometry(0.9), []);
  const material = useMemo(() => createStoneMaterial(), []);
  const mesh = useMemo(() => {
    const count = COLS * ROWS;
    const im = new THREE.InstancedMesh(geometry, material, count);
    const m = new THREE.Matrix4();
    const t = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      t.makeTranslation(
        x + (col - (COLS - 1) / 2) * SPACING,
        0,
        (row - (ROWS - 1) / 2) * SPACING
      );
      m.copy(t).multiply(cellMatrix(i, mirrored));
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [geometry, material, mirrored, x]);
  return <primitive object={mesh} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Canvas camera={{ position: [0, 7, 16], fov: 45, near: 0.1, far: 1000 }}>
      <color attach="background" args={['#9fb0c4']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 9]} intensity={1.4} />
      <directionalLight position={[-9, 5, -7]} intensity={0.35} color="#a9c2ff" />
      <gridHelper args={[60, 30, '#5b6675', '#49525e']} />
      {/* Left: right-handed basis (fixed). Right: left-handed (old bug). */}
      <Rocks mirrored={false} x={-7} />
      <Rocks mirrored x={7} />
      <OrbitControls target={[0, 0, 0]} />
    </Canvas>
  </StrictMode>
);
