import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import {
  clearStationAccessSource,
  setStationAccessSource
} from '../../game/data/stations.ts';
import {
  getHabitatRevision,
  getHabitatWorldState,
  subscribeHabitats
} from '../../game/systems/habitatSystem.ts';
import { getItemCount, subscribeInventory } from '../../game/systems/inventorySystem.ts';
import { getObservation, subscribeObservations } from '../../game/systems/observationLedger.ts';
import { getMilestones, hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { getPieces } from '../../game/systems/structureSystem.ts';
import { restoreHabitatForWorld } from '../../game/systems/persistence.ts';
import { getCurrentDayPhase } from '../../game/worldClock.ts';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { getSpaceFlightSnapshot } from '../../state/spaceFlight.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import {
  activateTidegardenHabitatCore,
  attendTidegardenRelationship,
  canCertifyTidegardenShelter,
  canRestAtTidegardenHabitat,
  certifyTidegardenShelter,
  chooseTidegardenHabitatSite,
  commitTidegardenScannerOverload,
  completeTidegardenSafeRest,
  createTidegardenRelationshipProof,
  getTidegardenChosenHabitatSite,
  reconcileTidegardenSettlementMilestones,
  recordTidegardenRelationshipObservation,
  TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID,
  TIDEGARDEN_SETTLEMENT_MILESTONES,
  surveyTidegardenHabitatSite,
  validateTidegardenHabitatSite
} from '../tidegardenSettlement.ts';
import { TIDEGARDEN_WORLD_ID } from '../tidegardenRoute.ts';
import { registerEmergentMovieSettlementBinding } from '../emergentMovieRuntime.ts';
import { useStoryState } from '../storyState.ts';
import {
  claimKestrelFoundingReserve,
  KESTREL_FOUNDING_RESERVE_MILESTONE
} from '../kestrelFoundingReserve.ts';

const RELATIONSHIP_DISTANCE = 5.2;
const HABITAT_STATION_DISTANCE = 7;
const STATION_SOURCE_ID = 'story:tidegarden:habitat-core';
const CARRIED_ASSEMBLER_SOURCE_ID = 'story:tidegarden:carried-assembler';

/** Story director target for the landed Kestrel during the settlement loop. */
export const tidegardenSettlementHandle: { shipPosition: THREE.Vector3 | null } = {
  shipPosition: null
};

interface TidegardenSettlementWorldProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
  shipPosition?: THREE.Vector3 | null;
}

