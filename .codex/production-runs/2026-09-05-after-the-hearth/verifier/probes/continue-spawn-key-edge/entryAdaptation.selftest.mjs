// Caller-adaptation test: asserts the ACTUAL entrypoint executes the wired
// helper path. A helper that is merely present but unwired CANNOT pass this.
import { readFileSync } from 'node:fs';
import { SPAN_OFFER_CONTRACT, signedSpanOfferAuthorization, gateInputsFromAuthorization } from './liveCalibration.mjs';
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const src = readFileSync(new URL('./earned-continue-3d-probe.mjs', import.meta.url), 'utf8');

// 1. The entry really imports and CALLS the helpers (not a dangling import).
ok(/from '\.\/liveCalibration\.mjs'/.test(src), 'entry imports liveCalibration');
for (const fn of ['signedSpanOfferAuthorization(', 'gateInputsFromAuthorization(', 'recalibrationDecision(', 'accumulateDirected(', 'stampedCalibration(', 'faceChangeRetention(', 'dirsFromEntries(']) {
  ok(src.includes(fn), `entry CALLS ${fn}`);
}
// 2. The old whole-basis latch no longer drives recalibration.
ok(!/if \(staleness\.stale\) \{\n\s*recalibrations\+\+/.test(src), 'pre-round basisStale latch no longer triggers recalibration');
// 3. Both gates receive the boolean derived from the authorization.
ok(/const offersF = gateInputsFromAuthorization\(spanAuth\)\.promptOffersF;/.test(src), 'offersF is the boolean from gateInputsFromAuthorization');
ok(/newActionGate\(\{[\s\S]{0,400}?promptOffersF: offersF/.test(src), 'newActionGate gets the boolean');
ok(/groundedActionGate\(\{[\s\S]{0,600}?promptOffersF: offersF/.test(src), 'groundedActionGate gets the boolean');
// 4. Acceptance is the new signed transition, not a generic phase change.
ok(!src.includes("afterOffer.survey.phase !== 'drawing')\n        || (afterOffer?.anchors"), 'generic phase-change OR anchor-presence acceptance removed');
// C1: acceptance is the CALLED helper, and the invented 19-anchor condition is gone.
// (STATIC WIRING ONLY. The behaviour of the helper is proved by
// continueClosure.selftest.mjs, which calls it; nothing here is a behaviour proof.)
ok(/acceptance: spanOfferAcceptance\(\{/.test(src), 'C1 entry CALLS spanOfferAcceptance for acceptance');
ok(/offer\.accepted = report\.phases\.newAction\.offer\.acceptance\.accepted/.test(src), 'C1 accepted comes from the helper verdict');
// Comment prose that DESCRIBES a removed defect is not the defect; strip line
// comments before asserting the executable text.
const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
ok(!/slice\(0, ?19\)/.test(code) && !/length === 19/.test(code), 'C1 the invented 19-anchor prefix condition is gone from acceptance');
ok(/overwriteVerdict\(/.test(src) && /worldSaveEquality: report\.phases\.survival\?\.overwrite\?\.ok === true/.test(src), 'C1 the SEPARATE full WorldSave/point-prefix equality gate after Continue is preserved');
// C2: the guessed hook is gone; the real journey-probe path and the injected reader are wired.
ok(!/__paravoxiaSystem\??\./.test(code), 'C2 the guessed __paravoxiaSystem hook is no longer read');
ok(/__paravoxiaJourneyProbe/.test(readFileSync(new URL('./continueClosure.mjs', import.meta.url), 'utf8')), 'C2 the real journey-probe hook is the one read');
ok(src.includes('CONTINUE_FRAME_READER_SOURCE'), 'C2 the sampler injects the ACTUAL readContinueFrame source');
ok(!/renderOrigin: s\?\.renderOrigin \?\? s\?\.worldBound/.test(src), 'C2 worldBound is no longer aliased as renderOrigin');
// C3: no since-click filter; harvest runs in the finally path too.
ok(!/x\.ms <= 5000/.test(src), 'C3 the ms<=5000 harvest filter is gone');
ok(/continueCaptureDecision\(/.test(src) && /isValidRuntimeReading\(/.test(src) && /makeContinueSamplerHarvest\(/.test(src), 'C3 entry CALLS the capture-window helpers (completeness now runs inside makeContinueSamplerHarvest)');
ok(/continueCaptureCompleteness\(/.test(readFileSync(new URL('./continueClosure.mjs', import.meta.url), 'utf8')), 'C3 the harvest itself computes completeness from the retained frames');
ok(/harvestContinueSampler\('finally'\)/.test(src), 'C3 the sampler is stopped and harvested on a FAILED Continue too');
ok(/CONTINUE_CAPTURE\.continueWaitBudgetMs/.test(src) && /continueWaitBudgetMs: 60000/.test(readFileSync(new URL('./continueClosure.mjs', import.meta.url), 'utf8')), 'C3 the 60s Continue wait budget is unchanged');
// C4: the giant key walk and the truthy-only dirs overwrite are gone.
ok(!/sleep\(450\)/.test(src) && !/sleep\(350\)/.test(src), 'C4 the 450ms press + 350ms settle key walk is gone');
ok(/CALIBRATION_BOUNDS\.pressMs/.test(src) && /CALIBRATION_BOUNDS\.settleMs/.test(src), 'C4 calibration uses the bounded short press + controlled settle');
ok(!/for \(const k of keys\) if \(retainedDirs\[k\]\) dirs\[k\]/.test(src), 'C4 the truthy-only dirs overwrite that kept stale directions is gone');
ok(/applyRetainedDirs\(dirs, entries, keys\)/.test(src) && /usableEntryCensus\(/.test(src), 'C4 entry CALLS applyRetainedDirs and usableEntryCensus');
ok(!/lateralKeysUsableAtLastCalibration/.test(src), 'C4 the last-partial-round lateral count no longer decides lateral control');
// 5. Telemetry armed BEFORE the click, using real hooks only.
const armIdx = src.indexOf('__voxContinueSampler');
const clickIdx = src.indexOf("await page.click('button[aria-describedby=\"landing-story-subtitle\"]')");
ok(armIdx > 0 && clickIdx > 0 && armIdx < clickIdx, 'sampler armed BEFORE the real Continue click');
ok(src.includes('window.__storyBeat') || src.includes('w.__storyBeat'), 'uses the real __storyBeat hook from evidence.mjs');
ok(src.includes('__voxelDebug') && src.includes('terrainSeed'), 'copies __voxelDebug.spawn.terrainSeed');
// PREFLIGHT FAULT 1: cleanup moved into the shared failure-safe harvest, which
// the probe now builds BEFORE the install/click. Behaviour is proven with a
// mocked page and an injected throw in preflightFaults.selftest.mjs.
ok(readFileSync(new URL('./continueClosure.mjs', import.meta.url), 'utf8').includes('delete window.__voxContinueSampler'), 'sampler is cleaned up (in the shared harvest, on every path)');
// 6. Namespace separation is real at runtime.
ok(SPAN_OFFER_CONTRACT.objectiveId === 'ch13:survey:offer-span', 'objectiveId namespace');
ok(SPAN_OFFER_CONTRACT.actionId === 'story-ch13-offer-span', 'actionId namespace');
ok(SPAN_OFFER_CONTRACT.objectiveId !== SPAN_OFFER_CONTRACT.actionId, 'namespaces are distinct');
const live = { beat: 'ch13-survey', surveyPhase: 'drawing', footArrived: true, prompts: ['[F] Offer the walked span for W-7744 to test.'] };
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span' }).ok === true, 'correct live objective + literal prompt authorizes');
ok(gateInputsFromAuthorization(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span' })).promptOffersF === true, 'gate input is boolean true');
for (const [obj, why] of [['story-ch13-offer-span', 'actionId used as objectiveId'], ['ch13:survey:draw', 'stale/not-ready drawing objective'], [null, 'missing objective']]) {
  ok(signedSpanOfferAuthorization({ ...live, objectiveId: obj }).ok === false, `refuses: ${why}`);
}
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span', prompts: ['[F] Offer this end'] }).ok === false, 'refuses neighbouring "Offer this end"');
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span', prompts: ['[F] Drink'] }).ok === false, 'refuses unrelated [F] Drink');
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span', beat: 'ch12-hearth' }).ok === false, 'refuses wrong beat');
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'ch13:survey:offer-span', footArrived: false }).ok === false, 'refuses missing foot arrival');
let threw = false; try { gateInputsFromAuthorization({ promptOffersF: { ok: false } }); } catch { threw = true; }
ok(threw, 'object {ok:false} is refused by the gate adapter (attempt-1 defect)');

console.log(`entryAdaptation.selftest: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log('  FAIL:', f);
if (fails.length) process.exit(1);
