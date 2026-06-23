import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei';
import type { CubeFace } from '../types/cube';
import { efficientPlanetMesh } from './EfficientPlanet';
import CameraControls from './CameraControls';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import {
  DEFAULT_JUMP_SPEED,
  DEFAULT_MOVE_SPEED,
  JumpState,
  SurfaceState,
  applyJumpImpulse,
  areAdjacentFaces,
  chooseFaceFromPosition,
  composeVelocity,
  dominantFaceForPosition,
  FACE_NORMALS,
  GRAVITY_STRENGTH,
  getSurfaceState,
  quaternionForUp,
  integrateLocalGravity,
  JETPACK_MAX_FUEL,
  JETPACK_MAX_UP_SPEED,
  JETPACK_REFILL_RATE,
  JETPACK_THRUST,
  makeTangentBasis,
  movementDirectionFromBasis,
  planarCameraBasis,
  predictPosition,
  reprojectVelocityOntoFace,
  transitionVelocityAcrossEdge,
  transportControlFrame,
  updateJumpState,
  vectorFromRapier,
  vectorToRapier,
  wrapPositionAroundEdge
} from '../utils/surfaceControls';
import { resolveSurfaceFrame } from '../utils/surfaceResolver';
import { smoothUpForPosition } from '../utils/gravityField';
import { setPlayerUp, setPlayerWorldPosition } from '../state/playerFrame';
import {
  EDGE_HYSTERESIS,
  FIXED_PHYSICS_STEP,
  GROUND_NORMAL_MIN_DOT,
  GROUND_PROBE_FOOT_OFFSET,
  GROUND_PROBE_LENGTH,
  GROUND_PROBE_LIFT,
  PLAYER_CAPSULE_HALF_HEIGHT,
  PLAYER_CAPSULE_RADIUS,
  PLAYER_CENTER_CLEARANCE,
  PLAYER_EDGE_RADIUS,
  TRANSITION_LOCK_TIME,
  TRANSITION_MIN_INWARD_SPEED,
  VOXEL_SCALE
} from '../utils/cubeGravityConstants';
import { isTouchActive } from '../utils/mobileInput';
import { MaterialType } from '../types/materials';
import { canHarvestVoxel, computeMineDuration, harvestClassForBlock, harvestVoxel, mineDurationMs, requiredToolTierForVoxel } from '../game/systems/harvestingSystem';
import { ensureStarterLoadout, getEquippedToolTier, selectTool, toolSpeedFor } from '../game/systems/loadoutSystem';
import { clearMiningProgress, setMiningProgress } from '../game/systems/miningProgress';
import { CHARGE_PER_BREAK, consumeMawCharge, isMawPowered, refuelFromInventory } from '../game/systems/mawSystem';
import { harvestTree, isTreeHarvested, TREE_HARDNESS, TREE_TOOL_TIER } from '../game/systems/treeHarvest';
import { collectStone, isStoneCollected } from '../game/systems/stonePickup';
import { isBuildEnabled, getSelectedPiece } from '../game/systems/buildState';
import { canAfford, placePiece, removePiece } from '../game/systems/structureSystem';
import { resolveBuildTarget, marchWallTarget, marchCeilingTarget, type BuildHit } from '../utils/buildPlacement';
import { faceIndexForNormal } from '../game/systems/structureSystem';
import { clearBuildGhost, setBuildGhost } from '../game/systems/buildGhost';
import { treeFieldHandle } from './TreeField';
import { looseStoneHandle } from './LooseStoneField';
import { structureFieldHandle } from './StructureField';
import { setLookedAt, type LookedAt } from '../game/systems/targeting';
import { playSfx, setJetpackSfx } from '../audio/sfxEngine.ts';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
const BLOCK_REACH = 8;
// Cadence of the "chipping" mine sound while holding to harvest (ms).
const MINE_TICK_MS = 260;
// Loose stones are picked up, not mined — a short, tool-independent hold.
const STONE_PICKUP_MS = 280;
// Speed multiplier when mining with an unfuelled charge-tool (bare-handed rate).
const BARE_HAND_MUL = 0.35;
// Continuous smooth-gravity field is now the DEFAULT (no faces/transitions/
// resolver — can't fall off or get stuck by construction). The discrete 6-face
// state machine stays available via ?gravity=discrete as a one-session safety
// hatch; once smooth is confirmed across all scenarios the discrete machinery
// (surfaceResolver, chooseFaceFromPosition, beginTransition, wrap/cooldowns) can
// be deleted.
const SMOOTH_GRAVITY = typeof window === 'undefined'
  || new URLSearchParams(window.location.search).get('gravity') !== 'discrete';
// Scratch for the cheap "what am I looking at" voxel ray-march (avoids a
// 125k-instance InstancedMesh raycast every frame).
const _lookOrigin = new THREE.Vector3();
const _lookDir = new THREE.Vector3();

