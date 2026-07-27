import * as THREE from 'three';

/**
 * The anchorage surface material.
 *
 * There are no texture assets anywhere in this project, so every surface in the
 * shipped game earns its detail the same way: a `MeshStandardMaterial` with a white
 * base colour and an `onBeforeCompile` that layers procedural albedo and roughness
 * multiplicatively. This is the built-architecture member of that family, following
 * the same shape as `createBuildMaterial` and `createStoneMaterial`.
 *
 * Four layers, in the order they read at distance:
 *   1. panel seams  — a world-space grid, suppressed on the axis a face points along
 *                     so a wall shows its own panelling and not the floor's
 *   2. plate value  — each panel gets a slightly different tone, so a large surface
 *                     stops being one flat colour
 *   3. grime        — broad vertical streaking and mottle, heavier low on a surface
 *   4. per-instance — a value shift hashed from the instance position, so two
 *                     identical crates are not literally identical
 *
 * `customProgramCacheKey` is mandatory: without it three recompiles the program per
 * material instance, which is exactly the shader-count problem the perf report warns
 * about.
 */

export interface StationMaterialOptions {
  /** Metres between panel seams. Larger reads as heavier industrial plate. */
  panelSize?: number;
  /** 0 disables seams entirely; 1 is a hard dark line. */
  seamStrength?: number;
  /** How much dirt accumulates. Concourse wants less than the warehouse. */
  grime?: number;
  roughness?: number;
  metalness?: number;
  cacheKey?: string;
}

const COMMON_HEAD = /* glsl */ `
  varying vec3 vStationWorld;
  varying vec3 vStationNrm;
  varying vec3 vStationLocal;
  varying float vStationHash;
  varying float vStationStyle;
`;

