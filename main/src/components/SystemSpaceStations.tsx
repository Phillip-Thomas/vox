import { useMemo } from 'react';
import { spaceStationBody } from '../game/spaceStation/spaceStationBody.ts';
import { buildSpaceStationDescriptor } from '../game/spaceStation/spaceStationDescriptor.ts';
import { systemSpaceStations } from '../game/spaceStation/spaceStationBody.ts';
import { forcedSpaceStationCount } from '../game/spaceStation/spaceStationDevFlag.ts';
import type { SystemCoordinate } from '../game/starSystem.ts';
import { useSystemFlight } from '../state/systemFlight.ts';
import {
  SpaceStationExterior,
  spaceStationExteriorDiagnostics
} from './spaceStation/SpaceStationExterior.tsx';
import { useEffect } from 'react';

/**
 * Stations, in the shipped game's system space.
 *
 * The sibling of `SystemCompanionBodies`: that one renders the other planets in
 * this system, this one renders the spaceStations. Both read the same floating render
 * origin, so both stay put when the player travels far enough that the origin
 * rebases.
 *
 * Most systems have none, and the component costs nothing when they do — the
 * spaceStation set is derived from the system seed and comes back empty. When there
 * is one it is two instanced draws, the same two the sandbox uses, so the station
 * you fly past here is byte-for-byte the station you walk around in.
 *
 * Lit by whatever lights the scene already has. The station is hundreds of units
 * across and thousands away, and a directional sun is infinite in extent, so it
 * picks up `SkyController`'s key for free rather than needing a lighting rig of
 * its own that would also spill onto the planet.
 */

export interface SystemSpaceStationsProps {
  currentCoordinate: SystemCoordinate;
  /** The system seed the manifest was built from; spaceStation population keys off it. */
  systemSeed: number;
  /**
   * Render stations at all. Defaults to on, and App gates it behind the same
   * `systemBodies` flag that governs companion planets.
   *
   * This previously claimed to default off in the story system. It never did —
   * there was no story check anywhere — and the story system at (-1,-1) does in
   * fact have an spaceStation, at 6,976 from the primary. Left as a plain switch
   * rather than growing the fiction the comment invented.
   */
  enabled?: boolean;
}

export default function SystemSpaceStations({
  currentCoordinate,
  systemSeed,
  enabled = true
}: SystemSpaceStationsProps) {
  const systemFlight = useSystemFlight();

  const forced = useMemo(() => forcedSpaceStationCount(), []);
  const stations = useMemo(() => {
    if (!enabled) return [];
    return systemSpaceStations(currentCoordinate, systemSeed, forced).map(body => ({
      body,
      // The descriptor carries the cell graph the exterior is generated from —
      // which is the same graph the interior is built from, and the reason the
      // dock you see out here is the airlock you arrive in.
      descriptor: buildSpaceStationDescriptor(body.address)
    }));
  }, [currentCoordinate, enabled, forced, systemSeed]);

  /*
    Exposed so a probe can tell "the station is not rendering" from "the station is
    rendering and you are six kilometres away from it". Those look identical in a
    frame and have completely different causes.
  */
  useEffect(() => {
    const devWindow = window as typeof window & {
      __spaceStationExterior?: () => ReturnType<typeof spaceStationExteriorDiagnostics>;
    };
    devWindow.__spaceStationExterior = () => spaceStationExteriorDiagnostics();
    return () => {
      delete devWindow.__spaceStationExterior;
    };
  }, []);

  if (stations.length === 0) return null;

  return (
    <>
      {stations.map(({ body, descriptor }) => (
        <SpaceStationExterior
          key={body.worldId}
          descriptor={descriptor}
          body={body}
          renderOrigin={systemFlight.renderOrigin}
        />
      ))}
    </>
  );
}

/** The stations in a system, without building any geometry. For HUD and targeting. */
export function systemSpaceStationBodies(coordinate: SystemCoordinate, systemSeed: number) {
  return systemSpaceStations(coordinate, systemSeed);
}

export { spaceStationBody };
