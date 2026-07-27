import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  buildAnchorageCrowd,
  buildStallTraders,
  figureParts,
  poseAt,
  swungOffset,
  type CrowdAgent
} from '../../game/anchorage/anchorageCrowd.ts';
import { anchorageFixedTime } from '../../game/anchorage/anchorageDevFlag.ts';
import type { AnchorageDescriptor, CellId } from '../../game/anchorage/anchorageTypes.ts';
import { anchorageVendorSites } from '../../game/anchorage/anchorageVendors.ts';
import { currentVisibleCells } from './AnchorageInterior.tsx';

/**
 * Renders the crowd as two instanced draws: bodies, and the visor slits.
 *
 * Every figure is eight boxes and every box is an instance of the same cube, so a
 * fifty-person concourse costs two draw calls. Only agents in cells the portal walk
 * can see are packed, so walking out of the concourse drops the cost rather than
 * carrying it around the station.
 *
 * The visors are a separate unlit pass, matching how the ship's light rails and the
 * audit worker's visor are done — an emissive slit has to hold its value through
 * ACES or it stops reading as an eye and becomes a dark smudge.
 */

/** Suit tones, taken from the audit worker's palette and varied around it. */
const SUIT_TONES = [0x6e7b77, 0x5f6b74, 0x6b6259, 0x59635f].map(hex => new THREE.Color(hex));
const SUIT_DARK = new THREE.Color(0x4c5754);
/**
 * Traders wear the market's colours, not the Regulation's.
 *
 * Muted relatives of the awning palette, so a stallholder reads as belonging to the
 * stall she is standing behind and the row scans as staffed from down the aisle.
 * The administration paints nothing; the traders paint everything they own.
 */
const TRADER_TONES = [0x8a5a46, 0x4e6a68, 0x6f6088, 0x7d6a3f].map(hex => new THREE.Color(hex));
const TRADER_DARK = new THREE.Color(0x453d38);
/** The feed's ember. Reads from across a room, which is the entire point of it. */
const VISOR_EMBER = new THREE.Color(0xff5a3c);

/**
 * Radians of leg swing at full stride. Kept modest — a large swing on straight box
 * legs reads as the legs crossing rather than as walking.
 */
const STRIDE_SWING = 0.34;
/** Arms counter-swing at a fraction of the legs. These are shoppers, not auditors. */
const ARM_SWING_RATIO = 0.55;

/**
 * How near you have to be before a trader notices you, and how far she will turn.
 *
 * A figure that snaps to face you from across the concourse is uncanny, and one
 * that pivots a full circle to track someone behind her stall is a turret. Both are
 * worse than a stallholder who simply stands there — so the turn is short, ranged,
 * and eased.
 */
const ATTENTION_RANGE = 5.5;
const ATTENTION_FULL = 2.4;
const MAX_HEAD_TURN = 1.0;