export function createStationMaterial(options: StationMaterialOptions = {}): THREE.MeshStandardMaterial {
  const {
    panelSize = 2.6,
    seamStrength = 0.55,
    grime = 0.5,
    roughness = 0.88,
    metalness = 0.08,
    cacheKey = 'anchorage-station-v1'
  } = options;

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    vertexColors: false
  });

  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float aStationStyle;\n${shader.vertexShader}`;
    shader.uniforms.uPanel = { value: panelSize };
    shader.uniforms.uSeam = { value: seamStrength };
    shader.uniforms.uGrime = { value: grime };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON_HEAD}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec4 stationWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
            vStationNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            // Hash the instance translation so repeated props differ in value.
            vStationHash = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            vStationStyle = aStationStyle;
          #else
            vec4 stationWorld = modelMatrix * vec4(transformed, 1.0);
            vStationNrm = normalize(mat3(modelMatrix) * normal);
            vStationHash = 0.5;
            vStationStyle = 0.0;
          #endif
          vStationWorld = stationWorld.xyz;
          // Unit-cube local space, -0.5..0.5 on every axis. Object-relative detail
          // (banding on a crate, a rib at an edge) has to key off this, not world
          // position, or a crate's stripes shift as it moves.
          vStationLocal = position;
        }
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        ${COMMON_HEAD}
        uniform float uPanel;
        uniform float uSeam;
        uniform float uGrime;

        float asHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Value noise, one octave. Cheap and enough for broad mottling.
        float asNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = asHash(i);
          float b = asHash(i + vec2(1.0, 0.0));
          float c = asHash(i + vec2(0.0, 1.0));
          float d = asHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // Distance to the nearest grid plane on one axis, normalised 0..1.
        float asSeamLine(float coord, float panel) {
          float f = fract(coord / panel);
          return min(f, 1.0 - f) * 2.0;
        }
        `
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        {
          vec3 p = vStationWorld;
          vec3 n = abs(normalize(vStationNrm));
          vec3 l = vStationLocal;
          float style = vStationStyle;

          // Weight each axis by how little the surface faces along it, so a floor
          // shows the XZ grid and a wall shows the grid on its own plane. Without
          // this a wall is striped by the floor's panel lines.
          vec3 axisWeight = clamp(1.0 - n, 0.0, 1.0);

          vec3 surface = vec3(1.0);

          // --- hull plate: large welded panels, heavy seams -------------------
          if (style < 0.5) {
            float panel = uPanel * 1.7;
            float lx = 1.0 - smoothstep(0.0, 0.05, asSeamLine(p.x, panel));
            float ly = 1.0 - smoothstep(0.0, 0.05, asSeamLine(p.y, panel));
            float lz = 1.0 - smoothstep(0.0, 0.05, asSeamLine(p.z, panel));
            float seam = max(max(lx * axisWeight.x, ly * axisWeight.y), lz * axisWeight.z);
            // A second, finer weld line offset from the first breaks the graph-paper
            // read that a single regular grid always produces.
            float weld = 1.0 - smoothstep(0.0, 0.02, asSeamLine(p.y + 0.37, panel * 0.5));
            vec2 plateId = floor(vec2(mix(p.x, p.z, n.x), p.y) / panel);
            surface *= 1.0 - uSeam * seam;
            surface *= 1.0 - uSeam * 0.28 * weld * axisWeight.y;
            surface *= mix(0.9, 1.1, asHash(plateId));
          }
          // --- deck: smaller tiles, tread band, no vertical lines -------------
          else if (style < 1.5) {
            float tile = uPanel * 0.85;
            float lx = 1.0 - smoothstep(0.0, 0.035, asSeamLine(p.x, tile));
            float lz = 1.0 - smoothstep(0.0, 0.035, asSeamLine(p.z, tile));
            float seam = max(lx, lz);
            // Tread ribs running across the deck, much finer than the tile grid.
            float tread = sin(p.x * 5.5) * 0.5 + 0.5;
            surface *= 1.0 - uSeam * 0.8 * seam;
            surface *= mix(0.97, 1.03, tread);
            surface *= mix(0.92, 1.08, asHash(floor(vec2(p.x, p.z) / tile)));
          }
          // --- smooth: brushed metal, no panelling at all ---------------------
          else if (style < 2.5) {
            float brush = asNoise(vec2(dot(p, vec3(7.0, 0.6, 7.0)), dot(p, vec3(0.3, 9.0, 0.3))));
            surface *= mix(0.94, 1.09, brush);
          }
          // --- container: horizontal banding and corner ribs ------------------
          else if (style < 3.5) {
            // Keyed to the box's own local space so a crate's ribs belong to it.
            float bands = sin(l.y * 44.0) * 0.5 + 0.5;
            float rib = smoothstep(0.40, 0.49, max(abs(l.x), abs(l.z)));
            float capBand = smoothstep(0.40, 0.47, abs(l.y));
            surface *= mix(0.9, 1.06, bands);
            surface *= 1.0 - 0.18 * rib;
            surface *= 1.0 - 0.12 * capBand;
          }
          // --- fabric: soft weave, no hard lines anywhere ----------------------
          else {
            float weave = asNoise(p.xz * 2.6) * 0.5 + asNoise(p.yz * 5.1) * 0.5;
            surface *= mix(0.9, 1.08, weave);
            // Slight sag toward the middle of a span, so an awning is not a plank.
            surface *= 1.0 - 0.1 * (1.0 - abs(l.x) * 2.0);
          }

          // Shared across every family: broad grime and per-instance value.
          float mottle = asNoise(p.xz * 0.16) * 0.6 + asNoise(p.yz * 0.31) * 0.4;
          float streak = asNoise(vec2(p.x * 0.9 + p.z * 0.7, p.y * 0.055));
          float low = 1.0 - smoothstep(0.0, 6.0, p.y);
          surface *= mix(0.9, 1.05, mottle);
          surface *= 1.0 - uGrime * 0.2 * streak * (0.35 + low * 0.65);
          surface *= mix(0.91, 1.06, vStationHash);

          diffuseColor.rgb *= surface;
        }
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        {
          // Grime is matte, bare plate is slightly polished. Coupling roughness to
          // the same fields as albedo is what stops the detail reading as a decal.
          float wear = asNoise(vStationWorld.xz * 0.22);
          roughnessFactor = clamp(roughnessFactor * mix(0.9, 1.08, wear) + uGrime * 0.05, 0.05, 1.0);
        }
        `
      );
  };

  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/**
 * Unlit trim material for emissive fittings.
 *
 * `toneMapped: false` keeps a lamp at its authored value through ACES, which is how
 * the shipped cockpit light rails are done. Kept clearly under the bloom threshold
 * by the caller's colour choice — bloom is a response to a bright material, not a
 * default glow, so a fitting that blooms should be one that is genuinely hot.
 */
export function createStationTrimMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ toneMapped: false });
}
