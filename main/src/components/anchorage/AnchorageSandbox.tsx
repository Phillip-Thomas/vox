import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  anchorageDockRoute,
  anchorageSpawnPoint,
  buildAnchorageDescriptor
} from '../../game/anchorage/anchorageDescriptor.ts';
import {
  buildBlockerIndex,
  positionBlocked,
  type BlockerIndex
} from '../../game/anchorage/anchorageCollision.ts';
import {
  advanceDock,
  beginDock,
  createDockState,
  dockEyeAt,
  dockInputLocked,
  dockReadout,
  skipDock,
  STATION_PRESSURE_KPA,
  type DockReadout,
  type DockRoute,
  type DockState
} from '../../game/anchorage/anchorageDock.ts';
import { buildAnchorageDressing } from '../../game/anchorage/anchorageDressing.ts';
import { validateAnchorageGraph } from '../../game/anchorage/anchorageLayout.ts';
import {
  createWalkState,
  eyePosition,
  PLAYER_BODY,
  PLAYER_EYE_HEIGHT,
  stepWalk,
  type WalkState
} from '../../game/anchorage/anchorageLocomotion.ts';
import { validateAnchorageShell } from '../../game/anchorage/anchorageShell.ts';
import {
  anchorageApproachEnabled,
  anchorageDockEnabled,
  anchorageHudVisible
} from '../../game/anchorage/anchorageDevFlag.ts';
import type { AnchorageAddress, CellId } from '../../game/anchorage/anchorageTypes.ts';
import { AnchorageInterior, anchorageInteriorDiagnostics } from './AnchorageInterior.tsx';
import { AnchorageCrowd, crowdSize } from './AnchorageCrowd.tsx';
import { VendorPanel } from './VendorPanel.tsx';
import {
  anchorageVendorSites,
  buildAnchorageVendors,
  type Vendor
} from '../../game/anchorage/anchorageVendors.ts';
import {
  advanceVendors,
  createTrader,
  vendorInReach,
  type TraderState
} from '../../game/anchorage/anchorageTrade.ts';
import { AnchorageLighting } from './AnchorageLighting.tsx';
import { ApproachScene } from './AnchorageApproach.tsx';
import { anchorageBody } from '../../game/anchorage/anchorageBody.ts';
import {
  DOCK_SPEED_LIMIT,
  SCAN_RANGE,
  type ApproachReadout
} from '../../game/anchorage/anchorageApproach.ts';
import PostFX from '../effects/PostFX.tsx';

/**
 * The anchorage development sandbox.
 *
 * A standalone scene with its own canvas — no story runtime, no physics world, no
 * shared scene graph. Isolation is the point: it answers "does the interior read,
 * does it hold frame rate, and is it worth walking around" without entangling any of
 * those questions with the shipped game.
 *
 * Two scenes live here, and only ever one at a time: the approach, where you fly a
 * ship to a station a kilometre long, and the interior, where you walk around
 * inside it. They are exclusive rather than nested because they cannot share a
 * depth buffer — a walking near plane of eight centimetres and a hundred-kilometre
 * far plane is a ratio no depth precision survives. Docking clearance is the hinge
 * between them, and the dock sequence opens on a black frame, so the cut is hidden
 * inside the choreography rather than papered over with a fade.
 */

type SandboxScene = 'approach' | 'interior';

/** Terminal ink, shared by every overlay in this file. Declared before the
 *  style objects that read it — a module-level const in the temporal dead zone
 *  is a runtime crash, not a lint warning. */
const INK = 'rgba(228,236,231,0.92)';
const DIM_INK = 'rgba(228,236,231,0.5)';
const WARM_INK = '#ffb45a';

const WALK_SPEED = 4.4;
const SPRINT_SPEED = 11;
const LOOK_SENSITIVITY = 0.0022;

