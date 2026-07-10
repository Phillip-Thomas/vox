import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { storyDirectorTick } from './storyDirector.ts';
import { advanceToBeat, getStoryStateSnapshot } from './storyState.ts';
import { getStoryInputPolicy } from './storyInputPolicy.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { REDACTION_BANDS } from './storyScript.ts';

/**
 * In-Canvas tick for the story director. Lives INSIDE the R3F frame loop (and
 * outside the keyed EfficientScene, so it survives world swaps) because the
 * director writes shader-facing reality overrides and DOM-facing feed runtime
 * values that must land on the same frame — e.g. the 2-frame chroma flashes.
 *
 * Also owns the redaction projection (it has the camera): the hero tree's
 * bounding sphere → a screen rect the feed HUD censors, escalating as the
 * player closes in.
 */

const APPROACH_DISTANCE = 26;

const _center = new THREE.Vector3();
const _toTree = new THREE.Vector3();
const _camDir = new THREE.Vector3();

function redactionLabelFor(distance: number): string {
  let label = REDACTION_BANDS[0].label;
  for (const band of REDACTION_BANDS) {
    if (distance <= band.withinDistance) label = band.label;
  }
  return label;
}

const StoryDirectorDriver: React.FC = () => {
  const size = useThree(s => s.size);
  const setDpr = useThree(s => s.setDpr);
  const appliedDpr = useRef<number | null>(null);

  useFrame((state, rawDt) => {
    const story = getStoryStateSnapshot();

    // Render-resolution lens (chunky raster/CCTV eras). Quantized so the A2
    // lerp doesn't resize buffers every frame; restored when story goes idle.
    const targetDpr = story.active ? getStoryInputPolicy().targetDpr : null;
    const quantized = targetDpr == null ? null : Math.round(targetDpr * 20) / 20;
    if (quantized !== appliedDpr.current) {
      appliedDpr.current = quantized;
      setDpr(quantized ?? Math.min(window.devicePixelRatio || 1, 1.5));
    }

    if (!story.active) return;
    const playing = getAppStateSnapshot().phase === 'playing';
    const camera = state.camera as THREE.PerspectiveCamera;
    const dt = Math.min(rawDt, 0.1);
    storyDirectorTick(dt, playing && camera.isPerspectiveCamera ? camera : null, state.clock.elapsedTime);

    const r = getFeedRuntime();

    // --- survey marker: the ch1 objective (the anomaly stone) ------------------
    // The feed designates the "uncharted mass" the work order demands: a bracket
    // when the stone is in frame, an edge chevron pointing at it when it isn't.
    if (playing && story.beat === 'ch1-anomaly' && anomalyStoneHandle.position) {
      const playerPos = getPlayerWorldPosition();
      const range = Math.max(0, playerPos.distanceTo(anomalyStoneHandle.position) - 1.5);
      camera.getWorldDirection(_camDir);
      _toTree.copy(anomalyStoneHandle.position).sub(camera.position);
      const depth = _toTree.dot(_camDir);
      const ndc = _center.copy(anomalyStoneHandle.position).project(camera);
      const halfW = size.width / 2;
      const halfH = size.height / 2;
      let x = ndc.x * halfW + halfW;
      let y = -ndc.y * halfH + halfH;
      if (depth < 0) {
        // Behind the camera: the projection flips — mirror it so the chevron
        // points the way you'd turn.
        x = size.width - x;
        y = size.height;
      }
      const margin = 70;
      const offscreen = depth < 0 || x < margin || x > size.width - margin || y < margin || y > size.height - margin;
      const m = r.marker;
      m.visible = true;
      m.offscreen = offscreen;
      m.label = `UNCHARTED MASS · ${Math.round(range)}m`;
      if (offscreen) {
        const dx = x - halfW;
        const dy = y - halfH;
        m.angle = Math.atan2(dy, dx);
        const scale = Math.min((halfW - margin) / Math.max(1, Math.abs(dx)), (halfH - margin) / Math.max(1, Math.abs(dy)));
        m.x = halfW + dx * scale;
        m.y = halfH + dy * scale;
      } else {
        m.x = x;
        m.y = y;
        m.angle = 0;
      }
    } else if (r.marker.visible) {
      r.marker.visible = false;
    }

    // --- hero tree redaction (Ch2 feed beats only) -----------------------------
    const feedBeat = story.beat === 'ch2-color' || story.beat === 'ch2-approach';
    if (!playing || !feedBeat || !heroTreeHandle.position || !heroTreeHandle.up) {
      if (r.redaction.visible) r.redaction.visible = false;
      if (!feedBeat) r.garble = story.beat === 'a2-awakening' ? r.garble : 0;
      return;
    }

    const playerPos = getPlayerWorldPosition();
    const distance = playerPos.distanceTo(heroTreeHandle.position);

    // Closing in flips the approach beat (work order pivots, escalation arms).
    if (story.beat === 'ch2-color' && distance < APPROACH_DISTANCE) {
      advanceToBeat('ch2-approach');
    }

    // Project the tree's bounding sphere to a screen rect.
    _center.copy(heroTreeHandle.position).addScaledVector(heroTreeHandle.up, heroTreeHandle.height * 0.55);
    camera.getWorldDirection(_camDir);
    _toTree.copy(_center).sub(camera.position);
    const depth = _toTree.dot(_camDir);
    if (depth <= 0.5) {
      r.redaction.visible = false;
      return;
    }
    const radius = Math.max(heroTreeHandle.crownRadius * 1.2, heroTreeHandle.height * 0.62);
    const ndc = _center.clone().project(camera);
    const halfH = size.height / 2;
    const halfW = size.width / 2;
    const pxRadius = (radius / depth) * (halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.5;
    const cx = ndc.x * halfW + halfW;
    const cy = -ndc.y * halfH + halfH;

    const stress = THREE.MathUtils.clamp(1 - distance / 20, 0, 1);
    r.redaction.visible = true;
    r.redaction.x = THREE.MathUtils.clamp(cx - pxRadius, -pxRadius, size.width);
    r.redaction.y = THREE.MathUtils.clamp(cy - pxRadius * 1.1, -pxRadius, size.height);
    r.redaction.w = pxRadius * 2;
    r.redaction.h = pxRadius * 2.7; // reach the trunk base — censor the WHOLE question
    r.redaction.stress = stress;
    r.redaction.label = redactionLabelFor(distance);

    // The feed strains as the unrenderable thing fills the frame.
    r.garble = stress * 0.8;
    if (story.beat === 'ch2-approach' && stress > 0.25) {
      r.glitch = Math.max(r.glitch, (stress - 0.25) * 0.6);
      r.scanRoll = Math.max(r.scanRoll, (stress - 0.25) * 0.3);
    }
  });
  return null;
};

export default StoryDirectorDriver;
