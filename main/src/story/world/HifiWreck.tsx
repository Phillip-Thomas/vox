import React, { useEffect, useMemo } from 'react';
import SpaceshipPlaceholder from '../../components/SpaceshipPlaceholder.tsx';
import { getPodImpactPose } from './storyWorld.ts';
import { hifiWreckHandle, useHifiWreckConverted } from './hifiWreck.ts';

// --- The high-fidelity crash wreck ---------------------------------------------
//
// At the A3 material awakening the voxel DescentPod converts into the real ship:
// the pod's smoking box wreck unmounts (DescentPod self-hides on the same
// milestone) and the hi-fi hull settles into the impact site in a crashed
// attitude — tilted, dug in, oriented to the local surface normal. Non-flyable:
// it's a landmark, not a vehicle, so nothing lets the player board it mid-story.
//
// Keyed on the persisted a3 milestone, so a resume/deep-link past the awakening
// loads straight into the hi-fi wreck. When the conversion happens with the
// player present it's a one-frame swap (pod out, ship in) — soft enough.

interface HifiWreckProps {
  planetSize: number;
  terrainSeed: number;
}

const HifiWreck: React.FC<HifiWreckProps> = ({ planetSize, terrainSeed }) => {
  const converted = useHifiWreckConverted();
  const impact = useMemo(() => getPodImpactPose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  // Perch the hull slightly above the pod's ground contact (settled, not floating).
  const shipPosition = useMemo(
    () => impact.position.clone().addScaledVector(impact.up, 0.6),
    [impact]
  );

  // Publish the handle for the copy agent: the impact site is known while the
  // wreck is mounted (a story world); `converted` flips at the awakening.
  useEffect(() => {
    hifiWreckHandle.position = shipPosition;
    return () => {
      hifiWreckHandle.position = null;
    };
  }, [shipPosition]);
  useEffect(() => {
    hifiWreckHandle.converted = converted;
    return () => {
      hifiWreckHandle.converted = false;
    };
  }, [converted]);

  if (!converted) return null;

  return (
    <SpaceshipPlaceholder
      position={shipPosition}
      terrainSeed={terrainSeed}
      activeApproach={false}
      interactive={false}
      crashedTilt={0.28}
    />
  );
};

export default HifiWreck;
