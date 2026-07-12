import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlanetDescriptor, StarSystemManifest, Vec3Tuple } from '../game/starSystem.ts';
import {
  resolveSystemBodyTarget,
  type ActiveBodyOcclusionBound,
  type SystemBodyTargetingInput
} from '../game/systemBodyTargeting.ts';
import {
  createSystemTravelGateState,
  isWithinSystemActivationEnvelope,
  rejectSystemTravelActivation,
  retrySystemTravelPreparation,
  transitionSystemTravelGate,
  type SystemTravelGateState
} from '../game/systemTravelDriverModel.ts';
import {
  cancelSystemTarget,
  commitSystemBodyTarget,
  getSystemFlightSnapshot
} from '../state/systemFlight.ts';
import {
  cancelSystemHandoff,
  getSpaceFlightSnapshot,
  getWarp
} from '../state/spaceFlight.ts';
import { setSystemTravelAssistTarget } from '../state/systemTravelAssist.ts';

export interface SystemTravelDriverProps {
  manifest: StarSystemManifest;
  activePlanetId: string | null;
  enabled: boolean;
  onPrepareTarget: (descriptor: PlanetDescriptor) => Promise<boolean>;
  onCancelTarget?: () => void;
  onActivateTarget: (descriptor: PlanetDescriptor, onAbort: () => void) => boolean;
  isTargetReady?: (worldId: string) => boolean;
  aimConeRadians?: number;
  atmosphereEnvelope?: number;
}

interface DriverRuntime {
  systemId: string;
  gate: SystemTravelGateState;
  preparationRetry: { worldId: string; retryAtMs: number } | null;
}

interface CallbackRuntime {
  prepare: (descriptor: PlanetDescriptor) => Promise<boolean>;
  activate: (descriptor: PlanetDescriptor, onAbort: () => void) => boolean;
  isReady: (worldId: string) => boolean;
}

const TARGET_ALWAYS_READY = (): boolean => true;
const PREPARATION_RETRY_DELAY_MS = 1_500;

function cancelOwnedTarget(worldId: string): void {
  const target = getSystemFlightSnapshot().target;
  if (target?.kind === 'system_body' && target.worldId === worldId) {
    cancelSystemTarget();
  }
}

