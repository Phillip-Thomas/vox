// Writes the iteration-3 (repair-verification) records from the measured
// bytes on disk: verification-report.json gains a repairIteration section,
// check-results.json gains a repairVerification block, and the iteration
// ledger gains one row. Iteration-1 and iteration-2 content is carried
// through verbatim.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V3 = path.join(RUN_DIR, 'evidence', 'verification-v3');
const CONTRACT_SHA = '1e36818230e7f48649c040b0e6574cad51c67dd5ba405fa00661307f0e0b4737';
const RECORDED_AT = new Date().toISOString();
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const analysis = read(path.join(V3, 'ladder-analysis.json'));
const scan = read(path.join(V3, 'frame-defect-scan.json'));
const seeded = read(path.join(V3, 'seeded-entries.json'));
const seededFrames = read(path.join(V3, 'seeded-entry-frames.json'));
const R = analysis.routes;

const routeRow = (id, label, url, verdict, note) => ({
  id,
  label,
  url,
  coldRuns: R[id].coldRuns,
  validRuns: R[id].validRuns,
  perRun: R[id].rows.map(r => ({
    run: r.run, tL1: r.tL1, tL2: r.tL2, tL3: r.tL3, tL4: r.tL4,
    tPhaseEdge: r.tPhaseEdge, tDeepSpace: r.tDeepSpace,
    l2Cause: r.l2Cause, c3MarginSeconds: r.c3MarginSeconds,
    onceOnlyCounts: r.onceOnly, order: r.order, pageErrors: r.pageErrors
  })),
  crossRunSpreadSeconds: {
    tL1: R[id].variance.tL1?.spread ?? null,
    tL2: R[id].variance.tL2?.spread ?? null,
    tL3: R[id].variance.tL3?.spread ?? null,
    tPhaseEdge: R[id].variance.tPhaseEdge?.spread ?? null,
    tDeepSpace: R[id].variance.tDeepSpace?.spread ?? null
  },
  maxFormulaDeltaSeconds: R[id].formulaMaxDeltaSeconds,
  l3RenderedEveryRun: R[id].l3RenderedEveryRun,
  l3DroppedEveryRun: R[id].l3DroppedEveryRun,
  status: verdict,
  measurement: note
});

