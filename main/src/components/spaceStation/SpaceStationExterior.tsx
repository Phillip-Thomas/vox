import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { spaceStationBody, type SpaceStationBody } from '../../game/spaceStation/spaceStationBody.ts';
import { spaceStationFixedTime } from '../../game/spaceStation/spaceStationDevFlag.ts';
import {
  buildSpaceStationExterior,
  EXTERIOR_LIGHT_TONE,
  type ExteriorTier
} from '../../game/spaceStation/spaceStationExterior.ts';
import type { SpaceStationDescriptor } from '../../game/spaceStation/spaceStationTypes.ts';
import { createStationMaterial } from './stationMaterial.ts';

/**
 * The station, rendered from outside.
 *
 * Two instanced draws for the whole structure: hull on the shared station material,
 * and every window and beacon on one unlit pass. The emissive half is what carries
 * the read at range — at four kilometres the hull is a dark smear and the lit
 * windows are the object — so it is never tiered out, while hull greebles drop off
 * as soon as they stop being resolvable.
 *
 * Placed and oriented by the body descriptor, so the mouth you fly into is the
 * airlock the interior scene starts you in.
 */

/** Hull tones. Cold, unsaturated: the colour belongs to the windows. */
const HULL_TONES = [
  0x6b727a, // 0 primary plate
  0x7d848c, // 1 lighter deck / dock structure
  0x565c64, // 2 structural: trusses, collars, masts
  0x6a6157, // 3 warehouse plate, warmer
  0x8b939b, // 4 radiator fin, bright face
  0x3f4a5c, // 5 collector panel
  0x2b2f36 // 6 the sealed mass, deliberately not matching
].map(hex => new THREE.Color(hex));

/** Emissive palette, indexed by EXTERIOR_LIGHT_TONE. */
const LIGHT_TONES = [
  0xd8e6ff, // dockWhite
  0x9fc4e8, // officeBlue
  0xffb45a, // marketWarm
  0xd8a058, // storeAmber
  0xff4a3a, // navRed
  0x46ff8c, // navGreen
  0xffffff // strobe
].map(hex => new THREE.Color(hex));

/**
 * Distance at which each tier stops being drawn.
 *
 * Measured to the station centre rather than per-box: the station is one object
 * and popping half a radiator bank because its root is marginally nearer than its
 * fin is worse than dropping the bank whole.
 */
const TIER_RANGE: Record<ExteriorTier, number> = {
  mass: Infinity,
  structure: 5_200,
  greeble: 1_100
};

/** Metres the dock floodlight is meant to reach across the hull face. */
const DOCK_FLOOD_REACH = 110;

/** Screen size a nav light or strobe is never allowed to fall below. */
const MIN_BEACON_PIXELS = 2.4;
/** Below this a window row is static rather than texture, so it is dropped. */
const MIN_WINDOW_PIXELS = 1.1;

/** Navigation lights and strobes: signal, not texture. Always drawn, never shrunk. */
function isBeacon(tone: number): boolean {
  return (
    tone === EXTERIOR_LIGHT_TONE.navRed ||
    tone === EXTERIOR_LIGHT_TONE.navGreen ||
    tone === EXTERIOR_LIGHT_TONE.strobe
  );
}

export interface SpaceStationExteriorProps {
  descriptor: SpaceStationDescriptor;
  /** Supply one to avoid rebuilding it; otherwise derived from the descriptor. */
  body?: SpaceStationBody;
  /**
   * The shipped game renders system space relative to a floating origin that
   * rebases as the player travels; the sandbox renders in absolute system
   * coordinates. Subtracted from the station's system position, so the default of
   * zero is the sandbox's case and the main game passes its live origin.
   */
  renderOrigin?: readonly [number, number, number];
  /**
   * Beyond this the station is not drawn at all.
   *
   * It is only two draw calls, but the pixel floor under its nav lights means a
   * station forty thousand units away would still paint a permanent cluster of
   * coloured dots on the sky — which reads as fireflies, not as a destination.
   */
  maxRange?: number;
  /**
   * Withhold the geometry that OFFERS a berth — the splayed guide arms, their
   * sequenced approach lamps, and the threshold strips outlining the mouth.
   *
   * Defaults to false, which is the sandbox's case and the shipped free-flight
   * case: the station is drawn exactly as it always has been, instance for
   * instance. The shipped game's mount raises it in story worlds where
   * `story:station-docking-authorized` is unheld, so the same fence that already
   * withholds the advisory register and [F] also withholds the offer's picture.
   * The dock itself — jamb frame, lit mouth, inner glow — is architecture and is
   * never suppressed; a station with no door would be a different station.
   */
  suppressDockOffer?: boolean;
}