export default function AnchorageSandbox({ address }: { address: AnchorageAddress }) {
  const descriptor = useMemo(() => buildAnchorageDescriptor(address), [address]);
  const problems = useMemo(
    () => [...validateAnchorageGraph(descriptor.graph), ...validateAnchorageShell(descriptor.graph)],
    [descriptor]
  );
  const spawn = useMemo(() => anchorageSpawnPoint(descriptor), [descriptor]);
  const population = useMemo(() => crowdSize(descriptor), [descriptor]);
  // The same dressing the interior renders, indexed for collision. Built from the
  // descriptor rather than handed over by the renderer so what you walk into and
  // what you look at can never drift apart.
  const props = useMemo(
    () => buildBlockerIndex(buildAnchorageDressing(descriptor.graph, descriptor.seed)),
    [descriptor]
  );
  const [occupiedCellId, setOccupiedCellId] = useState<CellId | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>(() => buildAnchorageVendors(descriptor));
  const [trader, setTrader] = useState<TraderState>(() => createTrader());
  const [nearVendorId, setNearVendorId] = useState<string | null>(null);
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);

  const dockRoute = useMemo(() => anchorageDockRoute(descriptor), [descriptor]);
  /*
    The dock state lives in a ref, advanced in exactly one place: the walk
    controller's frame callback, which is the only code here that has a delta.
    Holding it in React state instead would re-render the entire scene tree sixty
    times a second for the six seconds of the arrival — a hitch during the one
    moment the station is trying to make an impression.
  */
  const startInApproach = useMemo(() => anchorageApproachEnabled(), []);
  const [scene, setScene] = useState<SandboxScene>(startInApproach ? 'approach' : 'interior');
  const body = useMemo(() => anchorageBody(address, descriptor.graph), [address, descriptor]);
  // Written every frame by the ship controller, read by the HUD's own loop. Never
  // React state: a readout in state would re-render the scene tree at frame rate
  // through the entire approach.
  const approach = useRef<ApproachReadout | null>(null);

  // Arriving with the choreography is the default; starting in the approach defers
  // it until clearance is granted, because the sequence *is* the handoff.
  const initialDock = useMemo(
    () =>
      anchorageDockEnabled() && !startInApproach
        ? beginDock(createDockState())
        : createDockState(),
    [startInApproach]
  );
  const dock = useRef<DockState>(initialDock);
  const [docking, setDocking] = useState(() => dockInputLocked(initialDock));

  /** Clearance granted: leave the ship outside and pick up inside the lock. */
  const enterStation = useCallback(() => {
    dock.current = anchorageDockEnabled() ? beginDock(createDockState()) : createDockState();
    setScene('interior');
    setDocking(dockInputLocked(dock.current));
  }, []);

  const nearVendor = vendors.find(entry => entry.id === nearVendorId) ?? null;
  const openVendor = vendors.find(entry => entry.id === openVendorId) ?? null;

  // Markets are brought current on entry rather than ticked. Closed-form catch-up
  // means an arrival after a long absence sees prices that moved while you were
  // away, at no cost while you were not looking.
  useEffect(() => {
    if (occupiedCellId !== 'concourse') return;
    setVendors(current => advanceVendors(current, performance.now() / 1000));
  }, [occupiedCellId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050607' }}>
      <Canvas
        // FOV 75 is the embodied lens the cinematography bible fixes for free
        // first-person movement; 62 was an unauthorised third value.
        camera={{ fov: 75, near: 0.08, far: 4_000 }}
        shadows={false}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true
        }}
        performance={{ min: 0.5, max: 1.0, debounce: 200 }}
        frameloop="always"
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          // Matches App.tsx exactly. PostFX swaps this to NoToneMapping while it is
          // mounted and applies ACES as its final pass instead; the exposure still
          // applies, so the two must agree or the sandbox grades differently from
          // the shipped game.
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.94;
        }}
      >
        <color attach="background" args={['#05070a']} />
        <SceneDepthRange scene={scene} />
        {scene === 'approach' ? (
          <ApproachScene
            descriptor={descriptor}
            body={body}
            readout={approach}
            onDock={enterStation}
            inputCaptured={false}
          />
        ) : (
          <>
            {/*
              FogExp2 to match the shipped atmosphere model. The bible requires that
              light, fog and grade describe one atmosphere; linear fog with a hand-picked
              near plane described a different one. Density is well below the surface
              value (0.005) because an interior's longest sightline is ~250m, not a
              horizon. Vacuum gets none of it, which is why this lives inside the
              interior branch rather than on the canvas.
            */}
            <fogExp2 attach="fog" args={['#0a0f16', 0.0016]} />
            <AnchorageLighting descriptor={descriptor} occupiedCellId={occupiedCellId} />
            <AnchorageInterior descriptor={descriptor} occupiedCellId={occupiedCellId} />
            <AnchorageCrowd descriptor={descriptor} />
            <WalkController
              descriptor={descriptor}
              spawn={spawn}
              props={props}
              onCellChange={setOccupiedCellId}
              vendors={vendors}
              onNearVendor={setNearVendorId}
              onOpenVendor={setOpenVendorId}
              inputCaptured={openVendorId !== null}
              dock={dock}
              dockRoute={dockRoute}
            />
          </>
        )}
        {/*
          The shipped post chain, unmodified and in its canonical order. This is what
          the game's look actually is: colour grade, Sobel outline, N8AO contact
          shading and one ACES pass. Mounting it rather than approximating it is the
          only way the anchorage stays in the same visual lineage as everything else.
        */}
        <PostFX terrainSeed={descriptor.seed} />
      </Canvas>
      {docking && <DockOverlay dock={dock} onArrived={() => setDocking(false)} />}
      {scene === 'approach' && !docking && <ApproachHud readout={approach} />}
      {anchorageHudVisible() && !openVendor && !docking && scene === 'interior' && (
        <>
          <SandboxHud descriptor={descriptor} problems={problems} population={population} />
          <Crosshair />
        </>
      )}
      {nearVendor && !openVendor && !docking && <InteractionPrompt vendor={nearVendor} />}
      {openVendor && (
        <VendorPanel
          vendor={openVendor}
          trader={trader}
          onTrade={({ trader: nextTrader, vendor: nextVendor }) => {
            setTrader(nextTrader);
            setVendors(current =>
              current.map(entry => (entry.id === nextVendor.id ? nextVendor : entry))
            );
          }}
          onClose={() => setOpenVendorId(null)}
        />
      )}
    </div>
  );
}

