import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpaceshipPlaceholder from '../../components/SpaceshipPlaceholder.tsx';
import type { CommandContext } from '../../game/commands.ts';
import {
  clearStationAccessSource,
  setStationAccessSource
} from '../../game/data/stations.ts';
import {
  WRECK_BENCH_STATIONS,
  WRECK_SALVAGE_MILESTONE,
  ensureWreckBenchStationEvents
} from '../../game/systems/shipRepairTransactions.ts';
import {
  getShipRepairStage,
  getShipRestorationSnapshot,
  subscribeShipRestoration
} from '../../game/systems/shipRestoration.ts';
import { hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { getPlayerLook, getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { atLeast, type ShipRepairStage } from '../emergentCapabilities.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { useStoryState } from '../storyState.ts';
import {
  WRECK_RECONSTRUCTION_EVENT_IDS,
  isWreckBenchStationAccessActive,
  getWreckReconstructionAction,
  performWreckReconstructionAction,
  wreckTiltForStage
} from '../wreckReconstruction.ts';
import {
  SHIP_REST_CLEARANCE,
  shipParkedOrientation,
  shipSurfaceUp
} from '../../utils/shipDesign.ts';
import { getPodImpactPose } from './storyWorld.ts';
import { hifiWreckHandle, useHifiWreckConverted } from './hifiWreck.ts';
import { registerEmergentMovieWreckBinding } from '../emergentMovieRuntime.ts';
import { hasBankedKestrelKeelMemory } from '../emergentUniqueItems.ts';
import {
  commitWreckDiagnosis,
  hasFirstHoverGroundedReturn,
  hasWreckDiagnosisReceipt,
  registerPhysicalWreckBinding,
  WRECK_DIAGNOSIS_REACH
} from '../reconstructionEmbodiment.ts';
import {
  beginReconstructionCalibration,
  getReconstructionCalibrationSnapshot,
  resetReconstructionCalibrationRuntime,
  sampleReconstructionCalibrationFrame,
  tickReconstructionCalibration
} from '../reconstructionCalibration.ts';
import {
  beginPhysicalBoarding,
  canCommitStagedShipEntry,
  cancelPhysicalBoarding,
  getPhysicalBoardingSnapshot,
  hasCompletedPhysicalBoarding,
  isPhysicalBoardingInputLocked,
  isPhysicalBoardingInProgress,
  isPhysicalBoardingVehicleControlLocked,
  resetPhysicalBoardingRuntime,
  tickPhysicalBoarding
} from '../physicalBoarding.ts';
import {
  getSpaceFlightSnapshot,
  enterShip,
  setShipBoardingInterceptor,
  setShipExitInterceptor
} from '../../state/spaceFlight.ts';
import { isBoardable } from '../../state/shipProximity.ts';
import { clearCinematicCameraPose, setCinematicCameraPose } from '../cinematicLook.ts';
import { isStoryPaused } from '../storyClock.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { attendWreckScar } from '../wreckScarObservation.ts';
import {
  SANDBOX_FOV,
  setStoryMoveScale,
  setStoryTargetFov
} from '../storyInputPolicy.ts';
import {
  BOARDING_HATCH_TARGET_LOCAL,
  BOARDING_HATCH_THROAT_FOCUS_LOCAL,
  BOARDING_HATCH_HINGE_LOCAL,
  BOARDING_HATCH_LEAF_CENTER_FROM_HINGE,
  BOARDING_HATCH_LEAF_SIZE,
  BOARDING_HATCH_FRAME_PRIORITY,
  BOARDING_TRANSACTION_FRAME_PRIORITY,
  boardingCameraPoseWeight,
  boardingHatchRotationX,
  sampleBoardingCameraPathLocal
} from './hifiWreckComposition.ts';

// --- The high-fidelity crash wreck ---------------------------------------------
//
// At the A3 material awakening the voxel DescentPod converts into the real ship:
// the pod's smoking box wreck unmounts (DescentPod self-hides on the same
// milestone) and the hi-fi hull settles into the impact site in a crashed
// attitude — tilted, dug in, oriented to the local surface normal. It remains a
// landmark until restoration reaches flight_ready; then this same exterior,
// rather than a duplicate ship, publishes the boarding interaction.
//
// Keyed on the persisted a3 milestone, so a resume/deep-link past the awakening
// loads straight into the hi-fi wreck. When the conversion happens with the
// player present it's a one-frame swap (pod out, ship in) — soft enough.

interface HifiWreckProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}

const WORKSTATION_REACH = 4.4;
const DIAGNOSIS_TARGET_LOCAL = new THREE.Vector3(0.34, 0.34, 1.54);
// Directly above the live workbench approach: manual and movie-mode players
// must use real lift to reach this physical route socket, then return to ground.
const HOVER_SOCKET_LOCAL = new THREE.Vector3(0.12, 2.25, 2.28);
const HATCH_TARGET_LOCAL = new THREE.Vector3(...BOARDING_HATCH_TARGET_LOCAL);
const _diagnosisEye = new THREE.Vector3();
const _diagnosisLook = new THREE.Vector3();
const _diagnosisDirection = new THREE.Vector3();
const _boardingStartEye = new THREE.Vector3();
const _boardingEye = new THREE.Vector3();
const _boardingTarget = new THREE.Vector3();
const _boardingApproach = new THREE.Vector3();
const _boardingLocalStartEye = new THREE.Vector3();
const _calibrationEye = new THREE.Vector3();
const _calibrationTarget = new THREE.Vector3();

const HifiWreck: React.FC<HifiWreckProps> = ({ planetSize, terrainSeed, commandContext }) => {
  const converted = useHifiWreckConverted();
  const story = useStoryState();
  const repairStage = useSyncExternalStore(
    subscribeShipRestoration,
    getShipRepairStage,
    getShipRepairStage
  );
  const salvageClaimed = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(WRECK_SALVAGE_MILESTONE, commandContext.actorId),
    () => false
  );
  const diagnosed = useSyncExternalStore(
    subscribeProgression,
    () => hasWreckDiagnosisReceipt(commandContext.actorId),
    () => false
  );
  const impact = useMemo(() => getPodImpactPose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  // The impact pose is the visible ground surface. Put the hull origin at the
  // same validated 2.5wu rest height used by landing/spawn authority so its
  // insect legs contact terrain and the fixed wreck remains boardable.
  const shipPosition = useMemo(
    () => impact.position.clone().addScaledVector(impact.up, SHIP_REST_CLEARANCE),
    [impact]
  );
  const crashedTilt = wreckTiltForStage(repairStage);
  const wreckQuaternion = useMemo(() => {
    const quaternion = shipParkedOrientation(shipPosition);
    if (crashedTilt) {
      quaternion.multiply(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(crashedTilt * 0.7, 0, crashedTilt)
      ));
    }
    return quaternion;
  }, [crashedTilt, shipPosition]);
  const wreckInverseQuaternion = useMemo(
    () => wreckQuaternion.clone().invert(),
    [wreckQuaternion]
  );
  const workstationPosition = useMemo(
    () => new THREE.Vector3(0.1, 0.22, 2.55).applyQuaternion(wreckQuaternion).add(shipPosition),
    [shipPosition, wreckQuaternion]
  );
  const diagnosisTarget = useMemo(
    () => DIAGNOSIS_TARGET_LOCAL.clone().applyQuaternion(wreckQuaternion).add(shipPosition),
    [shipPosition, wreckQuaternion]
  );
  const hoverSocketPosition = useMemo(
    () => HOVER_SOCKET_LOCAL.clone().applyQuaternion(wreckQuaternion).add(shipPosition),
    [shipPosition, wreckQuaternion]
  );
  const hatchTarget = useMemo(
    () => HATCH_TARGET_LOCAL.clone().applyQuaternion(wreckQuaternion).add(shipPosition),
    [shipPosition, wreckQuaternion]
  );
  const surfaceUp = useMemo(() => shipSurfaceUp(shipPosition), [shipPosition]);
  const livePlayerPosition = useMemo(() => getPlayerWorldPosition(), []);
  const stationSourceId = useMemo(
    () => `story-wreck-bench:${commandContext.actorId}:${commandContext.world.worldId}`,
    [commandContext.actorId, commandContext.world.worldId]
  );
  const stationAccessPublished = useRef(false);
  const boardingCameraOwned = useRef(false);
  const calibrationCameraOwned = useRef(false);
  const boardingWindowFocused = useRef(
    typeof document === 'undefined' || document.hasFocus()
  );

  useFrame(() => {
    livePlayerPosition.copy(getPlayerWorldPosition());
    const accessible = converted && isWreckBenchStationAccessActive(
      repairStage,
      livePlayerPosition.distanceToSquared(workstationPosition)
    );
    if (accessible === stationAccessPublished.current) return;
    stationAccessPublished.current = accessible;
    if (accessible) setStationAccessSource(stationSourceId, WRECK_BENCH_STATIONS);
    else clearStationAccessSource(stationSourceId);
  });

  useEffect(() => () => {
    stationAccessPublished.current = false;
    clearStationAccessSource(stationSourceId);
  }, [stationSourceId]);

  // Reconstruct the station facts on reload/hydration as well as on the live
  // bench transaction. Stable ids make repeated mounts and transaction replay free.
  useEffect(() => {
    if (!atLeast(repairStage, 'bench_online')) return;
    const benchEventId = getShipRestorationSnapshot().repairHistory.find(
      entry => entry.to === 'bench_online'
    )?.eventId ?? WRECK_RECONSTRUCTION_EVENT_IDS.stage('bench_online');
    ensureWreckBenchStationEvents(benchEventId, commandContext.actorId);
  }, [commandContext.actorId, repairStage]);

  useEffect(() => {
    if (!converted || !story.active || String(story.beat) !== 'ch7-reconstruct') return;
    return registerStoryInteraction((camera, playerPosition) => {
      if (!diagnosed) {
        const distanceSquared = playerPosition.distanceToSquared(diagnosisTarget);
        if (distanceSquared > WRECK_DIAGNOSIS_REACH ** 2) return null;
        if (camera) {
          camera.getWorldPosition(_diagnosisEye);
          camera.getWorldDirection(_diagnosisLook);
        } else {
          // Movie-mode resolves the same interaction without passing the R3F
          // camera. Its published embodied look is still the physical gaze proof.
          const look = getPlayerLook();
          const up = getPlayerUp();
          _diagnosisEye.copy(playerPosition).addScaledVector(up, 1.55);
          _diagnosisLook.copy(look.forward)
            .multiplyScalar(Math.cos(look.pitch))
            .addScaledVector(up, Math.sin(look.pitch))
            .normalize();
        }
        _diagnosisDirection.copy(diagnosisTarget).sub(_diagnosisEye).normalize();
        const viewAlignment = _diagnosisLook.dot(_diagnosisDirection);
        if (viewAlignment < 0.58) return null;
        return {
          id: 'story-wreck-diagnosis',
          verb: 'Trace Wreck Relationships',
          perform: () => {
            const receipt = commitWreckDiagnosis({
              actorId: commandContext.actorId,
              worldId: commandContext.world.worldId,
              storyBeat: story.beat,
              repairStage,
              keelMemoryBanked: hasBankedKestrelKeelMemory(commandContext.actorId),
              distanceSquared,
              viewAlignment
            });
            if (receipt.ok) {
              attendWreckScar(
                repairStage,
                commandContext.actorId,
                commandContext.world.worldId
              );
            }
          }
        };
      }
      if (playerPosition.distanceToSquared(workstationPosition) <= WORKSTATION_REACH ** 2) {
        const action = getWreckReconstructionAction(commandContext.actorId);
        if (action) {
          return {
            id: action.interactionId,
            verb: action.verb,
            perform: () => {
              performWreckReconstructionAction(action, commandContext.actorId, commandContext);
            }
          };
        }
      }

      // Optional free attention: when no required bench action owns F, the
      // player may revisit the same scar across persisted repair states. This
      // never advances Story and never takes the camera.
      const distanceSquared = playerPosition.distanceToSquared(diagnosisTarget);
      if (distanceSquared > WRECK_DIAGNOSIS_REACH ** 2) return null;
      if (camera) {
        camera.getWorldPosition(_diagnosisEye);
        camera.getWorldDirection(_diagnosisLook);
      } else {
        const look = getPlayerLook();
        const up = getPlayerUp();
        _diagnosisEye.copy(playerPosition).addScaledVector(up, 1.55);
        _diagnosisLook.copy(look.forward)
          .multiplyScalar(Math.cos(look.pitch))
          .addScaledVector(up, Math.sin(look.pitch))
          .normalize();
      }
      _diagnosisDirection.copy(diagnosisTarget).sub(_diagnosisEye).normalize();
      if (_diagnosisLook.dot(_diagnosisDirection) < 0.68) return null;
      return {
        id: 'story-wreck-scar-attend',
        verb: 'Inspect Persistent Scar',
        perform: () => {
          attendWreckScar(
            repairStage,
            commandContext.actorId,
            commandContext.world.worldId
          );
        }
      };
    });
  }, [
    commandContext.actorId,
    commandContext.world.worldId,
    converted,
    diagnosed,
    diagnosisTarget,
    repairStage,
    story.active,
    story.beat,
    workstationPosition
  ]);

  useEffect(() => {
    if (!converted || !story.active || String(story.beat) !== 'ch7-board') return;
    return registerStoryInteraction((_camera, playerPosition) => {
      // A crash/reload after the pressure-seal receipt may restore on foot. The
      // durable receipt licenses the ordinary board resolver to recover ownership
      // without replaying the one-shot seal scene.
      if (hasCompletedPhysicalBoarding(commandContext.actorId, commandContext.world.worldId)) {
        return null;
      }
      const boarding = getPhysicalBoardingSnapshot();
      if (isPhysicalBoardingInputLocked() && boarding.actorId === commandContext.actorId) {
        return {
          id: 'story-board-cancel',
          verb: 'Step Back From Hatch',
          perform: () => { cancelPhysicalBoarding('player-cancelled'); }
        };
      }
      if (repairStage !== 'flight_ready'
        || !isBoardable()
        || playerPosition.distanceToSquared(shipPosition) > 3.8 ** 2) return null;
      return {
        id: 'story-board-hatch',
        verb: 'Enter Through Hatch',
        perform: () => {
          beginPhysicalBoarding({
            actorId: commandContext.actorId,
            worldId: commandContext.world.worldId,
            storyBeat: story.beat,
            repairStage,
            phase: getSpaceFlightSnapshot().phase,
            controlMode: getSpaceFlightSnapshot().controlMode,
            boardable: isBoardable(),
            exteriorPosition: [playerPosition.x, playerPosition.y, playerPosition.z],
            surfaceUp: [surfaceUp.x, surfaceUp.y, surfaceUp.z],
            shipPosition: [shipPosition.x, shipPosition.y, shipPosition.z]
          });
        }
      };
    });
  }, [
    commandContext.actorId,
    commandContext.world.worldId,
    converted,
    repairStage,
    shipPosition,
    story.active,
    story.beat,
    surfaceUp
  ]);

  useEffect(() => registerPhysicalWreckBinding({
    actorId: commandContext.actorId,
    worldId: commandContext.world.worldId,
    position: [shipPosition.x, shipPosition.y, shipPosition.z],
    hoverSocketPosition: [
      hoverSocketPosition.x,
      hoverSocketPosition.y,
      hoverSocketPosition.z
    ]
  }), [
    commandContext.actorId,
    commandContext.world.worldId,
    hoverSocketPosition,
    shipPosition
  ]);

  useEffect(() => {
    if (!converted || !story.active || story.beat !== 'ch7-reconstruct') return;
    beginReconstructionCalibration({
      actorId: commandContext.actorId,
      worldId: commandContext.world.worldId,
      storyBeat: story.beat,
      repairStage,
      groundedReturnComplete: hasFirstHoverGroundedReturn(commandContext.actorId)
    });
  }, [
    commandContext.actorId,
    commandContext.world.worldId,
    converted,
    repairStage,
    story.active,
    story.beat
  ]);

  // Intercept every ch7 entry path, including movie-mode's direct enterShip(),
  // so no controller can bypass the physical hatch transaction.
  useEffect(() => setShipBoardingInterceptor(() => {
    if (hasCompletedPhysicalBoarding(commandContext.actorId, commandContext.world.worldId)) return true;
    if (!story.active) return true;
    // Flight readiness lands 2.25 seconds before the director opens the
    // boarding beat. The generic ship prompt/direct enterShip path must stay
    // closed across that handoff or the player can become the vehicle owner
    // outside the hatch transaction and strand ch7-board permanently.
    if (String(story.beat) !== 'ch7-board') return false;
    if (canCommitStagedShipEntry()) return true;
    const player = getPlayerWorldPosition();
    const flight = getSpaceFlightSnapshot();
    beginPhysicalBoarding({
      actorId: commandContext.actorId,
      worldId: commandContext.world.worldId,
      storyBeat: story.beat,
      repairStage,
      phase: flight.phase,
      controlMode: flight.controlMode,
      boardable: isBoardable(),
      exteriorPosition: [player.x, player.y, player.z],
      surfaceUp: [surfaceUp.x, surfaceUp.y, surfaceUp.z],
      shipPosition: [shipPosition.x, shipPosition.y, shipPosition.z]
    });
    return false;
  }), [
    commandContext.actorId,
    commandContext.world.worldId,
    repairStage,
    shipPosition,
    story.active,
    story.beat,
    surfaceUp
  ]);

  // Control transfers before the pressure boundary closes. Guard every exit
  // caller (UI, automation, or future controller code), not just the F handler.
  useEffect(() => setShipExitInterceptor(
    () => !isPhysicalBoardingVehicleControlLocked()
  ), []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && getSpaceFlightSnapshot().controlMode === 'fps') {
        cancelPhysicalBoarding('escape');
      }
    };
    const onBlur = () => {
      boardingWindowFocused.current = false;
      if (getSpaceFlightSnapshot().controlMode === 'fps') {
        cancelPhysicalBoarding('focus-lost');
      }
    };
    const onFocus = () => {
      boardingWindowFocused.current = true;
    };
    window.addEventListener('keydown', onEscape);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (story.active && String(story.beat) === 'ch7-board') return;
    if (isPhysicalBoardingInProgress()) resetPhysicalBoardingRuntime('story-boundary');
  }, [story.active, story.beat]);

  useFrame((_state, rawDt) => {
    const calibrationBefore = getReconstructionCalibrationSnapshot();
    if (calibrationBefore.phase === 'running') {
      tickReconstructionCalibration({
        dt: rawDt,
        paused: isStoryPaused(),
        focused: boardingWindowFocused.current
          && (typeof document === 'undefined' || !document.hidden)
      });
      const calibration = getReconstructionCalibrationSnapshot();
      if (calibration.phase === 'running') {
        const reducedMotion = typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const frame = sampleReconstructionCalibrationFrame(calibration.elapsed, reducedMotion);
        _calibrationEye.set(...frame.eyeLocal).applyQuaternion(wreckQuaternion).add(shipPosition);
        _calibrationTarget.set(...frame.targetLocal).applyQuaternion(wreckQuaternion).add(shipPosition);
        setCinematicCameraPose(
          _calibrationEye,
          _calibrationTarget,
          surfaceUp,
          frame.weight
        );
        setStoryMoveScale(0);
        setStoryTargetFov(frame.fov);
        calibrationCameraOwned.current = true;
      }
    } else if (calibrationCameraOwned.current) {
      clearCinematicCameraPose();
      setStoryMoveScale(1);
      setStoryTargetFov(SANDBOX_FOV);
      calibrationCameraOwned.current = false;
    }

    const before = getPhysicalBoardingSnapshot();
    if (before.phase === 'idle' || before.phase === 'complete') return;
    const player = getPlayerWorldPosition();
    const flight = getSpaceFlightSnapshot();
    const effects = tickPhysicalBoarding({
      actorId: commandContext.actorId,
      worldId: commandContext.world.worldId,
      storyBeat: story.beat,
      phase: flight.phase,
      controlMode: flight.controlMode,
      boardable: isBoardable(),
      playerPosition: [player.x, player.y, player.z],
      focused: boardingWindowFocused.current
        && (typeof document === 'undefined' || !document.hidden),
      paused: isStoryPaused(),
      dt: rawDt
    });
    const boarding = getPhysicalBoardingSnapshot();
    if (boarding.phase === 'hatch_entering' || boarding.phase === 'transfer_requested') {
      const start = boarding.exteriorPosition;
      const up = boarding.surfaceUp;
      if (start && up) {
        _boardingStartEye.set(start[0], start[1], start[2])
          .addScaledVector(_boardingApproach.set(up[0], up[1], up[2]), 1.55);
        _boardingLocalStartEye.copy(_boardingStartEye)
          .sub(shipPosition)
          .applyQuaternion(wreckInverseQuaternion);
        const pathEye = sampleBoardingCameraPathLocal([
          _boardingLocalStartEye.x,
          _boardingLocalStartEye.y,
          _boardingLocalStartEye.z
        ], boarding.hatchProgress);
        _boardingEye.set(...pathEye)
          .applyQuaternion(wreckQuaternion)
          .add(shipPosition);
        _boardingTarget.set(...BOARDING_HATCH_THROAT_FOCUS_LOCAL)
          .applyQuaternion(wreckQuaternion)
          .add(shipPosition);
        setCinematicCameraPose(
          _boardingEye,
          _boardingTarget,
          surfaceUp,
          boardingCameraPoseWeight(boarding.hatchProgress)
        );
        boardingCameraOwned.current = true;
      }
    } else if (boardingCameraOwned.current) {
      clearCinematicCameraPose();
      boardingCameraOwned.current = false;
    }
    if (effects.includes('request-vehicle-transfer')) {
      playSfx('boardShip');
      enterShip();
    }
  }, BOARDING_TRANSACTION_FRAME_PRIORITY);

  useEffect(() => () => {
    if (boardingCameraOwned.current) clearCinematicCameraPose();
    if (calibrationCameraOwned.current) {
      clearCinematicCameraPose();
      setStoryMoveScale(1);
      setStoryTargetFov(SANDBOX_FOV);
    }
    resetReconstructionCalibrationRuntime();
    if (isPhysicalBoardingInProgress()) resetPhysicalBoardingRuntime('wreck-unmounted');
  }, []);

  // Publish the handle for the copy agent: the impact site is known while the
  // wreck is mounted (a story world); `converted` flips at the awakening.
  useEffect(() => {
    hifiWreckHandle.position = shipPosition;
    hifiWreckHandle.workstationPosition = workstationPosition;
    hifiWreckHandle.diagnosisTarget = diagnosisTarget;
    hifiWreckHandle.hoverSocketPosition = hoverSocketPosition;
    hifiWreckHandle.hatchTarget = hatchTarget;
    return () => {
      hifiWreckHandle.position = null;
      hifiWreckHandle.workstationPosition = null;
      hifiWreckHandle.diagnosisTarget = null;
      hifiWreckHandle.hoverSocketPosition = null;
      hifiWreckHandle.hatchTarget = null;
    };
  }, [diagnosisTarget, hatchTarget, hoverSocketPosition, shipPosition, workstationPosition]);
  useEffect(() => registerEmergentMovieWreckBinding({
    commandContext,
    workstationPosition
  }), [commandContext, workstationPosition]);
  useEffect(() => {
    hifiWreckHandle.converted = converted;
    return () => {
      hifiWreckHandle.converted = false;
    };
  }, [converted]);

  if (!converted) return null;

  return (
    <>
      <SpaceshipPlaceholder
        position={shipPosition}
        planetSize={planetSize}
        terrainSeed={terrainSeed}
        worldId={commandContext.world.worldId}
        activeApproach={false}
        playerPosition={livePlayerPosition}
        interactive={repairStage === 'flight_ready' && (
          !story.active
          || String(story.beat) === 'ch7-board'
          || hasCompletedPhysicalBoarding(commandContext.actorId, commandContext.world.worldId)
        )}
        crashedTilt={crashedTilt}
        restorationStage={repairStage}
      />
      <group
        name="story-wreck-reconstruction"
        position={shipPosition}
        quaternion={wreckQuaternion}
      >
        <WreckStageAdditions
          stage={repairStage}
          salvageClaimed={salvageClaimed}
          diagnosed={diagnosed}
        />
      </group>
    </>
  );
};

