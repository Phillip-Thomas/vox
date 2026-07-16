import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import type { CommandContext } from '../../game/commands.ts';
import type { ItemId } from '../../game/data/items.ts';
import { getCampfires, removeCampfireAt } from '../../game/systems/campfires.ts';
import { getItemCount, removeItem } from '../../game/systems/inventorySystem.ts';
import {
  hasMilestone,
  subscribeProgression
} from '../../game/systems/progressionSystem.ts';
import {
  commitAuditMismatch,
  commitComplianceAct,
  commitProtectedTreeToolAttempt,
  commitTreeRefusal,
  EMERGENT_AUDIT_MILESTONES
} from '../emergentAudit.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { useStoryState } from '../storyState.ts';
import { getHeroTreePose, getPondPose, getWreckRelayPose } from './storyWorld.ts';
import { playSfx } from '../../audio/sfxEngine.ts';

const ATTEND_DISTANCE = 5;
const ACT_DISTANCE = 4.2;

const ORGANIC_SAMPLES: readonly ItemId[] = [
  'berry', 'root', 'cactus_pulp', 'fan_frond', 'wild_bloom', 'seedpod',
  'biofiber', 'resin'
];

interface EmergentAuditSitesProps {
  planetSize: number;
  terrainSeed: number;
  commandContext: CommandContext;
}

/**
 * Physical verbs for the audit hinge. These are proximity interactions against
 * persistent world facts, not dialogue buttons: the fire is actually removed,
 * held organic samples are actually surrendered, and the protected tree never
 * exposes a mining transaction.
 */
const EmergentAuditSites: React.FC<EmergentAuditSitesProps> = ({
  planetSize,
  terrainSeed,
  commandContext
}) => {
  const story = useStoryState();
  const revision = useSyncExternalStore(
    subscribeProgression,
    () => progressionRevision(commandContext.actorId),
    () => ''
  );
  const pond = useMemo(() => getPondPose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  const tree = useMemo(() => getHeroTreePose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  const relay = useMemo(() => getWreckRelayPose(planetSize, terrainSeed), [planetSize, terrainSeed]);

  useEffect(() => {
    if (!story.active) return;
    if (story.beat !== 'ch4-audit' && story.beat !== 'ch4-comply' && story.beat !== 'ch4-defy') return;
    return registerStoryInteraction((_camera, playerPosition) => {
      const actorId = commandContext.actorId;
      const worldId = commandContext.world.worldId;

      if (story.beat === 'ch4-audit') {
        if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
          const fire = getCampfires()[0];
          if (!fire || playerPosition.distanceTo(arrayPosition(fire.pos)) > ATTEND_DISTANCE) return null;
          return {
            id: 'story-audit-fire',
            verb: 'Attend Fire Mismatch',
            perform: () => { commitAuditMismatch('fire', worldId, actorId); }
          };
        }
        if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
          if (!pond || playerPosition.distanceTo(pond.shore) > ATTEND_DISTANCE) return null;
          return {
            id: 'story-audit-life',
            verb: 'Attend Living Noise',
            perform: () => { commitAuditMismatch('life', worldId, actorId); }
          };
        }
        if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
          if (playerPosition.distanceTo(tree.position) > ATTEND_DISTANCE) return null;
          return {
            id: 'story-audit-tree',
            verb: 'Attend Tree Mismatch',
            perform: () => { commitAuditMismatch('tree', worldId, actorId); }
          };
        }
      }

      if (story.beat === 'ch4-comply') {
        if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
          const fire = getCampfires()[0];
          if (!fire || playerPosition.distanceTo(arrayPosition(fire.pos)) > ACT_DISTANCE) return null;
          return {
            id: 'story-comply-fire',
            verb: 'Douse the Fire',
            perform: () => {
              const removed = removeCampfireAt(fire.pos, fire.up);
              commitComplianceAct('fire', removed, worldId, actorId);
            }
          };
        }
        if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
          if (playerPosition.distanceTo(relay.position) > ACT_DISTANCE) return null;
          return {
            id: 'story-comply-organics',
            verb: 'Resolve Organic Samples',
            perform: () => {
              // An empty tray is an explicit, physical absence resolution. If
              // samples exist, every held unit is removed before the receipt.
              for (const id of ORGANIC_SAMPLES) {
                const quantity = getItemCount(id, actorId);
                if (quantity > 0) removeItem(id, quantity, actorId);
              }
              commitComplianceAct('organics', true, worldId, actorId);
            }
          };
        }
      }

      if (story.beat === 'ch4-defy'
        && !hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)
        && playerPosition.distanceTo(tree.position) <= ACT_DISTANCE) {
        const toolRefused = hasMilestone(EMERGENT_AUDIT_MILESTONES.protectedToolRefused, actorId);
        return {
          id: 'story-refuse-tree',
          verb: toolRefused ? 'refuse.' : 'Test Maw on Protected Tree',
          perform: () => {
            if (toolRefused) commitTreeRefusal(worldId, actorId);
            else {
              const result = commitProtectedTreeToolAttempt(worldId, actorId);
              if (result.ok && !result.idempotent) playSfx('blocked');
            }
          }
        };
      }
      return null;
    });
  }, [commandContext, pond, relay.position, revision, story.active, story.beat, tree.position]);

  const target = currentTarget(story.beat, pond?.shore ?? null, tree.position, relay.position, commandContext.actorId);
  if (!target) return null;
  const protectedTrace = story.beat === 'ch4-defy'
    && hasMilestone(EMERGENT_AUDIT_MILESTONES.protectedToolRefused, commandContext.actorId)
    && !hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, commandContext.actorId);
  return (
    <>
      <AuditAttentionRing position={target.position} color={target.color} />
      {protectedTrace && <ProtectedTreeToolTrace position={tree.position} up={tree.up} />}
    </>
  );
};