function WalkController({
  descriptor,
  spawn,
  props,
  onCellChange,
  vendors,
  onNearVendor,
  onOpenVendor,
  inputCaptured,
  dock,
  dockRoute
}: {
  descriptor: ReturnType<typeof buildAnchorageDescriptor>;
  spawn: [number, number, number];
  /** Solid furniture. Walls and doorways come from the cell graph. */
  props: BlockerIndex;
  onCellChange: (cellId: CellId | null) => void;
  vendors: Vendor[];
  onNearVendor: (vendorId: string | null) => void;
  onOpenVendor: (vendorId: string | null) => void;
  /** True while the vendor panel owns the keyboard. */
  inputCaptured: boolean;
  /** The arrival, advanced here because this is the only place with a delta. */
  dock: React.MutableRefObject<DockState>;
  dockRoute: DockRoute;
}): null {
  const { camera, gl } = useThree();
  const graph = descriptor.graph;

  const keys = useRef(new Set<string>());
  const euler = useRef(new THREE.Euler(0, -Math.PI / 2, 0, 'YXZ'));
  const walk = useRef<WalkState>(createWalkState(graph, spawn));
  const reportedCell = useRef<CellId | null>(null);

  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);
  const nearRef = useRef<string | null>(null);
  /** Probe-driven movement intent, in m/s. Null while the keyboard is in charge. */
  const scripted = useRef<{ forward: number; strafe: number } | null>(null);
  const vendorsRef = useRef<Vendor[]>(vendors);
  vendorsRef.current = vendors;
  const capturedRef = useRef(inputCaptured);
  capturedRef.current = inputCaptured;

  const applyEye = useCallback(() => {
    const eye = eyePosition(walk.current);
    camera.position.set(eye[0], eye[1], eye[2]);
  }, [camera]);

  useEffect(() => {
    walk.current = createWalkState(graph, spawn);
    camera.quaternion.setFromEuler(euler.current);
    applyEye();
  }, [applyEye, camera, graph, spawn]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      // While the panel is open it owns the keyboard — otherwise typing "sell"
      // into the conversation field walks you across the concourse.
      if (capturedRef.current) return;
      // Any key skips the arrival. A sequence you cannot cut short is one you
      // resent by the fourth time you have watched it.
      if (dockInputLocked(dock.current)) {
        dock.current = skipDock(dock.current).state;
        applyEye();
        return;
      }
      keys.current.add(event.code);
      if (event.code === 'Space') event.preventDefault();
      if (event.code === 'KeyF' && nearRef.current) {
        onOpenVendor(nearRef.current);
        keys.current.clear();
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

    // Capture harnesses cannot acquire pointer lock headless, so expose the look
    // direction directly. Same shape as the existing `window.__auditWorker` hook.
    const devWindow = window as typeof window & {
      __anchorageLook?: (yawRadians: number, pitchRadians?: number) => void;
      __anchorageState?: () => { cellId: string | null; position: [number, number, number] };
      __anchorageTeleport?: (cellId: string, u?: number, v?: number) => boolean;
      __anchorageTeleportToVendor?: (index: number) => string | null;
      __anchorageWalk?: (forward: number, strafe: number) => void;
      __anchorageStaffing?: () => { vendors: number; traders: number; blocked: number };
    };
    devWindow.__anchorageState = () => ({
      cellId: walk.current.cellId,
      position: [walk.current.position[0], walk.current.position[1], walk.current.position[2]]
    });

    /**
     * Drive movement directly, in metres per second.
     *
     * Held keys are the honest input path but a useless probe instrument: the walk
     * is time-stepped and software rendering runs at a few frames a second, so
     * "hold forward for three seconds" covers a wildly different distance headless
     * than it does on a GPU. An explicit intent makes a collision assertion mean
     * something. Pass (0, 0) to stop.
     */
    devWindow.__anchorageWalk = (forward: number, strafe: number) => {
      scripted.current = forward === 0 && strafe === 0 ? null : { forward, strafe };
    };

    /**
     * Is every stall staffed, and is every trader standing somewhere she fits?
     *
     * The interesting failure is not "no figures rendered" — it is a figure posted
     * inside her own shelving, which looks fine from the aisle and is wrong.
     */
    devWindow.__anchorageStaffing = () => {
      const sites = anchorageVendorSites(descriptor);
      const floorY =
        graph.cells.find(cell => cell.kind === 'concourse')?.min[1] ?? 0;
      return {
        vendors: vendorsRef.current.length,
        traders: sites.length,
        blocked: sites.filter(site =>
          positionBlocked(props, site.stand[0], site.stand[2], floorY, PLAYER_BODY)
        ).length
      };
    };

    /**
     * Stand the viewer at a vendor's counter, facing it. Capture runs cannot walk
     * across an aisle at software-render framerates, and "is the prompt showing"
     * is exactly the thing worth asserting.
     */
    devWindow.__anchorageTeleportToVendor = (index: number) => {
      const vendor = vendorsRef.current[index];
      if (!vendor) return null;
      const aisleSide = Math.sign(vendor.counter[2] - vendor.stand[2]) || 1;
      const standAt: [number, number, number] = [
        vendor.counter[0],
        0,
        vendor.counter[2] + aisleSide * 1.5
      ];
      walk.current = createWalkState(graph, standAt);
      applyEye();
      onCellChange(walk.current.cellId);
      // Face across the counter. The camera's default forward is -Z, so standing
      // on the +Z side of a counter means looking along -Z, i.e. yaw 0.
      euler.current.y = aisleSide > 0 ? 0 : Math.PI;
      euler.current.x = 0;
      camera.quaternion.setFromEuler(euler.current);
      return vendor.id;
    };

    /**
     * Place the viewer inside a named cell at fractional footprint coordinates.
     *
     * Capture runs cannot walk there: the post chain drops software rendering to a
     * few frames a second, and locomotion is time-stepped, so holding forward covers
     * metres rather than hundreds of them. Teleporting keeps look-development frames
     * reproducible and fast without touching how the player actually moves.
     */
    devWindow.__anchorageTeleport = (cellId: string, u = 0.5, v = 0.5) => {
      const cell = graph.cells.find(entry => entry.id === cellId);
      if (!cell) return false;
      const x = cell.min[0] + (cell.max[0] - cell.min[0]) * u;
      const z = cell.min[2] + (cell.max[2] - cell.min[2]) * v;
      walk.current = createWalkState(graph, [x, cell.min[1], z]);
      applyEye();
      onCellChange(walk.current.cellId);
      return true;
    };
    devWindow.__anchorageLook = (yawRadians: number, pitchRadians = 0) => {
      euler.current.y = yawRadians;
      euler.current.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitchRadians));
      camera.quaternion.setFromEuler(euler.current);
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
      delete devWindow.__anchorageLook;
      delete devWindow.__anchorageState;
      delete devWindow.__anchorageTeleport;
      delete devWindow.__anchorageTeleportToVendor;
      delete devWindow.__anchorageWalk;
      delete devWindow.__anchorageStaffing;
    };
  }, [applyEye, camera, descriptor, dock, gl, graph, onCellChange, onOpenVendor, props]);

  useFrame((_, delta) => {
    const held = keys.current;

    // The arrival owns the camera until it hands back. The dolly ends exactly at
    // the walk state's spawn, so handback is a matter of stopping the override
    // rather than of moving anybody.
    if (dockInputLocked(dock.current)) {
      held.clear();
      dock.current = advanceDock(dock.current, delta).state;
      const eye = dockEyeAt(dockRoute, dockReadout(dock.current).travel, PLAYER_EYE_HEIGHT);
      camera.position.set(eye[0], eye[1], eye[2]);
      return;
    }

    if (inputCaptured) {
      held.clear();
      return;
    }

    // Horizontal basis from the look direction, flattened so looking up does not
    // slow you down — the usual first-person expectation.
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0);
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    move.set(0, 0, 0);
    let speed = held.has('ShiftLeft') || held.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;

    const drive = scripted.current;
    if (drive) {
      move.addScaledVector(forward, drive.forward).addScaledVector(right, drive.strafe);
      speed = move.length();
      if (speed > 0) move.normalize();
    } else {
      if (held.has('KeyW')) move.add(forward);
      if (held.has('KeyS')) move.sub(forward);
      if (held.has('KeyD')) move.add(right);
      if (held.has('KeyA')) move.sub(right);
      if (move.lengthSq() > 0) move.normalize();
    }

    const step = Math.min(delta, 0.05);

    walk.current = stepWalk(
      graph,
      walk.current,
      { dx: move.x * speed * step, dz: move.z * speed * step, jump: held.has('Space') },
      step,
      props
    );

    applyEye();

    if (walk.current.cellId !== reportedCell.current) {
      reportedCell.current = walk.current.cellId;
      onCellChange(walk.current.cellId);
    }

    // Who is the player facing across a counter? Distance alone would put you in
    // conversation with whoever is behind you across a four-metre aisle.
    const reach = vendorInReach(
      vendors,
      walk.current.position,
      [forward.x, 0, forward.z]
    );
    const nextNear = reach?.vendor.id ?? null;
    if (nextNear !== nearRef.current) {
      nearRef.current = nextNear;
      onNearVendor(nextNear);
    }
  });

  return null;
}

