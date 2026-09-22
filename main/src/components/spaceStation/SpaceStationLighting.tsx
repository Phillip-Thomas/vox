import { STATION_FRAME_PRIORITY, stationFrameTime } from './stationFrameOrder.ts';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildSpaceStationDressing } from '../../game/spaceStation/spaceStationDressing.ts';
import { currentVisibleCells } from './SpaceStationInterior.tsx';
import type {
  SpaceStationCellKind,
  SpaceStationDescriptor,
  CellId
} from '../../game/spaceStation/spaceStationTypes.ts';

/**
 * Lighting for the spaceStation interior. Three systems working together.
 *
 * **District fill.** One global ambient cannot serve five rooms that mean different
 * things. Each district carries its own fill colour and level, cross-faded as the
 * viewer crosses a threshold. This is the colour script: the dock is cold and
 * industrial, the registry corridor is clinical and flat, the concourse is warm and
 * bright because it is full of people and lamps, the bureaucratic hall is a cold
 * plain, the warehouse is dim sodium. Light is what tells you which room you are in
 * before you have read a single sign — and it is *extent*, not spotlight kindness:
 * fill and albedo carry every room; point lights are reserved for the few pools
 * that belong to someone.
 *
 * **Fog.** Rides the same ramp as the fill, so a long sightline fades to the
 * district's hue instead of to black. The hall's far wall fades into blue-grey
 * haze; concourse fog is warm and thin so the market stays crisp. Fog is owned here
 * and unmounts with the interior branch, so no value survives leaving the station.
 *
 * **Fittings.** An emissive material looks bright but casts nothing, so a room full
 * of glowing lamps still renders black. Real point lights are the fix, and there are
 * far too many fittings to light them all — so a small pool is reassigned every few
 * frames to whichever are nearest, with slots reserved per type so the desk lamp at
 * your elbow cannot starve the overhead fittings that give a hall its ceiling.
 * Fittings with `radius: 0` are wayfinding trim — jamb strips, column edges, the
 * deck guidance strip — and never enter the pool.
 *
 * Light *cardinality* never changes — the bible forbids mounting or unmounting lights
 * around a player verb. Only colour and intensity move, and nothing here has a
 * period: the threshold ramp is one-shot per crossing, finite and monotone.
 *
 * This is a stand-in for the baked irradiance volume: no bounce, no occlusion.
 */

export const POOL_SIZE = 7;
/** Of the pool, how many are held for warm desk-level fittings. The rest go overhead. */
export const WARM_SLOTS = 3;
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

/**
 * Seconds a threshold crossing takes, keyed by the district being *entered*.
 *
 * Warmth arrives slowly: the concourse takes longest so the fill is seen arriving
 * on the line "(warmth you did not make.)". Cold comes faster than warmth — leaving
 * the concourse for the hall runs at the hall's 1.0 s, and every other room at 0.8.
 * These are contract constants (scene-contract draft-v1, concourse-open anchor);
 * a future station-audio packet inherits them by reference, never by transcription.
 */
export const THRESHOLD_FADE_SECONDS: Record<SpaceStationCellKind, number> = {
  apron: 0.8,
  counter: 0.8,
  concourse: 1.4,
  floor: 1.0,
  shelves: 0.8,
  blank: 0.8
};

/**
 * Smootherstep (6t⁵ − 15t⁴ + 10t³). Monotone, no overshoot, slow at the start, and
 * — unlike classic smoothstep — past 0.95 by 6/7 of the ramp: on the 1.4 s
 * concourse ramp it reads 0.632 at +0.8 s, 0.977 at +1.2 s, 1.0 at +1.4 s, which is
 * what the contract's T-concourse-open strip asserts.
 */