// Rotation taking oldUp -> newUp, robust for the ANTIPARALLEL case (top<->bottom
// after a straight tunnel-through) where setFromUnitVectors is degenerate.
function rotationBetweenUps(oldUp: THREE.Vector3, newUp: THREE.Vector3): THREE.Quaternion {
  const d = THREE.MathUtils.clamp(oldUp.dot(newUp), -1, 1);
  if (d < -0.9999) {
    const axis = (Math.abs(oldUp.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));
    axis.cross(oldUp).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
  }
  return new THREE.Quaternion().setFromUnitVectors(oldUp, newUp);
}

// Jetpack fuel as a normalized 0..1 value, exposed module-side so the HUD can
// poll it per-frame (mirrors ShipController.getEngageCharge) without re-rendering.
let jetpackFuelDisplay = 1;
export function getJetpackFuel(): number {
  return jetpackFuelDisplay;
}
const VISUAL_TRANSITION_TIME = 0.42;
const PLAYER_LOCAL_UP = new THREE.Vector3(0, 1, 0);

interface RotationAnimation {
  startTime: number;
  startRotation: THREE.Quaternion;
  targetRotation: THREE.Quaternion;
}

export interface PlayerDebugState {
  face: CubeFace;
  targetFace: CubeFace | null;
  grounded: boolean;
  controlsActive: boolean;
  speed: number;
  gravity: [number, number, number];
  position: [number, number, number];
}

interface EfficientPlayerProps {
  planetSize: number;
  initialPosition?: THREE.Vector3;
  resetPosition?: THREE.Vector3;
  onPositionChange?: (position: THREE.Vector3) => void;
  onSurfaceChange?: (surface: SurfaceState) => void;
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: PlayerDebugState) => void;
}

