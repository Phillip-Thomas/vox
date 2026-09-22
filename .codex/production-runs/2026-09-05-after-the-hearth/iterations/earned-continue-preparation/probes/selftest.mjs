#!/usr/bin/env node
/**
 * EARNED-CONTINUE SELF-TEST — CPU only. No browser, no GPU, no preview, no
 * shared lock, no game state, no capture folder. Every case is a decision over
 * literal values; the two impure primitives in the pinned helper (lock
 * ownership, served identity) are exercised through injected dependencies.
 *
 * It also asserts the PIN: the pinned copy of the manual COMMON role's
 * commonPassageLogic must still be byte-identical to what pin.json recorded, so
 * a later edit by that role cannot silently change this lane's meaning.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  rehashSourceManifest, captureDirDecision, avReading, avAnchorDelta, replayVerdict,
  earnedOriginGate, checkpointPurity, parseWorldKey, worldIdentityVerdict, overwriteVerdict,
  newActionGate, newAnchorEligibility, continueBootDecision
} from './earnedContinueLogic.mjs';
import { heavyLockOwnership, previewBindingDecision, preflightDecision, identityVerdict } from './pinned/commonPassageLogic.pinned.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
let failures = 0; let checks = 0;
const ok = (cond, name) => {
  checks++;
  if (cond) console.log(`  ok   ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const group = (n) => console.log(`\n[${n}]`);

// --- 0. the pin ---------------------------------------------------------------
group('pin integrity');
const pin = JSON.parse(readFileSync(join(HERE, 'pinned/pin.json'), 'utf8'));
const pinned = readFileSync(join(HERE, 'pinned/commonPassageLogic.pinned.mjs'));
ok(sha(pinned) === pin.pins[0].pinnedSha256, 'pinned commonPassageLogic bytes match pin.json');
ok(pin.pins[0].byteIdentical === true, 'pin was taken byte-identical from the manual role file');

// --- 1. source manifest re-hash ----------------------------------------------
group('rehashSourceManifest (injected IO)');
{
  const manifest = JSON.stringify({ hashes: { 'a.ts': sha(Buffer.from('A')), 'b.ts': sha(Buffer.from('B')) } });
  const files = { '/repo/a.ts': Buffer.from('A'), '/repo/b.ts': Buffer.from('B'), '/m.json': Buffer.from(manifest) };
  const readFile = (p) => { if (!(p in files)) throw new Error(`ENOENT ${p}`); return files[p]; };
  const joinPath = (a, b) => `${a}/${b}`;
  const clean = rehashSourceManifest({ manifestPath: '/m.json', repoRoot: '/repo', expectManifestSha: sha(Buffer.from(manifest)), readFile, joinPath });
  ok(clean.intact === true && clean.filesChecked === 2, 'an intact tree hashes every listed file');
  ok(clean.manifestMatchesExpected === true, 'the manifest file hash binds to the expected sha');
  const drifted = rehashSourceManifest({ manifestPath: '/m.json', repoRoot: '/repo', expectManifestSha: 'nope', readFile: (p) => (p === '/repo/b.ts' ? Buffer.from('CHANGED') : readFile(p)), joinPath });
  ok(drifted.intact === false && drifted.mismatches.length === 1, 'one changed source byte is a mismatch, not a pass');
  ok(drifted.manifestMatchesExpected === false, 'a wrong expected manifest sha never matches');
  const missing = rehashSourceManifest({ manifestPath: '/m.json', repoRoot: '/repo', readFile: (p) => (p === '/repo/b.ts' ? (() => { throw new Error('ENOENT'); })() : readFile(p)), joinPath });
  ok(missing.intact === false && missing.unreadable.length === 1, 'an unreadable listed file is recorded, never skipped');
}

// --- 2. capture-dir refusal ---------------------------------------------------
group('captureDirDecision');
ok(captureDirDecision({ path: '/c', exists: false, entries: [] }).ok === true, 'a fresh folder is accepted');
ok(captureDirDecision({ path: '/c', exists: true, entries: ['summary.json'] }).ok === false, 'a NON-EMPTY capture folder is refused');
ok(captureDirDecision({ path: null }).ok === false, 'a missing --out is refused');

// --- 3. AV reading: named, nested, sequenced ----------------------------------
group('avReading / avAnchorDelta');
const av1 = { active: true, suspended: false, beat: 'ch13-survey', anchorId: 'anc.cg.survey-started', anchorEvent: 'activate', activationSequence: 3, activationHistoryAnchorIds: ['anc.cg.origin-landed', 'anc.cg.survey-started'] };
const av2 = { ...av1, anchorId: 'anc.cg.route-offered', activationSequence: 4, activationHistoryAnchorIds: [...av1.activationHistoryAnchorIds, 'anc.cg.route-offered'] };
{
  const r = avReading(av1);
  ok(r.available && r.anchorId === 'anc.cg.survey-started' && r.historyCount === 2, 'named anchor id and history are read from the nested bridge object');
  ok(r.rawKeyCountIsNotEvidence === Object.keys(av1).length, 'the raw key count is retained ONLY as a labelled non-evidence field');
  ok(avReading(null).available === false, 'an absent bridge is unavailable, not empty-but-fine');
  ok(avReading({ av: { anchors: [] } }).historyCount === 0, 'a wrong flat shape yields no named history');
  const d = avAnchorDelta(av1, av2);
  ok(d.addedAnchorIds.length === 1 && d.addedAnchorIds[0] === 'anc.cg.route-offered', 'the delta names the newly activated anchor');
  ok(d.sequenceAdvanced === true, 'the activation SEQUENCE advance is measured, not assumed');
  ok(avAnchorDelta(av1, av1).sequenceAdvanced === false, 'an unchanged sequence does not count as an advance');
}

// --- 4. replay verdict --------------------------------------------------------
group('replayVerdict');
{
  const clean = replayVerdict({ earnedHistory: ['anc.cg.survey-started'], restoredHistory: [], restoredPendingAnchors: [], installWatchBefore: { n: 1 }, installWatchAfter: { n: 1 } });
  ok(clean.noReplay === true && clean.installWatchChanged === false, 'no re-activation and no install re-fire is no replay');
  const replay = replayVerdict({ earnedHistory: ['anc.cg.origin-landed'], restoredHistory: ['anc.cg.origin-landed'] });
  ok(replay.noReplay === false && replay.replayedCueAnchorIds.length === 1, 'a re-played arrival/landing cue is caught by NAME');
  const pending = replayVerdict({ earnedHistory: ['anc.cg.survey-started'], restoredHistory: [], restoredPendingAnchors: ['anc.cg.survey-started'] });
  ok(pending.noReplay === false, 'an already-earned anchor queued as pending after the restore is a replay');
}

// --- 5. earned Origin gate ----------------------------------------------------
group('earnedOriginGate');
const goodGate = {
  originLandedMilestone: true, bootActivePlanetId: '-1,-1:p1', landedActivePlanetId: '-1,-1',
  locationMode: 'surface', controlMode: 'fps', supported: true, bodyPose: [-34, 51.05, 10],
  fps: 58.2, minFps: 15, av: av1, anchors: ['anc.cg.origin-landed']
};
ok(earnedOriginGate(goodGate).ok === true, 'a real landing with grounded support, fps and named anchors passes');
ok(earnedOriginGate({ ...goodGate, originLandedMilestone: false }).ok === false, 'no milestone -> refused');
ok(earnedOriginGate({ ...goodGate, landedActivePlanetId: '-1,-1:p1' }).ok === false, 'still on the departure body -> refused');
ok(earnedOriginGate({ ...goodGate, supported: false }).ok === false, 'an unsupported body is not a landing');
ok(earnedOriginGate({ ...goodGate, controlMode: 'flight' }).ok === false, 'still in flight controls -> refused');
ok(earnedOriginGate({ ...goodGate, fps: 4 }).ok === false, 'a stalled renderer -> refused');
ok(earnedOriginGate({ ...goodGate, fps: null }).ok === false, 'an unmeasured frame rate -> refused');
ok(earnedOriginGate({ ...goodGate, av: { active: true, suspended: false, beat: null, anchorId: null, anchorEvent: null, activationSequence: 0, activationHistoryAnchorIds: [] } }).ok === false, 'an empty NAMED history -> refused (a key count would have passed)');
ok(earnedOriginGate({ ...goodGate, anchors: {} }).ok === false, 'a non-array anchors read (wrong flat path) -> refused');

// --- 6. checkpoint purity -----------------------------------------------------
group('checkpointPurity');
ok(checkpointPurity({ surveyPhase: 'drawing', samples: 4, minSamples: 4 }).catchNow === true, 'the partial checkpoint catches the capture at >= minSamples');
ok(checkpointPurity({ surveyPhase: 'drawing', samples: 2, minSamples: 4 }).catchNow === false, 'below the threshold the rail keeps running');
{
  const impure = checkpointPurity({ surveyPhase: 'drawing', samples: 9, minSamples: 4, milestones: ['story:ch13-route-tested'] });
  ok(impure.pure === false && impure.catchNow === true, 'a route-tested milestone means this is no longer a PARTIAL save');
  ok(checkpointPurity({ surveyPhase: 'drawing', samples: 5, minSamples: 4, firedAnchors: ['anc.cg.route-offered'] }).pure === false, 'a fired route-offered anchor is impure too');
}

// --- 7. world / actor identity ------------------------------------------------
group('worldIdentityVerdict / overwriteVerdict / parseWorldKey');
ok(parseWorldKey('pvx.v1.world.-1,-1:p1').worldId === '-1,-1:p1', 'the world id is parsed off the storage key');
ok(parseWorldKey('pvx.v1.world.-1,-1').prefix === 'pvx.v1.world.', 'the key prefix is parsed');
{
  const same = worldIdentityVerdict({
    savedKey: 'pvx.v1.world.-1,-1', savedWorldId: '-1,-1', savedSeed: 3215739679,
    liveActivePlanetIdAtSave: '-1,-1', liveActivePlanetIdAfterContinue: '-1,-1',
    restoredKey: 'pvx.v1.world.-1,-1', restoredWorldId: '-1,-1', restoredSeed: 3215739679,
    earnedMilestones: ['story:ch13-origin-landed'], restoredMilestones: ['story:ch13-origin-landed']
  });
  ok(same.ok === true, 'same key, prefix, world id, seed, live body and milestones passes');
  const wrongBody = worldIdentityVerdict({ ...{
    savedKey: 'pvx.v1.world.-1,-1', savedWorldId: '-1,-1',
    liveActivePlanetIdAtSave: '-1,-1', liveActivePlanetIdAfterContinue: '-1,-1:p1',
    restoredKey: 'pvx.v1.world.-1,-1'
  } });
  ok(wrongBody.ok === false, 'the run-5 failure shape (resumed on the sibling body) is caught');
  const lost = worldIdentityVerdict({ savedKey: 'k.world.a', restoredKey: 'k.world.a', earnedMilestones: ['story:ch13-origin-landed'], restoredMilestones: [] });
  ok(lost.ok === false && lost.lostMilestones.length === 1, 'a lost actor milestone is caught');
}
ok(overwriteVerdict({ savedSamples: 4, samplesOnDiskAfterContinue: 4 }).ok === true, 'earned samples still on disk after Continue');
ok(overwriteVerdict({ savedSamples: 4, samplesOnDiskAfterContinue: 0 }).ok === false, 'earned samples overwritten by empty live state is caught');
ok(overwriteVerdict({ savedSamples: 0, samplesOnDiskAfterContinue: 0 }).ok === false, 'nothing to preserve is not a pass');
ok(overwriteVerdict({ savedSamples: 4, samplesOnDiskAfterContinue: 4, savedSha256: 'a', shaAfterContinue: 'b' }).ok === true, 'a rewritten blob that keeps the samples is not a failure (bytes alone are not the test)');

// --- 8. new action ------------------------------------------------------------
group('newActionGate / newAnchorEligibility');
const liveNew = { beat: 'ch13-survey', surveyPhase: 'drawing', restoredSamples: 4, prompts: ['[F] Offer this end'], promptOffersF: true, arrived: true };
ok(newActionGate(liveNew).ok === true, 'a restored, live, arrived body with an [F] prompt may press F');
ok(newActionGate({ ...liveNew, promptOffersF: false }).ok === false, 'no shipped [F] prompt -> no press (no shortcut)');
ok(newActionGate({ ...liveNew, arrived: false }).ok === false, 'never arrived by ordinary movement -> refused');
ok(newActionGate({ ...liveNew, beat: 'ch13-return' }).ok === false, 'wrong resume beat -> refused');
ok(newActionGate({ ...liveNew, restoredSamples: 0 }).ok === false, 'an empty restored survey -> refused');
{
  const acc = newAnchorEligibility({ anchorsBefore: ['anc.cg.survey-started'], anchorsAfter: ['anc.cg.survey-started', 'anc.cg.route-offered'], avBefore: av1, avAfter: av2, surveyPhaseBefore: 'drawing', surveyPhaseAfter: 'offered' });
  ok(acc.accepted === true && acc.newlyFiredAnchorIds[0] === 'anc.cg.route-offered', 'acceptance names the NEW anchor');
  const none = newAnchorEligibility({ anchorsBefore: ['x'], anchorsAfter: ['x'], avBefore: av1, avAfter: av1, surveyPhaseBefore: 'drawing', surveyPhaseAfter: 'drawing' });
  ok(none.accepted === false, 'no new anchor and no phase change is not acceptance');
}

// --- 9. Continue-boot hygiene -------------------------------------------------
group('continueBootDecision');
ok(continueBootDecision({ url: 'http://127.0.0.1:38007/?journeyprobe=1&debug=1', storageKeysBefore: ['a'], storageKeysAfter: ['a'] }).ok === true, 'a plain boot that retains storage is clean');
ok(continueBootDecision({ url: 'http://127.0.0.1:38007/?story=ch13-survey' }).ok === false, 'a story deep link on the Continue boot is refused (it would re-seed)');
ok(continueBootDecision({ url: 'http://127.0.0.1:38007/?movie=1' }).ok === false, 'a movie rail on the Continue boot is refused');
ok(continueBootDecision({ url: 'http://x/', storageKeysBefore: ['pvx.v1.world.-1,-1'], storageKeysAfter: [] }).ok === false, 'dropped storage keys are caught');

// --- 10. pinned preflight primitives (injected deps) ---------------------------
group('pinned heavy-lock / preview binding / preflight');
{
  const noFd = heavyLockOwnership({ lockPath: '/tmp/x.lock', fd: null });
  ok(noFd.owned === false, 'no inherited fd -> lock is NOT owned');
  const noPath = heavyLockOwnership({ lockPath: null, fd: 9 });
  ok(noPath.owned === false, 'no lock path -> refused');
  const wrongInode = heavyLockOwnership({
    lockPath: '/tmp/x.lock', fd: 9,
    deps: { fstatSync: () => ({ dev: 1, ino: 111 }), statSync: () => ({ dev: 1, ino: 222 }), readFileSync: () => '', pid: () => 1, execFileSync: () => {} }
  });
  ok(wrongInode.owned === false, 'an inherited fd pointing at a different inode -> refused');
}
{
  const own = { state: 'running', url: 'http://127.0.0.1:38007/', indexSha256: 'I', bundleSha256: 'B', bundlePath: '/assets/x.js', sourceManifestSha256: 'M' };
  const served = { indexSha256: 'I', bundleSha256: 'B', errors: [] };
  const bind = previewBindingDecision({ ownership: own, url: 'http://127.0.0.1:38007/', expectSourceManifestSha: 'M', served });
  ok(bind.ok === true, 'served index+bundle bytes matching root ownership binds the build');
  ok(previewBindingDecision({ ownership: own, url: 'http://127.0.0.1:38007/', expectSourceManifestSha: 'M', served: { indexSha256: 'OTHER', bundleSha256: 'B', errors: [] } }).ok === false, 'a different served index is refused');
  ok(previewBindingDecision({ ownership: own, url: 'http://127.0.0.1:38007/', expectSourceManifestSha: 'OLD', served }).ok === false, 'a stale expected manifest (e.g. the 38803 build) is refused');
  ok(previewBindingDecision({ ownership: own, url: 'http://127.0.0.1:38007/', expectSourceManifestSha: 'M', served: null }).ok === false, 'never fetching the served bytes is refused (liveness is not identity)');

  const goodLock = { owned: true, problems: [] };
  const pf = preflightDecision({ ready: { ready: true }, control: { action: 'continue', activeRole: 'earned-continue' }, url: 'http://127.0.0.1:38007/', out: 'earned-3', heavyLock: goodLock, expectSourceManifestSha: 'M', liveSourceManifestSha: 'M', previewBinding: bind, role: 'earned-continue' });
  ok(pf.launch === true, 'all bindings present -> a browser may launch');
  ok(preflightDecision({ ready: { ready: true }, control: { action: 'continue', activeRole: 'common-manual-focused' }, url: 'http://127.0.0.1:38007/', out: 'o', heavyLock: goodLock, expectSourceManifestSha: 'M', liveSourceManifestSha: 'M', previewBinding: bind, role: 'earned-continue' }).launch === false, 'ANOTHER role holding the active slot (manual COMMON) refuses launch');
  ok(preflightDecision({ ready: { ready: true }, control: { action: 'hold' }, url: 'http://x/', out: 'o', heavyLock: goodLock, expectSourceManifestSha: 'M', liveSourceManifestSha: 'M', previewBinding: bind, role: 'earned-continue' }).launch === false, 'a verifier control hold refuses launch');
  ok(preflightDecision({ ready: { ready: true }, control: { action: 'continue', activeRole: 'earned-continue' }, url: 'http://x/', out: 'o', heavyLock: { owned: false, problems: ['no fd'] }, expectSourceManifestSha: 'M', liveSourceManifestSha: 'M', previewBinding: bind, role: 'earned-continue' }).launch === false, 'an unproven heavy lock refuses launch');
  ok(preflightDecision({ ready: { ready: false }, control: { action: 'continue', activeRole: 'earned-continue' }, url: 'http://x/', out: 'o', heavyLock: goodLock, expectSourceManifestSha: 'M', liveSourceManifestSha: 'M', previewBinding: bind, role: 'earned-continue' }).launch === false, 'an unready run refuses launch');
  ok(preflightDecision({ ready: { ready: true }, control: { action: 'continue', activeRole: 'earned-continue' }, url: 'http://x/', out: 'o', heavyLock: goodLock, expectSourceManifestSha: 'M', liveSourceManifestSha: 'DRIFTED', previewBinding: bind, role: 'earned-continue' }).launch === false, 'a drifted live source manifest refuses launch');
}
ok(identityVerdict({ title: 'Paravoxia', renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)', headed: true, indexSha: 'I', expectIndexSha: 'I' }).ok === true, 'headed ANGLE Paravoxia with a matching index sha is identity');
ok(identityVerdict({ title: 'Paravoxia', renderer: 'SwiftShader', headed: true, indexSha: 'I', expectIndexSha: 'I' }).ok === false, 'a software renderer is refused');
ok(identityVerdict({ title: 'Paravoxia', renderer: 'ANGLE (NVIDIA)', headed: true, indexSha: null, expectIndexSha: 'I' }).ok === false, 'an unmeasured index sha fails when one is required');

console.log(`\n[earned-continue selftest] ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
