import * as THREE from 'three';

// =============================================================================
// COCKPIT MFDs — every display panel in the flight deck, in ONE draw call.
//
// The old cabin had black rectangles where instruments should be. Nothing in
// the interior moved except a throttle lever and two glowing bars, so the space
// read as a prop rather than a working vehicle.
//
// This builds real multi-function displays: a nav plot, an engine/power stack,
// an attitude ladder, an annunciator wall, and status columns. They are all one
// merged plane soup with a per-vertex `aScreen.x` selecting content, drawn with
// one unlit shader — so five living instruments cost exactly one draw and no
// texture memory.
//
// Content is procedural and driven by the real flight signal (throttle, speed,
// boost), which matters more than fidelity: an instrument that lies about the
// vehicle is set dressing, one that tracks it is feedback.
// =============================================================================

export const SCREEN_NAV = 0;
export const SCREEN_POWER = 1;
export const SCREEN_ATTITUDE = 2;
export const SCREEN_ANNUNCIATOR = 3;
export const SCREEN_STATUS = 4;

export interface CockpitScreenUniforms {
  uTime: { value: number };
  uThrottle: { value: number };
  uSpeed: { value: number };
  uBoost: { value: number };
  uPitch: { value: number };
  uRoll: { value: number };
  uAccent: { value: THREE.Color };
  uAmber: { value: THREE.Color };
  /** Master display brightness; drops with reduced-motion / cabin dim. */
  uGain: { value: number };
}

interface ScreenPlacement {
  id: number;
  position: [number, number, number];
  size: [number, number];
  rotation: [number, number, number];
}

/**
 * Where the displays live, in camera space. Everything hugs the periphery and
 * the dash: the forward aperture stays clear, which is both the cockpit-frame
 * contract and the reason the instruments stay readable in motion.
 */
const SCREEN_PLACEMENTS: ScreenPlacement[] = [
  // Port and starboard main MFDs, canted up off the dash slabs. This is the
  // placement that matters: a 70-degree flight camera never sees the sidewalls
  // at rest, so instruments mounted there are decoration. On the dash they are
  // in view constantly and still clear of the forward aperture.
  //
  // Port carries attitude — the primary flight display, where a pilot's eye
  // goes first — and starboard carries the drive stack. The boresight itself
  // stays for the holographic velocity director, so nothing competes with it.
  { id: SCREEN_ATTITUDE, position: [-1.28, -0.83, -2.55], size: [0.94, 0.6], rotation: [-0.92, 0.42, 0.1] },
  { id: SCREEN_POWER, position: [1.28, -0.83, -2.55], size: [0.94, 0.6], rotation: [-0.92, -0.42, -0.1] },
  // Overhead annunciator wall, at the very top of frame where a real one sits.
  { id: SCREEN_ANNUNCIATOR, position: [0, 1.36, -2.06], size: [1.4, 0.16], rotation: [1.28, 0, 0] },
  // Inboard console readouts at the bottom corners of the view.
  { id: SCREEN_NAV, position: [-1.95, -1.0, -2.04], size: [0.82, 0.4], rotation: [-1.13, 0.24, 0.12] },
  { id: SCREEN_STATUS, position: [1.95, -1.0, -2.04], size: [0.82, 0.4], rotation: [-1.13, -0.24, -0.12] },
  // Peripheral panels in the sidewall recesses: off-frame at rest, and the
  // payoff for looking around or flying on an ultrawide display.
  { id: SCREEN_STATUS, position: [-3.0, 0.02, -1.66], size: [0.6, 1.44], rotation: [0, 0.44, -0.05] },
  { id: SCREEN_NAV, position: [3.0, 0.02, -1.66], size: [0.6, 1.44], rotation: [0, -0.44, 0.05] },
  { id: SCREEN_NAV, position: [-4.72, 0.06, -1.8], size: [0.62, 1.4], rotation: [0, 0.3, 0] },
  { id: SCREEN_POWER, position: [4.72, 0.06, -1.8], size: [0.62, 1.4], rotation: [0, -0.3, 0] }
];

