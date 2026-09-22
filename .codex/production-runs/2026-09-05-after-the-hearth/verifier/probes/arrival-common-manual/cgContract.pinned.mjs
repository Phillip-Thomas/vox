/**
 * Signed scene-v3 contract reader for this run's verification probes.
 * Expectations come from the signed bytes only; nothing is hardcoded here.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUN_DIR = resolve(HERE, '..', '..', '..');
export const REPO_ROOT = resolve(RUN_DIR, '..', '..', '..');
export const MAIN = resolve(REPO_ROOT, 'main');
export const ART = resolve(RUN_DIR, 'verifier', 'artifacts');
export const CAPTURES = resolve(RUN_DIR, 'verifier', 'captures');
export const LOGS = resolve(RUN_DIR, 'verifier', 'logs');

export const SIGNED_CONTRACT_SHA256 =
  '5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54';

export function loadContract({ requireSigned = true } = {}) {
  const path = resolve(RUN_DIR, 'scene-contract.json');
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (requireSigned && sha256 !== SIGNED_CONTRACT_SHA256) {
    throw new Error(`scene-contract.json is ${sha256}, not the signed scene-v3 ${SIGNED_CONTRACT_SHA256}`);
  }
  return { path, sha256, contract: JSON.parse(bytes.toString('utf8')) };
}

/** Objective id -> exact signed guidance expectations. */
export function objectiveExpectations(contract) {
  const out = new Map();
  for (const o of contract.guidance.objectives) {
    out.set(o.id, {
      id: o.id,
      kind: o.kind,
      targetMode: o.targetMode,
      requiresMarker: o.requiresMarker,
      markerLabel: o.markerLabel,
      workOrder: [...o.workOrder],
      feedback: o.feedback,
      enterAnchorRef: o.enterAnchorRef,
      clearAnchorRef: o.clearAnchorRef,
      agencyWindowRef: o.agencyWindowRef,
      variantRefs: [...o.variantRefs],
      resetTriggers: [...o.resetTriggers],
      variantIntent: o.variantIntent,
      acceptanceCriterion: o.acceptanceCriterion,
      /** Exact alternate (state-conditional) work orders quoted inside variantIntent. */
      conditionalWorkOrders: quotedWorkOrders(o.variantIntent)
    });
  }
  return out;
}

/**
 * The v2 delta signs its state-conditional copy as a literal JSON array inside
 * variantIntent prose. Pull those arrays out verbatim so the probe compares
 * against signed bytes, never against paraphrase.
 */
export function quotedWorkOrders(intent) {
  if (typeof intent !== 'string') return [];
  const found = [];
  const re = /\[\s*"(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")*\s*\]/g;
  for (const m of intent.match(re) ?? []) {
    try { const parsed = JSON.parse(m); if (Array.isArray(parsed)) found.push(parsed); } catch { /* not copy */ }
  }
  return found;
}

export function anchorsByBeat(contract) {
  const map = new Map();
  for (const a of contract.syncAnchors) {
    if (!map.has(a.beat)) map.set(a.beat, []);
    map.get(a.beat).push(a);
  }
  for (const list of map.values()) list.sort((x, y) => x.order - y.order);
  return map;
}

export const beats = (contract) => [...contract.scope.beats];
export const anchorIds = (contract) => contract.syncAnchors.map((a) => a.id);
export const criticalAnchorIds = (contract) => [...contract.performance.criticalAnchors];

/** Anchors flagged contingent by their signed event text (may legitimately not occur). */
export function contingentAnchorIds(contract) {
  return contract.syncAnchors.filter((a) => /^contingent\b/i.test(a.event.trim())).map((a) => a.id);
}

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
