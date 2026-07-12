import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WorldCoordinate,
  coordinateToSeed,
  seededUnit
} from '../utils/worldCoordinates';
import { getSpaceFlightSnapshot, setTarget } from '../state/spaceFlight.ts';
import {
  getSystemFlightSnapshot,
  type SystemVectorTuple
} from '../state/systemFlight.ts';
import {
  atmosphereSpaceBlend,
  planetLocalCameraRadius
} from '../game/atmosphereSpace.ts';
import {
  NOMINAL_PLANET_FACE_RADIUS,
  starProfileForSystem
} from '../game/starSystem.ts';
import {
  REMOTE_SYSTEM_BASE_DISTANCE,
  REMOTE_SYSTEM_DISTANCE_JITTER,
  REMOTE_SYSTEM_DISTANCE_PER_GRID,
  REMOTE_SYSTEM_GLOW_SCALE,
  REMOTE_SYSTEM_LOCK_RING_SEGMENTS,
  REMOTE_SYSTEM_MAX_VISIBLE_MARKERS,
  REMOTE_SYSTEM_RADIUS_JITTER,
  REMOTE_SYSTEM_RADIUS_MAX,
  REMOTE_SYSTEM_RADIUS_MIN
} from '../game/celestialRenderScale.ts';

interface GalaxyImpostorsProps {
  currentCoordinate: WorldCoordinate;
  planetSize: number;
  activePlanetSystemPosition: SystemVectorTuple;
}

declare global {
  interface Window {
    __paravoxiaSunMarkersProbe?: {
      getState(): {
        markerCount: number;
        reveal: number;
        groupVisible: boolean;
        ancestorsVisible: boolean;
        instanceCount: number;
        uReveal: number;
        meshInScene: boolean;
        samplePositions: Array<[number, number, number]>;
        /** NDC-projected marker centers for the CURRENT camera: [x, y, behind]. */
        screenPositions: Array<[number, number, boolean]>;
      };
      /** Multiply the glint brightness for visibility debugging (1 = normal). */
      setDebugGain(gain: number): void;
      /** Swap the glint shader for a solid magenta basic material (debug). */
      setDebugSolid(on: boolean): void;
    };
  }
}

/**
 * A neighbor STAR SYSTEM rendered as its sun: an additive glint (hot core +
 * soft halo) colored by the system's deterministic StarProfile. Deliberately
 * NOT a planet disc — local companion planets own the "physical body" look;
 * remote systems read as distant suns you aim at and warp to. What orbits a
 * sun is the scanner's job to report (the lock reticle shows the world count).
 */
interface RemoteSystemMarker {
  coordinate: WorldCoordinate;
  seed: number;
  /** Camera-relative offset (the layer group is anchored to the camera). */
  position: THREE.Vector3;
  /** Hot-core radius in world units; the glow extends GLOW_SCALE x this. */
  coreRadius: number;
  color: THREE.Color;
}

const GRID_RADIUS = 8;
const INNER_GRID_RADIUS = 2.85;
// Remote coordinates are unresolved STAR-SYSTEM markers, not local planets.
// Their entire glow envelope stays below 0.5 degrees and their render band
// sits behind the widest possible local companion pair. Canonical
// direct-flight positions are a later sector-streaming concern; this bounded
// background representation must never pretend to be a nearby physical body.
const MIN_ELEVATION = 0.08;
const MAX_ELEVATION = 0.44;

// Target opacity starts late in the atmospheric thinning, then frame-rate-
// independent damping turns even a max-speed crossing into a soft reveal.
const IMPOSTOR_REVEAL_START_BLEND = 0.78;
const IMPOSTOR_REVEAL_DAMPING = 8;

function impostorReveal(spaceBlend: number): number {
  const t = THREE.MathUtils.clamp(
    (spaceBlend - IMPOSTOR_REVEAL_START_BLEND) / (1 - IMPOSTOR_REVEAL_START_BLEND),
    0,
    1
  );
  return t * t * (3 - 2 * t);
}

/** Aim cone for target lock: dot(camForward, markerDir) above this (~10deg). */
const AIM_COS = 0.985;
/** Slightly inflated core silhouette used for target line-of-sight checks. */
const OCCLUSION_RADIUS_SCALE = 1.08;
/** The loaded voxel planet is cube-like; its visual corners reach faceRadius*sqrt(3). */
const LOCAL_PLANET_OCCLUSION_SCALE = Math.sqrt(3);
/** Targeting reticle ring colour (cheap unlit). */
const LOCK_COLOR = new THREE.Color('#7dffb0');
/** How fast the lock highlight eases in/out. */
const LOCK_EASE_DAMPING = 8;

