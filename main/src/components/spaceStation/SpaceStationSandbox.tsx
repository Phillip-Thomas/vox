import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  spaceStationDockRoute,
  spaceStationSpawnPoint,
  buildSpaceStationDescriptor
} from '../../game/spaceStation/spaceStationDescriptor.ts';
import {
  buildBlockerIndex,
  positionBlocked,
  type BlockerIndex
} from '../../game/spaceStation/spaceStationCollision.ts';
import {
  advanceDock,
  beginDock,
  beginUndock,
  createDockState,
  dockEyeAt,
  dockInputLocked,
  dockReadout,
  skipDock,
  STATION_PRESSURE_KPA,
  type DockReadout,
  type DockRoute,
  type DockState
} from '../../game/spaceStation/spaceStationDock.ts';
import { buildSpaceStationDressing } from '../../game/spaceStation/spaceStationDressing.ts';
import { validateSpaceStationGraph } from '../../game/spaceStation/spaceStationLayout.ts';
import {
  createWalkState,
  eyePosition,
  PLAYER_BODY,
  PLAYER_EYE_HEIGHT,
  stepWalk,
  type WalkState
} from '../../game/spaceStation/spaceStationLocomotion.ts';
import { validateSpaceStationShell } from '../../game/spaceStation/spaceStationShell.ts';
import {
  spaceStationApproachEnabled,
  spaceStationDockEnabled,
  spaceStationHudVisible
} from '../../game/spaceStation/spaceStationDevFlag.ts';
import type { SpaceStationAddress, CellId } from '../../game/spaceStation/spaceStationTypes.ts';
import { SpaceStationInterior, spaceStationInteriorDiagnostics } from './SpaceStationInterior.tsx';
import { SpaceStationCrowd, crowdSize } from './SpaceStationCrowd.tsx';
import { VendorPanel } from './VendorPanel.tsx';
import { StationStoryPanel } from './StationStoryPanel.tsx';
import {
  spaceStationVendorSites,
  buildSpaceStationVendors,
  type Vendor
} from '../../game/spaceStation/spaceStationVendors.ts';
import {
  advanceVendors,
  createTrader,
  vendorInReach,
  type TraderState
} from '../../game/spaceStation/spaceStationTrade.ts';
import {
  STATION_STORY_MILESTONES,
  bootstrapStationStorySession,
  commitBondedCellStowed,
  commitConcourseEntered,
  commitStationDeparted,
  commitStationDocked,
  deriveStationStoryStep,
  persistStationStory,
  stationStoryObjective,
  stationStoryProbeSnapshot,
  stationVendorTopics,
  type StationStoryObjective
} from '../../game/spaceStation/spaceStationStory.ts';
import { hasMilestone } from '../../game/systems/progressionSystem.ts';
import { SpaceStationLighting } from './SpaceStationLighting.tsx';
import { ApproachScene } from './SpaceStationApproach.tsx';
import { spaceStationBody } from '../../game/spaceStation/spaceStationBody.ts';
import {
  DOCK_SPEED_LIMIT,
  SCAN_RANGE,
  type ApproachReadout
} from '../../game/spaceStation/spaceStationApproach.ts';
import { isTouchActive, isTouchDevice } from '../../utils/mobileInput.ts';
import PostFX from '../effects/PostFX.tsx';
import TouchControls from '../mobile/TouchControls.tsx';

