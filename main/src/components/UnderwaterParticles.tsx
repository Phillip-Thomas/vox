/**
 * UnderwaterParticles — two GPU Points systems that sell underwater volume:
 *
 *   1. Marine Snow  — ~900 soft translucent motes drifting via sin-based Brownian
 *      noise in the vertex shader. World-anchored around the camera, infinite wrap.
 *   2. Rising Bubbles — ~250 bright-rim bubbles with local-up velocity + horizontal
 *      wobble in the vertex shader, respawning below the swimmer when they exit top.
 *
 * Both systems are kept in a camera-adjacent volume via a `uCameraPos` uniform,
 * but particles are anchored in world space before wrapping. This gives forward
 * swimmer motion real parallax instead of making bubbles feel attached to camera.
 *
 * Visibility toggled (not mounted/unmounted) to avoid re-allocation.
 * Overall opacity driven by `uSubmergence` so they fade in with the waterline.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getPlayerUp } from '../state/playerFrame';
import { getPlayerSubmergence } from '../state/playerSubmersion';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOX_HALF = 7; // half-size of the particle cloud cube (14-unit total)
const BOX_SIZE = BOX_HALF * 2;

const DEFAULT_SNOW_COUNT   = 900;
const DEFAULT_BUBBLE_COUNT = 250;

// ---------------------------------------------------------------------------
// Geometry helpers — build once in useMemo
// ---------------------------------------------------------------------------

function buildSnowGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const seeds     = new Float32Array(count * 3); // per-particle random seeds (x,y,z)
  const sizes     = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Positions in local [-BOX_HALF, BOX_HALF] box
    positions[i * 3 + 0] = (Math.random() - 0.5) * BOX_SIZE;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOX_SIZE;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX_SIZE;

    // Three independent random seeds for per-axis drift frequency variation
    seeds[i * 3 + 0] = Math.random() * 6.2832; // phase offset x
    seeds[i * 3 + 1] = Math.random() * 6.2832; // phase offset y
    seeds[i * 3 + 2] = Math.random() * 6.2832; // phase offset z

    sizes[i] = 2.5 + Math.random() * 3.0; // pixel size 2.5–5.5
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds,     3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,     1));
  return geo;
}

function buildBubbleGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const seeds     = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * BOX_SIZE;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOX_SIZE; // spread vertically too
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX_SIZE;

    seeds[i * 3 + 0] = Math.random() * 6.2832; // horizontal wobble phase x
    seeds[i * 3 + 1] = 0.4 + Math.random() * 0.8; // rise speed scale (0.4–1.2 u/s)
    seeds[i * 3 + 2] = Math.random() * 6.2832; // horizontal wobble phase z

    sizes[i] = 3.5 + Math.random() * 4.5; // pixel size 3.5–8
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds,     3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,     1));
  return geo;
}

// ---------------------------------------------------------------------------
// Shader sources
// ---------------------------------------------------------------------------

// Wrap a value into [-half, half] range (GLSL)
const WRAP_GLSL = /* glsl */`
float wrapBox(float v, float half_) {
  // Map to [0, size], fract, map back to [-half, half]
  float size = half_ * 2.0;
  return mod(v + half_, size) - half_;
}

void waterParticleBasis(vec3 up, out vec3 right, out vec3 forward) {
  vec3 ref = abs(up.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  right = normalize(cross(ref, up));
  forward = normalize(cross(up, right));
}

vec3 wrapAroundCamera(vec3 worldPos, vec3 cameraPos, vec3 up, float half_) {
  vec3 right; vec3 forward;
  waterParticleBasis(up, right, forward);
  vec3 d = worldPos - cameraPos;
  return cameraPos
    + right * wrapBox(dot(d, right), half_)
    + up * wrapBox(dot(d, up), half_)
    + forward * wrapBox(dot(d, forward), half_);
}
`;

// ---------------------------------------------------------------------------
// Marine Snow shaders
// ---------------------------------------------------------------------------

