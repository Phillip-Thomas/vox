/**
 * PREPARED, NOT RUN. CPU-only definition of the single exact-input discriminator
 * for the manual COMMON credit plateau at six.
 *
 * NON-MUTATING BY CONSTRUCTION. This module defines CDP logpoint payloads only.
 * It installs nothing here, opens no browser, touches no game source, and adds
 * no state that could grant credit. Every logpoint condition ends in `false`,
 * so the debugger never pauses; V8 evaluates the condition, appends one bounded
 * record to an array on the page, and resumes.
 *
 * BINDING EVIDENCE (static, exact, verified against the immutable 34825 candidate build):
 *   bundle  /assets/index-Ddqg7x9Y.js
 *   sha256  4b41a7d50f2da85a010eb534540187404bc10a7c2cd474c6653e5030923c83e9
 *   NO source map is shipped, so binding is by unique minified signature, not
 *   by a guessed identifier:
 *     - `function Rwe(e,A,t,i,g=2.5,I=ywe)` is nextRouteCoverage. The substring
 *       `=2.5){` occurs EXACTLY ONCE in the whole 5,666,730-char bundle, and the
 *       body is a literal character-for-character match of the projection scan
 *       in main/src/story/commonGroundRoute.ts:468-503.
 *     - `pwe(` occurs exactly twice: the declaration and ONE call site, inside
 *       `Kme` (= tickCommon), matching commonGroundDirector.ts:1320.
 *   Parameter identity at the call `pwe(tQ,i,t.terraUnits,I)`:
 *     e/tQ = CG_ROUTE_COMMON, A/i = body (the FOOT-projected pose), t = previous
 *     credited units, i(arg 4)/I = displacement, g = corridorRadius default 2.5.
 */

export const BUNDLE = {
  path: '/assets/index-Ddqg7x9Y.js',
  sha256: '4b41a7d50f2da85a010eb534540187404bc10a7c2cd474c6653e5030923c83e9',
  sourceMapShipped: false,
  totalLines: 10970,
  bindingUniqueness: {
    'function Rwe(e,A,t,i,g=2.5,I=ywe){': 1,
    'Rwe(': 2,
    'const ywe=.35': 1
  }
};

/** Zero-based CDP coordinates measured on the exact bundle above. */
export const SITES = {
  /** First statement of nextRouteCoverage, i.e. `const o={x:A.x,y:A.y,z:A.z}`. */
  creditEntry: { lineNumber: 7839, columnNumber: 194730, byteOffset: 4443926 },
  /** Declaration head, for identity re-verification only. */
  creditDecl: { lineNumber: 7839, columnNumber: 194688, byteOffset: 4443884 }
};

/** Bounded sink installed once, before any logpoint, via Runtime.evaluate. */
export const SINK_INSTALL = `(()=>{const g=globalThis;if(g.__cgXi)return 'already';` +
  `g.__cgXi={cap:2400,drop:0,rec:[],push(r){if(this.rec.length<this.cap)this.rec.push(r);else this.drop++;}};` +
  `return 'installed';})()`;

/**
 * LP-A — the only discriminating logpoint.
 *
 * Records, per ACTUAL credit call: the exact prior credited units, the exact
 * foot-projected body point handed to the projection scan, and the exact
 * per-update displacement for that update. It reads ONLY the arguments already
 * on the stack; it calls no predicate, no game function, and no route math.
 *
 * RETURNED credit is NOT readable at function entry. It is recovered exactly,
 * without a second evaluation, from the NEXT record's `prev` (the call site
 * assigns the return straight back into `common.terraUnits`, which is argument
 * `t` of the following update). The FINAL call of a session therefore has an
 * unknown return and MUST be reported as missing, never interpolated.
 */
export const LP_A = {
  id: 'LP-A-credit-call',
  site: SITES.creditEntry,
  condition:
    `(()=>{try{const s=globalThis.__cgXi;if(!s)return false;` +
    `s.push({k:'call',n:s.rec.length,t:performance.now(),` +
    `prev:i.units,rv:i.reachedVertex,pfoot:i.foot?[i.foot.x,i.foot.y,i.foot.z]:null,` +
    `disp:t,foot:[A.x,A.y,A.z],corridor:g,reach:I,routeLen:e.length});` +
    `}catch(_){}return false;})()`,
  pausesExecution: false,
  callsPredicates: false,
  fields: {
    prev: 'coverage.units — ACTUAL prior credited units (arg 4 .units)',
    rv: 'coverage.reachedVertex — ACTUAL prior certified vertex index',
    pfoot: 'coverage.foot — ACTUAL real previous foot, null on the first update',
    disp: 'displacementUnits — ACTUAL per-update displacement (arg 3)',
    foot: 'body — ACTUAL foot-projected credit point (arg 2)',
    corridor: 'corridorRadius actually in effect (expected 2.5)',
    reach: 'vertexReach actually in effect (expected 0.35, 3D euclidean)',
    routeLen: 'CG_ROUTE_COMMON length, guards route identity'
  }
};