const repairIteration = {
  iteration: 3,
  route: 'repair-verification',
  contractVersion: 'draft-v3',
  contractSha256: CONTRACT_SHA,
  supersedesContractVersion: 'draft-v2',
  repairsDefectIds: ['vd-01'],
  recordedBy: 'story-verifier',
  recordedAt: RECORDED_AT,
  status: 'fail',
  scope: 'Targeted delta re-proof of the vd-01 repair in main/src/story/emergentStoryDirector.ts (tickLaunchVoice only). Every iteration-1 result in the sections above — ch7, the frozen exit-window table, frame rate, variants, audio and the reset matrix — stands and is retained verbatim; the exit-window cadence was nonetheless re-measured here because tickLaunchVoice changed, and it is clean.',
  summary: 'The paced ladder implements its contracted formulas exactly: t_L2 = min(t_L1 + 4.5, t_phaseEdge) and t_L3 = max(t_phaseEdge, t_L2 + 3.0) hold within 0.066 s worst case across 24 cold runs, with both branches of both formulas exercised; order, once-only, the drop rule, seeded-consumed entry, variant parity and the frozen exit-window table all verify clean. One contracted term fails: acceptance criterion [21], the measured-margin guarantee. On the only scripted paced route that actually reaches deep_space, t_L3 + 1.98 s lands AFTER t_deepSpace by 1.211 s on average (-1.239 to -1.173 across three cold runs), so L3 is truncated at roughly a third of its reveal rather than completing strictly before the exit. On the literal contract script (hold [SPACE] at entry +6.0 s and nothing further) the ship never reaches deep_space at all inside a 22 s observation, so no margin exists to measure on that variant; the full three-line experience with completed reveals was observed only on routes that never leave the atmosphere.',
  environment: {
    browser: 'Chromium (playwright-core, ~/.cache/ms-playwright)',
    flags: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720'],
    renderer: 'SwiftShader (headless)',
    qualityTier: 'LOW (POTATO where labelled)',
    viewport: '1280x720 (390x844 for the mobile-portrait variant)',
    clockSource: "the game's own pause-aware storyNow(); beat entry taken from the store subscription where it won the boot race and from the app's window.__storyBeat mirror converted onto the same clock otherwise, with the conversion offset recorded per run",
    canonicalPreviewUrl: 'http://localhost:5176'
  },
  namedConstantsVerified: {
    source: 'main/src/story/emergentStoryDirector.ts',
    CH8_L1_MIN_SLOT_SECONDS: 4.5,
    CH8_L2_MIN_SLOT_SECONDS: 3,
    l3RevealSeconds: 1.972,
    revealRateMsPerChar: 34,
    evidenceRefs: ['evidence/verification-v3/ladder-analysis.json']
  },
  routes: [
    routeRow('routeA.space-only', 'Route A, paced scripted deep link, contract script exactly (?story=ch8-launch&profile=LOW, hold [SPACE] at entry +6.0 s, no further pilot input)',
      'http://localhost:5176/?story=ch8-launch&profile=LOW', 'partial',
      'Full three-line ladder, all three captions once and in order, L3 reveal complete at +2.0 s (58/58 characters imaged). L2 was edge-accelerated in 3/3 runs because ignition at +6.0 s puts the phase edge (7.466-7.488 s) 0.22-0.50 s ahead of the timer slot t_L1+4.5; L1 had already completed its reveal, so nothing was interrupted. The ship never reached deep_space within the 22 s observation, so acceptance criterion [21] has no t_deepSpace to measure against on this variant.'),
    routeRow('routeA.space-then-w', 'Route A variant that actually exits: same ignition, then hold [W] through the climb as the shipped climb objective instructs',
      'http://localhost:5176/?story=ch8-launch&profile=LOW', 'fail',
      'Ladder and formulas identical, but t_deepSpace lands 1.211 s (mean) BEFORE t_L3 + 1.98 s, so L3 is truncated by the frozen exit-window table. Measured C3 margin -1.239 / -1.173 / -1.222 s. Criterion [21] requires the margin strictly positive and flags anything under 0.3 s.'),
    routeRow('routeA.space-late-ignite', 'Route A timer-branch control: identical route with ignition at entry +10.0 s',
      'http://localhost:5176/?story=ch8-launch&profile=LOW', 'pass',
      'Exercises the branches the +6.0 s script cannot: L2 fires on the timer at exactly t_L1 + 4.5 s in 3/3 runs (7.613-7.978 s against L1 at 3.091-3.450 s) and L3 fires on the phase edge as max(t_phaseEdge, t_L2+3.0) = t_phaseEdge. Worst formula delta 0.037 s.'),
    routeRow('routeB.chained-movie', 'Route B, chained movie entry from the ch7 flow (?story=ch7-board&movie=1&profile=LOW)',
      'http://localhost:5176/?story=ch7-board&movie=1&profile=LOW', 'pass',
      'L1 renders at entry +0.023 s; L2 fires exactly on the phase edge (1.433-1.462 s), 3.06-3.09 s ahead of its timer slot, and interrupts L1 at 37-39 of 94 revealed characters — the authored player-caused exception, imaged as a pair at edge -0.081/-0.062 s and edge +0.237/+0.239 s. L3 is DROPPED in 3/3 runs: its due time (t_L2+3.0 = 4.43-4.46 s) is after the first deep_space observation at 3.390-3.406 s, and no L3 caption appears in the trace or in any frame. Exit window unaffected.'),
    routeRow('routeC.deeplink-movie', 'Route C, plain deep-link movie (?story=ch8-launch&movie=1&profile=LOW)',
      'http://localhost:5176/?story=ch8-launch&movie=1&profile=LOW', 'pass',
      'L1 at 2.986-3.277 s, L2 edge-accelerated at 4.390-4.720 s interrupting L1 mid-reveal, L3 DROPPED in 3/3 runs (due 7.39-7.72 s against deep_space at 6.266-6.567 s). Frames at deep_space -0.5/+0.0/+0.5 s record the state: at the exit the caption slot still holds L2 at 53 of 65 characters, so on this route it is L2, not L3, that the frozen exit-window table truncates.'),
    routeRow('routeD.potato', 'Route D, POTATO tier deep-link movie', 'http://localhost:5176/?story=ch8-launch&movie=1&profile=POTATO', 'pass',
      'Asserted as the drop, not the render: L3 dropped in 3/3 runs, order and once-only intact, exit-window table unaffected. No L3 caption in any trace or frame.'),
    routeRow('routeD.mobile-portrait', 'Route D parity, 390x844 mobile portrait', 'http://localhost:5176/?story=ch8-launch&movie=1&profile=LOW', 'pass',
      'Same string set and order (L1 then L2), same drop behaviour, L2 offset from L1 within 0.004 s of the desktop reference.'),
    routeRow('routeD.reduced-motion', 'Route D parity, prefers-reduced-motion reduce', 'http://localhost:5176/?story=ch8-launch&movie=1&profile=LOW', 'pass',
      'Same string set and order, same drop behaviour, L2 offset from L1 within 0.012 s of the desktop reference.')
  ],
  c3MarginGuarantee: {
    contractRef: 'evidence.acceptanceCriteria[21]',
    formula: 't_deepSpace - (t_L3 + 1.98 s)',
    l3RevealSeconds: 1.972,
    status: 'fail',
    measuredOnRoute: 'routeA.space-then-w (the only scripted paced route observed to reach deep_space)',
    perRunMarginSeconds: R['routeA.space-then-w'].rows.map(r => r.c3MarginSeconds),
    meanMarginSeconds: R['routeA.space-then-w'].variance.c3Margin.mean,
    minMarginSeconds: R['routeA.space-then-w'].variance.c3Margin.min,
    maxMarginSeconds: R['routeA.space-then-w'].variance.c3Margin.max,
    crossRunSpreadSeconds: R['routeA.space-then-w'].variance.c3Margin.spread,
    underTriadFlagThreshold: true,
    triadFlagRaised: true,
    contractLiteralRouteResult: 'On hold-[SPACE]-only the ship stays in atmosphere; no deep_space observation occurred within 22 s of beat entry in 3/3 runs, so the guarantee is unmeasurable rather than met on that variant.',
    physicalCause: 'Measured air time from the phase edge to the first deep_space observation is 3.80-3.86 s with the shipped climb input, while L3 is scheduled at t_phaseEdge + 3.0 s and needs 1.972 s of reveal after that — 4.97 s of air time. The ladder needs about 1.2 s more climb than the shipped flight physics give a player who follows the climb objective.',
    evidenceRefs: [
      'evidence/verification-v3/ladder-analysis.json',
      'evidence/verification-v3/routeA-space-then-w.json',
      'evidence/verification-v3/routeA-space.json'
    ]
  },
  formulaConformance: {
    status: 'pass',
    l2: {
      timerBranchObserved: 'routeA.space-late-ignite, 3/3 runs',
      edgeBranchObserved: 'routeA.space-only, routeA.space-then-w, routeB, routeC and all three Route D variants, 3/3 runs each',
      maxAbsoluteDeltaSeconds: 0.066
    },
    l3: {
      edgeBranchObserved: 'routeA.space-late-ignite, 3/3 runs (t_L3 = t_phaseEdge)',
      spacingBranchObserved: 'routeA.space-only and routeA.space-then-w, 3/3 runs each (t_L3 = t_L2 + 3.0)',
      maxAbsoluteDeltaSeconds: 0.066,
      note: 'The largest residuals sit on the capture-heavy space-then-w runs; the same route measured without screenshots resolves to 0.026 s, so the residual is shutter load on the director tick, not scheduling drift.'
    },
    orderAndOnceOnly: 'L1 then L2 then L3 with exactly one emission each on every route where a line fires; zero repeats across 24 cold runs.',
    protectedState: 'No signed-anchor read remains in the ladder path; every trigger observed here reads getSpaceFlightSnapshot() and the shipped dwell state only.',
    evidenceRefs: ['evidence/verification-v3/ladder-analysis.json']
  },
  authoredInterruption: {
    status: 'pass',
    rule: 'Acceptance criterion [20]: a phase-edge acceleration may interrupt L1 mid-reveal to deliver L2; the timer path may never interrupt.',
    edgeCausedInterruptionImaged: true,
    framePairs: [
      { run: 'routeB run 2', before: 'evidence/verification-v3/routeB-desktop-run2/005_burst_t1p35s_ch8-launch_surface.png', beforeOffsetFromEdgeSeconds: -0.081, beforeRevealedChars: '37/94', after: 'evidence/verification-v3/routeB-desktop-run2/007_burst_t1p67s_ch8-launch_descent.png', afterOffsetFromEdgeSeconds: 0.237, afterRevealedChars: '6/65' },
      { run: 'routeB run 3', before: 'evidence/verification-v3/routeB-desktop-run3/005_burst_t1p37s_ch8-launch_surface.png', beforeOffsetFromEdgeSeconds: -0.062, beforeRevealedChars: '39/94', after: 'evidence/verification-v3/routeB-desktop-run3/007_burst_t1p67s_ch8-launch_descent.png', afterOffsetFromEdgeSeconds: 0.239, afterRevealedChars: '6/65' }
    ],
    timerPathNeverInterrupted: 'In the timer-branch control (late ignition) L1 completed all 94 characters 1.326-1.341 s before L2 fired.',
    evidenceRefs: ['evidence/verification-v3/routeB-desktop.json', 'evidence/verification-v3/routeA-space-late-ignite.json']
  },
  dropRule: {
    status: 'pass',
    droppedEveryRunOn: ['routeB.chained-movie', 'routeC.deeplink-movie', 'routeD.potato', 'routeD.mobile-portrait', 'routeD.reduced-motion'],
    dropAssertedInTraceNotJustAbsentFromFrames: 'The caption store subscription records every emission; L3 appears in zero of the 15 movie-route traces, and the exit-window origin (L4) is the next caption after L2 on every one.',
    nothingDeferredIntoExitWindow: 'L4 fires at +0.000 s of the exit window in 15/15 movie runs and no L-line appears anywhere inside the window.',
    evidenceRefs: ['evidence/verification-v3/ladder-analysis.json']
  },
  exitWindowRegression: {
    status: 'pass',
    origin: 'L4 atmosphere-exit caption',
    observations: 15,
    rows: analysis.exitWindowPooled,
    worstDeltaSeconds: 0.098,
    toleranceSeconds: 0.2,
    measurement: 'All eight frozen rows land within +0.098 s of their named constants across 15 cold movie runs on five route/variant combinations. tickLaunchVoice changing did not disturb the frozen ch8 exit-window table.',
    evidenceRefs: ['evidence/verification-v3/ladder-analysis.json']
  },
  variantDOrdering: {
    status: 'pass',
    objectiveId: 'ch8:launch:orbital-handoff',
    chainedColdRuns: 3,
    publishOffsetSeconds: [1.766, 1.767, 1.766],
    stackOneOffsetSeconds: [2.017, 2.017, 2.016],
    marginSeconds: R['routeB.chained-movie'].rows.map(r => r.variantDMarginSeconds),
    marginSpreadSeconds: R['routeB.chained-movie'].variance.variantDMargin.spread,
    publishedBeforeStackOneEveryRun: true,
    measurement: 'On the chained route the handoff objective publishes at +1.766-1.767 s of the exit window and stack row 1 at +2.016-2.017 s: margin 0.250-0.251 s in 3/3 runs. The same ordering holds on all 12 movie runs measured here (margin 0.249-0.251 s). Unchanged from the iteration-1 measurement of 0.249-0.250 s.',
    evidenceRefs: ['evidence/verification-v3/routeB-desktop.json', 'evidence/verification-v3/ladder-analysis.json']
  },
  seededConsumedEntry: {
    status: 'pass',
    cases: [
      {
        case: 'non-surface entry, shipped debug route',
        url: seeded.cases[0].url,
        phaseAtEntry: 'deep_space at entry +0.108 s',
        laddersFired: 'none — zero L1/L2/L3 emissions in the trace',
        firstCaptionAfterEntry: 'the L4 exit-window caption at +3.189 s',
        emptySlotFrames: seededFrames.shots.map(s => ({ file: `evidence/verification-v3/seeded-fly-entry/${s.file}`, targetOffsetSeconds: s.targetOffsetSeconds, measuredOffsetSeconds: s.measuredOffsetSeconds, captionSlotEmpty: s.captionSlotEmpty })),
        replayOrBurst: 'none'
      },
      {
        case: 'mid-flight beat re-entry at a non-surface, non-deep_space phase',
        url: seeded.cases[1].url,
        mutationDisclosure: 'The probe called the exported enterEmergentStoryBeat seam mid-climb. This is a probe-side mutation and is disclosed as such: the shipped snapshot tool cannot reproduce a mid-flight restore because flight phase is not durable state (main/src/game/systems/persistence.ts captures no spaceFlight fields), so a real snapshot restore always resumes on the pad.',
        phaseAtReentry: seeded.cases[1].phaseAtReentry,
        laddersFired: 'none — the only caption after re-entry is L4 at +1.702 s',
        replayOrBurst: 'none',
        frame: 'evidence/verification-v3/seeded-midflight-reentry/reentry+0.5s_ch8-launch_descent.png'
      }
    ],
    measurement: 'Both non-surface entries seed all three ladder latches consumed. No line replays, no catch-up burst, and the caption slot is empty at entry +0.5 s and +1.5 s on the fresh non-surface load.',
    evidenceRefs: ['evidence/verification-v3/seeded-entries.json', 'evidence/verification-v3/seeded-entry-frames.json']
  },
  variantParity: {
    status: 'pass',
    reference: 'routeC.deeplink-movie (desktop 1280x720 LOW)',
    variants: analysis.variantParity,
    measurement: 'POTATO, 390x844 mobile portrait and prefers-reduced-motion all reproduce the same string set and order, the same edge-caused L2, the same L3 drop and the same exit-window table; the L2-minus-L1 interval differs from the desktop reference by at most 0.012 s.',
    evidenceRefs: ['evidence/verification-v3/ladder-analysis.json']
  },
  frameDefectScan: {
    status: 'pass',
    tool: 'frame-defect-scan.mjs',
    framesScanned: scan.directories.reduce((n, d) => n + d.frameCount, 0),
    directoriesScanned: scan.directories.length,
    blankFrames: 0,
    luminanceJumpsOverThreshold: 1,
    note: 'The single flagged luminance jump is in evidence/verification-v3/seeded-fly-entry, which is not a temporal strip: it holds four independently triggered entry frames, so consecutive-frame comparison is not meaningful there. Every temporal strip is clean.',
    evidenceRefs: ['evidence/verification-v3/frame-defect-scan.json']
  },
  treeFindabilityRecord: {
    status: 'recorded',
    contractRef: 'evidence.acceptanceCriteria[24] and cap.ch8.paced-ladder',
    purpose: 'Standing record for the routed cin.launch.02-world-below camera packet: physical departure through L3 firing and full reveal.',
    strips: [
      'evidence/verification-v3/routeA-space-run1',
      'evidence/verification-v3/routeA-space-run2',
      'evidence/verification-v3/routeA-space-run3',
      'evidence/verification-v3/routeA-space-late-ignite-run1',
      'evidence/verification-v3/routeA-space-late-ignite-run2',
      'evidence/verification-v3/routeA-space-late-ignite-run3'
    ],
    cadence: 'about 220 ms between strip frames, denser inside the scheduled anchor bursts',
    frameCount: fs.readdirSync(V3).filter(n => n.startsWith('routeA-space-run') || n.startsWith('routeA-space-late-ignite-run')).reduce((n, d) => n + fs.readdirSync(path.join(V3, d)).filter(f => f.endsWith('.png')).length, 0),
    objectiveObservation: 'At L3 firing and at L3 +2.0 s (reveal complete) the cockpit view frames sky only: no ground, site or tree geometry is inside the frame in any of the six Route A runs. This is a measurement, not a ruling; whether the site and hero tree must be findable there is the Cinematography Director\'s call.',
    evidenceRefs: ['evidence/verification-v3/routeA-space.json', 'evidence/verification-v3/routeA-space-late-ignite.json']
  },
  defects: [
    {
      proposedId: 'vd-04',
      severity: 'high',
      category: 'contract-acceptance',
      beat: 'ch8-launch',
      anchor: 'anchor.ch8.site-recedes',
      contractRefs: ['evidence.acceptanceCriteria[21]', 'evt.ch8.l3-liftoff'],
      status: 'open-flagged-to-triad',
      summary: 'Acceptance criterion [21], the measured-margin guarantee, fails on the paced route. On the only scripted paced route observed to reach deep_space (ignite at entry +6.0 s, then hold the climb as the shipped climb objective instructs), t_L3 + 1.98 s lands after t_deepSpace by 1.211 s on average (-1.239 / -1.222 / -1.173 across three cold runs), so L3 shows about 22 of its 58 characters before the frozen exit-window table overwrites the slot. On the literal contract script (hold [SPACE] only) the ship never reaches deep_space within 22 s, so the guarantee is unmeasurable rather than met there. The full-reveal-before-exit experience was observed only on routes that never leave the atmosphere.',
      measurement: 'Phase edge to first deep_space observation is 3.80-3.86 s of air time with the shipped climb input; L3 is scheduled at t_phaseEdge + 3.0 s and needs 1.972 s of reveal, i.e. 4.97 s of air time.',
      likelyCause: 'CH8_L2_MIN_SLOT_SECONDS = 3.0 plus the L3 reveal exceeds the shipped climb duration from the phase edge on every route where the player actually ascends. The ladder arithmetic is implemented exactly as contracted; it is the contracted spacing against the measured flight physics that does not fit.',
      owner: 'chapter (with cinematography and score as peers on any retiming)',
      verificationRoute: 'Re-run routeA --shape space-then-w --runs 3 with ladder-verify-probe.mjs and assert the C3 margin at or above +0.3 s.',
      evidenceRefs: ['evidence/verification-v3/routeA-space-then-w.json', 'evidence/verification-v3/routeA-space.json', 'evidence/verification-v3/ladder-analysis.json']
    }
  ],
  capturedGaps: [
    'Route A is defined in the contract only as "hold [SPACE] at entry +6.0 s"; it does not say what the pilot holds afterwards, and the measured exit time depends entirely on that. Three input shapes were measured and all three are reported rather than one being chosen as canonical: hold [SPACE] only (never exits), [SPACE] then [W] as the shipped climb objective instructs (exits at 11.28-11.40 s), and the ignition-plus-boost shape the movie autopilot uses (exits at about 9.7 s, L3 dropped, observed in the pre-flight survey and not carried as a cold-run route).',
    'The genuine "mid-flight snapshot restore" of acceptance criterion [19] cannot be produced by the shipped snapshot tool: flight phase is not durable state, so a restore always resumes on the pad. The seeding branch is proven instead by a fresh non-surface load and by a disclosed probe-side call to the exported beat-entry seam.',
    'Anchor frames are the nearest frame to each contracted offset; residuals are recorded per frame. All Route A and Route B anchors landed within 0.11 s of target; two Route C deep_space -0.5 s frames landed at -0.215 s and -0.110 s because that anchor cannot be predicted before the fact and was covered by burst capture.',
    'The empty-slot frame for the non-surface entry was captured by a second pass (seeded-entry-frames.json) because the first pass could not open its shutter until the page-side instrumentation had finished importing; the first-pass frame sits at entry +2.113 s and is retained.',
    'Frame rate was not re-measured this iteration. The iteration-1 medians stand; nothing in this patch changes render work.'
  ],
  probes: [
    { path: 'ladder-verify-probe.mjs', role: 'paced-ladder route driver and capture session (modes routeA, routeB, routeC, seeded, seeded-frame)' },
    { path: 'ladder-analysis.mjs', role: 'aggregates every route trace into evidence/verification-v3/ladder-analysis.json' },
    { path: 'frame-defect-scan.mjs', role: 'blank-frame and luminance-pop scan over every captured strip' },
    { path: 'repair-verification-report-build.mjs', role: 'writes this section, the check-results block and the ledger row from the measured bytes' }
  ],
  evidenceRefs: [
    'evidence/verification-v3/',
    'evidence/verification-v3/ladder-analysis.json',
    'evidence/verification-v3/routeA-space.json',
    'evidence/verification-v3/routeA-space-then-w.json',
    'evidence/verification-v3/routeA-space-late-ignite.json',
    'evidence/verification-v3/routeB-desktop.json',
    'evidence/verification-v3/routeC-desktop.json',
    'evidence/verification-v3/routeC-potato.json',
    'evidence/verification-v3/routeC-mobile-portrait.json',
    'evidence/verification-v3/routeC-reduced-motion.json',
    'evidence/verification-v3/seeded-entries.json',
    'evidence/verification-v3/seeded-entry-frames.json',
    'evidence/verification-v3/frame-defect-scan.json'
  ]
};

