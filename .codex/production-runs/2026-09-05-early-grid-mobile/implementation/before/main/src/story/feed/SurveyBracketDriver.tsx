import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { getFeedRuntime, FEED_BRACKET_SLOTS } from '../feedRuntime.ts';
import { getSideLens } from '../sideLens.ts';
import { getStoryStateSnapshot } from '../storyState.ts';
import { getAppStateSnapshot } from '../../state/appState.ts';
import { getPlayerWorldPosition } from '../../state/playerFrame.ts';
import { getDebrisPositions, isDebrisCollected } from '../debrisSalvage.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { BLOCKS } from '../../game/data/blocks.ts';
import { getVoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { debrisSalvageComplete } from '../debrisSalvage.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from '../storyScript.ts';
import { isAutopilotDriving } from '../autopilot.ts';
import {
  SURVEY_BRACKET_LIMIT,
  SURVEY_BRACKET_SALVAGE_SHARE,
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

export default function SurveyBracketDriver({ paused = false }: { paused?: boolean } = {}): null {
  const size = useThree(state => state.size);
  const targets = useRef<SurveyBracketTarget[]>([]);
  const sinceSelect = useRef(Infinity);
  // Reused so the per-frame path allocates nothing.
  const probe = useMemo(
    () => (x: number, y: number, z: number) => {
      const voxel = voxelSystem.getVoxel(x, y, z);
      if (!voxel) return null;
      return { yields: BLOCKS[voxel.blockId]?.drops.includes('biofiber') ?? false };
    },
    []
  );

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
    if (!mode || !playing || paused || isAutopilotDriving()
      || !story.active || !monochrome || r.externalCameraMix < 0.5) {
      for (const bracket of r.brackets) bracket.visible = false;
      targets.current = [];
      sinceSelect.current = Infinity;
      return;
    }

    const dt = Math.min(0.25, Math.max(0, rawDt));
    sinceSelect.current += dt;
    const playerPosition = getPlayerWorldPosition();
    if (sinceSelect.current >= SELECT_INTERVAL_SECONDS) {
      sinceSelect.current = 0;
      // Designate what is OUTSTANDING, not what the beat is nominally about.
      const fiberQuota = mode === 'harvest' ? CH1_FIXED_TUTORIAL.biofiber : CH1_QUOTA.biofiber;
      const demand = surveyBracketDemand(story.beat, {
        fiber: getItemCount('biofiber') < fiberQuota,
        debris: !debrisSalvageComplete()
      });
      const salvage = demand.salvage
        ? collectSalvageBracketTargets(
            playerPosition,
            getDebrisPositions(),
            isDebrisCollected,
            // Debris never crowds out the fiber the player cannot see.
            demand.harvest ? SURVEY_BRACKET_SALVAGE_SHARE : SURVEY_BRACKET_LIMIT
          )
        : [];
      const lens = getSideLens();
      const harvest = demand.harvest && lens
        ? collectHarvestBracketTargets(playerPosition, lens, probe, SURVEY_BRACKET_LIMIT - salvage.length)
        : [];
      targets.current = [...salvage, ...harvest];
    }

    const camera = state.camera;
    for (let i = 0; i < FEED_BRACKET_SLOTS; i++) {
      const bracket = r.brackets[i];
      const target = targets.current[i];
      if (!target) {
        bracket.visible = false;
        continue;
      }
      _ndc.copy(target.position).project(camera);
      // Behind the camera, or far enough outside the frame that a clamped box
      // would designate empty ground rather than the target.
      if (_ndc.z > 1 || Math.abs(_ndc.x) > 1.15 || Math.abs(_ndc.y) > 1.15) {
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