/**
 * Depth range, per scene.
 *
 * A walking near plane of eight centimetres and a hundred-kilometre far plane is a
 * ratio no depth buffer survives — the whole station would z-fight against itself.
 * The two scenes never coexist, so the camera simply retunes when it crosses over.
 */
function SceneDepthRange({ scene }: { scene: SandboxScene }): null {
  const { camera } = useThree();
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (scene === 'approach') {
      perspective.near = 1;
      perspective.far = 140_000;
    } else {
      perspective.near = 0.08;
      perspective.far = 4_000;
    }
    perspective.updateProjectionMatrix();
  }, [camera, scene]);
  return null;
}

/**
 * The approach instrument panel.
 *
 * Reads the shared readout on its own animation frame rather than through React
 * state, so a HUD that updates continuously does not re-render the scene.
 *
 * Everything on it is a gate the player can act on: range closes by flying, the
 * bearing bar centres by turning, and the closing-speed number is the one that
 * actually refuses clearance. An instrument showing a value nobody can change is
 * decoration.
 */
function ApproachHud({ readout }: { readout: React.MutableRefObject<ApproachReadout | null> }) {
  const [current, setCurrent] = useState<ApproachReadout | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setCurrent(readout.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [readout]);

  if (!current) return null;

  const rangeFraction = Math.max(0, Math.min(1, 1 - current.distance / SCAN_RANGE));
  // Off-axis maps to a bar that centres as you line up. Beyond the corridor the
  // needle pins rather than running off the instrument.
  const bearing = Math.max(-1, Math.min(1, current.offAxis / 0.9));
  const hot = current.closingSpeed > DOCK_SPEED_LIMIT;

  return (
    <>
      <div style={approachPanel} data-testid="anchorage-approach-hud">
        <div style={{ color: current.canDock ? '#46ff8c' : WARM_INK, letterSpacing: '0.1em' }}>
          {current.advisory.toUpperCase()}
        </div>
        <div style={{ height: 10 }} />
        <ApproachLine label="range" value={`${Math.round(current.distance)}`} fill={rangeFraction} />
        <ApproachLine
          label="bearing"
          value={current.insideCorridor ? 'on corridor' : `${(current.offAxis * 57.3).toFixed(0)}° off`}
          fill={1 - Math.abs(bearing)}
          warn={!current.insideCorridor}
        />
        <ApproachLine
          label="closing"
          value={`${current.closingSpeed.toFixed(0)} / ${DOCK_SPEED_LIMIT}`}
          fill={Math.max(0, Math.min(1, 1 - current.closingSpeed / (DOCK_SPEED_LIMIT * 3)))}
          warn={hot}
        />
        <div style={{ color: DIM_INK, marginTop: 10, fontSize: 11 }}>
          WASD thrust · space/C up-down · shift boost · X hold station · mouse look
        </div>
      </div>
      {current.canDock && (
        <div style={clearancePrompt} data-testid="anchorage-dock-prompt">
          [F] request docking clearance
        </div>
      )}
      <Crosshair />
    </>
  );
}