export default function EfficientPlayer({
  planetSize,
  initialPosition,
  resetPosition,
  onPositionChange,
  onSurfaceChange,
  onGroundedChange,
  onDebugChange
}: EfficientPlayerProps) {
  const ref = useRef<RapierRigidBody | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [, get] = useKeyboardControls();
  const { world, rapier } = useRapier();

  // Seed gravity from the SPAWN position's face, not a hardcoded 'top'. Exiting
  // the ship spawns you wherever you landed it (any of the 6 faces); initializing
  // to 'top' left gravity pointing the wrong way for the first frames (and mid-
  // face it never auto-corrected, since chooseFaceFromPosition only fires at edges).
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(
    () => getSurfaceState(initialPosition ? dominantFaceForPosition(initialPosition) : 'top')
  );
  const surfaceRef = useRef<SurfaceState>(surfaceState);
  const visualCameraUp = useRef(surfaceState.up.clone());
  const rotationAnimation = useRef<RotationAnimation | null>(null);
  const lastPlanarForward = useRef(new THREE.Vector3(0, 0, -1));
  const controlsActive = useRef(false);
  // Hold-to-mine accumulator: the voxel being mined (coord key), elapsed/needed
  // time, and when the last chip sound played. Reset when the key is released,
  // the crosshair leaves the voxel, or the block breaks.
  const mineState = useRef<{ key: string | null; elapsed: number; duration: number; tickAt: number; usesCharge: boolean }>(
    { key: null, elapsed: 0, duration: 0, tickAt: 0, usesCharge: false }
  );
  // Build mode uses EDGE presses (place once per press), not hold.
  const prevBuildKey = useRef(false);
  const prevDeconKey = useRef(false);
  const frameCount = useRef(0);
  const transitionCooldown = useRef(0);
  const lastGrounded = useRef(false);
  const lastGroundedNotification = useRef<boolean | null>(null);
  const jumpState = useRef<JumpState>({
    isGrounded: false,
    coyoteTimeRemaining: 0,
    jumpBufferRemaining: 0,
    previousJump: false
  });
  const jetpackFuel = useRef(JETPACK_MAX_FUEL);
  const defaultSpawnPosition = useMemo(
    () => new THREE.Vector3(0, planetSize + PLAYER_CENTER_CLEARANCE + 2, 0),
    [planetSize]
  );
  const initialSpawnPosition = useMemo(
    () => (initialPosition ?? defaultSpawnPosition).clone(),
    [defaultSpawnPosition, initialPosition]
  );
  // Initial body rotation aligned to the SPAWN face (not identity/top), so the
  // capsule + camera are correctly oriented on the first frame after exiting the
  // ship on any face — no tilted body poking into view before a transition fires.
  const initialSpawnQuat = useMemo(
    () => quaternionForUp(FACE_NORMALS[dominantFaceForPosition(initialSpawnPosition)]),
    [initialSpawnPosition]
  );
  const resetSpawnPosition = useMemo(
    () => (resetPosition ?? defaultSpawnPosition).clone(),
    [defaultSpawnPosition, resetPosition]
  );

  const setSurface = useCallback((next: SurfaceState) => {
    surfaceRef.current = next;
    setSurfaceState(next);
    onSurfaceChange?.({
      ...next,
      up: next.up.clone(),
      gravity: next.gravity.clone()
    });
  }, [onSurfaceChange]);

  // Emit the initial (spawn-position-derived) surface once on mount so the scene
  // and planet orient collision streaming correctly from the first frame after a
  // spawn or ship exit, not just after the first edge transition.
  useEffect(() => {
    onSurfaceChange?.({
      ...surfaceRef.current,
      up: surfaceRef.current.up.clone(),
      gravity: surfaceRef.current.gravity.clone()
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => setJetpackSfx(false), []);

  const updateVisualTransition = useCallback(() => {
    const animation = rotationAnimation.current;
    const body = ref.current;
    if (!animation || !body) return;

    const progress = Math.min((performance.now() - animation.startTime) / (VISUAL_TRANSITION_TIME * 1000), 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const rotation = animation.startRotation.clone().slerp(animation.targetRotation, eased);

    body.setRotation(rotation, true);
    visualCameraUp.current.copy(PLAYER_LOCAL_UP).applyQuaternion(rotation).normalize();

    if (progress >= 1) {
      body.setRotation(animation.targetRotation, true);
      visualCameraUp.current.copy(PLAYER_LOCAL_UP).applyQuaternion(animation.targetRotation).normalize();
      rotationAnimation.current = null;
    }
  }, []);

  const checkGrounded = useCallback((position: THREE.Vector3, up: THREE.Vector3) => {
    const basis = makeTangentBasis(up, lastPlanarForward.current);
    const offsets = [
      new THREE.Vector3(0, 0, 0),
      basis.forward.clone().multiplyScalar(GROUND_PROBE_FOOT_OFFSET),
      basis.forward.clone().multiplyScalar(-GROUND_PROBE_FOOT_OFFSET),
      basis.right.clone().multiplyScalar(GROUND_PROBE_FOOT_OFFSET),
      basis.right.clone().multiplyScalar(-GROUND_PROBE_FOOT_OFFSET)
    ];
    const direction = up.clone().multiplyScalar(-1);

    for (const offset of offsets) {
      const origin = position.clone().addScaledVector(up, GROUND_PROBE_LIFT).add(offset);
      const ray = new rapier.Ray(vectorToRapier(origin), vectorToRapier(direction));
      const hit = world.castRayAndGetNormal(ray, GROUND_PROBE_LENGTH, true, undefined, undefined, undefined, ref.current ?? undefined);
      if (!hit) continue;

      const normal = vectorFromRapier(hit.normal).normalize();
      if (normal.dot(up) >= GROUND_NORMAL_MIN_DOT) return true;
    }

    return false;
  }, [rapier, world]);

  const beginTransition = useCallback((
    targetFace: CubeFace,
    sourcePosition: THREE.Vector3,
    sourceVelocity: THREE.Vector3,
    basis: { forward: THREE.Vector3; right: THREE.Vector3 }
  ) => {
    const body = ref.current;
    if (!body) return false;

    const current = surfaceRef.current;
    if (current.face === targetFace || !areAdjacentFaces(current.face, targetFace)) return false;
    updateVisualTransition();

    const target = getSurfaceState(targetFace);
    const currentRotation = body.rotation();
    const startRotation = new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
    const deltaRotation = new THREE.Quaternion().setFromUnitVectors(current.up, target.up);
    const targetRotation = new THREE.Quaternion().multiplyQuaternions(deltaRotation, startRotation);
    const transported = transportControlFrame(
      { up: current.up, forward: basis.forward, right: basis.right },
      current.up,
      target.up
    );

    const wrappedPosition = wrapPositionAroundEdge(
      sourcePosition,
      current.up,
      target.up,
      planetSize,
      PLAYER_CENTER_CLEARANCE
    );
    // Validate the wrap actually lands on the target face — otherwise the edge
    // heuristic mis-fired (corner ambiguity); reject and let the resolver correct.
    if (dominantFaceForPosition(wrappedPosition) !== targetFace) return false;
    const transitionedVelocity = transitionVelocityAcrossEdge(
      sourceVelocity,
      current.up,
      target.up,
      TRANSITION_MIN_INWARD_SPEED
    );

    body.setTranslation(vectorToRapier(wrappedPosition), true);
    body.setLinvel(vectorToRapier(transitionedVelocity), true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.lockRotations(true, true);

    rotationAnimation.current = {
      startTime: performance.now(),
      startRotation,
      targetRotation
    };
    lastPlanarForward.current.copy(transported.forward);
    transitionCooldown.current = TRANSITION_LOCK_TIME;
    setSurface(target);
    return true;
  }, [planetSize, setSurface, updateVisualTransition]);

  // Resolver-driven correction (NO position wrap — you're already physically on
  // the target face): used for tunnel-exit snaps and escape recovery. Reorients
  // gravity, reprojects velocity so a face change can't launch you sideways,
  // eases the camera, and optionally clamps the position back inside the planet.
  const beginReorient = useCallback((
    targetFace: CubeFace,
    velocity: THREE.Vector3,
    clampPosition?: THREE.Vector3
  ) => {
    const body = ref.current;
    if (!body) return;
    const current = surfaceRef.current;
    const target = getSurfaceState(targetFace);

    if (clampPosition) body.setTranslation(vectorToRapier(clampPosition), true);

    const reprojected = reprojectVelocityOntoFace(velocity, target.up);
    body.setLinvel(vectorToRapier(reprojected), true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.lockRotations(true, true);

    if (target.face !== current.face) {
      updateVisualTransition();
      const cr = body.rotation();
      const startRotation = new THREE.Quaternion(cr.x, cr.y, cr.z, cr.w);
      const delta = rotationBetweenUps(current.up, target.up);
      const targetRotation = new THREE.Quaternion().multiplyQuaternions(delta, startRotation);
      rotationAnimation.current = {
        startTime: performance.now(),
        startRotation,
        targetRotation
      };
      lastPlanarForward.current.applyQuaternion(delta).normalize();
      transitionCooldown.current = TRANSITION_LOCK_TIME;
      setSurface(target);
    }
  }, [setSurface, updateVisualTransition]);

  const resetPlayer = useCallback(() => {
    const body = ref.current;
    if (!body) return;

    const top = getSurfaceState('top');
    body.setTranslation(vectorToRapier(resetSpawnPosition), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation(new THREE.Quaternion(), true);
    body.lockRotations(true, true);
    rotationAnimation.current = null;
    visualCameraUp.current.copy(top.up);
    lastPlanarForward.current.set(0, 0, -1);
    transitionCooldown.current = 0;
    setSurface(top);
  }, [resetSpawnPosition, setSurface]);

  const handlePointerLockChange = useCallback((locked: boolean) => {
    controlsActive.current = locked;
    jumpState.current.previousJump = get().jump;
  }, [get]);

  // Bootstrap the player's gear so the early loop is playable before crafting
  // exists. Idempotent — only grants a starting Maw if no tool is owned yet.
  useEffect(() => { ensureStarterLoadout(); }, []);

  // Raycast the crosshair against the voxel terrain, the (near) tree meshes, and
  // the loose-stone mesh, returning whichever is CLOSEST. Trees/stones aren't
  // voxels — a hit on their instanced mesh maps back to its voxel coord via the
  // field's slot→voxel handle.
  type HarvestTarget =
    | { kind: 'voxel'; coord: { x: number; y: number; z: number }; voxel: NonNullable<ReturnType<typeof voxelSystem.getVoxel>> }
    | { kind: 'tree'; coord: { x: number; y: number; z: number } }
    | { kind: 'stone'; coord: { x: number; y: number; z: number } };
  const pickHarvestTarget = useCallback((camera: THREE.Camera | null): HarvestTarget | null => {
    if (!camera) return null;
    raycaster.far = BLOCK_REACH;
    raycaster.setFromCamera(mouse, camera);

    let best: HarvestTarget | null = null;
    let bestDist = Infinity;

    // Terrain voxel.
    const mesh = efficientPlanetMesh.current;
    if (mesh) {
      const hit = raycaster.intersectObject(mesh, false).find(i => i.instanceId !== undefined);
      if (hit && hit.instanceId !== undefined) {
        const coord = voxelSystem.getCoordForSlot(hit.instanceId);
        const voxel = coord ? voxelSystem.getVoxel(coord.x, coord.y, coord.z) : null;
        if (coord && voxel && hit.distance < bestDist) { best = { kind: 'voxel', coord, voxel }; bestDist = hit.distance; }
      }
    }

    // Trees (nearest trunk/leaf instance mapping to a live tree-voxel).
    const treeMeshes = [treeFieldHandle.trunk, treeFieldHandle.leaf].filter(Boolean) as THREE.InstancedMesh[];
    if (treeMeshes.length > 0) {
      for (const h of raycaster.intersectObjects(treeMeshes, false)) {
        if (h.instanceId === undefined) continue;
        const v = treeFieldHandle.slotVoxel[h.instanceId];
        if (v && !isTreeHarvested(v[0], v[1], v[2])) {
          if (h.distance < bestDist) { best = { kind: 'tree', coord: { x: v[0], y: v[1], z: v[2] } }; bestDist = h.distance; }
          break;
        }
      }
    }

    // Loose stones.
    if (looseStoneHandle.mesh) {
      for (const h of raycaster.intersectObject(looseStoneHandle.mesh, false)) {
        if (h.instanceId === undefined) continue;
        const v = looseStoneHandle.slotVoxel[h.instanceId];
        if (v && !isStoneCollected(v[0], v[1], v[2])) {
          if (h.distance < bestDist) { best = { kind: 'stone', coord: { x: v[0], y: v[1], z: v[2] } }; bestDist = h.distance; }
          break;
        }
      }
    }

    return best;
  }, []);

  // Actually break + harvest a voxel once mining has charged to completion.
  const commitMine = useCallback((
    coord: { x: number; y: number; z: number },
    voxel: NonNullable<ReturnType<typeof voxelSystem.getVoxel>>,
    toolTier: number
  ) => {
    if (voxelSystem.removeVoxel(coord.x, coord.y, coord.z)) {
      playSfx('mine');
      harvestVoxel({ blockId: voxel.blockId, deposit: voxel.deposit, toolTier });
      voxelSystem.exposeNeighbors(coord.x, coord.y, coord.z);
    } else {
      playSfx('blocked');
    }
  }, []);

  // Per-frame hold-to-mine. `held` = the harvest key/touch is down this frame;
  // `dt` is seconds since last frame. Progress accumulates only while the
  // crosshair stays on the same voxel and the tool is strong enough; the block
  // breaks when elapsed reaches its hardness/tool-derived duration.
  const updateMining = useCallback((held: boolean, dt: number, camera: THREE.Camera | null) => {
    const ms = mineState.current;
    if (!held) {
      if (ms.key !== null) { ms.key = null; ms.elapsed = 0; clearMiningProgress(); }
      return;
    }

    const target = pickHarvestTarget(camera);
    if (!target) {
      if (ms.key !== null) { ms.key = null; ms.elapsed = 0; }
      clearMiningProgress();
      return;
    }

    const { coord } = target;
    const key = `${target.kind}:${coord.x},${coord.y},${coord.z}`;

    // Capability gate (voxels only — trees are soft, tier 0). Uses the best tier
    // OWNED; below it, one "blocked" chirp per fresh target, no progress.
    if (target.kind === 'voxel'
      && !canHarvestVoxel({ blockId: target.voxel.blockId, deposit: target.voxel.deposit, toolTier: getEquippedToolTier() })) {
      if (ms.key !== `!${key}`) { playSfx('blocked'); ms.key = `!${key}`; ms.elapsed = 0; }
      setMiningProgress(true, 0, true);
      return;
    }

    // New target (or resumed after release): pick the RIGHT tool for this material
    // (Hatchet→wood, Pickaxe→stone, …) and start a fresh charge with an immediate
    // chip. Speed folds in that tool's per-material rate and, if it's the Faulty
    // Maw, its charge: empty + no Biofuel → slow bare-handed rate (auto-refuels if
    // a Biofuel is held). A non-charge tool (Hatchet/Pickaxe) never drains charge.
    if (ms.key !== key) {
      if (target.kind === 'stone') {
        // Loose stones are picked up by hand — quick, tool/charge independent.
        ms.usesCharge = false;
        ms.duration = STONE_PICKUP_MS;
      } else {
        const isTree = target.kind === 'tree';
        const klass = isTree ? 'wood' : harvestClassForBlock(target.voxel.blockId);
        const requiredTier = isTree
          ? TREE_TOOL_TIER
          : requiredToolTierForVoxel(target.voxel.blockId, target.voxel.deposit);
        const tool = selectTool(klass, requiredTier);
        const usesCharge = tool?.usesCharge ?? false;
        if (usesCharge && !isMawPowered()) refuelFromInventory();
        const powered = !usesCharge || isMawPowered();
        const tier = tool?.toolTier ?? 0;
        const speedMul = toolSpeedFor(tool, klass) * (powered ? 1 : BARE_HAND_MUL);
        ms.usesCharge = usesCharge;
        ms.duration = isTree
          ? computeMineDuration(TREE_HARDNESS, TREE_TOOL_TIER, tier, speedMul)
          : mineDurationMs({ blockId: target.voxel.blockId, deposit: target.voxel.deposit, toolTier: tier }, { speedMul });
      }
      ms.key = key;
      ms.elapsed = 0;
      ms.tickAt = 0;
      playSfx('mine');
    }

    ms.elapsed += dt * 1000;

    if (ms.elapsed >= ms.duration) {
      if (ms.usesCharge && isMawPowered()) consumeMawCharge(CHARGE_PER_BREAK);
      if (target.kind === 'tree') {
        harvestTree(coord.x, coord.y, coord.z);
        playSfx('mine');
      } else if (target.kind === 'stone') {
        collectStone(coord.x, coord.y, coord.z);
        playSfx('mine');
      } else {
        commitMine(coord, target.voxel, getEquippedToolTier());
      }
      ms.key = null; ms.elapsed = 0; ms.tickAt = 0;
      clearMiningProgress();
      return;
    }

    if (ms.elapsed - ms.tickAt >= MINE_TICK_MS) {
      playSfx('mine');
      ms.tickAt = ms.elapsed;
    }
    setMiningProgress(true, Math.min(1, ms.elapsed / ms.duration), false);
  }, [pickHarvestTarget, commitMine]);

  // Per-frame build mode: snap the selected piece under the crosshair (publish the
  // ghost), place it on a fresh press of the harvest key, deconstruct on a press of
  // the deconstruct key. `place`/`decon` are the EDGE (this frame's down, not held).
  const updateBuild = useCallback((place: boolean, decon: boolean, camera: THREE.Camera | null) => {
    if (!camera) { clearBuildGhost(); return; }
    const piece = getSelectedPiece();
    raycaster.far = BLOCK_REACH;
    raycaster.setFromCamera(mouse, camera); // crosshair = screen centre

    // Nearest hit across terrain + structure → a normalized BuildHit.
    const voxelMesh = efficientPlanetMesh.current;
    const structMesh = structureFieldHandle.mesh;
    const meshes = [voxelMesh, structMesh].filter(Boolean) as THREE.Object3D[];
    let hitInfo: BuildHit | null = null;
    let deconHit: { cell: { x: number; y: number; z: number }; face: number } | null = null;
    for (const h of raycaster.intersectObjects(meshes, false)) {
      if (h.instanceId === undefined || !h.face) continue;
      if (h.object === voxelMesh) {
        const coord = voxelSystem.getCoordForSlot(h.instanceId);
        if (!coord) continue;
        hitInfo = {
          cell: [coord.x, coord.y, coord.z], point: h.point, isPanel: false,
          normalIdx: faceIndexForNormal(h.face.normal.x, h.face.normal.y, h.face.normal.z)
        };
      } else {
        const p = structureFieldHandle.slotPiece[h.instanceId];
        if (!p) continue;
        hitInfo = { cell: p.cell, point: h.point, isPanel: true, panelType: p.type, panelFace: p.face, normalIdx: -1 };
        deconHit = { cell: { x: p.cell[0], y: p.cell[1], z: p.cell[2] }, face: p.face };
      }
      break; // nearest
    }

    // Deconstruct the panel under the crosshair.
    if (decon) {
      if (deconHit && removePiece([deconHit.cell.x, deconHit.cell.y, deconHit.cell.z], deconHit.face)) playSfx('mine');
      else playSfx('blocked');
    }

    let target = hitInfo ? resolveBuildTarget(hitInfo, piece) : null;
    // Fallback: aiming across a foundation at eye height doesn't hit the thin floor
    // panel, so find the cell the ray passes through (walls snap to the faced edge /
    // a wall below = stacking; ceilings cap the cell).
    if (!target || !target.valid) {
      if (piece === 'wall') target = marchWallTarget(raycaster.ray.origin, raycaster.ray.direction, BLOCK_REACH) ?? target;
      else if (piece === 'ceiling') target = marchCeilingTarget(raycaster.ray.origin, raycaster.ray.direction, BLOCK_REACH) ?? target;
    }
    if (!target) {
      clearBuildGhost();
      if (place) playSfx('blocked');
      return;
    }
    const ok = target.valid && canAfford(piece);
    setBuildGhost(target.cell, target.face, ok);
    if (place) {
      if (ok && placePiece(target.cell, target.face, piece)) playSfx('mine');
      else playSfx('blocked');
    }
  }, []);

  // "Looking at" readout for the crosshair label. The terrain voxel uses a CHEAP
  // ray-march (round(world/VOXEL_SCALE) Map lookups, not a 125k-instance raycast);
  // trees + loose stones are picked up with a cheap raycast of their (few, near)
  // instances. Whichever is closest wins, so the label matches what you'd harvest.
  const updateLookedAt = useCallback((camera: THREE.Camera | null) => {
    if (!camera || !(controlsActive.current || isTouchActive())) {
      setLookedAt(null);
      return;
    }
    camera.getWorldPosition(_lookOrigin);
    camera.getWorldDirection(_lookDir);

    let found: LookedAt | null = null;
    let foundDist = Infinity;
    for (let t = 1.0; t <= BLOCK_REACH; t += 0.45) {
      const vx = Math.round((_lookOrigin.x + _lookDir.x * t) / VOXEL_SCALE);
      const vy = Math.round((_lookOrigin.y + _lookDir.y * t) / VOXEL_SCALE);
      const vz = Math.round((_lookOrigin.z + _lookDir.z * t) / VOXEL_SCALE);
      if (voxelSystem.hasVoxel(vx, vy, vz)) {
        const voxel = voxelSystem.getVoxel(vx, vy, vz);
        if (voxel) {
          found = { kind: 'voxel', material: voxel.material as MaterialType, blockId: voxel.blockId, deposit: voxel.deposit };
          foundDist = t;
        }
        break;
      }
    }

    raycaster.far = BLOCK_REACH;
    raycaster.setFromCamera(mouse, camera);
    const treeMeshes = [treeFieldHandle.trunk, treeFieldHandle.leaf].filter(Boolean) as THREE.InstancedMesh[];
    for (const h of (treeMeshes.length ? raycaster.intersectObjects(treeMeshes, false) : [])) {
      if (h.instanceId === undefined) continue;
      const v = treeFieldHandle.slotVoxel[h.instanceId];
      if (v && !isTreeHarvested(v[0], v[1], v[2])) {
        if (h.distance < foundDist) { found = { kind: 'tree' }; foundDist = h.distance; }
        break;
      }
    }
    if (looseStoneHandle.mesh) {
      for (const h of raycaster.intersectObject(looseStoneHandle.mesh, false)) {
        if (h.instanceId === undefined) continue;
        const v = looseStoneHandle.slotVoxel[h.instanceId];
        if (v && !isStoneCollected(v[0], v[1], v[2])) {
          if (h.distance < foundDist) { found = { kind: 'stone' }; foundDist = h.distance; }
          break;
        }
      }
    }

    setLookedAt(found);
  }, []);

  useBeforePhysicsStep(() => {
    const body = ref.current;
    if (!body) return;

    const controls = get();
    if (controls.reset) {
      setJetpackSfx(false);
      resetPlayer();
      return;
    }

    const position = vectorFromRapier(body.translation());

    transitionCooldown.current = Math.max(0, transitionCooldown.current - FIXED_PHYSICS_STEP);

    // Active surface frame. Either the continuous smooth-gravity FIELD prototype
    // (?gravity=smooth — no faces/transitions/resolver, can't fall off or get
    // stuck by construction) or the discrete 6-face state machine (default), with
    // the resolver as its single authority + anti-escape guard.
    let activeUp: THREE.Vector3;
    let activeGravity: THREE.Vector3;

    if (SMOOTH_GRAVITY) {
      activeUp = smoothUpForPosition(position, { radius: planetSize });
      activeGravity = activeUp.clone().multiplyScalar(-GRAVITY_STRENGTH);
      // Continuous field -> orient the capsule + camera directly each frame; no
      // transition animation needed (the field never jumps).
      body.setRotation(quaternionForUp(activeUp), true);
      visualCameraUp.current.copy(activeUp);
      surfaceRef.current = {
        face: dominantFaceForPosition(position),
        up: activeUp,
        gravity: activeGravity,
        phase: 'stable',
        targetFace: null
      };
    } else {
      // --- SURFACE RESOLVER: single authority on which face's gravity applies,
      // run FIRST so grounding/movement evaluate against the RESOLVED up. Handles
      // tunnel-exit snaps + the hard anti-escape guard; intentional edge-walks
      // fall through ('hold') to the existing path below.
      const preVelocity = vectorFromRapier(body.linvel());
      const resolved = resolveSurfaceFrame({
        position,
        velocity: preVelocity,
        currentFace: surfaceRef.current.face,
        planetRadius: planetSize
      });
      if (resolved.mode === 'escape') {
        beginReorient(resolved.face, resolved.velocityCorrection ?? preVelocity, resolved.positionClamp);
        return;
      }
      const reorientLocked = Boolean(rotationAnimation.current) || transitionCooldown.current > 0;
      if (resolved.mode === 'snap' && !reorientLocked) {
        beginReorient(resolved.face, preVelocity);
        return;
      }
      activeUp = surfaceRef.current.up;
      activeGravity = surfaceRef.current.gravity;
    }

    // Publish the local up so the sky/lighting can drive LOCAL day/night
    // (chase-the-light): the sun lights the hemisphere this up faces.
    setPlayerUp(activeUp);

    const grounded = checkGrounded(position, activeUp);
    lastGrounded.current = grounded;

    // Input is enabled by pointer lock (desktop) OR active touch controls (mobile).
    const active = controlsActive.current || isTouchActive();

    const movementInput = active
      ? {
          forward: controls.forward,
          backward: controls.backward,
          left: controls.left,
          right: controls.right
        }
      : { forward: false, backward: false, left: false, right: false };

    const basis = cameraRef.current
      ? planarCameraBasis(cameraRef.current, activeUp, lastPlanarForward.current)
      : makeTangentBasis(activeUp, lastPlanarForward.current);
    lastPlanarForward.current.copy(basis.forward);

    const moveDirection = movementDirectionFromBasis(movementInput, basis.forward, basis.right);
    const currentVelocity = vectorFromRapier(body.linvel());
    const gravityVelocity = integrateLocalGravity(
      currentVelocity,
      activeGravity,
      activeUp,
      FIXED_PHYSICS_STEP,
      grounded
    );
    let nextVelocity = composeVelocity(gravityVelocity, moveDirection, activeUp, DEFAULT_MOVE_SPEED);

    const jump = updateJumpState(
      jumpState.current,
      active && controls.jump,
      grounded,
      FIXED_PHYSICS_STEP
    );
    jumpState.current = jump.next;

    if (jump.shouldJump) {
      playSfx('jump');
      nextVelocity = applyJumpImpulse(nextVelocity, activeUp, DEFAULT_JUMP_SPEED);
    }

    // Hold-jump jetpack: once airborne, holding jump burns limited fuel for a
    // gentle upward thrust (controlled hover/boost), capped so it's not a rocket.
    // Fuel refills while grounded. shouldJump (the ground impulse) takes priority.
    const jumpHeld = active && controls.jump;
    let jetpackActive = false;
    if (grounded) {
      jetpackFuel.current = Math.min(
        JETPACK_MAX_FUEL,
        jetpackFuel.current + JETPACK_REFILL_RATE * FIXED_PHYSICS_STEP
      );
    } else if (jumpHeld && !jump.shouldJump && jetpackFuel.current > 0) {
      jetpackActive = true;
      jetpackFuel.current = Math.max(0, jetpackFuel.current - FIXED_PHYSICS_STEP);
      const upSpeed = nextVelocity.dot(activeUp);
      if (upSpeed < JETPACK_MAX_UP_SPEED) {
        const add = Math.min(JETPACK_THRUST * FIXED_PHYSICS_STEP, JETPACK_MAX_UP_SPEED - upSpeed);
        nextVelocity.addScaledVector(activeUp, add);
      }
    }
    jetpackFuelDisplay = jetpackFuel.current / JETPACK_MAX_FUEL;
    setJetpackSfx(jetpackActive, Math.max(0.35, jetpackFuelDisplay));

    // (cooldown already decremented at the top of the step, before the resolver.)
    // Edge-walk is part of the DISCRETE system only; the smooth field never needs it.
    const transitionLocked = Boolean(rotationAnimation.current) || transitionCooldown.current > 0;

    if (!SMOOTH_GRAVITY && !transitionLocked) {
      const predictedPosition = predictPosition(position, nextVelocity, FIXED_PHYSICS_STEP);
      const targetFace = chooseFaceFromPosition(predictedPosition, surfaceRef.current.face, {
        planetRadius: planetSize,
        hysteresis: EDGE_HYSTERESIS,
        bodyRadius: PLAYER_EDGE_RADIUS,
        velocity: nextVelocity,
        movementDirection: moveDirection
      });

      if (targetFace && beginTransition(targetFace, position, nextVelocity, basis)) {
        return;
      }
    }

    body.setLinvel(vectorToRapier(nextVelocity), true);
  });

  useFrame((_, delta) => {
    const body = ref.current;
    if (!body) return;

    frameCount.current += 1;
    updateVisualTransition();
    const position = vectorFromRapier(body.translation());
    onPositionChange?.(position);
    setPlayerWorldPosition(position); // global for non-Canvas code (campfire placement)
    if (lastGroundedNotification.current !== lastGrounded.current) {
      const previous = lastGroundedNotification.current;
      lastGroundedNotification.current = lastGrounded.current;
      if (previous === false && lastGrounded.current) playSfx('land');
      onGroundedChange?.(lastGrounded.current);
    }

    const controls = get();
    const deleteActive = controlsActive.current || isTouchActive();
    const harvestHeld = deleteActive && controls.delete;
    if (isBuildEnabled()) {
      // Build mode: the harvest key PLACES (edge), not mines. Mining is suppressed.
      updateMining(false, delta, cameraRef.current);
      const placeEdge = harvestHeld && !prevBuildKey.current;
      const deconHeld = deleteActive && Boolean((controls as Record<string, boolean>).deconstruct);
      const deconEdge = deconHeld && !prevDeconKey.current;
      updateBuild(placeEdge, deconEdge, cameraRef.current);
      prevBuildKey.current = harvestHeld;
      prevDeconKey.current = deconHeld;
    } else {
      // Hold-to-mine: progress accumulates while the key/touch is held on a voxel,
      // and the block only breaks once it has fully charged (time scales with block
      // hardness / tool tier — see mineDurationMs).
      clearBuildGhost();
      prevBuildKey.current = false;
      prevDeconKey.current = false;
      updateMining(harvestHeld, delta, cameraRef.current);
    }

    // Update the "looking at" readout a few times/sec (cheap voxel march).
    if (frameCount.current % 4 === 0) {
      updateLookedAt(cameraRef.current);
    }

    if (frameCount.current % 10 === 0) {
      const activeSurface = surfaceRef.current;
      const velocity = vectorFromRapier(body.linvel());
      if (typeof window !== 'undefined') {
        (window as Window & { __voxelDebug?: Record<string, unknown> }).__voxelDebug = {
          ...(window as Window & { __voxelDebug?: Record<string, unknown> }).__voxelDebug,
          player: {
            face: activeSurface.face,
            targetFace: activeSurface.targetFace,
            grounded: lastGrounded.current,
            position: [position.x, position.y, position.z],
            velocity: [velocity.x, velocity.y, velocity.z],
            gravity: [activeSurface.gravity.x, activeSurface.gravity.y, activeSurface.gravity.z],
            transitionCooldown: transitionCooldown.current,
            visualTransitioning: Boolean(rotationAnimation.current)
          }
        };
      }
      onDebugChange?.({
        face: activeSurface.face,
        targetFace: activeSurface.targetFace,
        grounded: lastGrounded.current,
        controlsActive: controlsActive.current,
        speed: velocity.length(),
        gravity: [activeSurface.gravity.x, activeSurface.gravity.y, activeSurface.gravity.z],
        position: [position.x, position.y, position.z]
      });
    }
  });

  return (
    <>
      <CameraControls
        cameraRef={cameraRef}
        activeUp={surfaceState.up}
        getActiveUp={() => visualCameraUp.current}
        onPointerLockChange={handlePointerLockChange}
      />
      <RigidBody
        ref={ref}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[initialSpawnPosition.x, initialSpawnPosition.y, initialSpawnPosition.z]}
        quaternion={[initialSpawnQuat.x, initialSpawnQuat.y, initialSpawnQuat.z, initialSpawnQuat.w]}
        lockRotations
        gravityScale={0}
        linearDamping={0.5}
        angularDamping={0.8}
        canSleep={false}
        ccd
      >
        <CapsuleCollider args={[PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS]} />

        <PerspectiveCamera
          ref={cameraRef}
          position={[0, 1, 0]}
          makeDefault
          fov={75}
          near={0.05}
          far={planetSize * 120}
        />

        {/* First-person body. Hidden: the camera is a child of this same rigid
            body, so the blue capsule would clip into the bottom of the view as
            gravity reorients near an edge (the "blue horizontal plane" artifact).
            Overview/agent cameras don't mount this rig, so nothing else needs it. */}
        <mesh visible={false}>
          <capsuleGeometry args={[PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HALF_HEIGHT * 2]} />
          <meshStandardMaterial color="#3f7fd9" roughness={0.75} />
        </mesh>
      </RigidBody>
    </>
  );
}
