import * as THREE from 'three';

// --- The life reveal (A3's bloom wave) --------------------------------------------
//
// A radial growth front for the living fields: every grass blade and tree
// scales up from its root as the front passes its position — the world seen
// GROWING for the first time, outward from where the player slept. Driven by
// the story director during the A3 dawn; inactive it is a single no-op multiply
// in the vertex shaders (radius = 1e9), so the sandbox pays nothing.

const NO_REVEAL_RADIUS = 1e9;

const center = new THREE.Vector3();
let radius = NO_REVEAL_RADIUS;
let softness = 1;
let active = false;

export function setLifeReveal(at: THREE.Vector3, nextRadius: number, nextSoftness: number): void {
  center.copy(at);
  radius = Math.max(0, nextRadius);
  softness = Math.max(0.001, nextSoftness);
  active = true;
}

export function clearLifeReveal(): void {
  active = false;
  radius = NO_REVEAL_RADIUS;
  softness = 1;
}

export function isLifeRevealActive(): boolean {
  return active;
}

type RevealUniforms = Record<string, { value: unknown }> | undefined;

/** Write the reveal uniforms into a compiled shader (no-op if absent). */
export function writeLifeRevealUniforms(uniforms: RevealUniforms): void {
  if (!uniforms) return;
  if (uniforms.uRevealRadius) (uniforms.uRevealRadius.value as number) = radius;
  if (uniforms.uRevealSoft) (uniforms.uRevealSoft.value as number) = softness;
  if (uniforms.uRevealCenter) (uniforms.uRevealCenter.value as THREE.Vector3).copy(center);
}

/** GLSL uniform declarations shared by every revealing material. */
export const LIFE_REVEAL_GLSL = `
uniform vec3 uRevealCenter;
uniform float uRevealRadius;
uniform float uRevealSoft;
float lifeRevealGrow(vec3 instWorld) {
  return 1.0 - smoothstep(uRevealRadius - uRevealSoft, uRevealRadius, distance(instWorld, uRevealCenter));
}
`;

/** Default uniform values (fully revealed — the sandbox no-op). */
export function installLifeRevealUniforms(uniforms: Record<string, { value: unknown }>): void {
  uniforms.uRevealCenter = { value: new THREE.Vector3() };
  uniforms.uRevealRadius = { value: NO_REVEAL_RADIUS };
  uniforms.uRevealSoft = { value: 1 };
}
