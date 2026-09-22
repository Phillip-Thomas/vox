import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildSpaceStationDressing } from '../../game/spaceStation/spaceStationDressing.ts';
import type {
  SpaceStationCellKind,
  SpaceStationDescriptor,
  CellId
} from '../../game/spaceStation/spaceStationTypes.ts';

/**
 * Lighting for the spaceStation interior. Two systems working together.
 *
 * **Fittings.** An emissive material looks bright but casts nothing, so a room full
 * of glowing lamps still renders black. Real point lights are the fix, and there are
 * far too many fittings to light them all — so a small pool is reassigned every few
 * frames to whichever are nearest, with slots reserved per type so the desk lamp at
 * your elbow cannot starve the overhead fittings that give a hall its ceiling.
 *
 * **District fill.** One global ambient cannot serve five rooms that mean different
 * things. Each district carries its own fill colour and level, cross-faded as the
 * viewer moves between them. This is the colour script: the dock is cold and
 * industrial, the registry corridor is clinical, the concourse is warm and bright
 * because it is full of people and lamps, the bureaucratic hall is a cold dark plain,
 * the warehouse is dim sodium. Light is what tells you which room you are in before
 * you have read a single sign.
 *
 * Light *cardinality* never changes — the bible forbids mounting or unmounting lights
 * around a player verb. Only colour and intensity move.
 *
 * This is a stand-in for the baked irradiance volume: no bounce, no occlusion.
 */

const POOL_SIZE = 7;
/** Of the pool, how many are held for warm desk-level fittings. The rest go overhead. */
const WARM_SLOTS = 3;
/** Reassigning every frame makes lights visibly swap; a few times a second reads as stable. */
const REASSIGN_INTERVAL_SECONDS = 0.25;

const LAMP_WARM = new THREE.Color(0xffa447);
const LAMP_COOL = new THREE.Color(0xbfe4ff);

/**
 * Target illuminance at a fitting's stated reach. Intensity is derived as
 * reach² × this, so one tuning knob controls overall exposure across every room
 * size instead of a per-fixture magic number.
 */
const ILLUMINANCE_AT_REACH = 0.6;

/** Seconds to cross-fade district fill. Slow enough to feel like entering a room. */
const FILL_FADE_SECONDS = 0.8;

interface DistrictFill {
  ambient: THREE.Color;
  ambientIntensity: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemiIntensity: number;
}

function fill(
  ambient: number,
  ambientIntensity: number,
  sky: number,
  ground: number,
  hemiIntensity: number
): DistrictFill {
  return {
    ambient: new THREE.Color(ambient),
    ambientIntensity,
    sky: new THREE.Color(sky),
    ground: new THREE.Color(ground),
    hemiIntensity
  };
}

/**
 * The colour script, one entry per district. Kept in one table so the whole station
 * can be read as a sequence — cold, colder, warm, coldest, sodium — rather than as
 * five independently tuned rooms.
 */
const DISTRICT_FILL: Record<SpaceStationCellKind, DistrictFill> = {
  // Freight handling. Cold, under-lit, big.
  apron: fill(0x54687e, 0.62, 0x6d8296, 0x241b14, 0.62),
  // Administration. The most evenly lit space in the station, and the least kind.
  counter: fill(0x8098ae, 0.92, 0x93aac0, 0x2a2620, 0.72),
  // The common area. Warm, bright, busy — the only room that likes you.
  concourse: fill(0xa08661, 1.85, 0xbb9a6d, 0x3d2c20, 1.55),
  // The cubicle grid. Coldest and dimmest; the lamps are the only inhabitants.
  floor: fill(0x44546e, 0.6, 0x586984, 0x1c1c24, 0.6),
  // Warehousing. Dim sodium, close ceiling, everything the colour of old cardboard.
  shelves: fill(0x7a6844, 0.68, 0x8a7550, 0x2a2016, 0.66),
  // Never entered; present so the record is total.
  blank: fill(0x202634, 0.18, 0x2a3142, 0x101216, 0.2)
};

interface Lamp {
  position: readonly [number, number, number];
  tone: number;
  /** Intended reach in metres; see ILLUMINANCE_AT_REACH. */
  radius?: number;
}

/** The `count` fittings of a given tone closest to `origin`, nearest first. */
function nearestOfTone(
  lamps: Lamp[],
  origin: THREE.Vector3,
  tone: number,
  count: number
): Array<{ index: number; distance: number }> {
  const best: Array<{ index: number; distance: number }> = [];
  for (let i = 0; i < lamps.length; i++) {
    if (lamps[i].tone !== tone) continue;
    const p = lamps[i].position;
    const distance =
      (p[0] - origin.x) ** 2 + (p[1] - origin.y) ** 2 + (p[2] - origin.z) ** 2;

    if (best.length < count) {
      best.push({ index: i, distance });
      best.sort((a, b) => a.distance - b.distance);
      continue;
    }
    if (distance >= best[best.length - 1].distance) continue;
    best[best.length - 1] = { index: i, distance };
    best.sort((a, b) => a.distance - b.distance);
  }
  return best;
}