const WreckStageAdditions: React.FC<{
  stage: ShipRepairStage;
  salvageClaimed: boolean;
  diagnosed: boolean;
}> = ({ stage, salvageClaimed, diagnosed }) => {
  const bench = atLeast(stage, 'bench_online');
  const frame = atLeast(stage, 'frame_restored');
  const sealed = atLeast(stage, 'hull_sealed');
  const lift = atLeast(stage, 'lift_online');
  const ready = stage === 'flight_ready';

  return (
    <>
      {!sealed && <WreckDamagedSkeleton frameRestored={frame} benchOnline={bench} />}

      {/* The impact scar remains legible even as the same hull is restored. */}
      <mesh position={[0.32, 0.2, 1.56]} rotation={[0.18, 0.08, -0.16]}>
        <boxGeometry args={[1.65, 0.08, 0.36]} />
        <meshStandardMaterial
          color={sealed ? '#788a87' : '#211f1c'}
          emissive={sealed ? '#213d3d' : '#080706'}
          emissiveIntensity={sealed ? 0.32 : 0.04}
          roughness={sealed ? 0.46 : 0.98}
          metalness={sealed ? 0.62 : 0.18}
        />
      </mesh>

      {diagnosed && !frame && <WreckRelationshipProjection />}

      {!salvageClaimed && (
        <group position={[0.1, 0.18, 2.55]} rotation={[0, -0.16, 0]}>
          <mesh position={[-0.58, 0.16, 0.05]} rotation={[0.12, 0.22, -0.06]}>
            <boxGeometry args={[0.84, 0.3, 0.48]} />
            <meshStandardMaterial color="#554d43" roughness={0.88} metalness={0.34} />
          </mesh>
          <mesh position={[0.35, 0.12, -0.08]} rotation={[-0.08, -0.28, 0.12]}>
            <boxGeometry args={[0.72, 0.22, 0.32]} />
            <meshStandardMaterial color="#39433f" roughness={0.82} metalness={0.48} />
          </mesh>
          <mesh position={[0.02, 0.38, 0.12]} rotation={[0, 0, 0.34]}>
            <boxGeometry args={[1.12, 0.09, 0.12]} />
            <meshStandardMaterial color="#796650" roughness={0.72} metalness={0.55} />
          </mesh>
        </group>
      )}

      {bench && (
        <group position={[0.1, 0.2, 2.55]}>
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[1.7, 0.14, 0.82]} />
            <meshStandardMaterial color="#475754" roughness={0.54} metalness={0.62} />
          </mesh>
          {[-0.68, 0.68].map(x => (
            <mesh key={x} position={[x, 0.02, 0]}>
              <boxGeometry args={[0.11, 0.52, 0.58]} />
              <meshStandardMaterial color="#303b39" roughness={0.7} metalness={0.5} />
            </mesh>
          ))}
          <mesh position={[-0.38, 0.4, 0]} rotation={[-0.18, 0, 0]}>
            <boxGeometry args={[0.42, 0.12, 0.48]} />
            <meshStandardMaterial color="#86d8d2" emissive="#248b89" emissiveIntensity={0.85} metalness={0.5} roughness={0.24} />
          </mesh>
          <mesh position={[0.38, 0.4, 0]} rotation={[-0.18, 0, 0]}>
            <boxGeometry args={[0.42, 0.12, 0.48]} />
            <meshStandardMaterial color="#ed9d58" emissive="#a74d1d" emissiveIntensity={0.7} metalness={0.48} roughness={0.3} />
          </mesh>
        </group>
      )}

      {frame && (
        <>
          {[-1, 1].map(side => (
            <mesh key={side} position={[-0.12, 0.08, side * 1.42]} rotation={[0, 0, side * 0.05]}>
              <boxGeometry args={[3.3, 0.12, 0.13]} />
              <meshStandardMaterial color="#6d817c" roughness={0.42} metalness={0.78} />
            </mesh>
          ))}
          <mesh position={[-1.18, 0.2, 0]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.18, 0.18, 2.62]} />
            <meshStandardMaterial color="#657873" roughness={0.44} metalness={0.74} />
          </mesh>
        </>
      )}

      {sealed && (
        <>
          {[-0.7, 0, 0.7].map(z => (
            <mesh key={z} position={[0.42, 0.34, z]} rotation={[0, 0, -0.12]}>
              <boxGeometry args={[1.26, 0.07, 0.46]} />
              <meshStandardMaterial color="#81948f" roughness={0.38} metalness={0.7} />
            </mesh>
          ))}
        </>
      )}

      {lift && (
        <>
          {[-0.88, 0.88].map(z => (
            <group key={z} position={[-0.15, -0.34, z]} rotation={[0, 0, Math.PI / 2]}>
              <mesh>
                <cylinderGeometry args={[0.2, 0.26, 0.62, 8]} />
                <meshStandardMaterial color="#526866" roughness={0.34} metalness={0.78} />
              </mesh>
              <mesh position={[0, 0.33, 0]}>
                <circleGeometry args={[0.15, 8]} />
                <meshStandardMaterial color="#bafaff" emissive="#42dbe8" emissiveIntensity={ready ? 1.8 : 0.9} />
              </mesh>
            </group>
          ))}
          {!ready && (
            <group name="wreck-upper-route-socket" position={HOVER_SOCKET_LOCAL}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.34, 0.055, 6, 16]} />
                <meshStandardMaterial
                  color="#d9fff5"
                  emissive="#3be0d2"
                  emissiveIntensity={1.2}
                  roughness={0.26}
                  metalness={0.48}
                />
              </mesh>
              <mesh>
                <octahedronGeometry args={[0.17, 0]} />
                <meshStandardMaterial color="#ffc27a" emissive="#c7652a" emissiveIntensity={0.9} />
              </mesh>
            </group>
          )}
        </>
      )}

      {ready && (
        <>
          <mesh position={[-1.78, 0.98, 0]} rotation={[0, 0, 0.04]}>
            <boxGeometry args={[0.12, 0.54, 0.12]} />
            <meshStandardMaterial color="#ffc27a" emissive="#ff7a2d" emissiveIntensity={1.4} metalness={0.35} roughness={0.26} />
          </mesh>
          <PhysicalHatch />
        </>
      )}
    </>
  );
};

