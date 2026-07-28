import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  evaluateApproach,
  SCAN_RANGE,
  type ApproachReadout
} from '../game/spaceStation/spaceStationApproach.ts';
import { systemSpaceStations, type SpaceStationBody } from '../game/spaceStation/spaceStationBody.ts';
import { forcedSpaceStationCount } from '../game/spaceStation/spaceStationDevFlag.ts';
import type { SystemCoordinate } from '../game/starSystem.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { commitSpaceStationTarget, getSystemFlightSnapshot } from '../state/systemFlight.ts';

/**
 * Watches the ship for stations worth docking at.
 *
 * The approach model is the same pure one the sandbox flies; this only feeds it the
 * shipped game's canonical ship pose and publishes the answer. Deliberately a
 * scene-graph driver rather than a React subscription: the pose is written every
 * frame without notifying React on purpose, so a component that re-rendered on it
 * would undo that decision for the whole app.
 *
 * It does not steer, warp, or take control. A station is a place you fly to.
 */

export interface SpaceStationContact {
  body: SpaceStationBody;
  readout: ApproachReadout;
}

let latestContact: SpaceStationContact | null = null;

/** Nearest station within instrument range, or null. Read by the HUD's own loop. */
export function spaceStationContact(): SpaceStationContact | null {
  return latestContact;
}

export interface SpaceStationApproachDriverProps {
  currentCoordinate: SystemCoordinate;
  systemSeed: number;
  enabled?: boolean;
  /** Fires once when the player requests and is granted clearance. */
  onDock?: (body: SpaceStationBody) => void;
}

export default function SpaceStationApproachDriver({
  currentCoordinate,
  systemSeed,
  enabled = true,
  onDock
}: SpaceStationApproachDriverProps) {
  const bodies = useMemo(
    () => (enabled ? systemSpaceStations(currentCoordinate, systemSeed, forcedSpaceStationCount()) : []),
    [currentCoordinate, enabled, systemSeed]
  );
  const dockRef = useRef(onDock);
  dockRef.current = onDock;

  useEffect(() => {
    if (bodies.length === 0) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyF') return;
      const contact = latestContact;
      if (!contact?.readout.canDock) return;
      // Publish the target before handing off, so anything watching the flight
      // store sees where the player went rather than inferring it afterwards.
      commitSpaceStationTarget(contact.body.address);
      dockRef.current?.(contact.body);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bodies]);

  /*
    Reports every station in the system with its true range, ignoring the scan
    cutoff and the flight phase.

    The HUD deliberately shows nothing until a station is within instruments, which
    makes "is this wired up at all" indistinguishable from "there is no station
    here" — and the difference matters, because most systems genuinely have none.
    Confirming the integration should not require flying eight kilometres in the
    right direction first.
  */
  useEffect(() => {
    const devWindow = window as typeof window & {
      __spaceStationContacts?: () => {
        phase: string;
        ship: [number, number, number];
        stations: Array<{ worldId: string; distance: number; phase: string; canDock: boolean }>;
      };
    };
    devWindow.__spaceStationContacts = () => {
      const { pose } = getSystemFlightSnapshot();
      const ship: [number, number, number] = [pose.position[0], pose.position[1], pose.position[2]];
      return {
        phase: getSpaceFlightSnapshot().phase,
        ship,
        stations: bodies.map(body => {
          const readout = evaluateApproach(body, {
            position: ship,
            velocity: [pose.velocity[0], pose.velocity[1], pose.velocity[2]]
          });
          return {
            worldId: body.worldId,
            distance: Math.round(readout.distance),
            phase: readout.phase,
            canDock: readout.canDock
          };
        })
      };
    };
    return () => {
      delete devWindow.__spaceStationContacts;
    };
  }, [bodies]);

  useEffect(() => () => {
    latestContact = null;
  }, []);

  useFrame(() => {
    if (bodies.length === 0) {
      latestContact = null;
      return;
    }
    // Only while actually flying. On a surface the nearest station is eight
    // kilometres straight up and an instrument reporting it is noise.
    const phase = getSpaceFlightSnapshot().phase;
    if (phase !== 'deep_space') {
      latestContact = null;
      return;
    }

    const { pose } = getSystemFlightSnapshot();
    const ship = {
      position: [pose.position[0], pose.position[1], pose.position[2]] as [number, number, number],
      velocity: [pose.velocity[0], pose.velocity[1], pose.velocity[2]] as [number, number, number]
    };

    let best: SpaceStationContact | null = null;
    for (const body of bodies) {
      const readout = evaluateApproach(body, ship);
      if (readout.distance > SCAN_RANGE) continue;
      if (!best || readout.distance < best.readout.distance) best = { body, readout };
    }
    latestContact = best;
  });

  return null;
}