export interface SpaceStationLightingProps {
  descriptor: SpaceStationDescriptor;
  /** District the viewer currently stands in; drives the fill cross-fade. */
  occupiedCellId: CellId | null;
}

export function SpaceStationLighting({ descriptor, occupiedCellId }: SpaceStationLightingProps) {
  const lamps = useMemo(
    () =>
      buildSpaceStationDressing(descriptor.graph, descriptor.seed)
        .filter(box => box.kind === 'lamp')
        .map(box => ({ position: box.center, tone: box.tone, radius: box.radius })),
    [descriptor]
  );

  const kindByCell = useMemo(() => {
    const map = new Map<CellId, SpaceStationCellKind>();
    for (const cell of descriptor.graph.cells) map.set(cell.id, cell.kind);
    return map;
  }, [descriptor]);

  const lightRefs = useRef<Array<THREE.PointLight | null>>(
    Array.from({ length: POOL_SIZE }, () => null)
  );
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const sinceReassign = useRef(REASSIGN_INTERVAL_SECONDS);

  // Live fill state, cross-faded toward the current district every frame.
  const current = useMemo(() => {
    const start = DISTRICT_FILL.apron;
    return {
      ambient: start.ambient.clone(),
      ambientIntensity: start.ambientIntensity,
      sky: start.sky.clone(),
      ground: start.ground.clone(),
      hemiIntensity: start.hemiIntensity
    };
  }, []);

  useFrame(({ camera }, delta) => {
    camera.getWorldPosition(cameraPosition);

    // --- district fill -------------------------------------------------------
    const kind = (occupiedCellId && kindByCell.get(occupiedCellId)) || 'apron';
    const target = DISTRICT_FILL[kind];
    const t = Math.min(1, delta / FILL_FADE_SECONDS);

    current.ambient.lerp(target.ambient, t);
    current.sky.lerp(target.sky, t);
    current.ground.lerp(target.ground, t);
    current.ambientIntensity += (target.ambientIntensity - current.ambientIntensity) * t;
    current.hemiIntensity += (target.hemiIntensity - current.hemiIntensity) * t;

    const ambient = ambientRef.current;
    if (ambient) {
      ambient.color.copy(current.ambient);
      ambient.intensity = current.ambientIntensity;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(current.sky);
      hemi.groundColor.copy(current.ground);
      hemi.intensity = current.hemiIntensity;
    }

    // --- fittings ------------------------------------------------------------
    sinceReassign.current += delta;
    if (sinceReassign.current < REASSIGN_INTERVAL_SECONDS) return;
    sinceReassign.current = 0;

    // Slots are reserved per fitting type. Selecting purely by distance lets the
    // desk lamp at your elbow win every slot, so the overhead fittings that give a
    // hall its ceiling never light anything and the volume reads as black.
    const nearest = [
      ...nearestOfTone(lamps, cameraPosition, 0, WARM_SLOTS),
      ...nearestOfTone(lamps, cameraPosition, 1, POOL_SIZE - WARM_SLOTS)
    ];

    for (let slot = 0; slot < POOL_SIZE; slot++) {
      const light = lightRefs.current[slot];
      if (!light) continue;
      const pick = nearest[slot];
      if (!pick) {
        light.intensity = 0;
        continue;
      }
      const lamp = lamps[pick.index];
      light.position.set(lamp.position[0], lamp.position[1], lamp.position[2]);
      light.color.copy(lamp.tone === 0 ? LAMP_WARM : LAMP_COOL);
      // Physical units: with decay 2, illuminance falls as intensity / distance².
      // So a fitting meant to reach `r` metres needs roughly r² of intensity. Each
      // fitting carries its own reach, because a 6m corridor and a 180m hall cannot
      // share one number — sizing for the hall blows the corridor out completely.
      const reach = lamp.radius ?? 10;
      light.intensity = reach * reach * ILLUMINANCE_AT_REACH;
      light.distance = reach * 2.4;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={DISTRICT_FILL.apron.ambientIntensity} />
      <hemisphereLight ref={hemiRef} intensity={DISTRICT_FILL.apron.hemiIntensity} />
      {Array.from({ length: POOL_SIZE }, (_, slot) => (
        <pointLight
          key={slot}
          ref={light => {
            lightRefs.current[slot] = light;
          }}
          intensity={0}
          decay={2}
          castShadow={false}
        />
      ))}
    </>
  );
}