/**
 * The spaceStation renderer and its isolated development sandbox.
 *
 * A standalone scene with its own canvas — no planet physics world and no shared
 * scene graph. Bare `?spacestation=` remains the ephemeral development sandbox.
 * The shipped `from=game` handoff layers one milestone-derived station visit on
 * this same renderer and restores/persists the global player stores at the hard
 * page seam.
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

export default function SpaceStationSandbox({ address }: { address: SpaceStationAddress }) {
  const isTouch = useMemo(() => isTouchDevice(), []);
  const descriptor = useMemo(() => buildSpaceStationDescriptor(address), [address]);
  // Must run before any story-facing state initializer. App is not mounted on a
  // station URL, so this is the sole restore point across the hard page seam.
  const [storySession] = useState(() => bootstrapStationStorySession(address));
  const storyMode = storySession !== null;
  const problems = useMemo(
    () => [...validateSpaceStationGraph(descriptor.graph), ...validateSpaceStationShell(descriptor.graph)],
    [descriptor]
  );
  const spawn = useMemo(() => spaceStationSpawnPoint(descriptor), [descriptor]);
  const population = useMemo(() => crowdSize(descriptor), [descriptor]);
  // The same dressing the interior renders, indexed for collision. Built from the
  // descriptor rather than handed over by the renderer so what you walk into and
  // what you look at can never drift apart.
  const props = useMemo(
    () => buildBlockerIndex(buildSpaceStationDressing(descriptor.graph, descriptor.seed)),
    [descriptor]
  );
  const [occupiedCellId, setOccupiedCellId] = useState<CellId | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>(() => buildSpaceStationVendors(descriptor));
  const [trader, setTrader] = useState<TraderState>(() => createTrader());
  const [nearVendorId, setNearVendorId] = useState<string | null>(null);
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [storyRevision, setStoryRevision] = useState(0);
  const [nearStoryTargetId, setNearStoryTargetId] = useState<string | null>(null);
  const [openStoryKind, setOpenStoryKind] = useState<'registry' | 'issuer' | null>(null);
  const [storyDistance, setStoryDistance] = useState<number | null>(null);

  const dockRoute = useMemo(() => spaceStationDockRoute(descriptor), [descriptor]);
  /*
    The dock state lives in a ref, advanced in exactly one place: the walk
    controller's frame callback, which is the only code here that has a delta.
    Holding it in React state instead would re-render the entire scene tree sixty
    times a second for the six seconds of the arrival — a hitch during the one
    moment the station is trying to make an impression.
  */
  const startInApproach = useMemo(() => spaceStationApproachEnabled(), []);
  const [scene, setScene] = useState<SandboxScene>(startInApproach ? 'approach' : 'interior');
  const body = useMemo(() => spaceStationBody(address, descriptor.graph), [address, descriptor]);
  // Written every frame by the ship controller, read by the HUD's own loop. Never
  // React state: a readout in state would re-render the scene tree at frame rate
  // through the entire approach.
  const approach = useRef<ApproachReadout | null>(null);

  // Arriving with the choreography is the default; starting in the approach defers
  // it until clearance is granted, because the sequence *is* the handoff.
  const initialDock = useMemo(
    () =>
      spaceStationDockEnabled() && !startInApproach
        ? beginDock(createDockState())
        : createDockState(),
    [startInApproach]
  );
  const dock = useRef<DockState>(initialDock);
  const [docking, setDocking] = useState(() => dockInputLocked(initialDock));

  /** Clearance granted: leave the ship outside and pick up inside the lock. */
  const enterStation = useCallback(() => {
    dock.current = spaceStationDockEnabled() ? beginDock(createDockState()) : createDockState();
    setScene('interior');
    setDocking(dockInputLocked(dock.current));
  }, []);

  const [nearAirlock, setNearAirlock] = useState(false);
  /*
    The dolly a departure runs along.

    Built at the moment the player asks to leave rather than fixed like the arrival
    route, with `deck` set to wherever they happen to be standing. Departure runs
    the same interpolation backwards, so this makes the walk back into the lock
    start from the player's actual position instead of snapping them to the spot
    they originally arrived on.
  */
  const [departRoute, setDepartRoute] = useState<DockRoute | null>(null);
  /** Set when the player has just left, so the ship reappears where it was parked. */
  const [undockedAt, setUndockedAt] = useState<readonly [number, number, number] | null>(null);

  const leaveStation = useCallback(
    (from: [number, number, number]) => {
      setDepartRoute({ lock: dockRoute.lock, deck: from });
      dock.current = beginUndock();
      setDocking(true);
      setNearAirlock(false);
    },
    [dockRoute]
  );

  /**
   * The sequence finished. Where that leads depends on how the player got here.
   *
   * Arriving hands control to the walk controller and nothing else happens. A
   * departure has to put them back in a ship — either the sandbox's own approach
   * scene, or, when the shipped game handed off to this page, back to the game
   * with the berth recorded so the ship spawns where it was parked.
   */
  const onSequenceComplete = useCallback(() => {
    setDocking(false);
    if (dock.current.direction !== 'depart') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'game') {
      if (storySession) {
        commitStationDeparted();
        persistStationStory(storySession);
      }
      const { system, index } = descriptor.address;
      const next = new URLSearchParams(params);
      // The parser and entry path use lowercase `spacestation`. The old
      // camel-case delete left the real flag behind and reloaded this sandbox
      // forever instead of returning the player to their ship.
      next.delete('spacestation');
      next.delete('spaceStation'); // clean legacy/manual URLs too
      next.delete('from');
      next.delete('approach');
      next.delete('dock');
      next.set('undock', `${system.x},${system.y},${index}`);
      next.set('fly', '1');
      window.location.assign(`${window.location.pathname}?${next.toString()}`);
      return;
    }
    // Standalone sandbox: hand the ship back without a reload, sitting at the
    // berth it was clamped to.
    setDepartRoute(null);
    dock.current = createDockState();
    setUndockedAt(body.berth);
    setScene('approach');
  }, [body, descriptor, storySession]);

  const nearVendor = vendors.find(entry => entry.id === nearVendorId) ?? null;
  const openVendor = vendors.find(entry => entry.id === openVendorId) ?? null;
  const storyObjective = useMemo(
    () => storyMode ? stationStoryObjective(descriptor, vendors) : null,
    [descriptor, storyMode, storyRevision, vendors]
  );
  const storyIssuer = storyObjective?.vendorId
    ? vendors.find(entry => entry.id === storyObjective.vendorId) ?? null
    : null;

  const recordStoryReceipt = useCallback((receipt: { changed: boolean }) => {
    if (!storySession || !receipt.changed) return;
    persistStationStory(storySession);
    setStoryRevision(value => value + 1);
  }, [storySession]);

  const activateStoryTarget = useCallback((
    objective: StationStoryObjective,
    position: [number, number, number]
  ) => {
    if (objective.targetKind === 'airlock') {
      const stowed = commitBondedCellStowed();
      if (!stowed.ok) return;
      recordStoryReceipt(stowed);
      leaveStation(position);
      return;
    }
    setOpenVendorId(null);
    setOpenStoryKind(objective.targetKind);
  }, [leaveStation, recordStoryReceipt]);

  // Markets are brought current on entry rather than ticked. Closed-form catch-up
  // means an arrival after a long absence sees prices that moved while you were
  // away, at no cost while you were not looking.
  useEffect(() => {
    if (occupiedCellId !== 'concourse') return;
    setVendors(current => advanceVendors(current, performance.now() / 1000));
    if (storySession) recordStoryReceipt(commitConcourseEntered());
  }, [occupiedCellId, recordStoryReceipt, storySession]);

  // Arrival receipt lands only after the docking choreography has handed the
  // camera back. `dock=0` uses the same effect and therefore remains playable.
  useEffect(() => {
    if (!storySession || scene !== 'interior' || docking) return;
    recordStoryReceipt(commitStationDocked());
  }, [docking, recordStoryReceipt, scene, storySession]);

  useEffect(() => {
    if (!storyMode) return;
    const devWindow = window as typeof window & {
      __spaceStationStory?: () => Record<string, unknown>;
    };
    devWindow.__spaceStationStory = stationStoryProbeSnapshot;
    return () => { delete devWindow.__spaceStationStory; };
  }, [storyMode, storyRevision]);

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
            startAt={undockedAt ?? undefined}
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
            <SpaceStationLighting descriptor={descriptor} occupiedCellId={occupiedCellId} />
            <SpaceStationInterior descriptor={descriptor} occupiedCellId={occupiedCellId} />
            <SpaceStationCrowd descriptor={descriptor} />
            {storyObjective && <StationStoryMarker objective={storyObjective} />}
            <WalkController
              descriptor={descriptor}
              spawn={spawn}
              props={props}
              onCellChange={setOccupiedCellId}
              vendors={vendors}
              onNearVendor={setNearVendorId}
              onOpenVendor={setOpenVendorId}
              storyObjective={storyObjective}
              onNearStoryTarget={setNearStoryTargetId}
              onStoryDistance={setStoryDistance}
              onActivateStoryTarget={activateStoryTarget}
              inputCaptured={openVendorId !== null || openStoryKind !== null}
              dock={dock}
              dockRoute={departRoute ?? dockRoute}
              airlock={dockRoute.lock}
              onNearAirlock={setNearAirlock}
              onLeave={leaveStation}
            />
          </>
        )}
        {/*
          The shipped post chain, unmodified and in its canonical order. This is what
          the game's look actually is: colour grade, Sobel outline, N8AO contact
          shading and one ACES pass. Mounting it rather than approximating it is the
          only way the spaceStation stays in the same visual lineage as everything else.
        */}
        <PostFX terrainSeed={descriptor.seed} />
      </Canvas>
      {docking && <DockOverlay dock={dock} onArrived={onSequenceComplete} />}
      {scene === 'approach' && !docking && <ApproachHud readout={approach} touch={isTouch} />}
      {spaceStationHudVisible() && !openVendor && !docking && scene === 'interior' && (
        <SandboxHud descriptor={descriptor} problems={problems} population={population} />
      )}
      {storyMode && storyObjective && !openVendor && !openStoryKind && !docking && scene === 'interior' && (
        <StationStoryHud objective={storyObjective} distance={storyDistance} />
      )}
      {(spaceStationHudVisible() || storyMode) && !openVendor && !openStoryKind && !docking && scene === 'interior' && (
        <Crosshair />
      )}
      {nearStoryTargetId && storyObjective && !openVendor && !openStoryKind && !docking && (
        <StoryInteractionPrompt objective={storyObjective} touch={isTouch} />
      )}
      {nearVendor && !nearStoryTargetId && !openVendor && !openStoryKind && !docking && (
        <InteractionPrompt vendor={nearVendor} />
      )}
      {nearAirlock && !storyMode && !openVendor && !openStoryKind && !docking && scene === 'interior' && (
        <AirlockPrompt touch={isTouch} />
      )}
      {isTouch && !docking && !openVendor && !openStoryKind && (
        <TouchControls controlMode={scene === 'approach' ? 'flight' : 'fps'} />
      )}
      {openVendor && (
        <VendorPanel
          vendor={openVendor}
          trader={trader}
          tradingEnabled={!storyMode || hasMilestone(STATION_STORY_MILESTONES.tradeUnlocked)}
          authoredTopics={storyMode ? stationVendorTopics(openVendor) : []}
          onTrade={({ trader: nextTrader, vendor: nextVendor }) => {
            setTrader(nextTrader);
            setVendors(current =>
              current.map(entry => (entry.id === nextVendor.id ? nextVendor : entry))
            );
          }}
          onClose={() => setOpenVendorId(null)}
        />
      )}
      {openStoryKind && (
        <StationStoryPanel
          kind={openStoryKind}
          vendor={openStoryKind === 'issuer' ? storyIssuer : null}
          onReceipt={recordStoryReceipt}
          onClose={() => setOpenStoryKind(null)}
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
  storyObjective,
  onNearStoryTarget,
  onStoryDistance,
  onActivateStoryTarget,
  inputCaptured,
  dock,
  dockRoute,
  airlock,
  onNearAirlock,
  onLeave
}: {
  descriptor: ReturnType<typeof buildSpaceStationDescriptor>;
  spawn: [number, number, number];
  /** Solid furniture. Walls and doorways come from the cell graph. */
  props: BlockerIndex;
  onCellChange: (cellId: CellId | null) => void;
  vendors: Vendor[];
  onNearVendor: (vendorId: string | null) => void;
  onOpenVendor: (vendorId: string | null) => void;
  storyObjective: StationStoryObjective | null;
  onNearStoryTarget: (targetId: string | null) => void;
  onStoryDistance: (distance: number | null) => void;
  onActivateStoryTarget: (
    objective: StationStoryObjective,
    position: [number, number, number]
  ) => void;
  /** True while the vendor panel owns the keyboard. */
  inputCaptured: boolean;
  /** The arrival, advanced here because this is the only place with a delta. */
  dock: React.MutableRefObject<DockState>;
  dockRoute: DockRoute;
  /** Where the ship is docked. Standing near it offers the way out. */
  airlock: [number, number, number];
  onNearAirlock: (near: boolean) => void;
  onLeave: (from: [number, number, number]) => void;
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
  const nearStoryRef = useRef<string | null>(null);
  const storyDistanceRef = useRef<number | null>(null);
  /** Probe-driven movement intent, in m/s. Null while the keyboard is in charge. */
  const scripted = useRef<{ forward: number; strafe: number } | null>(null);
  const vendorsRef = useRef<Vendor[]>(vendors);
  vendorsRef.current = vendors;
  const storyObjectiveRef = useRef(storyObjective);
  storyObjectiveRef.current = storyObjective;
  const activateStoryRef = useRef(onActivateStoryTarget);
  activateStoryRef.current = onActivateStoryTarget;
  const capturedRef = useRef(inputCaptured);
  capturedRef.current = inputCaptured;
  const nearAirlockRef = useRef(false);
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const airlockRef = useRef(airlock);
  airlockRef.current = airlock;

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
      if (event.code === 'KeyF' && nearStoryRef.current && storyObjectiveRef.current) {
        keys.current.clear();
        activateStoryRef.current(storyObjectiveRef.current, [
          walk.current.position[0],
          walk.current.position[1],
          walk.current.position[2]
        ]);
        return;
      }
      if (event.code === 'KeyF' && nearRef.current) {
        onOpenVendor(nearRef.current);
        keys.current.clear();
        return;
      }
      // F opens a counter in the market and the airlock at the dock. They are four
      // hundred metres apart, so there is nothing to disambiguate.
      if (event.code === 'KeyF' && nearAirlockRef.current) {
        keys.current.clear();
        leaveRef.current([
          walk.current.position[0],
          walk.current.position[1],
          walk.current.position[2]
        ]);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const onClick = () => void canvas.requestPointerLock?.();
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas && !isTouchActive()) return;
      euler.current.y -= event.movementX * LOOK_SENSITIVITY;
      euler.current.x -= event.movementY * LOOK_SENSITIVITY;
      euler.current.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onBlur = () => keys.current.clear();

    // Capture harnesses cannot acquire pointer lock headless, so expose the look
    // direction directly. Same shape as the existing `window.__auditWorker` hook.
    const devWindow = window as typeof window & {
      __spaceStationLook?: (yawRadians: number, pitchRadians?: number) => void;
      __spaceStationState?: () => { cellId: string | null; position: [number, number, number] };
      __spaceStationTeleport?: (cellId: string, u?: number, v?: number) => boolean;
      __spaceStationTeleportToVendor?: (index: number) => string | null;
      __spaceStationTeleportToStoryTarget?: () => string | null;
      __spaceStationVendors?: () => Array<{
        id: string;
        designation: string;
        name: string;
        specialty: string;
      }>;
      __spaceStationWalk?: (forward: number, strafe: number) => void;
      __spaceStationStaffing?: () => { vendors: number; traders: number; blocked: number };
    };
    devWindow.__spaceStationState = () => ({
      cellId: walk.current.cellId,
      position: [walk.current.position[0], walk.current.position[1], walk.current.position[2]]
    });
    devWindow.__spaceStationVendors = () => vendorsRef.current.map(vendor => ({
      id: vendor.id,
      designation: vendor.designation,
      name: vendor.name,
      specialty: vendor.specialty
    }));

    /**
     * Drive movement directly, in metres per second.
     *
     * Held keys are the honest input path but a useless probe instrument: the walk
     * is time-stepped and software rendering runs at a few frames a second, so
     * "hold forward for three seconds" covers a wildly different distance headless
     * than it does on a GPU. An explicit intent makes a collision assertion mean
     * something. Pass (0, 0) to stop.
     */
    devWindow.__spaceStationWalk = (forward: number, strafe: number) => {
      scripted.current = forward === 0 && strafe === 0 ? null : { forward, strafe };
    };

    /**
     * Is every stall staffed, and is every trader standing somewhere she fits?
     *
     * The interesting failure is not "no figures rendered" — it is a figure posted
     * inside her own shelving, which looks fine from the aisle and is wrong.
     */
    devWindow.__spaceStationStaffing = () => {
      const sites = spaceStationVendorSites(descriptor);
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
    devWindow.__spaceStationTeleportToVendor = (index: number) => {
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

    devWindow.__spaceStationTeleportToStoryTarget = () => {
      const objective = storyObjectiveRef.current;
      if (!objective) return null;
      const target = objective.target;
      const offset = objective.targetKind === 'airlock'
        ? Math.min(3.5, objective.reach * 0.55)
        : -Math.min(1.5, objective.reach * 0.35);
      const standAt: [number, number, number] = [
        target[0] + offset,
        target[1],
        target[2]
      ];
      walk.current = createWalkState(graph, standAt);
      applyEye();
      onCellChange(walk.current.cellId);
      // Station cells run along +X; face the target from the approach side.
      euler.current.y = -Math.PI / 2;
      euler.current.x = 0;
      camera.quaternion.setFromEuler(euler.current);
      return objective.id;
    };

    /**
     * Place the viewer inside a named cell at fractional footprint coordinates.
     *
     * Capture runs cannot walk there: the post chain drops software rendering to a
     * few frames a second, and locomotion is time-stepped, so holding forward covers
     * metres rather than hundreds of them. Teleporting keeps look-development frames
     * reproducible and fast without touching how the player actually moves.
     */
    devWindow.__spaceStationTeleport = (cellId: string, u = 0.5, v = 0.5) => {
      const cell = graph.cells.find(entry => entry.id === cellId);
      if (!cell) return false;
      const x = cell.min[0] + (cell.max[0] - cell.min[0]) * u;
      const z = cell.min[2] + (cell.max[2] - cell.min[2]) * v;
      walk.current = createWalkState(graph, [x, cell.min[1], z]);
      applyEye();
      onCellChange(walk.current.cellId);
      return true;
    };
    devWindow.__spaceStationLook = (yawRadians: number, pitchRadians = 0) => {
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
      delete devWindow.__spaceStationLook;
      delete devWindow.__spaceStationState;
      delete devWindow.__spaceStationTeleport;
      delete devWindow.__spaceStationTeleportToVendor;
      delete devWindow.__spaceStationTeleportToStoryTarget;
      delete devWindow.__spaceStationVendors;
      delete devWindow.__spaceStationWalk;
      delete devWindow.__spaceStationStaffing;
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

    const activeStoryObjective = storyObjectiveRef.current;
    const storyDistance = activeStoryObjective
      ? Math.hypot(
          walk.current.position[0] - activeStoryObjective.target[0],
          walk.current.position[1] - activeStoryObjective.target[1],
          walk.current.position[2] - activeStoryObjective.target[2]
        )
      : null;
    const roundedDistance = storyDistance === null ? null : Math.round(storyDistance * 2) / 2;
    if (roundedDistance !== storyDistanceRef.current) {
      storyDistanceRef.current = roundedDistance;
      onStoryDistance(roundedDistance);
    }
    const nextStoryNear = activeStoryObjective && storyDistance !== null
      && storyDistance <= activeStoryObjective.reach
      ? activeStoryObjective.id
      : null;
    if (nextStoryNear !== nearStoryRef.current) {
      nearStoryRef.current = nextStoryNear;
      onNearStoryTarget(nextStoryNear);
    }

    // Who is the player facing across a counter? Distance alone would put you in
    // conversation with whoever is behind you across a four-metre aisle.
    const reach = vendorInReach(
      vendors,
      walk.current.position,
      [forward.x, 0, forward.z]
    );
    const nextNear = nextStoryNear ? null : reach?.vendor.id ?? null;
    if (nextNear !== nearRef.current) {
      nearRef.current = nextNear;
      onNearVendor(nextNear);
    }

    // Standing near where the ship is clamped on. Generous, because the way out of
    // a place should not require finding a pixel.
    const lock = airlockRef.current;
    const toAirlock = Math.hypot(
      walk.current.position[0] - lock[0],
      walk.current.position[2] - lock[2]
    );
    const nextAirlock = walk.current.cellId === 'apron' && toAirlock <= AIRLOCK_REACH;
    if (nextAirlock !== nearAirlockRef.current) {
      nearAirlockRef.current = nextAirlock;
      onNearAirlock(nextAirlock);
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
function ApproachHud({
  readout,
  touch
}: {
  readout: React.MutableRefObject<ApproachReadout | null>;
  touch: boolean;
}) {
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
      <div style={touch ? touchApproachPanel : approachPanel} data-testid="spaceStation-approach-hud">
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
          {touch
            ? 'Left stick thrust · drag to look · LAND clearance'
            : 'WASD thrust · space/C up-down · shift boost · X hold station · mouse look'}
        </div>
      </div>
      {current.canDock && (
        <div
          style={clearancePrompt}
          data-testid="spaceStation-dock-prompt"
          role="status"
          aria-live="polite"
        >
          {touch ? 'LAND · request docking clearance' : '[F] request docking clearance'}
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

const touchApproachPanel: React.CSSProperties = {
  ...approachPanel,
  top: 'calc(12px + env(safe-area-inset-top, 0px))',
  bottom: 'auto',
  left: 'calc(12px + env(safe-area-inset-left, 0px))',
  right: 'calc(12px + env(safe-area-inset-right, 0px))',
  whiteSpace: 'normal'
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
  const touch = isTouchDevice();

  const skipSequence = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dockInputLocked(dock.current)) return;
    // Same transition as the keyboard path in WalkController. The next frame
    // observes `complete` and performs the normal arrival/departure callback;
    // touch only chooses when the choreography finishes, never where it leads.
    dock.current = skipDock(dock.current).state;
  }, [dock]);

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
  const departing = readout.direction === 'depart';

  return (
    <div
      style={dockLayer}
      data-testid="spaceStation-dock-overlay"
      onPointerDown={skipSequence}
      role="button"
      aria-label={touch ? 'Tap to skip docking sequence' : 'Click or press any key to skip docking sequence'}
    >
      <div style={{ ...dockBlackout, opacity: 1 - readout.reveal }} />
      <div style={{ ...dockLeaf, top: 0, height: leaf }} />
      <div style={{ ...dockLeaf, bottom: 0, height: leaf }} />
      <div style={{ ...dockPanel, opacity: readout.panelOpacity }}>
        <div style={{ color: WARM_INK, letterSpacing: '0.1em', marginBottom: 8 }}>
          {readout.title}
        </div>
        {/*
          Same three gauges either way, because they are the same three mechanisms.
          Only the words for their end states change, and they come from the
          readout's direction rather than from a second overlay that would have to
          be kept in step with this one.
        */}
        <DockLine
          label="clamps"
          value={readout.clamp}
          detail={departing ? (readout.clamp <= 0 ? 'released' : 'holding') : (readout.clamp >= 1 ? 'engaged' : 'driving')}
        />
        <DockLine
          label="lock pressure"
          value={readout.pressure}
          detail={`${readout.pressureKpa.toFixed(1)} / ${STATION_PRESSURE_KPA.toFixed(1)} kPa`}
        />
        <DockLine
          label="hatch"
          value={readout.hatch}
          detail={departing ? (readout.hatch <= 0 ? 'sealed' : 'cycling') : (readout.hatch >= 1 ? 'open' : 'cycling')}
        />
        <div style={{ color: DIM_INK, marginTop: 10, fontSize: 11 }}>
          {touch ? 'tap to skip' : 'any key or click to skip'}
        </div>
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
  pointerEvents: 'auto',
  touchAction: 'manipulation',
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

/** How near the lock you must stand before the way out is offered. */
const AIRLOCK_REACH = 9;

/** A single shared visual language for counter, issuer, and return-airlock goals. */
function StationStoryMarker({ objective }: { objective: StationStoryObjective }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.z = clock.elapsedTime * 0.55;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08;
    ring.current.scale.setScalar(pulse);
  });

  return (
    <group position={[objective.target[0], objective.target[1] + 2.2, objective.target[2]]}>
      <mesh ref={ring} renderOrder={1000}>
        <torusGeometry args={[0.62, 0.045, 8, 32]} />
        <meshBasicMaterial color="#ffb45a" transparent opacity={0.92} depthTest={false} />
      </mesh>
      <mesh renderOrder={1000}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color="#fff2d8" depthTest={false} />
      </mesh>
      <mesh position={[0, -1.1, 0]} renderOrder={999}>
        <cylinderGeometry args={[0.015, 0.015, 2, 6]} />
        <meshBasicMaterial color="#ffb45a" transparent opacity={0.42} depthTest={false} />
      </mesh>
    </group>
  );
}

function StationStoryHud({
  objective,
  distance
}: {
  objective: StationStoryObjective;
  distance: number | null;
}) {
  const step = deriveStationStoryStep();
  return (
    <aside style={stationStoryHud} data-testid="spaceStation-story-objective">
      <div style={{ color: DIM_INK, fontSize: 10, letterSpacing: '0.16em' }}>
        STATION VISIT · ISSUED COMPONENT
      </div>
      <div style={{ color: WARM_INK, marginTop: 6, letterSpacing: '0.06em' }}>
        {objective.markerLabel}
        {distance !== null ? ` · ${Math.max(0, Math.round(distance))}m` : ''}
      </div>
      <div style={{ marginTop: 8 }}>
        {objective.workOrder.map(line => <div key={line}>{line}</div>)}
      </div>
      {step === 'registry' && !hasMilestone(STATION_STORY_MILESTONES.designationPresented) && (
        <div style={{ color: DIM_INK, marginTop: 9 }}>(your body takes its place before the marker does.)</div>
      )}
      {step === 'issuer' && hasMilestone(STATION_STORY_MILESTONES.concourseEntered) && (
        <div style={{ color: DIM_INK, marginTop: 9 }}>(warmth you did not make.)</div>
      )}
      {step === 'depart' && (
        <div style={{ color: DIM_INK, marginTop: 9 }}>(one fire waiting. carry back what the world could not give.)</div>
      )}
    </aside>
  );
}

function StoryInteractionPrompt({
  objective,
  touch
}: {
  objective: StationStoryObjective;
  touch: boolean;
}) {
  return (
    <div
      style={storyInteractionPrompt}
      data-testid={objective.targetKind === 'registry'
        ? 'spaceStation-registry-prompt'
        : objective.targetKind === 'issuer'
          ? 'spaceStation-issuer-prompt'
          : 'spaceStation-story-airlock-prompt'}
      role="status"
      aria-live="polite"
    >
      {touch ? 'USE' : '[F]'} {objective.verb}
    </div>
  );
}

const stationStoryHud: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(16px + env(safe-area-inset-top, 0px))',
  left: 'calc(16px + env(safe-area-inset-left, 0px))',
  width: 'min(420px, calc(100vw - 32px))',
  padding: '12px 14px',
  color: INK,
  background: 'rgba(5,8,10,0.82)',
  borderLeft: '2px solid rgba(255,180,90,0.86)',
  borderTop: '1px solid rgba(228,236,231,0.13)',
  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  pointerEvents: 'none',
  zIndex: 34
};

const storyInteractionPrompt: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '58%',
  transform: 'translateX(-50%)',
  maxWidth: 'calc(100vw - 24px)',
  padding: '6px 12px',
  font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#77f0a1',
  background: 'rgba(6,8,10,0.82)',
  border: '1px solid rgba(119,240,161,0.34)',
  pointerEvents: 'none',
  whiteSpace: 'normal',
  textAlign: 'center',
  zIndex: 35
};

/** The way out. Same idiom as the counter prompt, because it is the same verb. */
function AirlockPrompt({ touch }: { touch: boolean }) {
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
      data-testid="spaceStation-airlock-prompt"
      role="status"
      aria-live="polite"
    >
      {touch ? 'USE · return to ship' : '[F] return to ship'}
    </div>
  );
}

/** The contextual prompt. One key, one verb, matching the shipped HUD idiom. */
function InteractionPrompt({ vendor, touch = isTouchDevice() }: { vendor: Vendor; touch?: boolean }) {
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
      data-testid="spaceStation-interaction-prompt"
      role="status"
      aria-live="polite"
    >
      {touch ? 'USE' : '[F]'} talk to {vendor.name}
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
  descriptor: ReturnType<typeof buildSpaceStationDescriptor>;
  problems: string[];
  population: number;
}) {
  const [diagnostics, setDiagnostics] = useState(spaceStationInteriorDiagnostics());
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
    const timer = window.setInterval(() => setDiagnostics(spaceStationInteriorDiagnostics()), 250);
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
      data-testid="spaceStation-sandbox-hud"
    >
      {`SPACE_STATION SANDBOX — ${descriptor.worldId}
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