/** One merged geometry carrying every display, tagged per-vertex by content id. */
export function createCockpitScreenGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const screens: number[] = [];

  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const corner = new THREE.Vector3();

  for (let index = 0; index < SCREEN_PLACEMENTS.length; index++) {
    const place = SCREEN_PLACEMENTS[index];
    const [hw, hh] = [place.size[0] / 2, place.size[1] / 2];
    euler.set(place.rotation[0], place.rotation[1], place.rotation[2]);
    quat.setFromEuler(euler);

    // Two triangles, authored CCW so the display faces the pilot.
    const local: Array<[number, number]> = [
      [-hw, -hh], [hw, -hh], [hw, hh],
      [-hw, -hh], [hw, hh], [-hw, hh]
    ];
    for (const [lx, ly] of local) {
      corner.set(lx, ly, 0).applyQuaternion(quat);
      positions.push(
        corner.x + place.position[0],
        corner.y + place.position[1],
        corner.z + place.position[2]
      );
      uvs.push(lx / hw * 0.5 + 0.5, ly / hh * 0.5 + 0.5);
      // Fractional part carries a per-instrument seed so two panels showing the
      // same content never animate in lockstep.
      screens.push(place.id + index * 0.01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setAttribute('aScreen', new THREE.BufferAttribute(new Float32Array(screens), 1));
  geo.computeVertexNormals();
  return geo;
}

const SCREEN_VERTEX = /* glsl */`
  attribute float aScreen;
  varying vec2 vUv;
  varying float vScreen;
  void main() {
    vUv = uv;
    vScreen = aScreen;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SCREEN_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uThrottle;
  uniform float uSpeed;
  uniform float uBoost;
  uniform float uPitch;
  uniform float uRoll;
  uniform vec3 uAccent;
  uniform vec3 uAmber;
  uniform float uGain;

  varying vec2 vUv;
  varying float vScreen;

  #include <common>

  float hash11(float p) { return fract(sin(p * 127.1) * 43758.5453); }
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  /** Anti-aliased line at |d| = 0, width w, using screen-space derivatives. */
  float lineAA(float d, float w) {
    float e = fwidth(d) + 1e-5;
    return 1.0 - smoothstep(w, w + e * 1.5, abs(d));
  }

  float box2(vec2 p, vec2 half_) {
    vec2 d = abs(p) - half_;
    return max(d.x, d.y);
  }

  /** Blocks of pseudo-glyphs: a text row without a font atlas. */
  float glyphRow(vec2 p, float seed, float density) {
    vec2 cell = vec2(floor(p.x * 22.0), floor(p.y));
    float on = step(1.0 - density, hash21(cell + seed));
    vec2 f = fract(vec2(p.x * 22.0, p.y));
    float inside = step(0.12, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.72);
    return on * inside;
  }

  // ---- instruments ---------------------------------------------------------

  vec3 navPlot(vec2 uv, float seed) {
    vec2 p = uv * 2.0 - 1.0;
    vec3 c = vec3(0.0);
    float r = length(p);

    // Range rings + cardinal spokes.
    for (int i = 1; i <= 3; i++) {
      c += uAccent * lineAA(r - float(i) * 0.26, 0.006) * 0.9;
    }
    float ang = atan(p.y, p.x);
    c += uAccent * lineAA(abs(fract(ang / 1.5707963 + 0.5) - 0.5) * 2.4 - 0.0, 0.02)
      * step(r, 0.82) * 0.18;

    // Sweep: one rotating wedge with a decaying tail, speed-linked.
    float sweep = fract((ang / 6.2831853) + uTime * (0.12 + uSpeed * 0.35) + seed);
    c += uAccent * pow(1.0 - sweep, 8.0) * step(r, 0.8) * 1.5;
    c += uAccent * 0.06 * step(r, 0.82);

    // Contacts: hashed blips that brighten as the sweep passes them.
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a = hash11(fi + seed * 7.0) * 6.2831853;
      float rad = 0.15 + hash11(fi + 11.0 + seed) * 0.6;
      vec2 bp = vec2(cos(a), sin(a)) * rad;
      float blipAng = fract(a / 6.2831853);
      float freshness = pow(1.0 - fract(sweep - blipAng + 1.0), 6.0);
      float dot_ = 1.0 - smoothstep(0.012, 0.03, length(p - bp));
      c += mix(uAccent * 0.35, vec3(0.85, 0.95, 1.0), freshness) * dot_ * (0.4 + freshness);
    }

    // Own-ship marker at centre and a heading tape along the top.
    c += vec3(0.9, 0.95, 1.0) * lineAA(box2(p, vec2(0.018, 0.05)), 0.004) * 0.9;
    float tape = lineAA(abs(fract(uv.x * 14.0) - 0.5) - 0.42, 0.02)
      * step(0.93, uv.y);
    c += uAccent * tape * 0.7;
    return c;
  }

  vec3 powerStack(vec2 uv, float seed) {
    vec3 c = vec3(0.0);
    // Six labelled bars; the top three track live flight signal, the rest idle.
    float rows = 6.0;
    float row = floor(uv.y * rows);
    float ry = fract(uv.y * rows);
    float level =
        row > 4.5 ? clamp(uThrottle, 0.0, 1.0)
      : row > 3.5 ? clamp(uSpeed, 0.0, 1.0)
      : row > 2.5 ? clamp(uBoost, 0.0, 1.0)
      : 0.32 + 0.3 * hash11(row + seed) + 0.06 * sin(uTime * (0.7 + row) + seed);

    float bar = step(0.28, ry) * step(ry, 0.74);
    float track = bar * step(0.28, uv.x) * step(uv.x, 0.94);
    float fill = bar * step(0.28, uv.x) * step(uv.x, 0.28 + level * 0.66);
    // Danger band: the last fifth of a bar reads amber.
    vec3 barColor = mix(uAccent, uAmber, smoothstep(0.72, 0.95, level));
    c += barColor * fill * 0.95;
    c += uAccent * track * 0.09;
    // Leading edge highlight so a moving bar reads as moving.
    c += vec3(1.0) * bar * lineAA(uv.x - (0.28 + level * 0.66), 0.004) * 0.5;
    // Segment ticks along each track.
    c += uAccent * track * step(0.5, fract(uv.x * 22.0)) * 0.06;
    // Pseudo-text label at the left of each row.
    c += mix(uAccent, uAmber, step(4.5, row) * 0.0)
      * glyphRow(vec2(uv.x * 4.6, ry * 1.0), row * 3.0 + seed, 0.5)
      * step(uv.x, 0.24) * 0.65;
    return c;
  }

  vec3 attitude(vec2 uv, float seed) {
    vec2 p = uv * 2.0 - 1.0;
    // Roll the ladder, then translate by pitch: a real attitude indicator.
    float cs = cos(uRoll), sn = sin(uRoll);
    vec2 q = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
    q.y += uPitch * 1.6;
    vec3 c = vec3(0.0);

    // Sky and ground fills. Without them a steep attitude leaves the panel
    // blank exactly when the pilot most needs to know which way is up.
    float ground = smoothstep(0.03, -0.03, q.y);
    c += mix(uAccent * 0.09, mix(uAmber, vec3(0.5, 0.42, 0.3), 0.55) * 0.09, ground);

    // Horizon, then a ladder that repeats forever so bars are always in frame.
    c += vec3(0.85, 0.95, 1.0) * lineAA(q.y, 0.03) * step(abs(q.x), 0.92) * 0.95;
    float rungs = q.y / 0.36;
    float index = floor(rungs + 0.5);
    float halfWidth = mod(abs(index), 2.0) < 0.5 ? 0.44 : 0.24;
    float rung = lineAA((fract(rungs + 0.5) - 0.5) * 0.36, 0.014)
      * step(abs(q.x), halfWidth)
      * step(0.5, abs(index));
    c += mix(uAccent, uAmber, ground) * rung * 0.75;

    // Fixed aircraft reference wings — do NOT roll with the ladder.
    float wings = step(abs(p.y), 0.055)
      * (step(0.28, abs(p.x)) * step(abs(p.x), 0.6));
    c += vec3(1.0, 0.86, 0.4) * wings * 1.1;
    c += vec3(1.0, 0.86, 0.4) * (1.0 - smoothstep(0.02, 0.045, length(p))) * 1.1;

    // Bank scale across the top with a roll pointer riding it.
    float scaleArc = lineAA(length(p - vec2(0.0, -0.55)) - 1.28, 0.012)
      * step(0.25, p.y) * 0.5;
    vec2 pointer = p - vec2(0.0, -0.55)
      - vec2(-sin(uRoll), cos(uRoll)) * 1.28;
    c += uAccent * scaleArc;
    c += vec3(1.0, 0.86, 0.4) * (1.0 - smoothstep(0.02, 0.05, length(pointer)));

    // Speed tape down the right edge, scrolling with velocity.
    float tape = step(0.86, uv.x)
      * lineAA(fract(uv.y * 9.0 - uTime * uSpeed * 1.2) - 0.5, 0.06);
    c += uAccent * tape * 0.55;
    return c;
  }

  vec3 annunciator(vec2 uv, float seed) {
    // A wall of caution/advisory lamps that cycle rather than sit static.
    vec2 cell = vec2(floor(uv.x * 18.0), floor(uv.y * 2.0));
    vec2 f = fract(vec2(uv.x * 18.0, uv.y * 2.0));
    float pad = step(0.12, f.x) * step(f.x, 0.88) * step(0.18, f.y) * step(f.y, 0.82);
    float h = hash21(cell + seed);
    float lit = step(0.55, h);
    // A couple of lamps blink slowly; boost lights the whole caution row.
    float blink = step(0.93, h) * step(0.5, fract(uTime * 0.8 + h));
    float level = lit * (0.35 + 0.4 * h) + blink * 0.5 + uBoost * 0.35 * step(cell.y, 0.5);
    vec3 tint = mix(uAccent, uAmber, step(0.5, cell.y));
    return tint * pad * level;
  }

  vec3 statusColumn(vec2 uv, float seed) {
    vec3 c = vec3(0.0);
    // A slowly scrolling log: rows of pseudo-text with an occasional highlight.
    float rows = 16.0;
    float scroll = uv.y * rows + uTime * 0.35 + seed * 9.0;
    float row = floor(scroll);
    float ry = fract(scroll);
    float h = hash11(row);
    float text = glyphRow(vec2(uv.x, ry), row, 0.35 + h * 0.35);
    vec3 tint = mix(uAccent, uAmber, step(0.9, h));
    c += tint * text * (0.35 + h * 0.4);
    // A bar graph column on the outer edge.
    float g = 0.3 + 0.5 * hash11(floor(uv.y * 30.0) + floor(uTime * 3.0));
    c += uAccent * step(0.88, uv.x) * step(uv.x, 0.88 + g * 0.11) * 0.4;
    return c;
  }

  void main() {
    float id = floor(vScreen + 0.5);
    float seed = fract(vScreen) * 100.0;

    vec3 c =
        id < 0.5 ? navPlot(vUv, seed)
      : id < 1.5 ? powerStack(vUv, seed)
      : id < 2.5 ? attitude(vUv, seed)
      : id < 3.5 ? annunciator(vUv, seed)
                 : statusColumn(vUv, seed);

    // ---- glass treatment ---------------------------------------------------
    // Scanlines, a faint phosphor bed, edge vignette, and a barely-there
    // flicker. Cheap, and the difference between "emissive quad" and "screen".
    float scan = 0.86 + 0.14 * sin(vUv.y * 420.0);
    c *= scan;
    vec2 e = abs(vUv * 2.0 - 1.0);
    float vignette = 1.0 - smoothstep(0.72, 1.0, max(e.x, e.y));
    c *= vignette;
    // Phosphor bed. Only the annunciator wall is amber: giving it to the tall
    // status columns as well turned a whole sidewall into a red field.
    float amberPanel = step(2.5, id) * step(id, 3.5);
    c += mix(uAccent, uAmber, amberPanel) * 0.028 * vignette;
    c *= 0.94 + 0.06 * sin(uTime * 47.0 + seed);
    // Bezel: a dark border with a lit inner lip, so each panel is a device.
    float bezel = smoothstep(0.94, 0.99, max(e.x, e.y));
    c = mix(c, vec3(0.0), bezel);
    c += mix(uAccent, uAmber, amberPanel) * lineAA(max(e.x, e.y) - 0.93, 0.006) * 0.4;

    // Displays are the brightest thing in the cabin by a wide margin — that is
    // how a pilot's eye finds them — so they are authored well above the wall
    // values and left for the bloom pass to flare.
    gl_FragColor = vec4(c * uGain * 2.6, 1.0);
  }
`;

/** The single unlit material shared by every display panel. */
export function createCockpitScreenMaterial(
  accent: THREE.Color,
  amber: THREE.Color
): { material: THREE.ShaderMaterial; uniforms: CockpitScreenUniforms } {
  const uniforms: CockpitScreenUniforms = {
    uTime: { value: 0 },
    uThrottle: { value: 0 },
    uSpeed: { value: 0 },
    uBoost: { value: 0 },
    uPitch: { value: 0 },
    uRoll: { value: 0 },
    uAccent: { value: accent.clone() },
    uAmber: { value: amber.clone() },
    uGain: { value: 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
    // Displays are physical panels, not overlays: opaque, depth-written, and
    // left out of tone mapping so bloom can pick up the bright traces.
    toneMapped: false,
    side: THREE.DoubleSide
  });
  return { material, uniforms };
}