/**
 * The wreck begins as a recognizable but unsupported Kestrel skeleton. It is
 * removed only when the persisted hull-sealed stage reveals the same complete
 * exterior, so no intact powered ship hides beneath early repair props.
 */
const WreckDamagedSkeleton: React.FC<{
  frameRestored: boolean;
  benchOnline: boolean;
}> = ({ frameRestored, benchOnline }) => (
  <group name="wreck-damaged-kestrel-skeleton">
    <mesh position={[-0.15, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.38, 0.5, 3.25, 6, 1, false]} />
      <meshStandardMaterial
        color={frameRestored ? '#596b68' : '#272a28'}
        roughness={frameRestored ? 0.56 : 0.92}
        metalness={frameRestored ? 0.62 : 0.28}
        flatShading
      />
    </mesh>
    {[-0.95, -0.2, 0.55].map((x, index) => (
      <mesh key={x} position={[x, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56 - index * 0.05, 0.045, 4, 6]} />
          <meshStandardMaterial color={frameRestored ? '#7c918b' : '#3d413d'} metalness={0.72} roughness={0.52} />
      </mesh>
    ))}
    {!frameRestored && (
      <>
        {/* Bench-facing slab: canted and narrowed so it reads as debris
            without filling the interaction camera's near field. */}
        <mesh position={[-0.72, -0.2, 1.34]} rotation={[0.38, -0.42, 0.48]}>
          <boxGeometry args={[1.34, 0.065, 0.58]} />
          <meshStandardMaterial color="#343735" roughness={0.9} metalness={0.34} />
        </mesh>
        <mesh position={[-0.72, -0.18, -1.38]} rotation={[-0.18, 0.2, -0.35]}>
          <boxGeometry args={[1.72, 0.07, 1.02]} />
          <meshStandardMaterial color="#292d2c" roughness={0.94} metalness={0.3} />
        </mesh>
      </>
    )}
    <mesh position={[0.73, 0.48, 0]} scale={[0.72, 0.42, 0.5]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={benchOnline ? '#4f7778' : '#2c3535'}
        emissive={benchOnline ? '#163b3e' : '#030505'}
        emissiveIntensity={benchOnline ? 0.45 : 0.03}
        wireframe
        roughness={0.78}
        metalness={0.5}
      />
    </mesh>
    {frameRestored && [-1, 1].flatMap(side => [0.8, -0.9].map((x, index) => (
      <group key={`${side}:${x}`}>
        <mesh position={[x, -0.88, side * (0.62 + index * 0.12)]} rotation={[side * 0.18, 0, side * 0.2]}>
          <boxGeometry args={[0.1, 1.8, 0.12]} />
          <meshStandardMaterial color="#647874" roughness={0.5} metalness={0.7} />
        </mesh>
        <mesh position={[x + (index ? -0.18 : 0.18), -1.78, side * (0.82 + index * 0.16)]}>
          <boxGeometry args={[0.48, 0.08, 0.28]} />
          <meshStandardMaterial color="#4a5c59" roughness={0.64} metalness={0.62} />
        </mesh>
      </group>
    )))}
  </group>
);

const WreckRelationshipProjection: React.FC = () => (
  <group
    name="wreck-relationship-projection"
    position={[-0.96, 0.68, 0.42]}
    scale={0.72}
  >
    {[
      { position: [0.16, 0.12, 0.32] as const, scale: [0.045, 0.045, 0.56] as const, color: '#9fe8df' },
      { position: [-0.18, 0.02, 0] as const, scale: [0.68, 0.045, 0.045] as const, color: '#ffc27a' },
      { position: [0.04, 0.22, -0.3] as const, scale: [0.045, 0.045, 0.4] as const, color: '#9fe8df' }
    ].map((trace, index) => (
      <mesh key={index} position={trace.position} scale={trace.scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={trace.color}
          transparent
          opacity={index === 1 ? 0.38 : 0.3}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    ))}
    <mesh position={[0.02, 0.12, 0.68]}>
      <octahedronGeometry args={[0.11, 0]} />
      <meshBasicMaterial
        color="#ffc27a"
        transparent
        opacity={0.46}
        wireframe
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  </group>
);

const PhysicalHatch: React.FC = () => {
  const hinge = useRef<THREE.Group>(null);
  // CameraControls consumes the pose authored by the previous normal-priority
  // boarding tick. Sampling the leaf first gives both consumers that same
  // progress while the authoritative transaction retains its original order.
  useFrame(() => {
    if (!hinge.current) return;
    hinge.current.rotation.x = boardingHatchRotationX(
      getPhysicalBoardingSnapshot().hatchProgress
    );
  }, BOARDING_HATCH_FRAME_PRIORITY);
  return (
    <>
      {/* Opaque rim + short pocket terminate the exterior view before vehicle
          ownership. This remains legible with bloom/transparency disabled. */}
      <group name="physical-hatch-throat">
        {[-0.49, 0.49].map(z => (
          <mesh key={`throat-z:${z}`} position={[0.5, 0.9, z]}>
            <boxGeometry args={[1.2, 0.26, 0.14]} />
            <meshStandardMaterial color="#071013" emissive="#09242a" emissiveIntensity={0.24} roughness={0.86} metalness={0.42} />
          </mesh>
        ))}
        {[-0.53, 0.53].map(x => (
          <mesh key={`throat-x:${x}`} position={[0.5 + x, 0.9, 0]}>
            <boxGeometry args={[0.14, 0.26, 0.84]} />
            <meshStandardMaterial color="#071013" emissive="#09242a" emissiveIntensity={0.24} roughness={0.86} metalness={0.42} />
          </mesh>
        ))}
        <mesh name="physical-hatch-threshold" position={[0.5, 0.74, 0]}>
          <boxGeometry args={[0.9, 0.08, 0.72]} />
          <meshStandardMaterial color="#04090b" emissive="#06171b" emissiveIntensity={0.2} roughness={0.92} metalness={0.28} />
        </mesh>
        <mesh position={[0.5, 0.8, 0.34]}>
          <boxGeometry args={[0.72, 0.035, 0.055]} />
          <meshStandardMaterial color="#ffc27a" emissive="#a94d20" emissiveIntensity={0.72} roughness={0.48} metalness={0.45} />
        </mesh>
      </group>
      <group ref={hinge} name="physical-boarding-hatch" position={BOARDING_HATCH_HINGE_LOCAL}>
        <mesh position={BOARDING_HATCH_LEAF_CENTER_FROM_HINGE}>
          <boxGeometry args={BOARDING_HATCH_LEAF_SIZE} />
          <meshStandardMaterial
            color="#7f918f"
            emissive="#1a3437"
            emissiveIntensity={0.32}
            roughness={0.38}
            metalness={0.7}
          />
        </mesh>
        <mesh position={[0.02, 0.052, 0.62]}>
          <boxGeometry args={[0.76, 0.025, 0.7]} />
          <meshStandardMaterial color="#203a43" emissive="#2f9ba4" emissiveIntensity={0.45} />
        </mesh>
      </group>
    </>
  );
};

export default HifiWreck;