/** Physical Tidegarden settlement verbs and persistent in-world Core device. */
const TidegardenSettlementWorld: React.FC<TidegardenSettlementWorldProps> = ({
  planetSize,
  terrainSeed,
  commandContext,
  shipPosition = null
}) => {
  const story = useStoryState();
  // Subscribe so the live Core/certification meshes rerender, but do not use
  // the revision as a persistence-hydration dependency. A habitat commit
  // increments this value; restoring again in response creates a restore ->
  // revision -> restore feedback loop and can take the Canvas down.
  useSyncExternalStore(
    subscribeHabitats,
    getHabitatRevision,
    getHabitatRevision
  );
  const relationshipAttended = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(
      TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended,
      commandContext.actorId
    ),
    () => false
  );
  const scannerOverloadObserved = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(
      TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload,
      commandContext.actorId
    ),
    () => false
  );
  const foundingReserveClaimed = useSyncExternalStore(
    subscribeProgression,
    () => hasMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE, commandContext.actorId),
    () => false
  );
  const siteChoiceMilestone = useSyncExternalStore(
    subscribeProgression,
    () => getMilestones(commandContext.actorId).find(milestone => (
      milestone.startsWith(TIDEGARDEN_SETTLEMENT_MILESTONES.siteChoicePrefix)
    )) ?? '',
    () => ''
  );
  const chosenSite = useMemo(
    () => siteChoiceMilestone
      ? getTidegardenChosenHabitatSite(commandContext.actorId)
      : null,
    [commandContext.actorId, siteChoiceMilestone]
  );
  const coreCarried = useSyncExternalStore(
    subscribeInventory,
    () => getItemCount('habitat_core', commandContext.actorId) > 0,
    () => false
  );
  const relationshipRecorded = useSyncExternalStore(
    subscribeObservations,
    () => Boolean(getObservation(
      TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID,
      commandContext.actorId
    )),
    () => false
  );
  const relationship = useMemo(
    () => createTidegardenRelationshipProof(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  const generator = useMemo(
    () => getWorldGen(planetSize, terrainSeed, commandContext.world.worldId).generator,
    [commandContext.world.worldId, planetSize, terrainSeed]
  );
  const liveTerrain = useMemo(() => ({
    shouldVoxelExist: (x: number, y: number, z: number) =>
      generator.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z),
    isWaterVoxel: (x: number, y: number, z: number) =>
      voxelSystem.isDeleted(x, y, z) || generator.isWaterVoxel(x, y, z),
    isSolidVoxel: (x: number, y: number, z: number) =>
      voxelSystem.hasVoxel(x, y, z)
      || (generator.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z)),
    isHazardousVoxel: (x: number, y: number, z: number) =>
      (voxelSystem.getVoxel(x, y, z)?.blockId
        ?? generator.generateBlockForPosition(x, y, z)) === 'lava',
    generateBlockForPosition: (x: number, y: number, z: number) =>
      generator.generateBlockForPosition(x, y, z),
    get revision() {
      return `${voxelSystem.getWorldId()}:${voxelSystem.getEditVersion()}:${generator.getWaterEditVersion()}`;
    }
  }), [generator]);
  const state = getHabitatWorldState(commandContext.world.worldId);
  const corePosition = useMemo(
    () => state ? new THREE.Vector3(...state.core.position) : null,
    [state]
  );
  const coreUp = useMemo(
    () => state ? new THREE.Vector3(...state.core.up) : new THREE.Vector3(0, 1, 0),
    [state]
  );
  const coreQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), coreUp),
    [coreUp]
  );
  const coreLight = useRef<THREE.PointLight>(null);
  const lastStationAccess = useRef(false);
  const lastCarriedAssemblerAccess = useRef(false);

  useEffect(() => {
    tidegardenSettlementHandle.shipPosition = shipPosition ? shipPosition.clone() : null;
    return () => { tidegardenSettlementHandle.shipPosition = null; };
  }, [shipPosition]);

  useEffect(() => {
    restoreHabitatForWorld(commandContext.world);
    reconcileTidegardenSettlementMilestones(
      commandContext.world.worldId,
      commandContext.actorId
    );
  }, [
    commandContext.actorId,
    commandContext.world.worldId,
    commandContext.world.seed
  ]);

  useEffect(() => registerEmergentMovieSettlementBinding({
    commandContext,
    planetSize,
    terrain: liveTerrain,
    agentTerrain: liveTerrain,
    relationship
  }), [commandContext, liveTerrain, planetSize, relationship]);

  useEffect(() => {
    if (!story.active
      || (story.beat !== 'ch9-settle' && story.beat !== 'ch9-hearth')
      || foundingReserveClaimed) return;
    claimKestrelFoundingReserve(
      `story:tidegarden:${commandContext.actorId}:founding-reserve`,
      commandContext.actorId,
      commandContext
    );
  }, [commandContext, foundingReserveClaimed, story.active, story.beat]);

  useEffect(() => {
    if (commandContext.world.worldId !== TIDEGARDEN_WORLD_ID) return;
    return registerStoryInteraction((_camera, playerPosition) => {
      const actorId = commandContext.actorId;
      const worldId = commandContext.world.worldId;
      if (relationship && playerPosition.distanceTo(relationship.position) <= RELATIONSHIP_DISTANCE) {
        if (!relationshipAttended) {
          return {
            id: 'story-tidegarden-attend',
            verb: 'Attend Waterline Relationship',
            perform: () => {
              attendTidegardenRelationship(
                relationship,
                `story:tidegarden:${actorId}:relationship-attended`,
                actorId,
                commandContext
              );
            }
          };
        }
        if (!relationshipRecorded) {
          return {
            id: 'story-tidegarden-record',
            verb: 'Record Observation (Optional)',
            perform: () => {
              recordTidegardenRelationshipObservation(
                relationship,
                `story:tidegarden:${actorId}:relationship-recorded`,
                actorId
              );
            }
          };
        }
      }

      if (relationshipAttended && !chosenSite) {
        const site = surveyTidegardenHabitatSite({
          worldId,
          planetSize,
          playerPosition,
          terrain: liveTerrain,
          actorId,
          pieces: getPieces()
        });
        if (site.ok) {
          return {
            id: 'story-tidegarden-choose-site',
            verb: 'Choose Habitat Site',
            perform: () => {
              chooseTidegardenHabitatSite({
                worldId,
                planetSize,
                playerPosition,
                terrain: liveTerrain,
                actorId,
                pieces: getPieces(),
                eventId: `story:tidegarden:${actorId}:site-chosen`,
                commandContext
              });
            }
          };
        }
      }

      const live = getHabitatWorldState(worldId);
      if (!live && coreCarried) {
        const site = validateTidegardenHabitatSite({
          worldId,
          planetSize,
          playerPosition,
          terrain: liveTerrain,
          actorId,
          pieces: getPieces()
        });
        if (site.ok) {
          return {
            id: 'story-habitat-core',
            verb: 'Install Habitat Core',
            perform: () => {
              activateTidegardenHabitatCore({
                proof: site.proof,
                eventId: `story:tidegarden:${actorId}:habitat-core-online`,
                actorId,
                commandContext
              });
            }
          };
        }
      }
      if (live && !live.shelterCertification
        && canCertifyTidegardenShelter(worldId, playerPosition, getPieces())) {
        return {
          id: 'story-habitat-certify',
          verb: 'Certify Working Shelter',
          perform: () => {
            certifyTidegardenShelter({
              worldId,
              playerPosition,
              eventId: `story:tidegarden:${actorId}:shelter-certified`,
              actorId,
              pieces: getPieces(),
              commandContext
            });
          }
        };
      }
      if (live?.shelterCertification && !live.safeRest
        && canRestAtTidegardenHabitat(
          worldId,
          playerPosition,
          getCurrentDayPhase(),
          getPieces()
        )) {
        return {
          id: 'story-habitat-rest',
          verb: 'Rest at the Second Hearth',
          perform: () => {
            completeTidegardenSafeRest({
              worldId,
              playerPosition,
              dayPhase: getCurrentDayPhase(),
              eventId: `story:tidegarden:${actorId}:safe-rest`,
              actorId,
              pieces: getPieces(),
              commandContext
            });
          }
        };
      }
      return null;
    });
  }, [
    commandContext,
    coreCarried,
    chosenSite,
    liveTerrain,
    planetSize,
    relationship,
    relationshipAttended,
    relationshipRecorded
  ]);

  useFrame(({ clock }) => {
    const playerPosition = getPlayerWorldPosition();
    const nearCore = Boolean(corePosition
      && playerPosition.distanceTo(corePosition) <= HABITAT_STATION_DISTANCE);
    if (nearCore !== lastStationAccess.current) {
      lastStationAccess.current = nearCore;
      if (nearCore) {
        setStationAccessSource(STATION_SOURCE_ID, ['smelter', 'assembler', 'survey_console']);
      } else {
        clearStationAccessSource(STATION_SOURCE_ID);
      }
    }
    const nearCarriedAssembler = Boolean(
      !corePosition
      && shipPosition
      && getSpaceFlightSnapshot().phase === 'surface'
      && playerPosition.distanceTo(shipPosition) <= HABITAT_STATION_DISTANCE + 1
    );
    if (nearCarriedAssembler !== lastCarriedAssemblerAccess.current) {
      lastCarriedAssemblerAccess.current = nearCarriedAssembler;
      if (nearCarriedAssembler) {
        setStationAccessSource(CARRIED_ASSEMBLER_SOURCE_ID, ['smelter', 'assembler']);
      } else {
        clearStationAccessSource(CARRIED_ASSEMBLER_SOURCE_ID);
      }
    }
    if (coreLight.current) {
      const pulse = 0.5 + Math.sin(clock.elapsedTime * 1.45) * 0.5;
      coreLight.current.intensity = state?.shelterCertification
        ? 1.1 + pulse * 0.3
        : 0.55 + pulse * 0.35;
    }
  });

  useEffect(() => () => {
    clearStationAccessSource(STATION_SOURCE_ID);
    clearStationAccessSource(CARRIED_ASSEMBLER_SOURCE_ID);
  }, []);

  return (
    <>
      {relationship && !relationshipRecorded && (
        <RelationshipMarker
          position={relationship.position}
          attended={relationshipAttended}
        />
      )}
      {relationship && story.active && story.beat === 'ch9-settle' && (
        <TidegardenScannerField
          relationshipPosition={relationship.position}
          observed={scannerOverloadObserved}
          actorId={commandContext.actorId}
        />
      )}
      {chosenSite && !corePosition && (
        <ChosenSiteMarker position={chosenSite.position} up={chosenSite.up} />
      )}
      {corePosition && (
        <group position={corePosition} quaternion={coreQuaternion}>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.38, 0.48, 0.72, 8]} />
            <meshStandardMaterial
              color={state?.shelterCertification ? '#e2c37b' : '#4a8e92'}
              emissive={state?.shelterCertification ? '#d7a84c' : '#2b9ca5'}
              emissiveIntensity={state?.shelterCertification ? 0.72 : 0.45}
              roughness={0.38}
              metalness={0.62}
            />
          </mesh>
          <mesh position={[0, 0.82, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color="#dff9ef"
              emissive="#64d7cb"
              emissiveIntensity={1.15}
              roughness={0.16}
              metalness={0.35}
            />
          </mesh>
          <pointLight
            ref={coreLight}
            color={state?.shelterCertification ? '#ffd58a' : '#79e4da'}
            intensity={0.8}
            distance={6}
            decay={2}
            position={[0, 1.05, 0]}
          />
        </group>
      )}
    </>
  );
};

