import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seededUnit } from '../../utils/worldCoordinates.ts';
import {
  approachHold,
  arrivalStandoff,
  evaluateApproach,
  keyLightDirection,
  SCAN_RANGE,
  type ApproachReadout
} from '../../game/anchorage/anchorageApproach.ts';
import { anchorageBody, type AnchorageBody } from '../../game/anchorage/anchorageBody.ts';
import {
  createFlightState,
  stepFlight,
  type FlightState
} from '../../game/anchorage/anchorageFlight.ts';
import type { AnchorageDescriptor } from '../../game/anchorage/anchorageTypes.ts';
import { AnchorageExterior } from './AnchorageExterior.tsx';

/**
 * The approach: everything the player sees before the airlock.
 *
 * A ship, a station, a star and about three thousand points of light to steer by.
 * The camera *is* the ship — there is no cockpit, because a cockpit is a modelling
 * problem and the thing being proven here is that the berth lines up with the door.
 *
 * Deliberately its own scene rather than a mode of the interior. The two have
 * incompatible depth ranges (a walking near plane of 8cm and a hundred-kilometre
 * far plane cannot share a depth buffer), incompatible atmospheres, and nothing in
 * common but the descriptor.
 */

const LOOK_SENSITIVITY = 0.0022;
/**
 * Where the player drops out of transit, measured from the station's centre.
 *
 * Off the beam rather than on the corridor: far enough that the whole kilometre of
 * it is in frame, close enough that the window bands still read as light rather
 * than as noise.
 */
export const APPROACH_START_DISTANCE = 1_500;

export interface ApproachSceneProps {
  descriptor: AnchorageDescriptor;
  body: AnchorageBody;
  /** Latest readout, written every frame. Read by the HUD's own loop. */
  readout: React.MutableRefObject<ApproachReadout | null>;
  /** Called when the player requests and is granted docking clearance. */
  onDock: () => void;
  /** True while something else owns the keyboard. */
  inputCaptured: boolean;
}

export function ApproachScene({
  descriptor,
  body,
  readout,
  onDock,
  inputCaptured
}: ApproachSceneProps) {
  return (
    <>
      <ApproachEnvironment body={body} />
      <AnchorageExterior descriptor={descriptor} body={body} />
      <ShipController
        body={body}
        readout={readout}
        onDock={onDock}
        inputCaptured={inputCaptured}
      />
    </>
  );
}

/**
 * Star, fill and starfield.
 *
 * One hard key from the system's star and one very dim fill from roughly opposite.
 * There is no bounce light in vacuum, but a station lit from one side only presents
 * a black silhouette against a black sky and stops being an object at all — the
 * fill is the smallest cheat that keeps the far side readable.
 */
function ApproachEnvironment({ body }: { body: AnchorageBody }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Raked across the spine rather than seeded blind: the exterior gets one light
  // worth having, and a station lit down its own axis has no form at all.
  const starDirection = useMemo(() => {
    const key = keyLightDirection(body);
    return new THREE.Vector3(key[0], key[1], key[2]);
  }, [body]);

  const starfield = useMemo(() => {
    const COUNT = 3_000;
    const RADIUS = 60_000;
    const positions = new Float32Array(COUNT * 3);
    const colours = new Float32Array(COUNT * 3);
    const colour = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      // Even distribution on a sphere: uniform in cos(elevation), not in elevation,
      // or the field bunches at the poles and the sky looks combed.
      const u = seededUnit(body.seed, 2_000 + i * 3);
      const v = seededUnit(body.seed, 2_001 + i * 3);
      const theta = u * Math.PI * 2;
      const cosPhi = v * 2 - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      positions[i * 3] = Math.cos(theta) * sinPhi * RADIUS;
      positions[i * 3 + 1] = cosPhi * RADIUS;
      positions[i * 3 + 2] = Math.sin(theta) * sinPhi * RADIUS;

      // A field of identical white dots reads as dust on the lens.
      const warmth = seededUnit(body.seed, 2_002 + i * 3);
      const value = 0.35 + warmth * 0.65;
      colour.setHSL(warmth < 0.7 ? 0.58 : 0.08, 0.35, 0.5).multiplyScalar(value);
      colours[i * 3] = colour.r;
      colours[i * 3 + 1] = colour.g;
      colours[i * 3 + 2] = colour.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  }, [body.seed]);

  useEffect(() => () => starfield.dispose(), [starfield]);

  // The starfield rides with the camera so it never gets closer, which is what
  // stops three thousand points from parallaxing into a wall as you cross 4km.
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    camera.getWorldPosition(group.position);
  });

  return (
    <>
      {/*
        Directional lights are distance-independent, so the position only sets the
        direction — but it has to be well outside the station or three's own
        target-relative maths puts the key inside the hull.
      */}
      <directionalLight
        position={[starDirection.x * 20_000, starDirection.y * 20_000, starDirection.z * 20_000]}
        intensity={7.4}
        color="#fff2dc"
      />
      <directionalLight
        position={[-starDirection.x * 20_000, -starDirection.y * 20_000, -starDirection.z * 20_000]}
        intensity={0.9}
        color="#5f7794"
      />
      {/*
        There is no bounce light in vacuum. This exists purely so the unlit side is
        a dark shape rather than a hole in the starfield — a silhouette that reads
        as absence stops being an object.
      */}
      <ambientLight intensity={0.62} color="#38455c" />
      <group ref={groupRef}>
        <points geometry={starfield}>
          <pointsMaterial size={110} sizeAttenuation vertexColors toneMapped={false} />
        </points>
      </group>
    </>
  );
}