// --- verification-report.json ------------------------------------------------
const reportPath = path.join(RUN_DIR, 'verification-report.json');
const report = read(reportPath);
report.repairIteration = repairIteration;
report.iterationNote = 'Every field outside repairIteration is the iteration-1 (draft-v2) record, retained verbatim. repairIteration holds the iteration-3 targeted delta re-proof of the draft-v3 vd-01 repair.';
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

// --- check-results.json ------------------------------------------------------
const checkPath = path.join(RUN_DIR, 'check-results.json');
const checks = read(checkPath);
checks.repairVerification = {
  iteration: 3,
  route: 'repair-verification',
  status: 'fail',
  recordedBy: 'story-verifier',
  recordedAt: RECORDED_AT,
  contractVersion: 'draft-v3',
  contractSha256: CONTRACT_SHA,
  summary: repairIteration.summary,
  failingContractTerms: ['evidence.acceptanceCriteria[21] measured-margin guarantee (proposed defect vd-04)'],
  passingContractTerms: [
    'evidence.acceptanceCriteria[16] paced-ladder named constants and formulas',
    'evidence.acceptanceCriteria[17] phase-edge accelerator is caption-only',
    'evidence.acceptanceCriteria[18] drop rule with nothing deferred into the exit window',
    'evidence.acceptanceCriteria[19] seeded-consumed non-surface entry',
    'evidence.acceptanceCriteria[20] single authored player-caused mid-reveal interruption',
    'evidence.acceptanceCriteria[22] POTATO asserts the drop, not the render',
    'evidence.acceptanceCriteria[2] frozen ch8 exit-window table, re-proved after the tickLaunchVoice change',
    'evidence.acceptanceCriteria[8] ch8:launch:orbital-handoff publishes before stack row 1'
  ],
  commands: [
    { command: 'node ladder-verify-probe.mjs routeA --shape space --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeA-space.json', summary: 'Three cold paced-ladder runs on the literal contract script; full ladder, no deep_space reached.' },
    { command: 'node ladder-verify-probe.mjs routeA --shape space-then-w --runs 3', status: 'fail', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeA-space-then-w.json', summary: 'Three cold runs of the exiting paced route; C3 margin -1.239 / -1.222 / -1.173 s.' },
    { command: 'node ladder-verify-probe.mjs routeA --shape space --ignite 10 --tag space-late-ignite --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeA-space-late-ignite.json', summary: 'Timer-branch control: L2 at exactly t_L1 + 4.5 s in 3/3 runs.' },
    { command: 'node ladder-verify-probe.mjs routeB --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeB-desktop.json', summary: 'Chained movie: edge-caused L2 interrupting L1 mid-reveal, L3 dropped, exit window clean.' },
    { command: 'node ladder-verify-probe.mjs routeC --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeC-desktop.json', summary: 'Deep-link movie: L3 dropped in 3/3, deep_space -0.5/+0.0/+0.5 frames captured.' },
    { command: 'node ladder-verify-probe.mjs routeC --profile POTATO --label potato --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeC-potato.json', summary: 'POTATO tier: drop asserted, not the render.' },
    { command: 'node ladder-verify-probe.mjs routeC --variant mobile --label mobile-portrait --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeC-mobile-portrait.json', summary: '390x844 parity.' },
    { command: 'node ladder-verify-probe.mjs routeC --variant reduced-motion --label reduced-motion --runs 3', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/routeC-reduced-motion.json', summary: 'Reduced-motion parity.' },
    { command: 'node ladder-verify-probe.mjs seeded', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/seeded-entries.json', summary: 'Both non-surface entries seed all three latches consumed.' },
    { command: 'node ladder-verify-probe.mjs seeded-frame', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/seeded-entry-frames.json', summary: 'Empty caption slot imaged at entry +0.5 s and +1.5 s.' },
    { command: 'node ladder-analysis.mjs', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/ladder-analysis.json', summary: 'Aggregated assertion sheet across all 24 cold runs.' },
    { command: 'node frame-defect-scan.mjs evidence/verification-v3/*/', status: 'pass', exitCode: 0, evidenceRef: 'evidence/verification-v3/frame-defect-scan.json', summary: '1585 frames, zero blank, zero temporal luminance pops.' }
  ],
  note: 'These are verification commands, recorded here for traceability. The gate-scored implementation command list above is unchanged and remains the integration engineer\'s record.',
  evidenceRefs: repairIteration.evidenceRefs
};
checks.iterationHistory.push({
  iteration: 3,
  route: 'repair-verification',
  contractVersion: 'draft-v3',
  contractSha256: CONTRACT_SHA,
  recordedAt: RECORDED_AT,
  note: 'Stage 6 targeted delta re-proof of the vd-01 repair. See check-results.repairVerification and verification-report.repairIteration. One contracted term fails: the acceptance criterion [21] measured-margin guarantee, raised as proposed defect vd-04.'
});
fs.writeFileSync(checkPath, `${JSON.stringify(checks, null, 2)}\n`);

// --- iteration-ledger.jsonl --------------------------------------------------
const defectsPath = path.join(RUN_DIR, 'defects.json');
const ledgerRow = {
  schema: 'paravoxia.creativeIteration.v1',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  iteration: 3,
  contractVersion: 'draft-v3',
  contractRef: 'scene-contract.json',
  contractSha256: CONTRACT_SHA,
  defectRegisterRef: 'defects.json',
  defectRegisterSha256: sha(defectsPath),
  route: 'repair-verification',
  budget: 'deep; verification on opus; three cold runs per route, three attempts per probe, honest gaps recorded instead of retried indefinitely',
  changes: [
    'No game source touched. Verification-only stage.',
    'ladder-verify-probe.mjs — created: paced-ladder route driver. Adds a per-rAF spaceFlight sampler to the iteration-1 live-store instrumentation so t_phaseEdge and t_deepSpace are stamped on the same pause-aware story clock as every caption, drives scripted manual ignition through the real [SPACE] keydown path, and runs an anchor-scheduled capture session that records each frame\'s own measured offset and DOM reveal length. Modes: routeA (with --shape and --ignite), routeB, routeC (with --profile/--variant), seeded, seeded-frame.',
    'ladder-analysis.mjs — created: aggregates every route trace into formula conformance, C3 margin, drop behaviour, cross-run variance, pooled exit-window rows, variant-D ordering and variant parity.',
    'frame-defect-scan.mjs — created: blank-frame and luminance-pop scan over every captured strip.',
    'repair-verification-report-build.mjs, evidence-manifest-v3-build.mjs — created: write the iteration-3 records and re-hash the evidence manifests from the bytes on disk.',
    'evidence/verification-v3/ — 24 cold runs across eight route/variant combinations, 1585 PNG frames and 12 traces; verification-report.json gained a repairIteration section, check-results.json a repairVerification block, and both evidence manifests were extended.'
  ],
  weightedScore: null,
  categoryFloor: null,
  gateStatus: 'implementation_recorded_one_known_failure',
  openDefects: { critical: 0, high: 1, mediumUnaccepted: 1, low: 1 },
  evidenceRefs: [
    'verification-report.json',
    'check-results.json',
    'evidence-registry.json',
    'raw-audiovisual-evidence.json',
    'evidence/verification-v3/ladder-analysis.json',
    'evidence/verification-v3/routeA-space-then-w.json',
    'evidence/verification-v3/routeB-desktop.json',
    'evidence/verification-v3/routeC-desktop.json',
    'evidence/verification-v3/seeded-entry-frames.json',
    'evidence/verification-v3/frame-defect-scan.json'
  ],
  canonicalUrl: 'http://localhost:5176',
  nextAction: 'Triad decision on proposed defect vd-04: the paced ladder implements every contracted formula exactly, but acceptance criterion [21] cannot be met against the shipped climb physics — the phase edge to deep_space air time is 3.80-3.86 s while L3 needs t_phaseEdge + 3.0 s plus a 1.972 s reveal. The routed autopilot-pacing packet recorded in acceptance criterion [25] does not address it, because the shortfall is in flight duration after the edge, not in when the movie ignites.',
  recordedAt: RECORDED_AT
};
fs.appendFileSync(path.join(RUN_DIR, 'iteration-ledger.jsonl'), `${JSON.stringify(ledgerRow)}\n`);

console.log('verification-report.json, check-results.json and iteration-ledger.jsonl updated');