const DEFAULT_MAX_RANGE = 26_000;
const ORIGIN: readonly [number, number, number] = [0, 0, 0];

export function SpaceStationExterior({
  descriptor,
  body: suppliedBody,
  renderOrigin = ORIGIN,
  maxRange = DEFAULT_MAX_RANGE,
  suppressDockOffer = false
}: SpaceStationExteriorProps) {
  const hullRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const body = useMemo(
    () => suppliedBody ?? spaceStationBody(descriptor.address, descriptor.graph),
    [descriptor, suppliedBody]
  );

  const exterior = useMemo(
    () => buildSpaceStationExterior(descriptor.graph, descriptor.seed),
    [descriptor]
  );

  const hullMaterial = useMemo(() => createStationMaterial(), []);
  useEffect(() => () => hullMaterial.dispose(), [hullMaterial]);

  // Per-instance surface family, same attribute the interior uses so both share
  // one shader rather than compiling a second near-identical program.
  const styleAttribute = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, exterior.boxes.length)), 1),
    [exterior]
  );

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'XYZ'),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
      camera: new THREE.Vector3(),
      centre: new THREE.Vector3()
    }),
    []
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.quaternion.set(
      body.quaternion[0],
      body.quaternion[1],
      body.quaternion[2],
      body.quaternion[3]
    );
  }, [body]);

  useFrame(({ clock, camera, size }) => {
    const hullMesh = hullRef.current;
    const lightMesh = lightRef.current;
    const group = groupRef.current;
    if (!hullMesh || !lightMesh || !group) return;

    // Placed every frame rather than once: the shipped game rebases its render
    // origin as the player travels, and a station pinned at mount would drift out
    // of the world the moment it did.
    scratch.centre.set(
      body.systemPosition[0] - renderOrigin[0],
      body.systemPosition[1] - renderOrigin[1],
      body.systemPosition[2] - renderOrigin[2]
    );
    group.position.copy(scratch.centre);

    const now = spaceStationFixedTime() ?? clock.getElapsedTime();
    camera.getWorldPosition(scratch.camera);
    const range = scratch.camera.distanceTo(scratch.centre);

    if (range > maxRange) {
      hullMesh.count = 0;
      lightMesh.count = 0;
      return;
    }

    // World size of one screen pixel at the station's range. A beacon smaller than
    // a pixel does not dim — it flickers in and out as the rasteriser catches it or
    // misses it, which is the single ugliest thing a distant light can do. Nav
    // lights are made to hold a floor of a couple of pixels instead, which is also
    // what a real one does: you see the light long before you can resolve the lamp.
    const perspective = camera as THREE.PerspectiveCamera;
    const unitsPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov ?? 75) / 2) * range) /
      Math.max(1, size.height);
    const beaconFloor = unitsPerPixel * MIN_BEACON_PIXELS;

    let hullIndex = 0;
    for (const box of exterior.boxes) {
      if (suppressDockOffer && box.dockOffer) continue;
      if (range > TIER_RANGE[box.tier]) continue;
      scratch.position.set(box.center[0], box.center[1], box.center[2]);
      if (box.rotation) {
        scratch.euler.set(box.rotation[0], box.rotation[1], box.rotation[2]);
        scratch.quaternion.setFromEuler(scratch.euler);
      } else {
        scratch.quaternion.identity();
      }
      scratch.scale.set(box.size[0], box.size[1], box.size[2]);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      hullMesh.setMatrixAt(hullIndex, scratch.matrix);
      hullMesh.setColorAt(hullIndex, HULL_TONES[box.tone % HULL_TONES.length]);
      // Hull plate for the masses, brushed for structure and greebles.
      styleAttribute.setX(hullIndex, box.tier === 'mass' ? 0 : 2);
      hullIndex++;
    }
    hullMesh.count = hullIndex;
    hullMesh.instanceMatrix.needsUpdate = true;
    if (hullMesh.instanceColor) hullMesh.instanceColor.needsUpdate = true;
    styleAttribute.needsUpdate = true;

    let lightIndex = 0;
    for (const light of exterior.lights) {
      if (suppressDockOffer && light.dockOffer) continue;
      const beacon = isBeacon(light.tone);
      // Window rows are the station's texture, not its signal. Once they fall below
      // a pixel they stop being rows and become static, so they are dropped and the
      // beacons carry the read instead — which is the right way round: a lit window
      // says "inhabited" up close, a nav light says "here I am" from ten kilometres.
      //
      // Measured on the *largest* dimension. Using the first one culled the dock
      // mouth — a nineteen-by-thirty-four metre lit opening whose X extent is its
      // one-metre thickness — so the single thing the entire approach is aimed at
      // was being dropped as sub-pixel from four hundred metres away.
      const screenSize = Math.max(light.size[0], light.size[1], light.size[2]);
      if (!beacon && screenSize < unitsPerPixel * MIN_WINDOW_PIXELS) continue;

      scratch.position.set(light.center[0], light.center[1], light.center[2]);
      if (light.rotation) {
        scratch.euler.set(light.rotation[0], light.rotation[1], light.rotation[2]);
        scratch.quaternion.setFromEuler(scratch.euler);
      } else {
        scratch.quaternion.identity();
      }
      scratch.scale.set(
        beacon ? Math.max(light.size[0], beaconFloor) : light.size[0],
        beacon ? Math.max(light.size[1], beaconFloor) : light.size[1],
        beacon ? Math.max(light.size[2], beaconFloor) : light.size[2]
      );
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);

      scratch.colour.copy(LIGHT_TONES[light.tone % LIGHT_TONES.length]);
      if (light.blink) {
        // Value rather than visibility: a beacon that vanishes reads as a dropped
        // instance, one that dims reads as a light.
        const cycle = ((now + (light.phase ?? 0)) % light.blink) / light.blink;
        const lit = cycle < (light.duty ?? 0.25);
        scratch.colour.multiplyScalar(lit ? 1 : 0.06);
      }
      // Push the surviving emissives well past white at range so they bloom rather
      // than merely appear. This is the whole reason a station is visible from
      // further away than its own hull is resolvable.
      if (range > 700) scratch.colour.multiplyScalar(1 + Math.min(3.2, range / 1_400));

      lightMesh.setMatrixAt(lightIndex, scratch.matrix);
      lightMesh.setColorAt(lightIndex, scratch.colour);
      lightIndex++;
    }
    lightMesh.count = lightIndex;
    lightMesh.instanceMatrix.needsUpdate = true;
    if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;

    latestDiagnostics = {
      range,
      hullInstances: hullIndex,
      hullTotal: exterior.boxes.length,
      lightInstances: lightIndex
    };
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={hullRef}
        args={[undefined, hullMaterial, Math.max(1, exterior.boxes.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]}>
          <primitive object={styleAttribute} attach="attributes-aStationStyle" />
        </boxGeometry>
      </instancedMesh>
      <instancedMesh
        ref={lightRef}
        args={[undefined, undefined, Math.max(1, exterior.lights.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/*
        The one real light on the station.

        The key rakes along the spine, which is what shows a thousand metres of hull
        for free and leaves the dock face — the only surface a pilot looks at for the
        whole approach — perfectly edge-on and black. Emissive boxes make the opening
        glow; this is what makes the hull around it exist. Physical units, so the
        intensity is the square of the reach it is meant to have.
      */}
      <pointLight
        position={[exterior.mouth[0] - 26, exterior.mouth[1], exterior.mouth[2]]}
        intensity={DOCK_FLOOD_REACH * DOCK_FLOOD_REACH * 1.5}
        distance={DOCK_FLOOD_REACH * 3}
        decay={2}
        color="#ffe6c2"
      />
    </group>
  );
}

export interface SpaceStationExteriorDiagnostics {
  range: number;
  hullInstances: number;
  hullTotal: number;
  lightInstances: number;
}

let latestDiagnostics: SpaceStationExteriorDiagnostics | null = null;

/** Read by the sandbox HUD and capture harnesses. Never drives rendering. */
export function spaceStationExteriorDiagnostics(): SpaceStationExteriorDiagnostics | null {
  return latestDiagnostics;
}