const snowVertexShader = /* glsl */`
attribute vec3 aSeed;
attribute float aSize;

uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uUp;
uniform float uBoxHalf;

varying float vEdgeFade; // 0..1, fades near box boundary

${WRAP_GLSL}

void main() {
  // Start from the base position (local box space)
  vec3 pos = position;

  // Slow Brownian drift: three independent sin-waves per axis
  float t = uTime;
  pos.x += 0.18 * sin(t * 0.31 + aSeed.x) + 0.07 * sin(t * 0.73 + aSeed.y);
  pos.y += 0.12 * sin(t * 0.22 + aSeed.y) + 0.05 * sin(t * 0.61 + aSeed.z);
  pos.z += 0.15 * sin(t * 0.27 + aSeed.z) + 0.06 * sin(t * 0.55 + aSeed.x);

  vec3 up = normalize(uUp);
  pos = wrapAroundCamera(pos, uCameraPos, up, uBoxHalf);

  // Re-express local offset relative to camera for edge-fade
  vec3 localOff = pos - uCameraPos;
  vec3 right; vec3 forward;
  waterParticleBasis(up, right, forward);
  // Fade out near the box walls (inner 70% = full alpha, then ramp to 0)
  float fx = 1.0 - smoothstep(uBoxHalf * 0.70, uBoxHalf, abs(dot(localOff, right)));
  float fy = 1.0 - smoothstep(uBoxHalf * 0.70, uBoxHalf, abs(dot(localOff, up)));
  float fz = 1.0 - smoothstep(uBoxHalf * 0.70, uBoxHalf, abs(dot(localOff, forward)));
  vEdgeFade = fx * fy * fz;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPos.z); // perspective scale
  gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
  gl_Position  = projectionMatrix * mvPos;
}
`;

const snowFragmentShader = /* glsl */`
uniform float uSubmergence;

varying float vEdgeFade;

void main() {
  // Soft round sprite via smoothstep on distance from point center
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);
  float alpha = smoothstep(0.5, 0.20, dist); // feathered disk

  // Motes are translucent debris, not bright sparks — desaturated blue-white
  vec3 color = vec3(0.78, 0.86, 0.94);

  float a = alpha * vEdgeFade * uSubmergence * 0.55; // max ~55% opacity
  if (a < 0.004) discard;

  gl_FragColor = vec4(color, a);
}
`;

// ---------------------------------------------------------------------------
// Rising Bubbles shaders
// ---------------------------------------------------------------------------

const bubbleVertexShader = /* glsl */`
attribute vec3 aSeed;  // .x = wobble phase, .y = rise speed, .z = wobble phase z
attribute float aSize;

uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uUp;
uniform float uBoxHalf;

varying float vEdgeFade;
varying float vRimAlpha; // drives the specular rim in frag

${WRAP_GLSL}

void main() {
  vec3 pos = position;
  vec3 up = normalize(uUp);
  vec3 right; vec3 forward;
  waterParticleBasis(up, right, forward);

  // Rising: move toward the local water surface, not global +Y.
  float rise    = uTime * aSeed.y * 1.2; // world-units risen
  pos += up * rise;

  // Horizontal sin wobble in the plane perpendicular to local up.
  pos += right * (0.25 * sin(uTime * 1.1 + aSeed.x));
  pos += forward * (0.20 * sin(uTime * 0.9 + aSeed.z));

  pos = wrapAroundCamera(pos, uCameraPos, up, uBoxHalf);

  // Edge fade
  vec3 localOff = pos - uCameraPos;
  float fx = 1.0 - smoothstep(uBoxHalf * 0.72, uBoxHalf, abs(dot(localOff, right)));
  float fy = 1.0 - smoothstep(uBoxHalf * 0.72, uBoxHalf, abs(dot(localOff, up)));
  float fz = 1.0 - smoothstep(uBoxHalf * 0.72, uBoxHalf, abs(dot(localOff, forward)));
  vEdgeFade = fx * fy * fz;

  // Near-top bubbles fade just before they wrap (reduces pop)
  float normY  = (dot(localOff, up) + uBoxHalf) / (uBoxHalf * 2.0); // 0=bottom,1=top
  vEdgeFade   *= 1.0 - smoothstep(0.80, 1.0, normY);

  vRimAlpha = 1.0;

  vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.5, 16.0);
  gl_Position  = projectionMatrix * mvPos;
}
`;