export default function SystemTravelDriver({
  manifest,
  activePlanetId,
  enabled,
  onPrepareTarget,
  onCancelTarget,
  onActivateTarget,
  isTargetReady = TARGET_ALWAYS_READY,
  aimConeRadians,
  atmosphereEnvelope
}: SystemTravelDriverProps) {
  const descriptors = useMemo(() => {
    const byWorldId = new Map<string, PlanetDescriptor>();
    for (const descriptor of manifest.planets) byWorldId.set(descriptor.worldId, descriptor);
    return byWorldId;
  }, [manifest]);
  const forwardScratch = useMemo(() => new THREE.Vector3(), []);
  const callbacksRef = useRef<CallbackRuntime>({
    prepare: onPrepareTarget,
    activate: onActivateTarget,
    isReady: isTargetReady
  });
  callbacksRef.current.prepare = onPrepareTarget;
  callbacksRef.current.activate = onActivateTarget;
  callbacksRef.current.isReady = isTargetReady;
  const cancelPreparationRef = useRef(onCancelTarget);
  cancelPreparationRef.current = onCancelTarget;

  const runtimeRef = useRef<DriverRuntime>({
    systemId: manifest.systemId,
    gate: createSystemTravelGateState(),
    preparationRetry: null
  });
  const activeBoundRef = useRef<ActiveBodyOcclusionBound>({
    systemPosition: [0, 0, 0],
    radius: 0
  });
  const targetingInputRef = useRef<SystemBodyTargetingInput>({
    cameraSystemPosition: [0, 0, 0],
    forward: [0, 0, -1],
    activePlanetId,
    bodies: manifest.planets
  });

  useFrame(({ camera }) => {
    const runtime = runtimeRef.current;
    if (runtime.systemId !== manifest.systemId) {
      if (runtime.gate.lockedWorldId) cancelOwnedTarget(runtime.gate.lockedWorldId);
      if (runtime.gate.lockedWorldId) cancelPreparationRef.current?.();
      runtime.systemId = manifest.systemId;
      runtime.gate = createSystemTravelGateState();
      runtime.preparationRetry = null;
    }

    const spaceFlight = getSpaceFlightSnapshot();
    const systemFlight = getSystemFlightSnapshot();
    const warp = getWarp();
    const systemHandoffActive = warp.active && warp.kind === 'system_handoff';
    if (warp.active && !systemHandoffActive) return;
    let descriptor: PlanetDescriptor | null = null;
    let targetDistance = 0;
    let targetWithinEnvelope = false;
    let targetReady = false;

    if (
      enabled
      && spaceFlight.phase === 'deep_space'
      && spaceFlight.controlMode === 'flight'
      && systemFlight.systemId === manifest.systemId
    ) {
      const input = targetingInputRef.current;
      const position = input.cameraSystemPosition as Vec3Tuple;
      position[0] = systemFlight.pose.position[0];
      position[1] = systemFlight.pose.position[1];
      position[2] = systemFlight.pose.position[2];

      camera.getWorldDirection(forwardScratch);
      const forward = input.forward as Vec3Tuple;
      forward[0] = forwardScratch.x;
      forward[1] = forwardScratch.y;
      forward[2] = forwardScratch.z;
      input.activePlanetId = activePlanetId;
      input.bodies = manifest.planets;
      input.aimConeRadians = aimConeRadians;

      const activeDescriptor = activePlanetId ? descriptors.get(activePlanetId) : undefined;
      if (activeDescriptor) {
        const activeBound = activeBoundRef.current;
        activeBound.systemPosition = activeDescriptor.systemPosition;
        activeBound.radius = activeDescriptor.surfaceBoundRadius;
        input.activeBodyOcclusionBound = activeBound;
      } else {
        input.activeBodyOcclusionBound = undefined;
      }

      const target = resolveSystemBodyTarget(input);
      if (target) {
        descriptor = descriptors.get(target.worldId) ?? null;
        targetDistance = target.distance;
        if (descriptor) {
          targetWithinEnvelope = isWithinSystemActivationEnvelope(
            targetDistance,
            descriptor.nominalFaceRadius,
            atmosphereEnvelope
          );
          targetReady = callbacksRef.current.isReady(descriptor.worldId);
        }
      }
    }

    if (systemHandoffActive) {
      const lockedWorldId = runtime.gate.lockedWorldId;
      const liveTarget = systemFlight.target;
      const leaseCurrent = enabled
        && descriptor?.worldId === lockedWorldId
        && targetWithinEnvelope
        && targetReady
        && liveTarget?.kind === 'system_body'
        && liveTarget.worldId === lockedWorldId;
      if (!warp.midpointFired && !leaseCurrent) {
        cancelSystemHandoff('lease_invalidated');
        if (lockedWorldId) {
          cancelOwnedTarget(lockedWorldId);
          cancelPreparationRef.current?.();
        }
        setSystemTravelAssistTarget(null);
      }
      return;
    }

    setSystemTravelAssistTarget(descriptor
      ? {
          worldId: descriptor.worldId,
          systemPosition: descriptor.systemPosition,
          ready: targetReady
        }
      : null);

    const retry = runtime.preparationRetry;
    if (retry && performance.now() >= retry.retryAtMs) {
      runtime.gate = retrySystemTravelPreparation(runtime.gate, retry.worldId);
      runtime.preparationRetry = null;
    }

    const gate = runtime.gate;
    if (!descriptor) {
      if (gate.lockedWorldId === null) return;
    } else if (
      gate.lockedWorldId === descriptor.worldId
      && (targetReady || gate.preparedLockWorldId === descriptor.worldId)
      && (
        !targetWithinEnvelope
        || !targetReady
        || gate.activatedLockWorldId === descriptor.worldId
      )
    ) {
      return;
    }

    const transition = transitionSystemTravelGate(
      gate,
      descriptor
        ? {
            worldId: descriptor.worldId,
            distance: targetDistance,
            nominalFaceRadius: descriptor.nominalFaceRadius,
            ready: targetReady
          }
        : null,
      atmosphereEnvelope
    );
    runtime.gate = transition.state;

    if (transition.actions.cancel && gate.lockedWorldId) {
      cancelOwnedTarget(gate.lockedWorldId);
      cancelPreparationRef.current?.();
    }
    if (!descriptor) return;
    if (transition.actions.commit) commitSystemBodyTarget(descriptor.address);
    if (transition.actions.prepare) {
      const preparingWorldId = descriptor.worldId;
      const scheduleRetry = () => {
        const liveRuntime = runtimeRef.current;
        if (liveRuntime.gate.preparedLockWorldId !== preparingWorldId) return;
        liveRuntime.preparationRetry = {
          worldId: preparingWorldId,
          retryAtMs: performance.now() + PREPARATION_RETRY_DELAY_MS
        };
      };
      void callbacksRef.current.prepare(descriptor)
        .then(succeeded => { if (!succeeded) scheduleRetry(); })
        .catch(scheduleRetry);
    }
    if (transition.actions.activate) {
      const rejectActivation = () => {
        const liveRuntime = runtimeRef.current;
        liveRuntime.gate = rejectSystemTravelActivation(liveRuntime.gate, descriptor.worldId);
      };
      let accepted = false;
      try {
        accepted = callbacksRef.current.activate(descriptor, rejectActivation);
      } catch (error) {
        console.error('[system-travel] Failed to begin local handoff', error);
      }
      if (!accepted) rejectActivation();
    }
  });

  useEffect(() => () => {
    const lockedWorldId = runtimeRef.current.gate.lockedWorldId;
    cancelSystemHandoff('driver_unmounted');
    setSystemTravelAssistTarget(null);
    if (lockedWorldId) {
      cancelOwnedTarget(lockedWorldId);
      cancelPreparationRef.current?.();
    }
  }, []);

  return null;
}
