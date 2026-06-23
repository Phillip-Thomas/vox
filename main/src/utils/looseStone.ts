// --- Loose-stone prop: shared geometry + material ----------------------------
//
// Used by BOTH the in-game LooseStoneField and the rock-test harness, so what you
// debug in isolation is exactly what ships (same lesson as the tree harness). A
// flat colour would fail the material-quality bar, so the stone is procedurally
// shaded (3D value-noise mottling / cavities / per-instance value variation),
// modelled on treeMaterials' createBarkMaterial.

import * as THREE from 'three';

export const STONE_COLOR = new THREE.Color(0x7e8389);

/**
 * One irregular boulder shape, shared by every instance. A subdivided icosphere
 * whose vertices are pushed in/out by deterministic sines → a lumpy rock, not a
 * regular gem. Per-instance rotation/scale + the world-space surface noise in the
 * material make the repeated shape read as variety. Flat-shaded for chiselled
 * facets that suit the voxel world.
 *
 * Winding stays outward (CCW) — the in-game orientation matrix MUST be
 * right-handed or it mirrors this and you'd see the inside faces.
 */
export function buildStoneGeometry(radius = 0.55): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    const lump =
      1
      + 0.20 * Math.sin(d.x * 3.1 + d.y * 2.3 + 0.7)
      + 0.16 * Math.sin(d.y * 4.7 + d.z * 1.9 + 2.1)
      + 0.12 * Math.cos(d.z * 5.3 + d.x * 2.1 + 4.0)
      - 0.08 * Math.sin((d.x + d.y + d.z) * 7.0);
    v.multiplyScalar(lump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Procedural stone material — MeshStandardMaterial + onBeforeCompile (keeps PBR/
 *  lighting/fog), injecting noise mottling, cavities, and per-instance variation. */
export function createStoneMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, // the procedural tint below IS the albedo
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uStoneColor = { value: STONE_COLOR.clone() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vStonePos;
        varying float vStoneTint;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vStonePos = transformed;
        #ifdef USE_INSTANCING
          vStoneTint = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.99, 78.23, 37.71))) * 43758.5453);
        #else
          vStoneTint = 0.5;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uStoneColor;
        varying vec3 vStonePos;
        varying float vStoneTint;
        float stHash(vec3 p){ return fract(sin(dot(p, vec3(12.989, 78.233, 37.719))) * 43758.5453); }
        float stNoise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(stHash(i + vec3(0.,0.,0.)), stHash(i + vec3(1.,0.,0.)), f.x),
                mix(stHash(i + vec3(0.,1.,0.)), stHash(i + vec3(1.,1.,0.)), f.x), f.y),
            mix(mix(stHash(i + vec3(0.,0.,1.)), stHash(i + vec3(1.,0.,1.)), f.x),
                mix(stHash(i + vec3(0.,1.,1.)), stHash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float stCoarse = stNoise(vStonePos * 7.0);
        float stFine   = stNoise(vStonePos * 22.0 + 11.0);
        vec3 stone = uStoneColor;
        stone *= mix(0.74, 1.06, vStoneTint);          // per-rock value variation
        stone *= 0.72 + 0.34 * stCoarse;               // broad mottling
        stone *= 0.92 + 0.14 * stFine;                 // fine grain
        stone *= 0.76 + 0.24 * smoothstep(0.15, 0.65, stCoarse); // darken cavities
        diffuseColor.rgb *= stone;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // keep it matte (high roughness) so facets read as stone, not polished chalk.
        roughnessFactor = clamp(roughnessFactor - 0.08 * stNoise(vStonePos * 9.0), 0.78, 1.0);`);
  };
  material.customProgramCacheKey = () => 'loose-stone-v1';
  return material;
}
