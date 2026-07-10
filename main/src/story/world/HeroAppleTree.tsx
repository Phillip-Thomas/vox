import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { buildTreeProfile, paramsFromProfile } from '../../utils/treeProfile.ts';
import { generateTree } from '../../utils/treeGen.ts';
import {
  applyTreeProfileToMaterials,
  createBarkMaterial,
  createBlossomMaterial,
  createLeafMaterial,
  updateTreeMaterials
} from '../../utils/treeMaterials.ts';
import { getGraphicsQuality } from '../../config/graphicsSettings.ts';
import { getVoxelRealityEffects } from '../../game/systems/realityRenderSystem.ts';
import { getSunDirection, getMoonDirection } from '../../components/SkyController.tsx';
import { useStoryState } from '../storyState.ts';
import { registerStoryInteraction } from '../storyInteractions.ts';
import { beginA2 } from '../storyDirector.ts';
import { getHeroTreePose, STORY_SEED } from './storyWorld.ts';

// --- The hero apple tree -----------------------------------------------------------
//
// The forbidden continuous living thing: ONE bespoke tree (the treeTest
// single-instance pattern) with its own materials and — critically — PINNED
// reality uniforms. At stage `color` the standard tree shaders discard their
// canopy (organic = 0); this tree forces organic/detail high so it is the one
// alive thing in an unresolved world. Its chroma still follows the global value.
//
// Apples are a seeded InstancedMesh scattered through the canopy shell — the
// most saturated objects in the game at the moment they first exist.

const HERO_SEED_SALT = 0xede9;

export const EAT_DISTANCE = 5.5;

/** Module handle for the driver's redaction projection (P4). */
export const heroTreeHandle: {
  position: THREE.Vector3 | null;
  up: THREE.Vector3 | null;
  crownRadius: number;
  height: number;
} = { position: null, up: null, crownRadius: 4, height: 8 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface HeroAppleTreeProps {
  planetSize: number;
  terrainSeed: number;
}

const HeroAppleTree: React.FC<HeroAppleTreeProps> = ({ planetSize, terrainSeed }) => {
  const story = useStoryState();
  const appliedRef = useRef(false);

  const pose = useMemo(() => getHeroTreePose(planetSize, terrainSeed), [planetSize, terrainSeed]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pose.up),
    [pose]
  );

  const built = useMemo(() => {
    const heroSeed = (STORY_SEED ^ HERO_SEED_SALT) >>> 0;
    const profile = buildTreeProfile(heroSeed);
    // Art direction: a broad, generous, unmistakably WELCOMING crown — and a
    // canopy green with warm undersides so the red apples detonate against it.
    profile.silhouette = 'round';
    profile.shapeId = 0;
    profile.leafMode = 0;
    profile.trunkHeight = Math.max(profile.trunkHeight, 7.2);
    profile.canopyDensity = Math.max(profile.canopyDensity, 0.9);
    profile.bloomAmount = 0; // no blossom cards — the apples carry the color
    profile.leafColor.set('#2e7d32');
    profile.leafTipColor.set('#66bb6a');
    profile.leafSSSColor.set('#b9f6ca');

    const params = paramsFromProfile(profile);
    params.crownRadius = Math.max(params.crownRadius, 4.6);
    const arch = generateTree(heroSeed, params);

    const mats = {
      bark: createBarkMaterial(),
      leaf: createLeafMaterial(),
      blossom: createBlossomMaterial()
    };

    const group = new THREE.Group();
    const id = new THREE.Matrix4();
    const add = (geo: THREE.BufferGeometry | null | undefined, mat: THREE.Material) => {
      if (!geo || geo.attributes.position.count === 0) return;
      const im = new THREE.InstancedMesh(geo, mat, 1);
      im.setMatrixAt(0, id);
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      group.add(im);
    };
    add(arch.trunkGeometry, mats.bark);
    add(arch.leafGeometry, mats.leaf);

    // Apples: seeded shell scatter around the canopy center, upper-biased.
    const rng = mulberry32(heroSeed);
    const appleCount = 16;
    const canopyCenterY = profile.trunkHeight * 0.92;
    const shell = params.crownRadius * 0.72;
    const appleGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const appleMat = new THREE.MeshStandardMaterial({
      color: '#e8262c',
      roughness: 0.32,
      metalness: 0,
      emissive: '#6d090d',
      emissiveIntensity: 0.4
    });
    const apples = new THREE.InstancedMesh(appleGeo, appleMat, appleCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < appleCount; i++) {
      const theta = rng() * Math.PI * 2;
      const upBias = 0.15 + rng() * 0.75; // hang through the mid/low canopy shell
      const r = shell * (0.75 + rng() * 0.3);
      const y = canopyCenterY + (upBias - 0.55) * params.crownRadius;
      m.makeTranslation(Math.cos(theta) * r, y, Math.sin(theta) * r);
      apples.setMatrixAt(i, m);
    }
    apples.instanceMatrix.needsUpdate = true;
    apples.frustumCulled = false;
    group.add(apples);

    return { group, profile, mats, crownRadius: params.crownRadius };
  }, []);

  useEffect(() => {
    heroTreeHandle.position = pose.position;
    heroTreeHandle.up = pose.up;
    heroTreeHandle.crownRadius = built.crownRadius;
    heroTreeHandle.height = built.profile.trunkHeight + built.crownRadius;
    // Dev affordance (mirrors window.__game): lets capture harnesses find the tree.
    (window as unknown as { __storyTree?: number[] }).__storyTree = pose.position.toArray();
    return () => {
      heroTreeHandle.position = null;
      heroTreeHandle.up = null;
      delete (window as unknown as { __storyTree?: number[] }).__storyTree;
    };
  }, [pose, built]);

  // Colours once shaders compile; wind/SSS + PINNED reality every frame.
  useFrame(state => {
    if (!appliedRef.current && built.mats.leaf.userData.shader) {
      applyTreeProfileToMaterials(built.profile, built.mats.bark, built.mats.leaf, built.mats.blossom, null);
      appliedRef.current = true;
    }
    const reality = getVoxelRealityEffects();
    updateTreeMaterials(
      built.mats.bark,
      built.mats.leaf,
      built.mats.blossom,
      null,
      state.clock.elapsedTime,
      getSunDirection(),
      getMoonDirection(),
      getGraphicsQuality(),
      // The pin: alive regardless of the world's stage; chroma follows the story.
      { ...reality, organic: 1, detail: Math.max(reality.detail, 0.8), atmosphere: Math.max(reality.atmosphere, 0.5) }
    );
  });

  // [F] Eat — the bite that breaks the feed. Live once the approach beat holds.
  useEffect(() => {
    if (story.beat !== 'ch2-approach') return;
    return registerStoryInteraction((_camera, position) => {
      if (position.distanceTo(pose.position) > EAT_DISTANCE) return null;
      return { id: 'story-eat', verb: 'Eat', perform: beginA2 };
    });
  }, [story.beat, pose]);

  return (
    <group position={pose.position} quaternion={quaternion}>
      <primitive object={built.group} />
      {/* Trunk collider: the tree is REAL — you cannot walk through the question. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.55, built.profile.trunkHeight / 2, 0.55]} position={[0, built.profile.trunkHeight / 2, 0]} />
      </RigidBody>
    </group>
  );
};

export default HeroAppleTree;