function progressionRevision(actorId: string): string {
  return Object.values(EMERGENT_AUDIT_MILESTONES)
    .map(id => hasMilestone(id, actorId) ? '1' : '0')
    .join('');
}

function currentTarget(
  beat: string | null,
  pond: THREE.Vector3 | null,
  tree: THREE.Vector3,
  relay: THREE.Vector3,
  actorId: string
): { position: THREE.Vector3; color: string } | null {
  if (beat === 'ch4-audit') {
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
      const fire = getCampfires()[0];
      return fire ? { position: arrayPosition(fire.pos), color: '#ffb36b' } : null;
    }
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
      return pond ? { position: pond, color: '#6ce0bf' } : null;
    }
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
      return { position: tree, color: '#b8e879' };
    }
  }
  if (beat === 'ch4-comply') {
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
      const fire = getCampfires()[0];
      return fire ? { position: arrayPosition(fire.pos), color: '#9da7ad' } : null;
    }
    if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
      return { position: relay, color: '#9da7ad' };
    }
  }
  if (beat === 'ch4-defy' && !hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)) {
    return { position: tree, color: '#f2eee5' };
  }
  return null;
}

const AuditAttentionRing: React.FC<{ position: THREE.Vector3; color: string }> = ({ position, color }) => (
  <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
      <torusGeometry args={[0.65, 0.035, 8, 36]} />
      <meshBasicMaterial color={color} transparent opacity={0.62} depthWrite={false} />
    </mesh>
    <pointLight color={color} intensity={0.32} distance={3.5} decay={2} position={[0, 0.5, 0]} />
  </group>
);

/** The Maw field visibly collapses against an intact trunk: refusal, not damage. */
const ProtectedTreeToolTrace: React.FC<{
  position: THREE.Vector3;
  up: THREE.Vector3;
}> = ({ position, up }) => (
  <group
    position={position.clone().addScaledVector(up, 1.1)}
    quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)}
  >
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.48, 0.055, 8, 30, Math.PI * 1.55]} />
      <meshBasicMaterial color="#73d7d1" transparent opacity={0.76} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[0.06, 0.06, 0.9]} />
      <meshBasicMaterial color="#e9f2ec" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  </group>
);

function arrayPosition(value: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

export default EmergentAuditSites;
