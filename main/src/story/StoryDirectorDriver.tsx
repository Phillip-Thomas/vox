import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { anomalyMassDesignated, storyDirectorTick, storyFreeMarkerTarget } from './storyDirector.ts';
import { advanceToBeat, getStoryStateSnapshot } from './storyState.ts';
import { getStoryInputPolicy } from './storyInputPolicy.ts';
import { autopilotTick, isMovieMode } from './autopilot.ts';
import { setScoreIntensity } from './storyScore.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { signalMesaHandle } from './world/SignalMesa.tsx';
import { REDACTION_BANDS } from './storyScript.ts';
import { currentNavWaypointIndex, currentNavWaypointPosition, NAV_WAYPOINT_COUNT } from './navWaypoints.ts';
import { getSupplyPodPositions, isPodCollected } from './supplyPods.ts';

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
const _camPos = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();

function redactionLabelFor(distance: number): string {
  let label = REDACTION_BANDS[0].label;
  for (const band of REDACTION_BANDS) {
    if (distance <= band.withinDistance) label = band.label;
  }
  return label;
}

function surveyMarkerTarget(beat: string | null): { position: THREE.Vector3; label: string } | null {
  // One goal at a time: the mass is only designated AFTER the calibration
  // sweep — until then the CCTV era has exactly one task, looking.
  if (beat === 'ch1-anomaly' && anomalyStoneHandle.position && anomalyMassDesignated()) {
    return { position: anomalyStoneHandle.position, label: 'UNCHARTED MASS' };
  }
  if (beat === 'ch1-iso' && signalMesaHandle.summit) {
    // The iso era climbs the mesa; the signal source is its summit (the anomaly
    // stone now lies across the gravity edge, designated only in ch1-anomaly).
    return { position: signalMesaHandle.summit, label: 'SIGNAL SOURCE' };
  }
  if (beat === 'ch1-nav') {
    const wp = currentNavWaypointPosition();
    if (wp) {
      return { position: wp, label: `TRIANGULATION ${currentNavWaypointIndex() + 1}/${NAV_WAYPOINT_COUNT}` };
    }
    return null;
  }
  if (beat === 'ch1-depth') {
    const positions = getSupplyPodPositions();
    let nearest: THREE.Vector3 | null = null;
    let nearestDist = Infinity;
    const player = getPlayerWorldPosition();
    positions.forEach((pos, i) => {
      if (isPodCollected(i)) return;
      const dist = player.distanceTo(pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pos;
      }
    });
    return nearest ? { position: nearest, label: 'SUPPLY POD' } : null;
  }
  // Post-feed beats (the first day alive / ch4): the director owns the target.
  return storyFreeMarkerTarget();
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
    if (isMovieMode()) autopilotTick(dt);

    const r = getFeedRuntime();

    // --- survey marker: the current objective, per era --------------------------
    // The feed designates whatever the work order demands: the next supply pod,
    // the active triangulation fix, the signal source, the uncharted mass — a
    // bracket when in frame, an edge chevron pointing at it when it isn't.
    const markerTarget = playing ? surveyMarkerTarget(story.beat) : null;
    if (markerTarget) {
      const playerPos = getPlayerWorldPosition();
      const range = Math.max(0, playerPos.distanceTo(markerTarget.position) - 1.5);
      // Direction to the goal in CAMERA space — meaningful in front, beside,
      // or behind (a raw NDC projection flips behind the camera, which used to
      // aim the chevron at nothing).
      camera.getWorldPosition(_camPos);
      camera.getWorldQuaternion(_camQuat);
      _camQuat.invert();
      _toTree.copy(markerTarget.position).sub(_camPos).applyQuaternion(_camQuat);
      const depth = -_toTree.z; // camera looks down -Z
      const halfW = size.width / 2;
      const halfH = size.height / 2;
      const margin = 70;
      const m = r.marker;
      m.visible = true;
      m.label = `${markerTarget.label} · ${Math.round(range)}m`;

      let onscreen = false;
      if (depth > 0.5) {
        const ndc = _center.copy(markerTarget.position).project(camera);
        const x = ndc.x * halfW + halfW;
        const y = -ndc.y * halfH + halfH;
        onscreen = x >= margin && x <= size.width - margin && y >= margin && y <= size.height - margin;
        if (onscreen) {
          m.offscreen = false;
          m.x = x;
          m.y = y;
          m.angle = 0;
        }
      }
      if (!onscreen) {
        // Edge chevron: screen-space direction straight from camera space
        // (screen y grows DOWN, camera y grows up).
        let sx = _toTree.x;
        let sy = -_toTree.y;
        const len = Math.hypot(sx, sy);
        if (len < 1e-4) {
          sx = 0;
          sy = 1; // dead astern with no lateral hint: point down
        } else {
          sx /= len;
          sy /= len;
        }
        const scale = Math.min(
          (halfW - margin) / Math.max(1e-4, Math.abs(sx)),
          (halfH - margin) / Math.max(1e-4, Math.abs(sy))
        );
        m.offscreen = true;
        m.x = halfW + sx * scale;
        m.y = halfH + sy * scale;
        m.angle = Math.atan2(sy, sx);
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

    // Project the tree's bounding sphere to a screen rect. Size by the EUCLIDEAN
    // range (not the on-axis depth — that collapses toward 0 as you look away
    // from the tree, blowing pxRadius up until the box consumes the screen), and
    // drop the box entirely once the sphere leaves the frustum.
    _center.copy(heroTreeHandle.position).addScaledVector(heroTreeHandle.up, heroTreeHandle.height * 0.55);
    camera.getWorldDirection(_camDir);
    _toTree.copy(_center).sub(camera.position);
    const depth = _toTree.dot(_camDir); // on-axis: > 0 means in front of the camera
    const range = Math.max(0.5, _toTree.length()); // true distance to the sphere centre
    if (depth <= 0.5) {
      r.redaction.visible = false;
      return;
    }
    const ndc = _center.clone().project(camera);
    // Meaningfully outside the view (behind is already handled above): stop censoring.
    if (Math.abs(ndc.x) > 1.6 || Math.abs(ndc.y) > 1.6) {
      r.redaction.visible = false;
      return;
    }
    const radius = Math.max(heroTreeHandle.crownRadius * 1.2, heroTreeHandle.height * 0.62);
    const halfH = size.height / 2;
    const halfW = size.width / 2;
    // Angular size from the true range; capped at 45% of viewport height so a
    // near pass can never balloon the box past the frame (same framing as before
    // when the tree is actually centred, where range ≈ depth).
    const rawPxRadius = (radius / range) * (halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.5;
    const pxRadius = Math.min(rawPxRadius, size.height * 0.45);
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

    // The feed strains as the unrenderable thing fills the frame — and the
    // score's heartbeat climbs with the same proximity.
    r.garble = stress * 0.8;
    if (story.beat === 'ch2-approach') {
      setScoreIntensity(0.45 + stress * 0.55);
      if (stress > 0.25) {
        r.glitch = Math.max(r.glitch, (stress - 0.25) * 0.6);
        r.scanRoll = Math.max(r.scanRoll, (stress - 0.25) * 0.3);
      }
    }
  });
  return null;
};

export default StoryDirectorDriver;