/**
 * FOOT REPRESENTATION, qualified.
 * `body` is commonGroundPlayerPose() = playerWorldPosition - up * CG_PLAYER_GROUND_OFFSET
 * (commonGroundDirector.ts:791-799). On the curved surface `up` is not +Y, so this
 * foot point differs from the camera/body centre HORIZONTALLY as well as vertically.
 * All positions in LP-A are in this foot representation, and must not be compared
 * against body-centre poses from earlier traces without restating the offset.
 */
export const FOOT_REPRESENTATION = {
  expression: 'playerWorldPosition - up * CG_PLAYER_GROUND_OFFSET',
  source: 'main/src/story/commonGroundDirector.ts:791-799',
  horizontalDivergenceOnCurvedSurface: true
};

/**
 * PREDICATES ACTUALLY EVALUATED AT THE CREDIT SITE, from the minified call site
 * `(g?fL(g,i,o,{extraSolids:n}):o.isSupported(i))&&GH(Q,RH(i),zKA()).ok&&(t.terraUnits=pwe(...))`
 * and commonGroundDirector.ts:1313-1322. This list is EXHAUSTIVE.
 */
export const EVALUATED_PREDICATES = [
  {
    name: 'walkedSegmentSupported(previousBody, body, ground, {extraSolids})',
    minified: 'fL',
    evaluated: 'always, when previousBody exists',
    covers: [
      'footing.isSupported at dense 0.25-unit samples along the walked span',
      'capsule-footprint overlap vs CG_APPARATUS_SOLIDS (radius 0.5, height 3.6)',
      'capsule-footprint overlap vs binding.extraSolids'
    ]
  },
  {
    name: 'ground.isSupported(body)',
    evaluated: 'ONLY on the first update, when previousBody is null',
    covers: ['single-point support, no swept footprint']
  },
  {
    name: 'checkReference(workerSocket, playerSocket(body), {extraSolids}).ok',
    minified: 'GH(Q,RH(i),zKA()).ok',
    evaluated: 'ONLY if the support term was true (&& short-circuit)',
    covers: [
      'reference range vs REFERENCE_RANGE_UNITS',
      'solid sight occlusion vs CG_APPARATUS_SOLIDS',
      'solid sight occlusion vs extraSolids'
    ]
  }
];

/**
 * PRESUMED-BUT-ABSENT BRANCH. Reported as absent rather than fabricated true.
 * `bodiesClear` (minified `TKA`, commonGroundRoute.ts:433) is the body-body
 * clearance predicate. It is NOT in the Terra credit chain: within
 * commonGroundDirector.ts it is called at :1213 and :2419, neither of which is
 * on the path to the routeProgressUnits call at :1320. Likewise `spanClearance`
 * (:2054, used at :2104) is standby-placement only. Any reading that credit is
 * gated on body clearance is UNSUPPORTED by the call chain.
 */
export const ABSENT_PREDICATES = [
  { name: 'bodiesClear', minified: 'TKA', declaredAt: 'commonGroundRoute.ts:433',
    calledAt: ['commonGroundDirector.ts:1213', 'commonGroundDirector.ts:2419'],
    onCreditPath: false },
  { name: 'spanClearance', declaredAt: 'commonGroundDirector.ts:2054',
    calledAt: ['commonGroundDirector.ts:2104'], onCreditPath: false }
];

/**
 * UNCALLED / SKIPPED PREDICATE REASONS, as they must be recorded in the report:
 *  - 'short-circuit-support-false' : checkReference is never reached when the
 *    support term is false. Its outcome for that update is MISSING, not false.
 *  - 'first-update-no-previous-body' : the swept walked-segment test is replaced
 *    by a single-point isSupported, so footprint sweeping is UNEVALUATED.
 *  - 'guard-false-no-credit-call'   : LP-A produces NO record at all. Absence of
 *    a record on an update is itself the evidence that a guard failed; it does
 *    NOT tell us which one, and MUST NOT be reported as a credit refusal.
 *  - 'no-displacement-early-return' : inside routeProgressUnits, !(disp>0)
 *    returns previousUnits before any segment scan.
 * Recovering WHICH guard failed would require re-evaluating physical predicates,
 * which this commission forbids. Those values stay MISSING.
 */
export const SKIP_REASONS = [
  'short-circuit-support-false',
  'first-update-no-previous-body',
  'guard-false-no-credit-call',
  'no-displacement-early-return'
];

/** Bounded drain, run once at the end of the session. */
export const DRAIN = `(()=>{const s=globalThis.__cgXi;return s?` +
  `JSON.stringify({count:s.rec.length,dropped:s.drop,rec:s.rec}):null;})()`;

/** Derive ACTUAL returned credit by chaining; never interpolate. */
export function chainReturns(records) {
  return records.map((r, idx) => {
    const next = records[idx + 1];
    return {
      ...r,
      returned: next ? next.prev : null,
      returnedSource: next ? 'actual-next-call-previousUnits' : 'MISSING-final-call',
      arcGain: next ? next.prev - r.prev : null,
      ceiling: r.prev + r.disp,
      refusedByCeiling: next ? (next.prev - r.prev) <= 1e-12 && r.disp > 0 : null
    };
  });
}