function ShipController({
  body,
  readout,
  onDock,
  inputCaptured
}: {
  body: AnchorageBody;
  readout: React.MutableRefObject<ApproachReadout | null>;
  onDock: () => void;
  inputCaptured: boolean;
}): null {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const flight = useRef<FlightState>(createFlightState(approachHold(body, APPROACH_START_DISTANCE)));
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const capturedRef = useRef(inputCaptured);
  capturedRef.current = inputCaptured;
  const dockRef = useRef(onDock);
  dockRef.current = onDock;

  const applyPose = useCallback(() => {
    const { position } = flight.current;
    camera.position.set(position[0], position[1], position[2]);
  }, [camera]);

  // Open off the beam, already looking at the station. An approach that begins with
  // the player hunting for the destination has wasted its establishing shot, and one
  // that begins already lined up has skipped the manoeuvre entirely.
  useEffect(() => {
    flight.current = createFlightState(arrivalStandoff(body, APPROACH_START_DISTANCE));
    lookAt(euler.current, flight.current.position, body.systemPosition);
    camera.quaternion.setFromEuler(euler.current);
    applyPose();
  }, [applyPose, body, camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (capturedRef.current) return;
      keys.current.add(event.code);
      if (event.code === 'Space') event.preventDefault();
      if (event.code === 'KeyF' && readout.current?.canDock) {
        keys.current.clear();
        dockRef.current();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const onClick = () => void canvas.requestPointerLock?.();
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      euler.current.y -= event.movementX * LOOK_SENSITIVITY;
      euler.current.x -= event.movementY * LOOK_SENSITIVITY;
      euler.current.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onBlur = () => keys.current.clear();

    const devWindow = window as typeof window & {
      __anchorageApproach?: () => (ApproachReadout & { position: [number, number, number] }) | null;
      __anchorageFlyTo?: (distanceFromBerth: number) => void;
      __anchorageApproachLook?: (yaw: number, pitch?: number) => void;
      __anchorageDock?: () => boolean;
    };

    devWindow.__anchorageApproach = () => {
      const current = readout.current;
      if (!current) return null;
      return {
        ...current,
        position: [...flight.current.position] as [number, number, number]
      };
    };

    /**
     * Place the ship on the corridor at a given range, at rest, looking at the
     * station.
     *
     * Capture and probe runs cannot fly kilometres at software-render frame rates,
     * and "is the station legible at 2km" is exactly the question worth asking of a
     * look-development frame. Re-aiming is part of the placement rather than a
     * separate call: a hook that moves the ship and leaves the heading behind
     * produces a frame of empty starfield and a readout claiming the station is
     * sixty metres away, which reads as a rendering bug and is not one.
     */
    devWindow.__anchorageFlyTo = (distanceFromBerth: number) => {
      flight.current = createFlightState(approachHold(body, distanceFromBerth));
      // Aimed at the dock mouth, not the station's centre. On final those are
      // different directions — the berth is on the apron's axis and the centre is
      // up in the sealed volume — and a pilot on the corridor is looking at the
      // door, so a probe frame should be too.
      lookAt(euler.current, flight.current.position, body.berth);
      camera.quaternion.setFromEuler(euler.current);
      applyPose();
    };

    devWindow.__anchorageApproachLook = (yaw: number, pitch = 0) => {
      euler.current.y = yaw;
      euler.current.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitch));
      camera.quaternion.setFromEuler(euler.current);
    };

    /** Request clearance from a probe. Returns whether it was granted. */
    devWindow.__anchorageDock = () => {
      if (!readout.current?.canDock) return false;
      dockRef.current();
      return true;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      delete devWindow.__anchorageApproach;
      delete devWindow.__anchorageFlyTo;
      delete devWindow.__anchorageApproachLook;
      delete devWindow.__anchorageDock;
    };
  }, [applyPose, body, camera, gl, readout]);

  useFrame((_, delta) => {
    const held = keys.current;
    if (inputCaptured) held.clear();

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();

    flight.current = stepFlight(
      flight.current,
      {
        forward: (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0),
        right: (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
        up: (held.has('Space') ? 1 : 0) - (held.has('KeyC') || held.has('ControlLeft') ? 1 : 0),
        boost: held.has('ShiftLeft') || held.has('ShiftRight'),
        brake: held.has('KeyX'),
        basisForward: [forward.x, forward.y, forward.z],
        basisRight: [right.x, right.y, right.z],
        basisUp: [up.x, up.y, up.z]
      },
      delta
    );

    applyPose();
    readout.current = evaluateApproach(body, flight.current);
  });

  return null;
}

/**
 * Point a YXZ euler from one place at another.
 *
 * The camera's own `lookAt` would work, but the controller owns yaw and pitch as
 * scalars so that mouse-look can clamp the pitch; writing a quaternion behind its
 * back means the first mouse movement snaps back to wherever the scalars were.
 */
function lookAt(euler: THREE.Euler, from: Vec3Like, to: readonly [number, number, number]): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const horizontal = Math.hypot(dx, dz) || 1e-6;
  // Camera forward is -Z, so a yaw of zero looks down -Z.
  euler.y = Math.atan2(-dx, -dz);
  euler.x = Math.atan2(dy, horizontal);
}

type Vec3Like = readonly [number, number, number];

/** Where the station reaches the edge of instruments, for the HUD's range bar. */
export { SCAN_RANGE };
export { anchorageBody };
