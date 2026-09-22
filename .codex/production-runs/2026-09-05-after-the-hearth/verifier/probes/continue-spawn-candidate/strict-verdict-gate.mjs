#!/usr/bin/env node
/**
 * PRIVATE post-finally verdict gate for the continue-spawn-verifier runtime step.
 * Runs ONLY after the real browser probe, over the SAME freshly written capture.
 * It never mutates game state, never weakens allHeld, never manufactures a pass,
 * and never substitutes for the runtime step.
 *
 * Implements verification-continue-spawn-runtime-review.txt items 1-4:
 *  (1) cleanup-receipt.json (POST-finally) + source-rehash.json stability.
 *  (2) TRUE full point-object prefix equality: the serialized LATE saved
 *      commonGround.survey.working.samples FULL objects vs the corresponding
 *      first N of the after-Continue serialized samples. Counts + whole-blob
 *      sha (survival.overwrite) are PRESERVED as diagnostics only; they are not
 *      prefix equality and can falsely reject legitimate appended points.
 *  (3) SCOPED saved pose (savedPrimary.key + '.player'), CENTRE-to-CENTRE
 *      against the restored centre in the complete Continue telemetry. The old
 *      unscoped '.player' foot-vs-centre lookup is NOT used as position proof.
 *  (4) Missing/false prefix, pose, cleanup or source proof FAILS. Existing
 *      mandatory newF / route-offered / noReplay identities remain.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2];
const probeStatus = Number(process.argv[3]);
const bad = [];
const evidence = { outDir, probeExit: probeStatus, utc: new Date().toISOString() };
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const need = (cond, msg) => { if (!cond) bad.push(msg); return !!cond; };

if (probeStatus !== 0) bad.push(`probe-exit=${probeStatus}`);

const sumPath = join(outDir, 'summary.json');
if (!existsSync(sumPath)) {
  console.error(`GATE-FAIL: no summary.json written at ${sumPath}`);
  process.exit(92);
}
const r = readJson(sumPath);

// ---------------------------------------------------- existing mandatory gates
const g = r.requiredGates || {};
evidence.requiredGates = g;
need(g.allHeld === true, `requiredGates.allHeld=${g.allHeld}`);
for (const k of ['actualAcceptedNewAction', 'worldSaveEquality', 'continueTelemetryComplete']) {
  need(g[k] === true, `requiredGates.${k}=${g[k]}`);
}
for (const [k, v] of Object.entries(g)) {
  if (v === false && !bad.some((b) => b.startsWith(`requiredGates.${k}=`))) bad.push(`requiredGates.${k}=false`);
}
const accepted = r?.phases?.newAction?.offer?.accepted;
evidence.newActionAccepted = accepted;
need(accepted === true, `phases.newAction.offer.accepted=${accepted}`);

// ------------------------------------- (1) POST-FINALLY cleanup + source gate
// summary.cleanupPreFinally is NOT authoritative for cleanup state.
const cleanupPath = join(outDir, 'cleanup-receipt.json');
if (!need(existsSync(cleanupPath), 'MISSING cleanup-receipt.json (post-finally cleanup proof absent)')) {
  evidence.cleanup = null;
} else {
  const c = readJson(cleanupPath);
  evidence.cleanup = { state: c.state, cleanupCompleted: c.cleanupCompleted, sessionStopped: c.sessionStopped ?? c.stopCall?.sessionStopped ?? null, cleanupError: c.cleanupError ?? c.stopCall?.cleanupError ?? null, rootPreviewUntouched: c.rootPreviewUntouched, heavyLockInheritedFd: c.heavyLockInheritedFd };
  need(c.state === 'stopped', `cleanup-receipt.state=${c.state} (expected "stopped")`);
  need(c.cleanupCompleted === true, `cleanup-receipt.cleanupCompleted=${c.cleanupCompleted}`);
  const stopped = c.sessionStopped ?? c.stopCall?.sessionStopped;
  need(stopped === true, `cleanup-receipt sessionStopped=${stopped}`);
  const cerr = c.cleanupError ?? c.stopCall?.cleanupError ?? null;
  need(cerr == null, `cleanup-receipt cleanupError=${JSON.stringify(cerr)}`);
}

const rehashPath = join(outDir, 'source-rehash.json');
if (!need(existsSync(rehashPath), 'MISSING source-rehash.json (source stability proof absent)')) {
  evidence.sourceRehash = null;
} else {
  const s = readJson(rehashPath);
  evidence.sourceRehash = { stableAcrossCapture: s.stableAcrossCapture, before: { sha: s.before?.manifestSha256, intact: s.before?.intact }, after: { sha: s.after?.manifestSha256, intact: s.after?.intact } };
  need(s.stableAcrossCapture === true, `source-rehash.stableAcrossCapture=${s.stableAcrossCapture}`);
  need(s.before?.intact === true, `source-rehash.before.intact=${s.before?.intact}`);
  need(s.after?.intact === true, `source-rehash.after.intact=${s.after?.intact}`);
}

// ------------- (2) TRUE full point-object prefix equality from the RAW BYTES --
// LATE saved bytes = worldsave-<key>.json (written from the post-beforeunload
// storage read). After-Continue bytes = worldsave-after-continue-<key>.json.
// We compare serialized FULL sample objects, saved[i] vs afterContinue[i] for
// i < saved.length. Extra appended points after the prefix are LEGITIMATE.
const savedPrimary = (r?.phases?.save?.actualWorldSaves || []).find((w) => w.hasCommonGround)
  ?? (r?.phases?.save?.actualWorldSaves || [])[0] ?? null;
const prefix = { method: 'serialized full point-object prefix equality (saved LATE beforeunload bytes vs after-Continue bytes)', ok: false };
if (!need(savedPrimary?.key && savedPrimary?.file, 'MISSING savedPrimary WorldSave file reference (no late saved bytes to compare)')) {
  prefix.reason = 'no savedPrimary';
} else {
  const restored = (r?.phases?.continue?.storageAfterContinue || []).find((w) => w.key === savedPrimary.key) ?? null;
  const savedFile = join(outDir, savedPrimary.file);
  const afterFile = restored?.file ? join(outDir, restored.file) : null;
  prefix.savedKey = savedPrimary.key;
  prefix.savedFile = savedPrimary.file;
  prefix.afterFile = restored?.file ?? null;
  if (!need(existsSync(savedFile), `MISSING late saved WorldSave bytes ${savedPrimary.file}`)
    || !need(afterFile && existsSync(afterFile), `MISSING after-Continue WorldSave bytes for key ${savedPrimary.key}`)) {
    prefix.reason = 'raw bytes absent';
  } else {
    const savedBlob = JSON.parse(readFileSync(savedFile, 'utf8'));
    const afterBlob = JSON.parse(readFileSync(afterFile, 'utf8'));
    const sv = savedBlob?.commonGround?.survey?.working?.samples;
    const av = afterBlob?.commonGround?.survey?.working?.samples;
    prefix.savedSampleCount = Array.isArray(sv) ? sv.length : null;
    prefix.afterSampleCount = Array.isArray(av) ? av.length : null;
    // world / actor / seed identity carried by the same raw bytes
    prefix.savedWorldId = savedBlob?.worldId ?? null;
    prefix.afterWorldId = afterBlob?.worldId ?? null;
    prefix.savedSeed = savedBlob?.seed ?? null;
    prefix.afterSeed = afterBlob?.seed ?? null;
    need(prefix.savedWorldId != null && prefix.savedWorldId === prefix.afterWorldId,
      `worldId mismatch across Continue saved=${JSON.stringify(prefix.savedWorldId)} after=${JSON.stringify(prefix.afterWorldId)}`);
    need(prefix.savedSeed != null && prefix.savedSeed === prefix.afterSeed,
      `seed mismatch across Continue saved=${JSON.stringify(prefix.savedSeed)} after=${JSON.stringify(prefix.afterSeed)}`);
    if (!need(Array.isArray(sv) && sv.length > 0, `late saved samples missing/empty (count=${prefix.savedSampleCount}) — nothing to preserve is not a pass`)
      || !need(Array.isArray(av), `after-Continue samples missing (count=${prefix.afterSampleCount})`)) {
      prefix.reason = 'sample arrays unusable';
    } else if (!need(av.length >= sv.length, `after-Continue sample count ${av.length} < saved ${sv.length} (saved points lost)`)) {
      prefix.reason = 'prefix shorter than saved';
    } else {
      const mismatches = [];
      for (let i = 0; i < sv.length; i += 1) {
        const a = JSON.stringify(sv[i]);
        const b = JSON.stringify(av[i]);
        if (a !== b) mismatches.push({ index: i, saved: sv[i], afterContinue: av[i] });
      }
      prefix.mismatchCount = mismatches.length;
      prefix.firstMismatches = mismatches.slice(0, 3);
      prefix.appendedAfterPrefix = av.length - sv.length;
      prefix.ok = mismatches.length === 0;
      need(prefix.ok, `full point-object prefix equality FAILED: ${mismatches.length}/${sv.length} saved sample objects differ after Continue (first index ${mismatches[0]?.index})`);
    }
  }
}
evidence.pointPrefixEquality = prefix;
// PRESERVED diagnostic, explicitly NOT the prefix proof:
evidence.legacyOverwriteDiagnostic = {
  note: 'survival.overwrite compares COUNTS + whole-WorldSave sha. Retained as a diagnostic only; it is not full point-object prefix equality and can falsely reject legitimate appended points.',
  value: r?.phases?.survival?.overwrite ?? null
};

// ------------------------- (3) SCOPED saved pose, CENTRE-to-CENTRE comparison --
const pose = { method: 'scoped saved pose (savedPrimary.key + ".player") CENTRE vs restored CENTRE (telemetry frames[].capsule) in the complete Continue telemetry', ok: false };
const poseKey = savedPrimary?.key ? `${savedPrimary.key}.player` : null;
pose.scopedKey = poseKey;
const findPose = (snap) => (snap?.poses || []).find((p) => p.key === poseKey) ?? null;
const savedPoseEntry = findPose(r?.phases?.pose?.menuBeforeContinueClick)
  ?? findPose(r?.phases?.pose?.afterBeforeunloadAndMenuBoot)
  ?? findPose(r?.phases?.pose?.beforeNavigation);
pose.savedSource = findPose(r?.phases?.pose?.menuBeforeContinueClick) ? 'menuBeforeContinueClick'
  : findPose(r?.phases?.pose?.afterBeforeunloadAndMenuBoot) ? 'afterBeforeunloadAndMenuBoot'
    : findPose(r?.phases?.pose?.beforeNavigation) ? 'beforeNavigation' : null;
const tel = r?.phases?.continue?.telemetry ?? null;
pose.telemetryComplete = tel?.completeness?.complete ?? null;
// Root transport correction: the actual retained sampler exposes frames[].capsule.
// Inspect every valid post-click frame, including the tail. A first/menu-only
// sample would miss the measured baseline jump at +687/+802ms.
const telFrames = Array.isArray(tel?.frames) ? tel.frames : [];
const validFrames = telFrames.filter((f) => f?.msSinceClick >= 0 && f?.beatPublished === true
  && f?.worldBound === true && Array.isArray(f?.capsule) && f.capsule.length === 3);
const savedCentre = Array.isArray(savedPoseEntry?.pos) ? savedPoseEntry.pos : null;
pose.savedCentre = savedCentre;
pose.telemetryFrameCount = telFrames.length;
pose.validPostClickFrameCount = validFrames.length;
pose.firstValidMsSinceClick = validFrames[0]?.msSinceClick ?? null;
pose.lastValidMsSinceClick = validFrames.at(-1)?.msSinceClick ?? null;
if (!need(savedCentre, `MISSING scoped saved pose centre for key ${poseKey}`)
  || !need(validFrames.length > 0, 'MISSING valid post-click CENTRE frames in Continue telemetry')) {
  pose.reason = 'centre-to-centre evidence absent';
} else {
  const displacements = validFrames.map((f) => {
    const delta = f.capsule.map((v,i) => Number(v)-Number(savedCentre[i]));
    return { msSinceClick:f.msSinceClick, centre:f.capsule,
      horizontalUnits:Math.hypot(delta[0],delta[2]), verticalUnits:delta[1],
      total3dUnits:Math.hypot(...delta), activePlanetId:f.activePlanetId, terrainSeed:f.terrainSeed };
  });
  pose.first = displacements[0];
  pose.last = displacements.at(-1);
  pose.maxHorizontal = displacements.reduce((a,b)=>b.horizontalUnits>a.horizontalUnits?b:a);
  pose.maxTotal3d = displacements.reduce((a,b)=>b.total3dUnits>a.total3dUnits?b:a);
  pose.identityMismatches = displacements.filter((f)=>f.activePlanetId!==prefix.savedWorldId || f.terrainSeed!==prefix.savedSeed).slice(0,3);
  pose.validTailCoverageMs = pose.lastValidMsSinceClick-pose.firstValidMsSinceClick;
  // This is a coarse instrument guard, not a gameplay tolerance. Root still
  // reviews actual measured displacement; no game predicate is changed.
  pose.ok = pose.maxHorizontal.horizontalUnits <= 5 && pose.maxTotal3d.total3dUnits < 5
    && pose.identityMismatches.length===0 && pose.validTailCoverageMs >= 5000;
  need(pose.maxHorizontal.horizontalUnits <= 5 && pose.maxTotal3d.total3dUnits < 5,
    `saved walking position moved during valid Continue window: max horizontal=${pose.maxHorizontal.horizontalUnits}u max total=${pose.maxTotal3d.total3dUnits}u`);
  need(pose.identityMismatches.length===0, 'world/seed changed inside valid Continue position window');
  need(pose.validTailCoverageMs >= 5000, `valid post-click centre tail only ${pose.validTailCoverageMs}ms`);
}
evidence.poseCentreToCentre = pose;
need(pose.telemetryComplete === true, `continue telemetry completeness=${pose.telemetryComplete} (5s valid runtime/foot tail incomplete)`);

console.log(`STRICT GATE REPORT ${JSON.stringify(evidence, null, 1)}`);
if (bad.length) {
  console.error(`GATE-FAIL: ${bad.join('; ')}`);
  process.exit(93);
}
console.log('GATE-PASS: actual acceptance + point-prefix + centre-pose + cleanup + source stability all held');
