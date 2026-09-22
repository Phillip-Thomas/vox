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
ok(src.includes('newRouteOfferedAnchor:') && src.includes('restoredPrefixIntact') && src.includes('fAuthorizedAndPressed'), 'acceptance requires new anchor + intact 19-prefix + authorized press');
// 5. Telemetry armed BEFORE the click, using real hooks only.
const armIdx = src.indexOf('__voxContinueSampler');
const clickIdx = src.indexOf("await page.click('button[aria-describedby=\"landing-story-subtitle\"]')");
ok(armIdx > 0 && clickIdx > 0 && armIdx < clickIdx, 'sampler armed BEFORE the real Continue click');
ok(src.includes('window.__storyBeat') || src.includes('w.__storyBeat'), 'uses the real __storyBeat hook from evidence.mjs');
ok(src.includes('__voxelDebug') && src.includes('terrainSeed'), 'copies __voxelDebug.spawn.terrainSeed');
ok(src.includes('delete window.__voxContinueSampler'), 'sampler is cleaned up');
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
