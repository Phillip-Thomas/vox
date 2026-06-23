import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import {
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  updateSpaceSky,
  setSpaceSkyAtmosphere
} from '../utils/spaceSky.ts';
import { getSunDirection, getMoonDirection } from './SkyController.tsx';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { buildPlanetProfile } from '../game/PlanetProfile.ts';
import { localDaylight, localGolden } from '../utils/dayNight.ts';
import { getPlayerUp } from '../state/playerFrame.ts';

// Per-planet DAYTIME atmosphere palette, by archetype (grounded-but-fantastical):
// a hue + saturation -> luminous low-sky, deep upper-sky, sun-bloom tint. Deep
// space / night are unaffected (the day branch alone reads these).
const ARCHETYPE_SKY: Record<string, { h: number; s: number }> = {
  verdant:  { h: 0.58, s: 0.50 },  // blue
  oceanic:  { h: 0.57, s: 0.55 },
  arid:     { h: 0.07, s: 0.55 },  // amber/dusty
  volcanic: { h: 0.02, s: 0.70 },  // red/ember
  frozen:   { h: 0.55, s: 0.30 },  // pale icy blue
  crystal:  { h: 0.76, s: 0.55 },  // violet
  metallic: { h: 0.60, s: 0.28 },  // steely
  fungal:   { h: 0.30, s: 0.55 },  // toxic green
  anomaly:  { h: 0.80, s: 0.60 }   // exotic magenta (overridden by veg hue)
};

function atmospherePalette(seed: number): { low: THREE.Color; high: THREE.Color; glow: THREE.Color } {
  const p = buildPlanetProfile(seed);
  const base = ARCHETYPE_SKY[p.archetype] ?? { h: 0.58, s: 0.45 };
  const h = p.archetype === 'anomaly' ? p.palette.vegetationHue : base.h;
  return {
    low:  new THREE.Color().setHSL(h, base.s * 0.55, 0.86),
    high: new THREE.Color().setHSL(h, base.s, 0.34),
    glow: new THREE.Color().setHSL((h + 0.02) % 1.0, base.s * 0.5, 0.92)
  };
}

// In deep space the dome must follow the camera (it's a skybox) AND sit beyond
// ALL scene content — the voxel planet at the origin (up to a few hundred units
// away) and the camera-relative galaxy impostors (~2400-3500). depthTest stays
// true, so scaling the radius-220 dome up to ~7000 (still inside the ship
// camera's far=8000) keeps everything correctly drawing OVER the starfield
// rather than the stars punching through the planet/impostors.
const DEEP_SPACE_DOME_SCALE = 32; // 220 * 32 ≈ 7040 world units

/**
 * Procedural starfield + nebula backdrop. Rendered from within SkyController's
 * JSX. Owns its own gated useFrame that reads the shared sun direction and the
 * same 240s clock so its motion/visibility stays consistent with the sky.
 */
export default function SpaceSky({ terrainSeed = 0 }: { terrainSeed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(() => createSpaceSkyMaterial(), []);
  const { phase } = useSpaceFlight();
  const inSpace = phase === 'deep_space';

  // Per-planet daytime atmosphere tint (static per seed; night/space unaffected).
  useEffect(() => {
    const { low, high, glow } = atmospherePalette(terrainSeed);
    setSpaceSkyAtmosphere(matRef.current ?? material, low, high, glow);
  }, [material, terrainSeed]);

  // Seed the dome on mount from the LOCAL day/night (sun vs the player's up) so
  // the first frame is correct even when shader animation is disabled.
  useMemo(() => {
    const sun = getSunDirection();
    const up = getPlayerUp();
    const cloudQuality = getGraphicsQuality().skyClouds ? 1.0 : 0.0;
    updateSpaceSky(material, 0, localDaylight(sun, up), localGolden(sun, up), sun, getMoonDirection(), up, cloudQuality);
  }, [material]);

  // In deep space the cosmos is ALWAYS fully visible. Force the dome to full
  // night (daylight=0 -> uDay=0 -> early-out) the moment we enter space, so even on profiles
  // with animatedShaders=false (which skip the per-frame update below) the stars
  // are on immediately. Restoring normal phases is handled by the useFrame path.
  useEffect(() => {
    const mat = matRef.current ?? material;
    if (!inSpace) return;
    // daylight=0 -> uDay=0 -> early-out -> pure cosmos; golden + clouds off in the void.
    updateSpaceSky(mat, 0, 0, 0, getSunDirection(), getMoonDirection(), getPlayerUp(), 0);
  }, [inSpace, material]);

  useFrame(state => {
    // Skybox placement first, every frame regardless of the animation gate: on
    // the surface the dome sits at the origin (radius 220, the planet occludes
    // its lower half); in deep space it follows the camera and scales out beyond
    // all content so the starfield is a true backdrop.
    const mesh = meshRef.current;
    if (mesh) {
      if (inSpace) {
        mesh.position.copy(state.camera.position);
        mesh.scale.setScalar(DEEP_SPACE_DOME_SCALE);
      } else if (mesh.scale.x !== 1) {
        mesh.position.set(0, 0, 0);
        mesh.scale.setScalar(1);
      }
    }

    const mat = matRef.current;
    if (!mat) return;
    const q = getGraphicsQuality();
    const animated = q.animatedShaders;
    const cloudQuality = q.skyClouds ? 1.0 : 0.0;

    // Deep space: stars/nebula forced fully on (uDay=0 -> early-out). When animated,
    // keep advancing time for twinkle/drift; otherwise the seed already applied.
    if (inSpace) {
      if (!animated) return;
      updateSpaceSky(mat, state.clock.elapsedTime, 0, 0, getSunDirection(), getMoonDirection(), getPlayerUp(), 0);
      return;
    }

    // Surface: LOCAL day/night from the live sun direction vs the player's up, so
    // it tracks both the sun's motion AND the player moving around the planet
    // (chase-the-light). Updated every frame — it's just uniform writes; shader
    // twinkle stays frozen on non-animated profiles (time = 0).
    const sun = getSunDirection();
    const up = getPlayerUp();
    updateSpaceSky(
      mat,
      animated ? state.clock.elapsedTime : 0,
      localDaylight(sun, up),
      localGolden(sun, up),
      sun,
      getMoonDirection(),
      up,
      cloudQuality
    );
  });

  return (
    <mesh
      ref={meshRef}
      renderOrder={SPACE_DOME_RENDER_ORDER}
      frustumCulled={false}
    >
      <sphereGeometry args={[SPACE_DOME_RADIUS, 64, 32]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