export function THRESHOLD_FADE_EASE(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * The concourse low line "(warmth you did not make.)" mounts at opacity 0 and rises
 * after this delay — the ramp's ~60 % instant — over LOW_LINE_FADE_SECONDS, so the
 * caption lands as the warmth does rather than announcing it. Presentation only:
 * the milestone commits at t = 0. Reduced motion steps at the same full-opacity instant.
 */
export const LOW_LINE_PRESENTATION_DELAY_SECONDS = 0.8;
export const LOW_LINE_FADE_SECONDS = 0.4;

export interface DistrictFill {
  ambient: THREE.Color;
  ambientIntensity: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemiIntensity: number;
  fog: THREE.Color;
  fogDensity: number;
}

function fill(
  ambient: number,
  ambientIntensity: number,
  sky: number,
  ground: number,
  hemiIntensity: number,
  fog: number,
  fogDensity: number
): DistrictFill {
  return {
    ambient: new THREE.Color(ambient),
    ambientIntensity,
    sky: new THREE.Color(sky),
    ground: new THREE.Color(ground),
    hemiIntensity,
    fog: new THREE.Color(fog),
    fogDensity
  };
}

/**
 * The colour script, one entry per district. Kept in one table so the whole station
 * can be read as a sequence — cold, clinical, warm, coldest, sodium — rather than as
 * five independently tuned rooms. The ordering that must survive any retune, by
 * median luma at the capture vantages: hall < apron ≤ shelves ≤ counter < concourse.
 *
 * Fog colours are the *displayed* haze: a fully fogged pixel shows ACES(fog × 0.94),
 * so the hex is chosen for what it tone-maps to (hall ≈ 30/255 blue-grey, counter
 * ≈ 52 clinical, concourse ≈ 58 warm), not for how it looks as paint.
 */
export const DISTRICT_FILL: Record<SpaceStationCellKind, DistrictFill> = {
  // Freight handling. Cold, industrial, big; the lit floor shows how big.
  apron: fill(0x5c7088, 1.0, 0x7a91a6, 0x7c8795, 0.95, 0x293646, 0.003),
  // Administration. The most evenly lit space in the station, and the least kind:
  // Ambient carries side faces. Ground bounce raises the dark lid while the
  // restrained sky term avoids brightening the already readable floor.
  counter: fill(0x91a8bd, 2.65, 0x2a394a, 0xb5c0cc, 1.8, 0x384455, 0.002),
  // The common area. Warm, bright, busy — the only room that likes you. Unchanged.
  concourse: fill(0xa08661, 1.85, 0xbb9a6d, 0x62513e, 1.55, 0x534634, 0.0018),
  // The cubicle grid. Coldest of the entered rooms: a blue-grey plain with warm
  // islands, its far wall lost in haze rather than in black.
  floor: fill(0x4c5d78, 0.95, 0x6f86a8, 0x2c3038, 1.3, 0x2f3a4e, 0.004),
  // Warehousing. Dim sodium, close ceiling, everything the colour of old cardboard.
  shelves: fill(0x8a7650, 2.25, 0x9a8560, 0xa18d74, 0.8, 0x3e3528, 0.0035),
  // Never entered; present so the record is total.
  blank: fill(0x202634, 0.18, 0x2a3142, 0x101216, 0.2, 0x293646, 0.003)
};

interface Lamp {
  position: readonly [number, number, number];
  tone: number;
  /** Intended reach in metres; see ILLUMINANCE_AT_REACH. */
  radius?: number;
  cellId: string;
}

/**
 * The `count` fittings of a given tone closest to `origin`, nearest first, drawn
 * only from cells the portal walk can currently see. A fitting behind a wall is
 * often the nearest one — the concourse's bars sit forty metres from the hall's
 * entry, its own second column pair seventy — and a slot spent on a light you
 * cannot see leaves the room you are standing in unlit.
 */
function nearestOfTone(
  lamps: Lamp[],
  origin: THREE.Vector3,
  tone: number,
  count: number,
  visible: ReadonlySet<string>
): Array<{ index: number; distance: number }> {
  const best: Array<{ index: number; distance: number }> = [];
  for (let i = 0; i < lamps.length; i++) {
    if (lamps[i].tone !== tone) continue;
    if (visible.size > 0 && !visible.has(lamps[i].cellId)) continue;
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

/** One frame of the threshold ramp, kept so a capture can prove the ramp frame-exactly. */
export interface SpaceStationFillSample {
  /** Seconds since the ramp started, accumulated from frame deltas. */
  elapsedSeconds: number;
  /** Eased ramp progress, 0 at the crossing frame and exactly 1 at the duration. */
  progress: number;
  ambientIntensity: number;
}

export interface SpaceStationFillDiagnostics {
  /** District the ramp is heading to (or has arrived at). */
  district: SpaceStationCellKind;
  /** District the ramp started from; equals `district` once no ramp is in flight. */
  from: SpaceStationCellKind;
  progress: number;
  elapsedSeconds: number;
  durationSeconds: number;
  /** Exact document/rAF clock used for this rendered fill, and its crossing. */
  frameTimestampMs: number | null;
  crossingTimestampMs: number | null;
  ambientIntensity: number;
  hemiIntensity: number;
  fogDensity: number;
  /** Seven-light pool; a real count so a probe can prove cardinality never moved. */
  poolSize: number;
  /** Fittings eligible for the pool, i.e. everything with a reach. */
  pooledFittings: number;
  /** Radius-0 trim: emissive, never lit. */
  unpooledFittings: number;
  /** The most recent frames, oldest first. */
  samples: SpaceStationFillSample[];
}

const SAMPLE_HISTORY = 96;

export function createDistrictRamp() {
  const start = DISTRICT_FILL.apron;
  const snapshot = (): DistrictFill => ({
    ambient: start.ambient.clone(),
    ambientIntensity: start.ambientIntensity,
    sky: start.sky.clone(),
    ground: start.ground.clone(),
    hemiIntensity: start.hemiIntensity,
    fog: start.fog.clone(),
    fogDensity: start.fogDensity
  });
  return {
    fromKind: 'apron' as SpaceStationCellKind,
    toKind: 'apron' as SpaceStationCellKind,
    from: snapshot(),
    live: snapshot(),
    frameTimestampMs: null as number | null,
    crossingTimestampMs: null as number | null,
    elapsed: THRESHOLD_FADE_SECONDS.apron,
    duration: THRESHOLD_FADE_SECONDS.apron,
    progress: 1,
    samples: [] as SpaceStationFillSample[]
  };
}

export function advanceDistrictRamp(ramp: ReturnType<typeof createDistrictRamp>, kind: SpaceStationCellKind, frameTimestampMs: number) {
  ramp.frameTimestampMs = frameTimestampMs;
  if (kind !== ramp.toKind) {
    // The walker published this cell before lighting runs: t=0 is the crossing frame.
    ramp.from.ambient.copy(ramp.live.ambient);
    ramp.from.sky.copy(ramp.live.sky);
    ramp.from.ground.copy(ramp.live.ground);
    ramp.from.fog.copy(ramp.live.fog);
    ramp.from.ambientIntensity = ramp.live.ambientIntensity;
    ramp.from.hemiIntensity = ramp.live.hemiIntensity;
    ramp.from.fogDensity = ramp.live.fogDensity;
    ramp.fromKind = ramp.toKind;
    ramp.toKind = kind;
    ramp.duration = THRESHOLD_FADE_SECONDS[kind];
    ramp.elapsed = 0;
    ramp.crossingTimestampMs = frameTimestampMs;
    ramp.samples.length = 0;
  } else if (ramp.crossingTimestampMs !== null) {
    ramp.elapsed = Math.min(ramp.duration, Math.max(0, (frameTimestampMs - ramp.crossingTimestampMs) / 1000));
  }

  const target = DISTRICT_FILL[ramp.toKind];
  const progress = ramp.elapsed >= ramp.duration ? 1 : THRESHOLD_FADE_EASE(ramp.elapsed / ramp.duration);
  ramp.progress = progress;
  const live = ramp.live;
  const from = ramp.from;
  live.ambient.copy(from.ambient).lerp(target.ambient, progress);
  live.sky.copy(from.sky).lerp(target.sky, progress);
  live.ground.copy(from.ground).lerp(target.ground, progress);
  live.fog.copy(from.fog).lerp(target.fog, progress);
  live.ambientIntensity = from.ambientIntensity + (target.ambientIntensity - from.ambientIntensity) * progress;
  live.hemiIntensity = from.hemiIntensity + (target.hemiIntensity - from.hemiIntensity) * progress;
  live.fogDensity = from.fogDensity + (target.fogDensity - from.fogDensity) * progress;

  // Preserve the completed transition until the next crossing. Continuously
  // recording settled frames erased t=0 before a hardware capture could read it.
  if (progress < 1 || ramp.samples.length === 0 || ramp.samples[ramp.samples.length - 1]?.progress !== 1) {
    if (ramp.samples.length >= SAMPLE_HISTORY) ramp.samples.shift();
    ramp.samples.push({ elapsedSeconds: ramp.elapsed, progress, ambientIntensity: live.ambientIntensity });
  }

}

export interface SpaceStationLightingProps {
  descriptor: SpaceStationDescriptor;
  /** District the viewer currently stands in; drives the fill cross-fade. */
  occupiedCell: Readonly<{ current: CellId | null }>;
}

export function SpaceStationLighting({ descriptor, occupiedCell }: SpaceStationLightingProps) {
  const { lamps, unpooled } = useMemo(() => {
    const all = buildSpaceStationDressing(descriptor.graph, descriptor.seed).filter(
      box => box.kind === 'lamp'
    );
    // `radius: 0` marks unlit emissive trim — jamb strips, column edges, the deck
    // guidance strip. They are light-shaped, not light-casting, and must never take
    // a pool slot from a fitting that has somewhere to reach.
    const pooled = all.filter(box => box.radius !== 0);
    return {
      lamps: pooled.map(box => ({
        position: box.center,
        tone: box.tone,
        radius: box.radius,
        cellId: box.cellId ?? ''
      })),
      unpooled: all.length - pooled.length
    };
  }, [descriptor]);

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

  // Fog is a scene property, not a child, so it is installed imperatively and taken
  // down with the component: an interior fog that outlived the interior would tint
  // the vacuum outside.
  const scene = useThree(state => state.scene);
  const fog = useMemo(
    () => new THREE.FogExp2(DISTRICT_FILL.apron.fog.getHex(), DISTRICT_FILL.apron.fogDensity),
    []
  );
  useEffect(() => {
    const previous = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = previous === fog ? null : previous;
    };
  }, [scene, fog]);

  /**
   * The threshold ramp. `from` is a snapshot of the live fill taken at the crossing
   * frame, so a mid-ramp retarget restarts from wherever the light actually is —
   * monotone per segment, no overshoot, exact arrival at the destination entry.
   * Mounting starts at the apron entry with the ramp complete: nothing is carried
   * in, and nothing fades on the first frame.
   */
  const ramp = useMemo(createDistrictRamp, []);

  useEffect(() => {
    const devWindow = window as typeof window & {
      __spaceStationFill?: () => SpaceStationFillDiagnostics;
    };
    devWindow.__spaceStationFill = () => ({
      district: ramp.toKind,
      from: ramp.fromKind,
      progress: ramp.progress,
      elapsedSeconds: ramp.elapsed,
      durationSeconds: ramp.duration,
      frameTimestampMs: ramp.frameTimestampMs,
      crossingTimestampMs: ramp.crossingTimestampMs,
      ambientIntensity: ramp.live.ambientIntensity,
      hemiIntensity: ramp.live.hemiIntensity,
      fogDensity: ramp.live.fogDensity,
      poolSize: POOL_SIZE,
      pooledFittings: lamps.length,
      unpooledFittings: unpooled,
      samples: ramp.samples.slice()
    });
    return () => {
      delete devWindow.__spaceStationFill;
    };
  }, [ramp, lamps, unpooled]);

  useFrame(({ camera }, delta) => {
    camera.getWorldPosition(cameraPosition);

    // --- district fill -------------------------------------------------------
    const kind = (occupiedCell.current && kindByCell.get(occupiedCell.current)) || 'apron';
    advanceDistrictRamp(ramp, kind, stationFrameTime());
    const live = ramp.live;

    const ambient = ambientRef.current;
    if (ambient) {
      ambient.color.copy(live.ambient);
      ambient.intensity = live.ambientIntensity;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(live.sky);
      hemi.groundColor.copy(live.ground);
      hemi.intensity = live.hemiIntensity;
    }
    fog.color.copy(live.fog);
    fog.density = live.fogDensity;

    // --- fittings ------------------------------------------------------------
    sinceReassign.current += delta;
    if (sinceReassign.current < REASSIGN_INTERVAL_SECONDS) return;
    sinceReassign.current = 0;

    // Slots are reserved per fitting type. Selecting purely by distance lets the
    // desk lamp at your elbow win every slot, so the overhead fittings that give a
    // hall its ceiling never light anything and the volume reads as black.
    const visible = currentVisibleCells();
    const nearest = [
      ...nearestOfTone(lamps, cameraPosition, 0, WARM_SLOTS, visible),
      ...nearestOfTone(lamps, cameraPosition, 1, POOL_SIZE - WARM_SLOTS, visible)
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
  }, STATION_FRAME_PRIORITY.fill);

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