const SCANNER_SIGNAL_IDS = [
  'water-root-0', 'water-root-1', 'water-root-2',
  'canopy-shelter-0', 'canopy-shelter-1', 'canopy-shelter-2',
  'pollen-route-0', 'pollen-route-1', 'pollen-route-2'
] as const;

const TidegardenScannerField: React.FC<{
  relationshipPosition: THREE.Vector3;
  observed: boolean;
  actorId: string;
}> = ({ relationshipPosition, observed, actorId }) => {
  const renderedFrames = useRef(0);
  const visibleFor = useRef(0);
  const up = useMemo(() => relationshipPosition.clone().normalize(), [relationshipPosition]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up),
    [up]
  );

  useFrame((_state, delta) => {
    if (observed) return;
    renderedFrames.current += 1;
    visibleFor.current += Math.min(0.1, Math.max(0, delta));
    if (renderedFrames.current < 2 || visibleFor.current < 1.25) return;
    commitTidegardenScannerOverload({
      worldId: TIDEGARDEN_WORLD_ID,
      visibleSignalIds: SCANNER_SIGNAL_IDS,
      relationshipKinds: ['water-root', 'canopy-shelter', 'pollen-route'],
      renderedFrames: renderedFrames.current
    }, `story:tidegarden:${actorId}:scanner-overload`, actorId);
  });

  if (observed) return null;
  return (
    <group position={relationshipPosition} quaternion={quaternion}>
      {SCANNER_SIGNAL_IDS.map((id, index) => (
        <ScannerRelationshipSignal key={id} index={index} />
      ))}
    </group>
  );
};