function ApproachLine({
  label,
  value,
  fill,
  warn = false
}: {
  label: string;
  value: string;
  fill: number;
  warn?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
      <span style={{ width: 66, color: DIM_INK }}>{label}</span>
      <span style={{ width: 150, height: 4, background: 'rgba(228,236,231,0.14)' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%`,
            background: warn ? '#ff5a3c' : WARM_INK
          }}
        />
      </span>
      <span style={{ color: warn ? '#ff5a3c' : INK, fontSize: 11 }}>{value}</span>
    </div>
  );
}

/* Bottom-left, not centred: a dev instrument must not sit on top of the thing it
   is reporting on, and the station is dead centre for the whole approach. */
const approachPanel: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  bottom: 16,
  padding: '12px 16px',
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: INK,
  background: 'rgba(6,8,10,0.68)',
  border: '1px solid rgba(228,236,231,0.14)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap'
};

const clearancePrompt: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '58%',
  transform: 'translateX(-50%)',
  padding: '6px 13px',
  font: '13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#46ff8c',
  background: 'rgba(6,8,10,0.76)',
  border: '1px solid rgba(70,255,140,0.34)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap'
};

/**
 * The arrival, as the player sees it.
 *
 * Three layers over the live scene: a blackout that lifts as the lock lights, two
 * hatch leaves that retract from the centre, and the lock's own instrument panel.
 * All DOM rather than geometry — the hatch is the frame of the shot, and the
 * cinematography bible is explicit that the composed frame is graded once, so this
 * is a curtain in front of the picture and never a second pass over it.
 *
 * Runs its own animation frame and reads the shared dock state. Nothing here calls
 * back into the scene, so the entire six seconds costs the renderer nothing.
 */
function DockOverlay({
  dock,
  onArrived
}: {
  dock: React.MutableRefObject<DockState>;
  onArrived: () => void;
}) {
  const [readout, setReadout] = useState<DockReadout>(() => dockReadout(dock.current));
  const arrived = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = dockReadout(dock.current);
      setReadout(next);
      if (next.phase === 'complete' && !arrived.current) {
        arrived.current = true;
        onArrived();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dock, onArrived]);

  // Leaves part from the centre line. Half the viewport each, so aperture 1 clears
  // the frame exactly.
  const leaf = `${50 * (1 - readout.aperture)}vh`;

  return (
    <div style={dockLayer} data-testid="anchorage-dock-overlay">
      <div style={{ ...dockBlackout, opacity: 1 - readout.reveal }} />
      <div style={{ ...dockLeaf, top: 0, height: leaf }} />
      <div style={{ ...dockLeaf, bottom: 0, height: leaf }} />
      <div style={{ ...dockPanel, opacity: readout.panelOpacity }}>
        <div style={{ color: WARM_INK, letterSpacing: '0.1em', marginBottom: 8 }}>
          BERTH ASSIGNED · HOLD FOR CYCLE
        </div>
        <DockLine label="clamps" value={readout.clamp} detail={readout.clamp >= 1 ? 'engaged' : 'driving'} />
        <DockLine
          label="lock pressure"
          value={readout.pressure}
          detail={`${readout.pressureKpa.toFixed(1)} / ${STATION_PRESSURE_KPA.toFixed(1)} kPa`}
        />
        <DockLine label="hatch" value={readout.hatch} detail={readout.hatch >= 1 ? 'open' : 'cycling'} />
        <div style={{ color: DIM_INK, marginTop: 10, fontSize: 11 }}>any key to skip</div>
      </div>
    </div>
  );
}

/** One instrument line: a label, a bar that fills, and what it is actually doing. */
function DockLine({ label, value, detail }: { label: string; value: number; detail: string }) {
  const done = value >= 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
      <span style={{ width: 108, color: done ? INK : DIM_INK }}>{label}</span>
      <span style={{ width: 128, height: 4, background: 'rgba(228,236,231,0.14)' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.round(value * 100)}%`,
            background: done ? WARM_INK : 'rgba(228,236,231,0.6)'
          }}
        />
      </span>
      <span style={{ color: DIM_INK, fontSize: 11 }}>{detail}</span>
    </div>
  );
}


const dockLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 30,
  overflow: 'hidden'
};

const dockBlackout: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#04060a'
};

/** Hatch leaves. Flat black with a lit inner edge, so they read as metal. */
const dockLeaf: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  background: 'linear-gradient(#04060a, #090d12)',
  boxShadow: '0 0 34px 6px rgba(0,0,0,0.9)',
  borderTop: '1px solid rgba(255,180,90,0.13)',
  borderBottom: '1px solid rgba(255,180,90,0.13)'
};

const dockPanel: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  padding: '14px 18px',
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: INK,
  background: 'rgba(6,8,10,0.82)',
  border: '1px solid rgba(228,236,231,0.16)',
  whiteSpace: 'nowrap'
};

/** The contextual prompt. One key, one verb, matching the shipped HUD idiom. */
function InteractionPrompt({ vendor }: { vendor: Vendor }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '58%',
        transform: 'translateX(-50%)',
        padding: '5px 11px',
        font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'rgba(228,236,231,0.92)',
        background: 'rgba(6,8,10,0.72)',
        border: '1px solid rgba(228,236,231,0.16)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}
      data-testid="anchorage-interaction-prompt"
    >
      [F] talk to {vendor.name}
    </div>
  );
}

function Crosshair() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 3,
        height: 3,
        marginLeft: -1.5,
        marginTop: -1.5,
        background: 'rgba(228,236,231,0.55)',
        pointerEvents: 'none'
      }}
    />
  );
}

