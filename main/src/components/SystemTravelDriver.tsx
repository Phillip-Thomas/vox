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
  transitionSystemTravelGate,
  type SystemTravelGateState
} from '../game/systemTravelDriverModel.ts';
import {
  cancelSystemTarget,
  commitSystemBodyTarget,
  getSystemFlightSnapshot
} from '../state/systemFlight.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { setSystemTravelAssistTarget } from '../state/systemTravelAssist.ts';

export interface SystemTravelDriverProps {
  manifest: StarSystemManifest;
  activePlanetId: string | null;
  enabled: boolean;
  onPrepareTarget: (descriptor: PlanetDescriptor) => void;
  onCancelTarget?: () => void;
  onActivateTarget: (descriptor: PlanetDescriptor) => void;
  isTargetReady?: (worldId: string) => boolean;
  aimConeRadians?: number;
  atmosphereEnvelope?: number;
}

interface DriverRuntime {
  systemId: string;
  gate: SystemTravelGateState;
}

interface CallbackRuntime {
  prepare: (descriptor: PlanetDescriptor) => void;
  activate: (descriptor: PlanetDescriptor) => void;
  isReady: (worldId: string) => boolean;
}

const TARGET_ALWAYS_READY = (): boolean => true;

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
    gate: createSystemTravelGateState()
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
    }

    const spaceFlight = getSpaceFlightSnapshot();
    const systemFlight = getSystemFlightSnapshot();
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

    setSystemTravelAssistTarget(descriptor
      ? {
          worldId: descriptor.worldId,
          systemPosition: descriptor.systemPosition,
          ready: targetReady
        }
      : null);

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
    if (transition.actions.prepare) callbacksRef.current.prepare(descriptor);
    if (transition.actions.activate) callbacksRef.current.activate(descriptor);
  });

  useEffect(() => () => {
    setSystemTravelAssistTarget(null);
    const lockedWorldId = runtimeRef.current.gate.lockedWorldId;
    if (lockedWorldId) {
      cancelOwnedTarget(lockedWorldId);
      cancelPreparationRef.current?.();
    }
  }, []);

  return null;
}