const ScannerRelationshipSignal: React.FC<{ index: number }> = ({ index }) => {
  const arm = 1.35 + (index % 3) * 0.58;
  const angle = (index / SCANNER_SIGNAL_IDS.length) * Math.PI * 2;
  const x = Math.cos(angle) * arm;
  const z = Math.sin(angle) * arm;
  const kind = Math.floor(index / 3);
  const color = kind === 0 ? '#62e5d0' : kind === 1 ? '#e4cd73' : '#d28df0';
  return (
    <group position={[x, 0.22 + (index % 2) * 0.16, z]}>
      <mesh>
        {kind === 0
          ? <sphereGeometry args={[0.11, 8, 6]} />
          : kind === 1
            ? <boxGeometry args={[0.18, 0.18, 0.18]} />
            : <coneGeometry args={[0.13, 0.25, 6]} />}
        <meshBasicMaterial color={color} transparent opacity={0.84} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.72, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh position={[0.22 * Math.cos(angle + 0.8), 0.76, 0.22 * Math.sin(angle + 0.8)]}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.74} depthWrite={false} />
      </mesh>
    </group>
  );
};

const ChosenSiteMarker: React.FC<{
  position: THREE.Vector3;
  up: THREE.Vector3;
}> = ({ position, up }) => {
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up),
    [up]
  );
  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.5, 0.62, 4]} />
        <meshBasicMaterial color="#f0cb78" transparent opacity={0.64} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial color="#f6dda3" transparent opacity={0.82} depthWrite={false} />
      </mesh>
    </group>
  );
};

const RelationshipMarker: React.FC<{
  position: THREE.Vector3;
  attended: boolean;
}> = ({ position, attended }) => (
  <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
      <torusGeometry args={[0.72, 0.045, 8, 42]} />
      <meshBasicMaterial
        color={attended ? '#9abeb0' : '#69e0c1'}
        transparent
        opacity={attended ? 0.28 : 0.68}
        depthWrite={false}
      />
    </mesh>
    <mesh position={[-0.35, 0.55, 0.12]} rotation={[0.08, 0, -0.18]}>
      <cylinderGeometry args={[0.035, 0.07, 1.1, 7]} />
      <meshStandardMaterial color="#6fa96f" roughness={0.86} />
    </mesh>
    <mesh position={[0.28, 0.44, -0.18]} rotation={[-0.05, 0, 0.25]}>
      <cylinderGeometry args={[0.025, 0.055, 0.86, 7]} />
      <meshStandardMaterial color="#7dc6a0" roughness={0.82} />
    </mesh>
    <pointLight
      color="#60d8bc"
      intensity={attended ? 0.12 : 0.32}
      distance={3.4}
      decay={2}
      position={[0, 0.5, 0]}
    />
  </group>
);

export default TidegardenSettlementWorld;