function SandboxHud({
  descriptor,
  problems,
  population
}: {
  descriptor: ReturnType<typeof buildAnchorageDescriptor>;
  problems: string[];
  population: number;
}) {
  const [diagnostics, setDiagnostics] = useState(anchorageInteriorDiagnostics());
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = window.setInterval(() => setDiagnostics(anchorageInteriorDiagnostics()), 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        maxWidth: 470,
        padding: '10px 12px',
        font: '12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'rgba(228,236,231,0.9)',
        background: 'rgba(6,8,10,0.7)',
        border: '1px solid rgba(228,236,231,0.14)',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap'
      }}
      data-testid="anchorage-sandbox-hud"
    >
      {`ANCHORAGE SANDBOX — ${descriptor.worldId}
seed ${descriptor.seed} · bound ${descriptor.boundRadius}m · ${fps} fps
in: ${diagnostics?.occupiedCellId ?? '—'}   visible: ${
        diagnostics ? `${diagnostics.visibleCellCount}/${diagnostics.cellCount}` : '—'
      }${diagnostics?.visibleCellIds.length ? ` (${diagnostics.visibleCellIds.join(', ')})` : ''}
instances: ${diagnostics ? `${diagnostics.instances}/${diagnostics.totalInstances}` : '—'}
crowd: ${population}
meshes: ${diagnostics ? diagnostics.meshes + 1 : '—'}  programs: ${diagnostics?.programs ?? '—'}${problems.length > 0 ? `\n\nLAYOUT PROBLEMS:\n  ${problems.join('\n  ')}` : ''}

click to capture mouse · WASD walk · shift run · space jump`}
    </div>
  );
}