const bubbleFragmentShader = /* glsl */`
uniform float uSubmergence;

varying float vEdgeFade;
varying float vRimAlpha;

void main() {
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);

  // Discard outside circle
  if (dist > 0.5) discard;

  // Rim highlight: bright ring at the outer edge, transparent interior
  float rim   = smoothstep(0.30, 0.42, dist) * smoothstep(0.50, 0.44, dist);
  // Faint inner fill so the bubble reads as a sphere
  float fill  = smoothstep(0.35, 0.10, dist) * 0.15;

  float alpha = (rim * 0.85 + fill) * vEdgeFade * uSubmergence;
  if (alpha < 0.005) discard;

  // Bubbles catch light — bright blue-white with slightly additive feel
  vec3 color = mix(vec3(0.65, 0.88, 1.0), vec3(1.0, 1.0, 1.0), rim);

  gl_FragColor = vec4(color, alpha);
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UnderwaterParticlesProps {
  /** Override particle counts for testing; defaults are 900 snow / 250 bubbles. */
  snowCount?:   number;
  bubbleCount?: number;
}

export default function UnderwaterParticles({
  snowCount   = DEFAULT_SNOW_COUNT,
  bubbleCount = DEFAULT_BUBBLE_COUNT,
}: UnderwaterParticlesProps) {

  // -- Geometry (never reallocated) -----------------------------------------
  const snowGeo   = useMemo(() => buildSnowGeometry(snowCount),     [snowCount]);
  const bubbleGeo = useMemo(() => buildBubbleGeometry(bubbleCount), [bubbleCount]);

  // -- Materials (never reallocated) ----------------------------------------
  const snowMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   snowVertexShader,
    fragmentShader: snowFragmentShader,
    uniforms: {
      uTime:        { value: 0 },
      uCameraPos:   { value: new THREE.Vector3() },
      uUp:          { value: new THREE.Vector3(0, 1, 0) },
      uSubmergence: { value: 0 },
      uBoxHalf:     { value: BOX_HALF },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.NormalBlending,
  }), []);

  const bubbleMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   bubbleVertexShader,
    fragmentShader: bubbleFragmentShader,
    uniforms: {
      uTime:        { value: 0 },
      uCameraPos:   { value: new THREE.Vector3() },
      uUp:          { value: new THREE.Vector3(0, 1, 0) },
      uSubmergence: { value: 0 },
      uBoxHalf:     { value: BOX_HALF },
    },
    transparent: true,
    depthWrite:  false,
    // Slightly additive so bubbles catch ambient light
    blending:    THREE.AdditiveBlending,
  }), []);

  // -- Points refs ----------------------------------------------------------
  const snowRef   = useRef<THREE.Points>(null);
  const bubbleRef = useRef<THREE.Points>(null);

  // Allocation-free camera position vector reused each frame
  const _camPos = useRef(new THREE.Vector3());

  // -- Per-frame update (no allocations) ------------------------------------
  useFrame(({ camera, clock }) => {
    const submergence = getPlayerSubmergence();
    const quality     = getGraphicsQuality();
    const visible     = submergence > 0.01 && quality.underwaterParticles;

    const snow   = snowRef.current;
    const bubble = bubbleRef.current;
    if (!snow || !bubble) return;

    snow.visible   = visible;
    bubble.visible = visible;

    if (!visible) return;

    const t = clock.getElapsedTime();
    camera.getWorldPosition(_camPos.current);

    // Marine snow uniforms
    snowMat.uniforms.uTime.value        = t;
    snowMat.uniforms.uCameraPos.value.copy(_camPos.current);
    snowMat.uniforms.uUp.value.copy(getPlayerUp());
    snowMat.uniforms.uSubmergence.value = submergence;

    // Bubble uniforms
    bubbleMat.uniforms.uTime.value        = t;
    bubbleMat.uniforms.uCameraPos.value.copy(_camPos.current);
    bubbleMat.uniforms.uUp.value.copy(getPlayerUp());
    bubbleMat.uniforms.uSubmergence.value = submergence;
  });

  // Both <points> are ALWAYS mounted to avoid reallocation; visibility is toggled
  return (
    <>
      <points
        ref={snowRef}
        geometry={snowGeo}
        material={snowMat}
        frustumCulled={false}
      />
      <points
        ref={bubbleRef}
        geometry={bubbleGeo}
        material={bubbleMat}
        frustumCulled={false}
      />
    </>
  );
}
