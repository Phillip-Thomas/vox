#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The rail is compiled from EVERY signed scene contract the runtime carries, in
// registration order. The first is the rail's identity (`source`); each one
// pins its own bytes and its own anchor count, so a contract cannot drift and a
// chapter cannot be silently dropped by regenerating.
const SIGNED_SOURCES = [
  {
    contractPath: '../.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json',
    sha256: '3367b94f9f0fcef14b6158f61e5cd3e3262afa3ae86b4b9574803e3ac48bb47e',
    contractVersion: 'intent-v1',
    anchorCount: 66
  },
  {
    contractPath: '../.codex/production-runs/2026-08-11-ch10-station-introduction/scene-contract.json',
    sha256: '32122245bf6b6630c4228da65204db2c6422e9ddb3a446c63ee6990986626860',
    contractVersion: 'draft-v7',
    anchorCount: 10
  }
];
const EXPECTED_ANCHOR_COUNT = SIGNED_SOURCES.reduce((total, entry) => total + entry.anchorCount, 0);

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const mainDir = path.resolve(toolDir, '..');
const outputPath = path.resolve(mainDir, 'src/story/generatedSceneAvRuntime.json');

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite.`);
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => requiredString(item, `${label}[${index}]`));
}

function assertUnique(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function sanitizePostEffect(effect, shotId, index) {
  return {
    id: requiredString(effect.id, `${shotId}.postEffects[${index}].id`),
    verb: requiredString(effect.verb, `${shotId}.postEffects[${index}].verb`),
    entryAnchorRef: requiredString(
      effect.entryAnchorRef,
      `${shotId}.postEffects[${index}].entryAnchorRef`
    ),
    exitAnchorRef: requiredString(
      effect.exitAnchorRef,
      `${shotId}.postEffects[${index}].exitAnchorRef`
    ),
    reducedMotion: Boolean(requiredString(
      effect.reducedMotionBehavior,
      `${shotId}.postEffects[${index}].reducedMotionBehavior`
    )),
    lowTierFallback: requiredString(
      effect.lowTierFallback,
      `${shotId}.postEffects[${index}].lowTierFallback`
    ).includes('Geometry') || effect.lowTierFallback.includes('geometry')
      ? 'physical-geometry-material'
      : 'physical-state',
    resetRef: requiredString(effect.resetRef, `${shotId}.postEffects[${index}].resetRef`)
  };
}

function sanitizeShot(shot) {
  const id = requiredString(shot.id, 'shot.id');
  const lens = shot.lens ?? {};
  const effects = shot.effects ?? {};
  const agency = shot.agency ?? {};
  const transition = shot.transition ?? {};
  return {
    id,
    beat: requiredString(shot.beat, `${id}.beat`),
    startAnchorRef: requiredString(shot.startAnchorRef, `${id}.startAnchorRef`),
    endAnchorRef: requiredString(shot.endAnchorRef, `${id}.endAnchorRef`),
    cameraAuthority: requiredString(shot.cameraAuthority, `${id}.cameraAuthority`),
    lens: {
      startFovDeg: finiteNumber(lens.startFovDeg, `${id}.lens.startFovDeg`),
      endFovDeg: finiteNumber(lens.endFovDeg, `${id}.lens.endFovDeg`),
      durationMs: finiteNumber(lens.durationMs, `${id}.lens.durationMs`),
      easing: requiredString(lens.easing, `${id}.lens.easing`),
      focusTarget: requiredString(lens.focusTarget, `${id}.lens.focusTarget`)
    },
    transition: {
      type: requiredString(transition.type, `${id}.transition.type`),
      declaredCut: Boolean(transition.declaredCut),
      durationMs: finiteNumber(transition.durationMs, `${id}.transition.durationMs`)
    },
    effects: {
      realityStage: requiredString(effects.realityStage, `${id}.effects.realityStage`),
      effectCeiling: stringArray(effects.effectCeiling, `${id}.effects.effectCeiling`),
      grade: {
        presetRef: effects.grade?.presetRef == null
          ? null
          : requiredString(effects.grade.presetRef, `${id}.effects.grade.presetRef`),
        resetRef: requiredString(effects.grade?.resetRef, `${id}.effects.grade.resetRef`)
      },
      lighting: {
        resetRef: requiredString(effects.lighting?.resetRef, `${id}.effects.lighting.resetRef`)
      },
      postEffects: (effects.postEffects ?? []).map((effect, index) => (
        sanitizePostEffect(effect, id, index)
      ))
    },
    agency: {
      movement: requiredString(agency.movement, `${id}.agency.movement`),
      look: requiredString(agency.look, `${id}.agency.look`),
      interaction: requiredString(agency.interaction, `${id}.agency.interaction`),
      handBackAnchorRef: requiredString(
        agency.handBackAnchorRef,
        `${id}.agency.handBackAnchorRef`
      )
    },
    resetRef: requiredString(shot.resetRef, `${id}.resetRef`)
  };
}

function sanitizeScoreCue(cue) {
  const id = requiredString(cue.id, 'score cue id');
  return {
    id,
    type: requiredString(cue.type, `${id}.type`),
    anchorRef: requiredString(cue.anchorRef, `${id}.anchorRef`),
    relation: requiredString(cue.relation, `${id}.relation`),
    offsetMs: finiteNumber(cue.offsetMs, `${id}.offsetMs`),
    mixIntent: requiredString(cue.mixIntent, `${id}.mixIntent`),
    resetRef: requiredString(cue.resetRef, `${id}.resetRef`)
  };
}

function sanitizeResetState(state) {
  const id = requiredString(state.id, 'reset state id');
  return {
    id,
    domain: requiredString(state.domain, `${id}.domain`),
    resetValue: requiredString(state.resetValue, `${id}.resetValue`),
    triggers: stringArray(state.triggers, `${id}.triggers`)
  };
}

function sanitizeContract(contract, sourceSha256, expected) {
  if (contract.schema !== 'paravoxia.sceneContract.v1') {
    throw new Error(`Unexpected scene contract schema: ${contract.schema}`);
  }
  if (contract.status !== 'frozen') throw new Error('Scene contract is not frozen.');
  if (contract.contractVersion !== expected.contractVersion) {
    throw new Error(
      `Scene contract revision drifted: expected ${expected.contractVersion}, got ${contract.contractVersion}.`
    );
  }

  const anchors = contract.syncAnchors.map(anchor => ({
    id: requiredString(anchor.id, 'anchor.id'),
    beat: requiredString(anchor.beat, `${anchor.id}.beat`),
    order: finiteNumber(anchor.order, `${anchor.id}.order`),
    event: requiredString(anchor.event, `${anchor.id}.event`),
    source: requiredString(anchor.source, `${anchor.id}.source`),
    storyEventRef: requiredString(anchor.story?.eventRef, `${anchor.id}.story.eventRef`),
    scoreCueRefs: (anchor.score ?? []).map((score, index) => requiredString(
      score.cueRef,
      `${anchor.id}.score[${index}].cueRef`
    )),
    shotRefs: (anchor.cinematography ?? []).map((shot, index) => requiredString(
      shot.shotRef,
      `${anchor.id}.cinematography[${index}].shotRef`
    ))
  }));
  if (anchors.length !== expected.anchorCount) {
    throw new Error(
      `${contract.sceneId}: expected ${expected.anchorCount} anchors, got ${anchors.length}.`
    );
  }
  const shots = contract.shots.map(sanitizeShot);
  const scoreCues = contract.score.cues.map(sanitizeScoreCue);
  const resetStates = contract.reset.states.map(sanitizeResetState);

  const anchorIds = assertUnique(anchors, 'anchor');
  const shotIds = assertUnique(shots, 'shot');
  const scoreCueIds = assertUnique(scoreCues, 'score cue');
  const resetIds = assertUnique(resetStates, 'reset state');
  for (const anchor of anchors) {
    for (const ref of anchor.shotRefs) {
      if (!shotIds.has(ref)) throw new Error(`${anchor.id} references missing shot ${ref}.`);
    }
    for (const ref of anchor.scoreCueRefs) {
      if (!scoreCueIds.has(ref)) throw new Error(`${anchor.id} references missing score cue ${ref}.`);
    }
  }
  for (const shot of shots) {
    for (const ref of [shot.startAnchorRef, shot.endAnchorRef, shot.agency.handBackAnchorRef]) {
      if (!anchorIds.has(ref)) throw new Error(`${shot.id} references missing anchor ${ref}.`);
    }
    if (!resetIds.has(shot.resetRef)) throw new Error(`${shot.id} references missing reset ${shot.resetRef}.`);
    for (const effect of shot.effects.postEffects) {
      for (const ref of [effect.entryAnchorRef, effect.exitAnchorRef]) {
        if (!anchorIds.has(ref)) throw new Error(`${effect.id} references missing anchor ${ref}.`);
      }
      if (!resetIds.has(effect.resetRef)) {
        throw new Error(`${effect.id} references missing reset ${effect.resetRef}.`);
      }
    }
  }

  return {
    schema: 'paravoxia.sceneAvRuntime.v1',
    source: {
      sceneId: requiredString(contract.sceneId, 'sceneId'),
      contractVersion: contract.contractVersion,
      sha256: sourceSha256,
      status: contract.status
    },
    beats: stringArray(contract.scope.beats, 'scope.beats'),
    anchors,
    shots,
    scoreCues,
    reset: {
      triggers: stringArray(contract.reset.triggers, 'reset.triggers'),
      states: resetStates,
      sandboxNoOpRequired: contract.reset.sandboxNoOp?.required === true
    }
  };
}

/**
 * Merge the compiled contracts into one rail. Ids are globally unique across
 * contracts by construction and re-asserted here, so a merge can never silently
 * shadow one chapter's anchor with another's. Reset states are unioned by id:
 * the domains are shared vocabulary and every contract restates the ones it
 * relies on.
 */
function mergeCompiledContracts(parts) {
  const [first] = parts;
  const merged = {
    schema: first.schema,
    source: first.source,
    sources: parts.map(part => part.source),
    beats: [],
    anchors: [],
    shots: [],
    scoreCues: [],
    reset: {
      triggers: [],
      states: [],
      sandboxNoOpRequired: parts.every(part => part.reset.sandboxNoOpRequired)
    }
  };
  const resetById = new Map();
  for (const part of parts) {
    merged.beats.push(...part.beats);
    merged.anchors.push(...part.anchors);
    merged.shots.push(...part.shots);
    merged.scoreCues.push(...part.scoreCues);
    for (const trigger of part.reset.triggers) {
      if (!merged.reset.triggers.includes(trigger)) merged.reset.triggers.push(trigger);
    }
    for (const state of part.reset.states) {
      if (!resetById.has(state.id)) resetById.set(state.id, state);
    }
  }
  merged.reset.states = [...resetById.values()];
  assertUnique(merged.beats.map(beat => ({ id: beat })), 'beat');
  assertUnique(merged.anchors, 'anchor');
  assertUnique(merged.shots, 'shot');
  assertUnique(merged.scoreCues, 'score cue');
  return merged;
}

const compiled = [];
for (const expected of SIGNED_SOURCES) {
  const contractPath = path.resolve(mainDir, expected.contractPath);
  const sourceBytes = await readFile(contractPath);
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  if (sourceSha256 !== expected.sha256) {
    throw new Error(
      `Frozen scene contract SHA drifted for ${expected.contractPath}: `
        + `expected ${expected.sha256}, got ${sourceSha256}.`
    );
  }
  const contract = JSON.parse(sourceBytes.toString('utf8'));
  compiled.push(sanitizeContract(contract, sourceSha256, expected));
}

const merged = mergeCompiledContracts(compiled);
const generated = `${JSON.stringify(merged, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== generated) {
    throw new Error(
      'Generated scene AV runtime is stale. Run `npm run scene:av:generate` from main/.'
    );
  }
  process.stdout.write(
    `scene-av runtime: ${EXPECTED_ANCHOR_COUNT} anchors from ${SIGNED_SOURCES.length} signed `
      + `contracts (${SIGNED_SOURCES.map(entry => entry.sha256.slice(0, 12)).join(', ')}) (current)\n`
  );
} else {
  await writeFile(outputPath, generated);
  process.stdout.write(`wrote ${path.relative(mainDir, outputPath)}\n`);
}