export function AnchorageCrowd({ descriptor }: { descriptor: AnchorageDescriptor }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const visorRef = useRef<THREE.InstancedMesh>(null);

  const { agents, bodyCapacity, visorCapacity, partsByHeight } = useMemo(() => {
    const shoppers = buildAnchorageCrowd(descriptor.graph, descriptor.seed);
    // Stall sites come from the vendor module, which is where the seed that places
    // them lives. Sites rather than vendor records: a vendor carries a live market
    // and would rebuild this entire crowd every time somebody bought something.
    const concourse = descriptor.graph.cells.find(cell => cell.kind === 'concourse');
    const traders = concourse
      ? buildStallTraders(concourse.id, anchorageVendorSites(descriptor), descriptor.seed, shoppers.length)
      : [];
    const built = [...shoppers, ...traders];

    const parts = new Map<number, ReturnType<typeof figureParts>>();
    for (const agent of built) {
      if (!parts.has(agent.height)) parts.set(agent.height, figureParts(agent.height));
    }
    const sample = parts.values().next().value ?? [];
    const bodyParts = Math.max(1, sample.filter(part => part.limb !== 'visor').length);
    return {
      agents: built,
      partsByHeight: parts,
      bodyCapacity: Math.max(1, built.length * bodyParts),
      visorCapacity: Math.max(1, built.length)
    };
  }, [descriptor]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      // YXZ, not the default XYZ: the limb swing must happen about the figure's own
      // lateral axis after it has yawed. With XYZ the tilt is applied about world X
      // after the yaw, so a figure walking along X splays its legs sideways.
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      scale: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      colour: new THREE.Color()
    }),
    []
  );

  useFrame(({ clock, camera }) => {
    const bodyMesh = bodyRef.current;
    const visorMesh = visorRef.current;
    if (!bodyMesh || !visorMesh) return;

    const now = anchorageFixedTime() ?? clock.getElapsedTime();
    const visible = currentVisibleCells();
    let bodyIndex = 0;
    let visorIndex = 0;

    for (const agent of agents) {
      if (!visible.has(agent.cellId)) continue;

      const pose = poseAt(agent, now);
      const parts = partsByHeight.get(agent.height);
      if (!parts) continue;

      const posted = agent.role === 'trader';
      const cycle = Math.sin(pose.travelled * 2.3);
      const swing = pose.moving === 0 ? 0 : cycle * STRIDE_SWING;
      // A small vertical bob sells walking more than the legs do.
      let lift = pose.moving === 0 ? 0 : Math.abs(cycle) * 0.035 * (agent.height / 1.7);
      let facing = pose.facing;
      // Arms hang at rest for a walker; a posted figure gets a slow drift instead,
      // because a person standing perfectly still is a mannequin.
      let idleArm = 0;

      if (posted) {
        const breath = Math.sin(now * 0.85 + agent.phase);
        lift = breath * 0.011 * (agent.height / 1.7);
        idleArm = Math.sin(now * 0.31 + agent.phase * 1.7) * 0.07;
        // Weight shifts from one foot to the other over several seconds.
        facing += Math.sin(now * 0.23 + agent.phase * 0.9) * 0.07;
        facing += attentionTurn(agent.stationFacing ?? pose.facing, pose.position, camera.position);
      }

      for (const part of parts) {
        let tilt = 0;
        let partLift = 0;
        switch (part.limb) {
          case 'legLeft':
            tilt = swing;
            break;
          case 'legRight':
            tilt = -swing;
            break;
          case 'armLeft':
            tilt = -swing * ARM_SWING_RATIO - idleArm;
            partLift = lift;
            break;
          case 'armRight':
            tilt = swing * ARM_SWING_RATIO + idleArm;
            partLift = lift;
            break;
          default:
            partLift = lift;
        }

        const local = swungOffset(part, tilt, partLift);
        scratch.offset.set(local[0], local[1], local[2]).applyAxisAngle(UP, facing);
        scratch.position.set(
          pose.position[0] + scratch.offset.x,
          pose.position[1] + scratch.offset.y,
          pose.position[2] + scratch.offset.z
        );
        scratch.euler.set(tilt, facing, 0);
        scratch.quaternion.setFromEuler(scratch.euler);
        scratch.scale.set(part.size[0], part.size[1], part.size[2]);
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);

        if (part.limb === 'visor') {
          visorMesh.setMatrixAt(visorIndex, scratch.matrix);
          // Slight per-agent value shift so a crowd is not one ember repeated.
          scratch.colour.copy(VISOR_EMBER).multiplyScalar(0.76 + (agent.id % 7) * 0.05);
          visorMesh.setColorAt(visorIndex, scratch.colour);
          visorIndex++;
          continue;
        }

        // Packs and legs take the darker suit tone, the way his do.
        const dark = part.limb === 'pack' || part.limb === 'legLeft' || part.limb === 'legRight';
        const palette = posted ? TRADER_TONES : SUIT_TONES;
        const shadow = posted ? TRADER_DARK : SUIT_DARK;
        scratch.colour.copy(dark ? shadow : palette[agent.tone % palette.length]);
        bodyMesh.setMatrixAt(bodyIndex, scratch.matrix);
        bodyMesh.setColorAt(bodyIndex, scratch.colour);
        bodyIndex++;
      }
    }

    bodyMesh.count = bodyIndex;
    bodyMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;

    visorMesh.count = visorIndex;
    visorMesh.instanceMatrix.needsUpdate = true;
    if (visorMesh.instanceColor) visorMesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, bodyCapacity]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} metalness={0.02} />
      </instancedMesh>
      <instancedMesh ref={visorRef} args={[undefined, undefined, visorCapacity]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * How far a posted figure turns from her rest facing toward whoever walks up.
 *
 * Returns a delta rather than an absolute yaw so the caller can add it on top of
 * the idle sway. Clamped and ranged: she looks over, she does not lock on.
 */
function attentionTurn(
  restFacing: number,
  standing: readonly [number, number, number],
  viewer: THREE.Vector3
): number {
  const dx = viewer.x - standing[0];
  const dz = viewer.z - standing[2];
  const distance = Math.hypot(dx, dz);
  if (distance > ATTENTION_RANGE || distance < 1e-3) return 0;

  // Shortest arc from where she is standing to where you are.
  let delta = Math.atan2(dx, dz) - restFacing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  // Eased in as you approach: nothing at the edge of the range, full turn once you
  // are actually at the counter.
  const closeness = (ATTENTION_RANGE - distance) / (ATTENTION_RANGE - ATTENTION_FULL);
  const weight = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(closeness, 0, 1), 0, 1);
  return THREE.MathUtils.clamp(delta, -MAX_HEAD_TURN, MAX_HEAD_TURN) * weight;
}

export function crowdSize(descriptor: AnchorageDescriptor): number {
  const concourse = descriptor.graph.cells.find(cell => cell.kind === 'concourse');
  return (
    buildAnchorageCrowd(descriptor.graph, descriptor.seed).length +
    (concourse ? anchorageVendorSites(descriptor).length : 0)
  );
}

export type { CrowdAgent, CellId };