const SUN_MARKER_PROGRAM_KEY = 'remote-system-sun-marker-v3';

// One InstancedMesh draws every sun glint — the same instanceMatrix +
// instanceColor pipeline the companion exact-water shells already prove out
// in production. Billboarding is done CPU-side (32 matrix composes per frame);
// the fragment stage composes a white-hot core, a wide soft halo, and faint
// horizontal/vertical cross-flares — the classic "that is a sun" signature no
// starfield dot has. Prominence comes from the bright core + flares; the hard
// silhouette stays inside the angular hierarchy gate (core 3x under any local
// planet, halo under the smallest).
const SUN_MARKER_VERTEX_SHADER = /* glsl */`
  varying vec2 vPlane;
  varying vec3 vColor;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    vPlane = position.xy;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * localPosition;
  }
`;

const SUN_MARKER_FRAGMENT_SHADER = /* glsl */`
  uniform float uReveal;
  varying vec2 vPlane;
  varying vec3 vColor;

  void main() {
    float r2 = dot(vPlane, vPlane);
    if (r2 > 1.0) discard;
    // Soft window so neither halo nor flares hard-clip at the quad rim.
    float window = 1.0 - smoothstep(0.72, 1.0, r2);
    // Tight saturated core, generous halo, long thin cross-flares. Total
    // energy is high on purpose: the glint must also punch through bright
    // nebula regions, where additive light needs headroom to read at all.
    float core = exp(-r2 * 42.0) * 3.4;
    float halo = exp(-r2 * 2.0) * 0.6;
    float flare = (exp(-abs(vPlane.x) * 26.0) + exp(-abs(vPlane.y) * 26.0))
      * exp(-r2 * 1.5) * 0.55;
    // The center whites out like a real sun; the tint owns the halo/flares.
    vec3 sunColor = mix(vColor, vec3(1.0), clamp(core * 0.4, 0.0, 0.85));
    vec3 color = sunColor * (core + halo + flare) * window * uReveal;
    if (max(color.r, max(color.g, color.b)) < 0.004) discard;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createSunMarkerMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name: 'remote-system-sun-marker',
    vertexShader: SUN_MARKER_VERTEX_SHADER,
    fragmentShader: SUN_MARKER_FRAGMENT_SHADER,
    uniforms: { uReveal: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false
  });
  material.userData = {
    remoteSystemMarker: true,
    programStrategy: SUN_MARKER_PROGRAM_KEY
  };
  material.customProgramCacheKey = () => SUN_MARKER_PROGRAM_KEY;
  return material;
}

function isMarkerOccludedByCloserMarker(
  target: RemoteSystemMarker,
  markers: RemoteSystemMarker[],
  targetDistance: number
): boolean {
  if (targetDistance < 1e-3) return false;
  const invTargetDistance = 1 / targetDistance;
  const dirX = target.position.x * invTargetDistance;
  const dirY = target.position.y * invTargetDistance;
  const dirZ = target.position.z * invTargetDistance;

  for (const blocker of markers) {
    if (blocker === target) continue;
    const projection =
      blocker.position.x * dirX +
      blocker.position.y * dirY +
      blocker.position.z * dirZ;
    if (projection <= 0 || projection >= targetDistance) continue;

    const blockerDistanceSq = blocker.position.lengthSq();
    const closestDistanceSq = Math.max(0, blockerDistanceSq - projection * projection);
    const occlusionRadius = blocker.coreRadius * OCCLUSION_RADIUS_SCALE;
    if (closestDistanceSq <= occlusionRadius * occlusionRadius) {
      return true;
    }
  }

  return false;
}

function isMarkerOccludedByLoadedWorld(
  target: RemoteSystemMarker,
  cameraPosition: THREE.Vector3,
  targetDistance: number,
  planetSize: number
): boolean {
  if (targetDistance < 1e-3 || cameraPosition.lengthSq() < 1e-3) return false;
  const invTargetDistance = 1 / targetDistance;
  const dirX = target.position.x * invTargetDistance;
  const dirY = target.position.y * invTargetDistance;
  const dirZ = target.position.z * invTargetDistance;
  const projection = -(
    cameraPosition.x * dirX +
    cameraPosition.y * dirY +
    cameraPosition.z * dirZ
  );
  if (projection <= 0 || projection >= targetDistance) return false;

  const closestDistanceSq = Math.max(0, cameraPosition.lengthSq() - projection * projection);
  const occlusionRadius = planetSize * LOCAL_PLANET_OCCLUSION_SCALE;
  return closestDistanceSq <= occlusionRadius * occlusionRadius;
}

function buildRemoteSystemMarkers(currentCoordinate: WorldCoordinate): RemoteSystemMarker[] {
  const candidates: Array<{
    dx: number;
    dy: number;
    gridDistance: number;
    coordinate: WorldCoordinate;
    seed: number;
    priority: number;
    required: boolean;
  }> = [];

  for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
    for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
      if (dx === 0 && dy === 0) continue;
      const gridDistance = Math.hypot(dx, dy);
      if (gridDistance > GRID_RADIUS + 0.001) continue;

      const coordinate = {
        x: currentCoordinate.x + dx,
        y: currentCoordinate.y + dy
      };
      const seed = coordinateToSeed(coordinate.x, coordinate.y);
      candidates.push({
        dx,
        dy,
        gridDistance,
        coordinate,
        seed,
        priority: seededUnit(seed, 401),
        required: gridDistance <= INNER_GRID_RADIUS
      });
    }
  }

  const required = candidates.filter(candidate => candidate.required);
  const optional = candidates
    .filter(candidate => !candidate.required)
    .sort((a, b) => b.priority - a.priority || a.gridDistance - b.gridDistance)
    .slice(0, Math.max(0, REMOTE_SYSTEM_MAX_VISIBLE_MARKERS - required.length));

  return [...required, ...optional]
    .sort((a, b) => a.gridDistance - b.gridDistance || a.seed - b.seed)
    .map(candidate => {
      const angleJitter = (seededUnit(candidate.seed, 11) - 0.5) * 0.16;
      const azimuth = Math.atan2(candidate.dy, candidate.dx) + angleJitter;
      const elevation = MIN_ELEVATION + seededUnit(candidate.seed, 17) * (MAX_ELEVATION - MIN_ELEVATION);
      const distance = REMOTE_SYSTEM_BASE_DISTANCE +
        candidate.gridDistance * REMOTE_SYSTEM_DISTANCE_PER_GRID +
        seededUnit(candidate.seed, 23) * REMOTE_SYSTEM_DISTANCE_JITTER;
      const horizontal = Math.cos(elevation) * distance;
      const position = new THREE.Vector3(
        Math.cos(azimuth) * horizontal,
        Math.sin(elevation) * distance,
        Math.sin(azimuth) * horizontal
      );

      const nearFactor = THREE.MathUtils.clamp(1 - candidate.gridDistance / GRID_RADIUS, 0, 1);
      const coreRadius = THREE.MathUtils.lerp(
        REMOTE_SYSTEM_RADIUS_MIN,
        REMOTE_SYSTEM_RADIUS_MAX,
        nearFactor
      ) + seededUnit(candidate.seed, 29) * REMOTE_SYSTEM_RADIUS_JITTER;

      const star = starProfileForSystem(candidate.coordinate);
      const color = new THREE.Color()
        .setHSL(star.hue, 0.68, 0.62)
        .multiplyScalar(star.intensity);

      return {
        coordinate: candidate.coordinate,
        seed: candidate.seed,
        position,
        coreRadius,
        color
      };
    });
}

function createSunMarkerMesh(
  markers: RemoteSystemMarker[],
  material: THREE.ShaderMaterial
): THREE.InstancedMesh {
  const quad = new THREE.PlaneGeometry(2, 2);
  quad.name = 'remote-system-sun-marker-quad';
  const mesh = new THREE.InstancedMesh(quad, material, markers.length);
  mesh.name = 'remote-system-sun-markers';
  mesh.count = markers.length;
  mesh.frustumCulled = false;
  // Billboard matrices are recomposed every frame from the camera orientation.
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  markers.forEach((marker, index) => mesh.setColorAt(index, marker.color));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData = {
    remoteSystemMarker: true,
    programStrategy: SUN_MARKER_PROGRAM_KEY
  };
  return mesh;
}

const MATRIX_SCRATCH = new THREE.Matrix4();
const SCALE_SCRATCH = new THREE.Vector3();

function billboardSunMarkers(
  mesh: THREE.InstancedMesh,
  markers: RemoteSystemMarker[],
  cameraQuaternion: THREE.Quaternion
): void {
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const size = marker.coreRadius * REMOTE_SYSTEM_GLOW_SCALE;
    MATRIX_SCRATCH.compose(
      marker.position,
      cameraQuaternion,
      SCALE_SCRATCH.setScalar(size)
    );
    mesh.setMatrixAt(index, MATRIX_SCRATCH);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Neighbor star systems, rendered as SUN GLINTS in a single instanced draw.
 * The layer group is camera-anchored (a stable background band — canonical
 * direct-flight positions are a later sector-streaming concern) and fades in
 * over the top of the atmosphere→space blend. Aim-cone targeting for the
 * interstellar warp works exactly as before; the lock ring marks the aimed
 * sun and the DOM reticle reports the system's world count.
 */
export default function GalaxyImpostors({
  currentCoordinate,
  planetSize,
  activePlanetSystemPosition
}: GalaxyImpostorsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lockRef = useRef<THREE.Mesh>(null);
  const revealRef = useRef(0);
  const lockT = useRef(0);
  const debugGainRef = useRef(1);
  const probeCameraRef = useRef<THREE.Camera | null>(null);

  const markers = useMemo(
    () => buildRemoteSystemMarkers(currentCoordinate),
    [currentCoordinate.x, currentCoordinate.y]
  );
  const markerMaterial = useMemo(() => createSunMarkerMaterial(), []);
  const markerMesh = useMemo(
    () => createSunMarkerMesh(markers, markerMaterial),
    [markers, markerMaterial]
  );
  // Thin reticle ring for the aim-lock highlight (unit-radius, scaled per-frame).
  const lockRingGeometry = useMemo(
    () => new THREE.RingGeometry(0.92, 1.0, REMOTE_SYSTEM_LOCK_RING_SEGMENTS),
    []
  );

  // Live coordinate of the marker currently aimed at (read per-frame to drive
  // the lock ring). Mutated in place, never re-renders.
  const targetedCoordRef = useRef<WorldCoordinate | null>(null);
  // Reused scratch for the camera-forward direction (no per-frame allocation).
  const forwardScratch = useRef(new THREE.Vector3());

  useEffect(() => () => {
    markerMesh.geometry.dispose();
    markerMesh.dispose();
  }, [markerMesh]);
  useEffect(() => () => {
    markerMaterial.dispose();
    lockRingGeometry.dispose();
  }, [markerMaterial, lockRingGeometry]);

  // Headless-probe introspection (mirrors __paravoxiaShipProbe's gating): lets
  // verification scripts confirm the layer's live render state without
  // reaching into the R3F store.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('systemprobe') !== '1') return undefined;
    const projectScratch = new THREE.Vector3();
    const probe = {
      getState: () => {
        const group = groupRef.current;
        let ancestorsVisible = true;
        for (let node = group?.parent ?? null; node; node = node.parent) {
          if (!node.visible) ancestorsVisible = false;
        }
        let meshInScene = false;
        group?.traverse(node => {
          if (node === markerMesh) meshInScene = true;
        });
        const camera = probeCameraRef.current;
        const screenPositions = markers.map(marker => {
          if (!camera || !group) return [0, 0, true] as [number, number, boolean];
          projectScratch.copy(marker.position).add(group.position).project(camera);
          return [
            projectScratch.x,
            projectScratch.y,
            projectScratch.z > 1 || projectScratch.z < -1
          ] as [number, number, boolean];
        });
        return {
          markerCount: markers.length,
          reveal: revealRef.current,
          groupVisible: group?.visible ?? false,
          ancestorsVisible,
          instanceCount: markerMesh.count,
          uReveal: markerMaterial.uniforms.uReveal.value as number,
          meshInScene,
          samplePositions: markers.slice(0, 4).map(marker =>
            [marker.position.x, marker.position.y, marker.position.z] as [number, number, number]),
          screenPositions
        };
      },
      setDebugGain: (gain: number) => {
        debugGainRef.current = Number.isFinite(gain) ? Math.max(0, gain) : 1;
      },
      setDebugSolid: (on: boolean) => {
        if (on) {
          markerMesh.material = new THREE.MeshBasicMaterial({
            color: '#ff00ff',
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            fog: false,
            toneMapped: false
          });
        } else {
          if (markerMesh.material !== markerMaterial) {
            (markerMesh.material as THREE.Material).dispose();
          }
          markerMesh.material = markerMaterial;
        }
      }
    };
    window.__paravoxiaSunMarkersProbe = probe;
    return () => {
      if (window.__paravoxiaSunMarkersProbe === probe) delete window.__paravoxiaSunMarkersProbe;
    };
  }, [markers, markerMesh, markerMaterial]);

  useFrame(({ camera }, rawDt) => {
    const group = groupRef.current;
    group?.position.copy(camera.position);

    const flight = getSystemFlightSnapshot();
    const targetReveal = impostorReveal(
      atmosphereSpaceBlend(
        planetLocalCameraRadius(
          camera.position,
          flight.renderOrigin,
          activePlanetSystemPosition
        ),
        NOMINAL_PLANET_FACE_RADIUS
      )
    );
    const dt = Math.min(rawDt, 0.05);
    const reveal = THREE.MathUtils.damp(
      revealRef.current,
      targetReveal,
      IMPOSTOR_REVEAL_DAMPING,
      dt
    );
    revealRef.current = targetReveal === 0 && reveal < 0.001
      ? 0
      : targetReveal === 1 && reveal > 0.999
        ? 1
        : reveal;
    if (group) group.visible = reveal > 0.002;
    markerMaterial.uniforms.uReveal.value = reveal * debugGainRef.current;
    probeCameraRef.current = camera;
    if (reveal > 0.002) billboardSunMarkers(markerMesh, markers, camera.quaternion);

    // --- aim-cone targeting (deep_space only, once the layer is revealed) ----
    const localBodyOwnsAim = flight.target?.kind === 'system_body';
    const aimEnabled =
      getSpaceFlightSnapshot().phase === 'deep_space' && !localBodyOwnsAim && reveal >= 0.97;
    if (!aimEnabled && targetedCoordRef.current !== null) {
      targetedCoordRef.current = null;
      setTarget(null);
    }

    if (aimEnabled) {
      // Camera forward in world space (-Z). Each marker's `position` is its
      // offset from the camera-anchored group origin, i.e. its direction*distance
      // from the camera, so the dot of the normalized offset with forward is the
      // alignment.
      const forward = forwardScratch.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      let best: RemoteSystemMarker | null = null;
      let bestDot = AIM_COS;
      for (const marker of markers) {
        const pos = marker.position;
        const len = pos.length();
        if (len < 1e-3) continue;
        const dot = (pos.x * forward.x + pos.y * forward.y + pos.z * forward.z) / len;
        if (dot > bestDot) {
          if (isMarkerOccludedByLoadedWorld(marker, camera.position, len, planetSize)) continue;
          if (isMarkerOccludedByCloserMarker(marker, markers, len)) continue;
          bestDot = dot;
          best = marker;
        }
      }

      const nextCoord = best ? best.coordinate : null;
      const prev = targetedCoordRef.current;
      const changed = prev === null
        ? nextCoord !== null
        : nextCoord === null || prev.x !== nextCoord.x || prev.y !== nextCoord.y;
      if (changed) {
        targetedCoordRef.current = nextCoord;
        setTarget(nextCoord); // store no-ops on unchanged coord anyway
        // NOTE: no prewarm here. Prewarming on every aim-target change ran heavy
        // SYNCHRONOUS world gen (terrain materialize + water flood fill) and froze
        // the frame whenever you panned across impostors — worse than the one-time
        // warp load. The actual world swap happens at the warp white-out midpoint
        // (spaceFlight arrival handler), which already masks that gen.
      }
    }

    // --- lock-ring highlight around the aimed sun ----------------------------
    const lock = lockRef.current;
    if (!lock) return;
    const targeted = targetedCoordRef.current;
    const lockedMarker = targeted
      ? markers.find(marker =>
        marker.coordinate.x === targeted.x && marker.coordinate.y === targeted.y)
      : undefined;
    lockT.current = THREE.MathUtils.damp(
      lockT.current,
      lockedMarker ? 1 : 0,
      LOCK_EASE_DAMPING,
      dt
    );
    lock.visible = lockT.current > 0.01 && lockedMarker !== undefined;
    if (lock.visible && lockedMarker) {
      lock.position.copy(lockedMarker.position);
      // Billboard: the group carries no rotation, so the camera quaternion is
      // the correct world-facing orientation as-is.
      lock.quaternion.copy(camera.quaternion);
      lock.scale.setScalar(
        lockedMarker.coreRadius * REMOTE_SYSTEM_GLOW_SCALE * (1.6 + 0.25 * lockT.current)
      );
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.006);
      (lock.material as THREE.MeshBasicMaterial).opacity = lockT.current * pulse * reveal;
    }
  });

  return (
    <group ref={groupRef} name="remote-system-sun-markers" visible={false}>
      <primitive object={markerMesh} />
      {/* Billboarded lock ring — hidden until a sun is the aim target. */}
      <mesh ref={lockRef} geometry={lockRingGeometry} visible={false} frustumCulled={false}>
        <meshBasicMaterial
          color={LOCK_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
