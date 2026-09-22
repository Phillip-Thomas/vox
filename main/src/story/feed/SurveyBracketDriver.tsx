import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { getFeedRuntime, FEED_BRACKET_SLOTS } from '../feedRuntime.ts';
import { getSideFacing, getSideLens, getLensRig, rigMoveBasis, getFixedScreenCoverage } from '../sideLens.ts';
import { getStoryStateSnapshot } from '../storyState.ts';
import { getAppStateSnapshot } from '../../state/appState.ts';
import { getPlayerWorldPosition, getPlayerUp } from '../../state/playerFrame.ts';
import { getDebrisPositions, isDebrisCollected, requiredDebrisSalvageComplete } from '../debrisSalvage.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { BLOCKS } from '../../game/data/blocks.ts';
import { getVoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { canHarvestVoxel } from '../../game/systems/harvestingSystem.ts';
import { getEquippedToolTier } from '../../game/systems/loadoutSystem.ts';
import { getGuidedObjectivePresentationState } from '../ux/objectiveDirector.ts';
import { makeTangentBasis } from '../../utils/surfaceControls.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from '../storyScript.ts';
import {
  pickSideHarvestVoxel,
  resolveSurveyTargetPresentation,
  setSurveyTargetPresentation,
  setDesignatedSurveyTargetKey,
  collectHarvestBracketTargets,
  collectSalvageBracketTargets,
  solveSurveyBracketRect,
  surveyBracketDemand,
  surveyBracketMode,
  type SurveyBracketTarget
} from './surveyBrackets.ts';

// --- The survey bracket driver ------------------------------------------------------
//
// In-Canvas half of the bracket overlay: it owns the camera, so it does the
// projection and writes screen-space boxes into the feed runtime. The DOM half
// reads those in its own rAF (the WarpOverlay pattern used by every other feed
// element) — no React re-renders per frame.
//
// Deliberately separate from StoryDirectorDriver: the objective marker
// designates ONE subject and may leave the frame as a chevron, whereas brackets
// only ever ring targets already on screen. Keeping them apart also keeps the
// marker's route-key hysteresis from being disturbed by a second consumer.

/** Box edge in px. Large enough to ring a voxel at side-lens range, small
 *  enough that four of them never tile the frame. */
const BRACKET_SIZE = 46;

/** Recompute the candidate set at 6 Hz. The voxel scan is cheap but not free,
 *  and a designator that re-picks every frame flickers between equidistant
 *  blocks instead of designating one. Projection still runs every frame, so
 *  the boxes track the camera smoothly between selections. */
const SELECT_INTERVAL_SECONDS = 1 / 6;

const _ndc = new THREE.Vector3();
const _forward = new THREE.Vector3(), _right = new THREE.Vector3();
const _moveForward = new THREE.Vector3(), _moveRight = new THREE.Vector3();

export default function SurveyBracketDriver({ paused = false }: { paused?: boolean } = {}): null {
  const size = useThree(state => state.size);
  const targets = useRef<SurveyBracketTarget[]>([]);
  const sinceSelect = useRef(Infinity);
  const objectiveIdentity = useRef<object | null>(null);
  const restoreIdentity = useRef('');
  const projectionFrame = useRef(0);
  // Reused so the per-frame path allocates nothing.
  const probe = useMemo(
    () => (x: number, y: number, z: number) => {
      const voxel = voxelSystem.getVoxel(x, y, z);
      if (!voxel || !canHarvestVoxel({ blockId: voxel.blockId, deposit: voxel.deposit, toolTier: getEquippedToolTier() })) return null;
      return { yields: BLOCKS[voxel.blockId]?.drops.includes('biofiber') ?? false };
    },
    []
  );

  useEffect(() => () => {
    for (const bracket of getFeedRuntime().brackets) bracket.visible = false;
    setDesignatedSurveyTargetKey(null); setSurveyTargetPresentation(null);
  }, []);

  useFrame((state, rawDt) => {
    const r = getFeedRuntime();
    const story = getStoryStateSnapshot();
    const mode = surveyBracketMode(story.beat);
    const playing = getAppStateSnapshot().phase === 'playing';
    // The brackets are a prosthesis for the missing material channel, so they
    // retire the moment the ladder hands that channel back. `bare` is the only
    // stage with no chroma and no surface detail at all.
    const monochrome = getVoxelRealityStage() === 'bare';
    // The screening is not a player and does not need a prosthesis; brackets in
    // a capture would read as shipped chrome in every cinematography frame.
    if (!mode || !playing || paused
      || !story.active || !monochrome || r.externalCameraMix < 0.5) {
      for (const bracket of r.brackets) bracket.visible = false;
      setDesignatedSurveyTargetKey(null);
      setSurveyTargetPresentation(null);
      targets.current = [];
      sinceSelect.current = Infinity;
      return;
    }

    const presentation = getGuidedObjectivePresentationState();
    const objective = presentation.objective;
    const restoreKey = `${presentation.runVersion}:${presentation.restoreVersion}`;
    if (objectiveIdentity.current !== objective || restoreIdentity.current !== restoreKey) {
      objectiveIdentity.current = objective; restoreIdentity.current = restoreKey;
      targets.current = []; sinceSelect.current = Infinity; setSurveyTargetPresentation(null);
    }
    const target = targets.current[0];
    if (target?.key.startsWith('d:') && isDebrisCollected(Number(target.key.slice(2)))) sinceSelect.current = Infinity;
    if (target?.key.startsWith('v:')) {
      const [x, y, z] = target.key.slice(2).split(',').map(Number);
      if (!probe(x, y, z)?.yields) sinceSelect.current = Infinity;
    }
    const lensNow = getSideLens();
    const native = lensNow && target?.label === 'BIOFIBER' ? pickSideHarvestVoxel(getPlayerWorldPosition(), lensNow, getSideFacing(), probe, true) : null;
    if (native && target?.key !== `v:${native.x},${native.y},${native.z}`) sinceSelect.current = Infinity;
    const dt = Math.min(0.25, Math.max(0, rawDt));
    sinceSelect.current += dt;
    const playerPosition = getPlayerWorldPosition();
    if (sinceSelect.current >= SELECT_INTERVAL_SECONDS) {
      sinceSelect.current = 0;
      const fiberQuota = story.beat === 'ch1-fixed' ? CH1_FIXED_TUTORIAL.biofiber : CH1_QUOTA.biofiber;
      const demand = surveyBracketDemand(story.beat, {
        fiber: getItemCount('biofiber') < fiberQuota,
        debris: story.beat === 'ch1-fixed' ? !isDebrisCollected(0) : !requiredDebrisSalvageComplete()
      });
      const lens = getSideLens();
      const salvage = demand.salvage ? collectSalvageBracketTargets(playerPosition, getDebrisPositions(),
        index => isDebrisCollected(index) || (story.beat === 'ch1-fixed' && index !== 0), 3) : [];
      const actual = demand.harvest && lens ? pickSideHarvestVoxel(playerPosition, lens, getSideFacing(), probe, true) : null;
      const harvest = demand.harvest && lens ? collectHarvestBracketTargets(playerPosition, lens, probe, 28, position => {
        const support = position.clone().addScaledVector(lens.up, -1.8);
        const voxel = voxelSystem.getVoxel(Math.round(support.x / VOXEL_SCALE), Math.round(support.y / VOXEL_SCALE), Math.round(support.z / VOXEL_SCALE));
        return !!voxel && !BLOCKS[voxel.blockId]?.tags.includes('liquid');
      }) : [];
      if (actual) harvest.unshift({ key: `v:${actual.x},${actual.y},${actual.z}`, position: new THREE.Vector3(actual.x, actual.y, actual.z).multiplyScalar(VOXEL_SCALE), label: 'BIOFIBER', approach: playerPosition.clone(), facing: getSideFacing() });
      // Identity belongs to the valid action; camera visibility cannot discard it.
      const candidates = [...salvage, ...harvest];
      const previous = targets.current[0];
      let retained = candidates.find(candidate => candidate.key === previous?.key);
      if (!retained && previous?.label === 'BIOFIBER' && previous.approach && previous.facing && lens) {
        const selected = pickSideHarvestVoxel(previous.approach, lens, previous.facing, probe, true);
        const support = previous.approach.clone().addScaledVector(lens.up, -1.8);
        const voxel = voxelSystem.getVoxel(Math.round(support.x / VOXEL_SCALE), Math.round(support.y / VOXEL_SCALE), Math.round(support.z / VOXEL_SCALE));
        if (selected && previous.key === `v:${selected.x},${selected.y},${selected.z}` && voxel && !BLOCKS[voxel.blockId]?.tags.includes('liquid')) retained = previous;
      }
      targets.current = actual ? [candidates[0]] : retained ? [retained] : candidates.length ? [candidates[0]] : [];

    }

    setDesignatedSurveyTargetKey(targets.current[0]?.key ?? null);
    const camera = state.camera;
    const chosen = targets.current[0];
    const lens = getSideLens();
    let approach = chosen?.approach;
    let validApproach = false;
    if (chosen && lens) {
      rigMoveBasis(lens, getLensRig(), _forward, _right);
      makeTangentBasis(getPlayerUp(), _forward, _forward, _moveForward, _moveRight);
      if (chosen.label === 'DEBRIS') {
        // The real pickup lies on the legal row; approach stays on the player's standing plane.
        approach = playerPosition.clone().addScaledVector(lens.travelAxis, chosen.position.clone().sub(playerPosition).dot(lens.travelAxis));
        validApproach = Math.abs(approach.clone().sub(lens.origin).dot(lens.travelAxis)) <= 29
          && approach.distanceTo(chosen.position) < 2.8;
      } else if (approach && chosen.facing) {
        const selected = pickSideHarvestVoxel(approach, lens, chosen.facing, probe, true);
        const support = approach.clone().addScaledVector(lens.up, -1.8);
        const voxel = voxelSystem.getVoxel(Math.round(support.x / VOXEL_SCALE), Math.round(support.y / VOXEL_SCALE), Math.round(support.z / VOXEL_SCALE));
        validApproach = !!voxel && !BLOCKS[voxel.blockId]?.tags.includes('liquid')
          && !!selected && chosen.key === `v:${selected.x},${selected.y},${selected.z}`;
      }
    }
    const actualNow = chosen?.label === 'BIOFIBER' && lens ? pickSideHarvestVoxel(playerPosition, lens, getSideFacing(), probe, true) : null;
    const nativeActionable = !!actualNow && chosen?.key === `v:${actualNow.x},${actualNow.y},${actualNow.z}`;
    if (chosen) _ndc.copy(chosen.position).project(camera); else _ndc.set(NaN, NaN, NaN);
    const bearing = resolveSurveyTargetPresentation({ ndc: _ndc, player: playerPosition, approach,
      movementRight: _moveRight, validApproach, nativeActionable });
    setSurveyTargetPresentation(objective ? { objective, objectiveId: objective.id,
      runVersion: presentation.runVersion, restoreVersion: presentation.restoreVersion,
      geometry: `${getFixedScreenCoverage()?.geometryEpoch ?? 0}:${size.width}:${size.height}:${camera.projectionMatrix.elements.join(',')}`,
      frame: ++projectionFrame.current, viewportWidth: size.width, viewportHeight: size.height, targetKey: chosen?.key ?? null, targetLabel: chosen?.label ?? null,
      approach: approach ? [approach.x, approach.y, approach.z] : undefined, facing: chosen?.facing,
      movementRight: [_moveRight.x, _moveRight.y, _moveRight.z],
      nativeActionable, ...bearing, fit: bearing.horizontalOffscreen ? 'offscreen' : 'pending' } : null);

    for (let i = 0; i < FEED_BRACKET_SLOTS; i++) {
      const bracket = r.brackets[i];
      const target = targets.current[i];
      if (!target || (!validApproach && !nativeActionable)) {
        if (target) sinceSelect.current = Infinity;
        bracket.visible = false;
        continue;
      }
      _ndc.copy(target.position).project(camera);
      // Behind the camera, or far enough outside the frame that a clamped box
      // would designate empty ground rather than the target.
      if (!Number.isFinite(_ndc.x) || !Number.isFinite(_ndc.y) || !Number.isFinite(_ndc.z) || _ndc.z < -1 || _ndc.z > 1 || Math.abs(_ndc.x) > 1 - BRACKET_SIZE / size.width || Math.abs(_ndc.y) > 1 - BRACKET_SIZE / size.height) {
        bracket.visible = false;
        continue;
      }
      const rect = solveSurveyBracketRect(
        _ndc.x * (size.width / 2) + size.width / 2,
        -_ndc.y * (size.height / 2) + size.height / 2,
        BRACKET_SIZE,
        size.width,
        size.height
      );
      bracket.visible = true;
      bracket.x = rect.x;
      bracket.y = rect.y;
      bracket.size = rect.size;
      bracket.labelFlipped = rect.labelFlipped;
      bracket.label = target.label;
    }
  });

  return null;
}
