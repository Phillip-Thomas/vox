import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlayerUp } from '../state/playerFrame';
import { getPlayerSubmergence } from '../state/playerSubmersion';
import { getSunDirection } from './SkyController';

// --- Surface seen from below (Snell's window + total-internal-reflection) ------
//
// The water faces are FrontSide + depthWrite:false, so from underwater the
// surface is effectively invisible and writes no depth — looking UP would show
// nothing. This camera-attached inverted dome reconstructs the surface
// analytically: a large BackSide sphere centered on the eye whose shader, per
// view ray, decides Snell WINDOW (the above-water world compressed into a ~96°
// cone, n=1.333 -> 48.6° half-angle, bright sky + sun disc) vs the TIR MIRROR
// outside the cone. It DISCARDS below the horizon so the seabed shows through, is
// depthTest'd so terrain between you and the surface occludes it, and fades by
// submergence so it only appears underwater. In-scene geometry => works on every
// tier (no composer needed), which is why the surface-from-below lives here and
// not in the post pass.

const DOME_RADIUS = 220;

const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vWorldPos;
  uniform vec3 uCamPos;
  uniform vec3 uUp;
  uniform vec3 uSunDir;
  uniform float uSubmergence;
  uniform vec3 uMirror;     // TIR shows deep-water colour outside the window
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;

  void main() {
    vec3 dir = normalize(vWorldPos - uCamPos);
    float cosT = dot(dir, uUp);
    if (cosT <= 0.02) discard; // below the horizon: let the seabed show through

    // Snell window: refraction critical angle for water (n=1.333). Inside the
    // cone the above-water world is visible; outside it is a mirror of the deep.
    float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
    float window = 1.0 - smoothstep(0.96, 1.0, sinT * 1.333);

    // Compressed sky inside the window: horizon->zenith gradient + a tight,
    // chromatic-rimmed sun disc (the brightest point of the underwater scene).
    vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(cosT, 0.0, 1.0), 0.6));
    float sd = max(dot(dir, uSunDir), 0.0);
    sky += vec3(1.0, 0.96, 0.86) * (exp((sd - 1.0) * 60.0) * 0.8 + exp((sd - 1.0) * 1400.0) * 3.0);

    vec3 col = mix(uMirror, sky, window);
    // Slight chromatic fringe on the window rim (the IQ touch).
    float rim = window * (1.0 - window) * 4.0;
    col.r += rim * 0.06; col.b -= rim * 0.04;

    // Fade in near the horizon (no hard ring) and by submergence. Clamp so bloom
    // blooms the rim/sun, not the whole disc into a white blob.
    float horizonFade = smoothstep(0.02, 0.18, cosT);
    gl_FragColor = vec4(min(col, vec3(1.6)), horizonFade * clamp(uSubmergence, 0.0, 1.0));
  }
`;

export default function UnderwaterDome() {
  const meshRef = useRef<THREE.Mesh>(null);
  const camera = useThree(s => s.camera);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.BackSide,
        uniforms: {
          uCamPos: { value: new THREE.Vector3() },
          uUp: { value: new THREE.Vector3(0, 1, 0) },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSubmergence: { value: 0 },
          uMirror: { value: new THREE.Color(0.02, 0.10, 0.16) },
          uSkyHorizon: { value: new THREE.Color(0.42, 0.62, 0.82) },
          uSkyZenith: { value: new THREE.Color(0.10, 0.34, 0.62) }
        }
      }),
    []
  );

  const geometry = useMemo(() => new THREE.SphereGeometry(DOME_RADIUS, 24, 16), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const submergence = getPlayerSubmergence();
    mesh.visible = submergence > 0.01;
    if (!mesh.visible) return;
    // Follow the eye so the dome is "infinitely far" in every direction.
    camera.getWorldPosition(mesh.position);
    const u = material.uniforms;
    u.uCamPos.value.copy(mesh.position);
    u.uUp.value.copy(getPlayerUp());
    u.uSunDir.value.copy(getSunDirection()).normalize();
    u.uSubmergence.value = submergence;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
  );
}
