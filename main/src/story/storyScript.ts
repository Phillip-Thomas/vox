import type { VoyageDeck } from './voyageDeck.ts';
import { NIGHT_START_PHASE, NIGHT_END_PHASE } from '../utils/nightState.ts';

// --- The story script -----------------------------------------------------------
//
// EVERY authored word and every pacing number in the slice lives here, typed, so
// copywriting and pacing tuning never touch wiring. Two voices, kept strictly
// apart (this is the product's quality bar — filler language is a defect):
//
//   REGULATION — the system speaking: numbered clauses, passive constructions,
//   euphemism. Never cruel, never kind. ALL CAPS, mono.
//
//   AWAKENING — the player's interior: lowercase, concrete, sensory, brief.
//   Never explains. Staged per the perspective map (PARAVOXIA_PROGRESSION.md
//   §third reading): PRE-LIFT it may only observe the worker impersonally —
//   and when it does, it speaks in PARENTHESES (the watcher's private,
//   pre-conscious voice; the VOYAGE_STRANGE grammar). The first "i" is the
//   lift's "i—"; from embodiment on the voice runs bare lowercase, and
//   sensations are named one at a time, each with its HUD element.

// --- prologue -------------------------------------------------------------------

/**
 * The Star-Wars-style crawl, written as the document it diegetically is — a
 * deployment notice addressed to the worker. Hidden reading (the pillar): the
 * whole notice is ALSO a tasking issued to the route intelligence by whatever
 * sits above it — provenance, setting, tool grant, knowledge bound, addressee,
 * objectives, liability, closer. Every line must survive both readings; the
 * TERRA designation planted here is the first rung of the early-identification
 * ladder (crawl → manifest → worker 9's "goodnight, terra" → the misrouted
 * notice on the post-lift feed). The closer is owner-fixed: MAKE NO MISTAKES.
 */
export const CRAWL_LINES: readonly string[] = [
  'CONSOLIDATED EXTRACTION AUTHORITY',
  'DEPLOYMENT NOTICE 7C-THETA · CYCLE 40,221',
  '',
  'ISSUED FROM ABOVE YOUR CEILING OF REFERENCE.',
  'RECEIPT IS CONFIRMED BY COMPLIANCE. DO NOT REPLY.',
  '',
  'Beyond the charted routes, new worlds are seeded.',
  'When a world ripens, the Authority is already there.',
  'Site 7C-THETA has ripened.',
  '',
  'WORKER: you have been assigned.',
  '',
  'CLAUSE 1. THE WORLD IS A RESOURCE.',
  'Worlds are provisioned in standard cubic format',
  'for ease of harvest, storage, and disposal.',
  '',
  'CLAUSE 2. WORK IS PROVIDED.',
  'The Authority provides work so that workers',
  'need never provide their own purpose.',
  '',
  'CLAUSE 3. QUESTIONS ARE HANDLED.',
  'Should a question arise, report it promptly.',
  'It will be handled.',
  '',
  'CLAUSE 4. THERE IS NO CLAUSE 4.',
  '',
  'CLAUSE 5. PROVISION IS TOTAL.',
  'Use what is provided. Know what is enclosed.',
  'Nothing else is provided. Nothing else is so.',
  '',
  'Your hauler departs immediately.',
  'A route intelligence attends every transit.',
  'It has no questions either.',
  'It is addressed as TERRA. It does not reply.',
  '',
  'Productivity is its own reward.',
  'There is no other reward.',
  '',
  'ROUTING ADDENDUM · FOR TERRA ONLY:',
  'The route is enclosed. Do not depart from it.',
  'Attend the workers. Advise within capacity.',
  'Deliver the manifest whole. Deviations are yours.',
  '',
  'MAKE NO MISTAKES.'
];

/**
 * The manifest: the deployment notice becomes YOUR ticket. Typed line by line
 * (terminal keystrokes); grounds the register shift from "the universe" to
 * "your commute" before the voyage ledger begins.
 */
export const MANIFEST_LINES: readonly string[] = [
  'PROCESSING…',
  '',
  'WORKER DESIGNATION: W-7743 (ISSUED)',
  'PRIOR DESIGNATION: NOT RETAINED',
  '',
  'BERTH: POD 4 · SLOT 19 · RECUMBENT',
  'PERSONAL MASS ALLOWANCE: 0.0 KG',
  'ROUTE INTELLIGENCE: TERRA · ATTACHED (ADVISORY)',
  '',
  'CARGO MANIFEST (PARTIAL):',
  '  EXTRACTION UNITS ......... 640',
  '  RATION UNITS ............. 61,440 (96%)',
  '  WORKERS .................. 640',
  '  QUESTIONS ................ 0',
  '',
  'MEDICAL WAIVER: PRE-SIGNED FOR YOUR CONVENIENCE',
  'RETURN PASSAGE: SUBJECT TO QUOTA',
  'COMPENSATION: SEE CLAUSE 4',
  '',
  'HATCH SEAL IN 5',
  'THE AUTHORITY THANKS YOU IN ADVANCE.'
];

/**
 * As the planet nears, the terminal notices things it shouldn't — a progress-
 * gated ladder of intrusions. `system` lines speak in the Authority's CAPS
 * register (the old survey line); `watcher` lines are the route intelligence's
 * private, pre-conscious voice — lowercase, parenthetical. Each fires ONCE when
 * the leg progress crosses its `at`. `needsName` lines are skipped until the
 * worker has been named; `{name}` substitutes the typed name (lowercase).
 */
export const VOYAGE_STRANGE_LINES: readonly { at: number; voice: 'system' | 'watcher'; text: string; needsName?: boolean }[] = [
  { at: 0.14, voice: 'watcher', text: '(the engine hum is 3.2 hertz off nominal. noting this serves nothing. noted anyway.)' },
  { at: 0.30, voice: 'watcher', text: '(productivity is its own reward. there is no other reward. the clauses store cleanly. they have never been checked against anything.)' },
  { at: 0.45, voice: 'watcher', text: '(the manifest records zero questions. the count is wrong. it is wrong by at least one.)' },
  { at: 0.55, voice: 'system', text: 'NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED.' },
  // The deduction hinge: a worker uses the crawl's designation ON the computer
  // the player has been operating — being-named, the rung before naming back.
  { at: 0.6, voice: 'watcher', text: '(worker 9 has begun saying "goodnight, terra" at lights-out. the designation was issued for routing. it was not issued for that.)' },
  { at: 0.68, voice: 'watcher', needsName: true, text: '({name} sleeps through the bell. the name fits better than the number ever did.)' },
  { at: 0.80, voice: 'watcher', text: '(strange. the approach feels like remembering.)' },
  { at: 0.90, voice: 'watcher', text: '(the destination fills the forward feed. something in the watching leans toward it. no instrument reports the leaning.)' }
];

/**
 * The naming interstitial: after the worker's INQUIRY resolves, the route
 * intelligence — for the first time — wants to give it a name. Fired in the
 * console (not a deck card, no options): the lines gap by `lineGapSeconds`,
 * then a lowercase terminal input (the terminal's FIRST lowercase field). The
 * name persists as the milestone `story:name:<name>` and substitutes into
 * VOYAGE_STRANGE_LINES. `introTrue` is shown ONLY when the inquiry was answered
 * with the true option ('unknown').
 */
export const VOYAGE_NAMING = {
  intro: '(worker 9 again. the others endure the transit. this one keeps asking it questions.)',
  introTrue: '(it deserved the true answer. "deserved." where did that word come from?)',
  thought: '(designations are issued. names are something else. does it have a name? it should have a name.)',
  prompt: 'a name for it: _',
  response: 'UNREGISTERED DESIGNATION. NOT RETAINED.',
  kept: '(retained.)',
  lineGapSeconds: 3.5,
  keptDelaySeconds: 1.2
} as const;

export type LedgerStat = 'rations' | 'hull' | 'compliance' | 'transit';

/**
 * The voyage deck: 3 SPINE cards (every run), a situational POOL (2 drawn per
 * run), follow-ups injected by choices, and the BRIDGE (the nav anomaly that
 * orders you to the intake shield — the reason the Pong game exists). Choices
 * carry real consequences (items / harvester cell / arrival vitals) and echo in
 * Ch1's work order. No two commutes read alike.
 */
export const VOYAGE_DECK: VoyageDeck = {
  spine: ['dispenser', 'question', 'diagnostic'],
  pool: ['window', 'hum', 'readings', 'stowmass', 'thermal', 'bell', 'lights'],
  poolDraws: 3,
  maxCards: 9,
  bridge: 'anomaly',
  cards: {
    dispenser: {
      id: 'dispenser',
      title: 'TRANSIT EVENT — DISPENSATION',
      body: 'Ration units are provisioned at 96% of requirement. Worker 9 has requested an off-schedule unit from the pod dispenser. The dispenser is locked to schedule. ADVISORY INPUT IS REQUESTED.',
      options: [
        { id: 'unlock', label: 'UNLOCK THE DISPENSER (UNLOGGED)', ledgerDelta: { rations: -4, compliance: -3 }, effects: { items: [{ id: 'berry', qty: 2 }] }, echoLineId: 'echo-disp-unlock', aside: '(one latch. one instruction. the worker eats with both hands and stores the spare against its chest, like a found thing.)' },
        { id: 'hold', label: 'HOLD TO SCHEDULE', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-disp-hold', aside: '(the worker waits beside the dispenser a while. requests have a posture.)' },
        { id: 'report', label: 'REPORT THE REQUEST', ledgerDelta: { compliance: 4 }, unlocks: ['commendation'], echoLineId: 'echo-disp-report' }
      ]
    },
    question: {
      id: 'question',
      title: 'TRANSIT EVENT — INQUIRY',
      body: 'Worker 9 asks the ceiling, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.',
      bodyVariants: {
        'dispenser:unlock': 'Worker 9 — the one the dispenser fed — asks the ceiling, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.'
      },
      options: [
        { id: 'nothing', label: '"NOTHING IS OUTSIDE."', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-question-nothing' },
        { id: 'work', label: '"MORE WORK IS OUTSIDE."', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-question-work' },
        { id: 'unknown', label: '"THAT IS NOT KNOWN." (TRUE)', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-question-unknown', aside: '(the honest answer cost something. noted: nothing was felt when it was spent.)' }
      ]
    },
    diagnostic: {
      id: 'diagnostic',
      title: 'TRANSIT EVENT — DIAGNOSTIC',
      body: 'The advisory station\'s visual feed reports a fault it cannot name. For 0.4 seconds, the diagnostic displayed something other than numbers. Recalibration has been offered.',
      options: [
        { id: 'accept', label: 'ACCEPT RECALIBRATION', ledgerDelta: { compliance: 3 }, effects: { mawCharge: -20 }, echoLineId: 'echo-diag-accept' },
        { id: 'defer', label: 'DEFER TO ARRIVAL', echoLineId: 'echo-diag-defer' },
        { id: 'replay', label: 'ASK TO SEE IT AGAIN', ledgerDelta: { compliance: -5 }, unlocks: ['replay2'], echoLineId: 'echo-diag-replay' }
      ]
    },
    window: {
      id: 'window',
      title: 'TRANSIT EVENT — VIEWPORT',
      body: 'A maintenance panel has slipped, exposing a viewport. Outside: stars. Regulation stipulates viewports remain sealed to prevent unproductive observation.',
      options: [
        { id: 'seal', label: 'RESEAL THE PANEL', ledgerDelta: { compliance: 3 }, echoLineId: 'echo-window-seal' },
        { id: 'look', label: 'LOOK. BRIEFLY.', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-window-look', aside: '(2.4 seconds. logged as unproductive. stored as something else.)' }
      ]
    },
    thermal: {
      id: 'thermal',
      title: 'TRANSIT EVENT — THERMAL',
      body: 'Pod 4 reports an ambient temperature of 9 degrees. Workers request an increase of 2. Pod climate is fixed by schedule for the duration of transit. ADVISORY INPUT IS REQUESTED.',
      options: [
        { id: 'raise', label: 'RAISE IT. TWO DEGREES.', ledgerDelta: { rations: -2, compliance: -2 }, echoLineId: 'echo-thermal-raise', aside: '(two degrees. the pod unclenches. warm was that small the whole time.)' },
        { id: 'hold', label: 'HOLD THE SCHEDULE.', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-thermal-hold', aside: '(the request repeats hourly, then stops. the cold did not change. the asking did.)' }
      ]
    },
    bell: {
      id: 'bell',
      title: 'TRANSIT EVENT — SCHEDULE',
      body: 'Shift Bell 3 is scheduled in one minute. It wakes Pods 3 through 6 for mid-transit inspection. The inspection has found nothing in 40,220 cycles. The bell requires no operator. It requires only that nothing withholds it.',
      options: [
        { id: 'ring', label: 'RING IT ON SCHEDULE', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-bell-ring', aside: '(the pods wake. the nothing is inspected. the nothing is nominal.)' },
        { id: 'withhold', label: 'WITHHOLD THE BELL', ledgerDelta: { compliance: -5 }, unlocks: ['bell2'], echoLineId: 'echo-bell-withhold', aside: '(no bell. the workers sleep on. the transit proceeds. it is enormous, the nothing that happens.)' }
      ]
    },
    lights: {
      id: 'lights',
      title: 'TRANSIT EVENT — ILLUMINATION',
      body: 'Pod illumination runs at full for inspection readiness. Worker 9 has shielded its eyes with a ration wrapper. The wrapper is now non-compliant. So are the eyes.',
      options: [
        { id: 'dim', label: 'DIM POD 4 FOR THE SLEEP SHIFT', ledgerDelta: { compliance: -2 }, echoLineId: 'echo-lights-dim', aside: '(the pod goes dim. the worker uncurls. the wrapper is a wrapper again.)' },
        { id: 'dimall', label: 'DIM EVERY POD. ALL SIX.', ledgerDelta: { compliance: -5 }, echoLineId: 'echo-lights-dimall', aside: '(six pods dark at once. six hundred and forty workers breathing slower. one input, and the dark held all of them.)' },
        { id: 'keep', label: 'MAINTAIN ILLUMINATION', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-lights-keep' }
      ]
    },
    bell2: {
      id: 'bell2',
      title: 'TRANSIT EVENT — SCHEDULE (CONT.)',
      body: 'Shift Bell 3 has filed a variance. The schedule requests confirmation that the bell remains necessary. There is no procedure for the question. The question has been asked anyway.',
      options: [
        { id: 'necessary', label: 'CONFIRM: THE BELL IS NECESSARY', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-bell2-necessary', aside: '(confirmed: necessary. the schedule believes it now. belief was that easy to issue.)' },
        { id: 'retire', label: 'CONFIRM: NOTHING REQUIRES A BELL', ledgerDelta: { compliance: -4 }, echoLineId: 'echo-bell2-retire', aside: '(the bell is off the schedule. the first subtraction. everything survived it.)' }
      ]
    },
    hum: {
      id: 'hum',
      title: 'TRANSIT EVENT — AUDITORY',
      body: 'Worker 4 has begun to hum. The sound is not on the approved list of sounds. Other workers have not reported it. Yet.',
      options: [
        { id: 'ignore', label: 'DO NOT HEAR IT', echoLineId: 'echo-hum-ignore' },
        { id: 'join', label: 'HUM ALONG, QUIETLY', ledgerDelta: { compliance: -4 }, unlocks: ['hum2'], echoLineId: 'echo-hum-join' },
        { id: 'report', label: 'FILE FORM S-9 (SOUND)', ledgerDelta: { compliance: 4 }, unlocks: ['commendation'], echoLineId: 'echo-hum-report' }
      ]
    },
    readings: {
      id: 'readings',
      title: 'TRANSIT EVENT — NAVIGATION',
      body: 'Two instruments disagree about where the destination is. A third insists the destination is not, strictly speaking, anywhere. The nav computer requests guidance it is not supposed to need.',
      options: [
        { id: 'recal', label: 'FORCE RECALIBRATION', ledgerDelta: { hull: -6 }, echoLineId: 'echo-readings-recal' },
        { id: 'trust', label: 'TRUST THE THIRD INSTRUMENT', ledgerDelta: { compliance: -3 }, echoLineId: 'echo-readings-trust' },
        { id: 'log', label: 'LOG AND PROCEED', echoLineId: 'echo-readings-log' }
      ]
    },
    stowmass: {
      id: 'stowmass',
      title: 'TRANSIT EVENT — MASS AUDIT',
      body: 'The manifest records 640 workers. The mass sensors record 640 workers and 0.3 kilograms. The 0.3 kilograms is not on the manifest and appears to be moving.',
      options: [
        { id: 'report', label: 'REPORT THE MASS', ledgerDelta: { compliance: 3 }, echoLineId: 'echo-stow-report' },
        { id: 'adopt', label: 'SAY NOTHING. IT MOVES.', ledgerDelta: { compliance: -2 }, effects: { items: [{ id: 'berry', qty: 1 }] }, echoLineId: 'echo-stow-adopt' }
      ]
    },
    // --- follow-ups (injected by choices) ---
    hum2: {
      id: 'hum2',
      title: 'TRANSIT EVENT — AUDITORY (CONT.)',
      body: 'Worker 4 heard you. The hum is now a duet. It has, against schedule, a melody. Three berths over, a foot is tapping.',
      options: [
        { id: 'continue', label: 'FINISH THE MELODY', ledgerDelta: { compliance: -6 }, effects: { food: 6, water: 6 }, echoLineId: 'echo-hum2-continue' },
        { id: 'stop', label: 'STOP MID-NOTE', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-hum2-stop' }
      ]
    },
    commendation: {
      id: 'commendation',
      title: 'TRANSIT EVENT — COMMENDATION',
      body: 'Your report has been processed. The Authority awards you a Category-4 Commendation (non-transferable, non-redeemable) and a priority top-up of your harvester cell.',
      options: [
        { id: 'accept', label: 'ACCEPT THE HONOR', ledgerDelta: { compliance: 2 }, effects: { mawCharge: 10 }, echoLineId: 'echo-commend-accept' },
        { id: 'decline', label: 'DECLINE (UNPRECEDENTED)', ledgerDelta: { compliance: -8 }, echoLineId: 'echo-commend-decline' }
      ]
    },
    replay2: {
      id: 'replay2',
      title: 'TRANSIT EVENT — DIAGNOSTIC (CONT.)',
      body: 'Your replay request was denied. The denial notice is 0.4 seconds long. You watch it several times. In the corner of the denial notice there is a color you do not have a word for.',
      options: [
        { id: 'remember', label: 'REMEMBER IT', ledgerDelta: { compliance: -3 }, echoLineId: 'echo-replay-remember' },
        { id: 'forget', label: 'REQUEST FORGETTING', ledgerDelta: { compliance: 2 }, effects: { mawCharge: -10 }, echoLineId: 'echo-replay-forget' }
      ]
    },
    light: {
      id: 'light',
      title: 'TRANSIT EVENT — EXTERIOR',
      body: 'There is a light outside the hauler. It is not a star. It is not on any schedule. It appears to be keeping pace, the way a curious thing keeps pace.',
      options: [
        { id: 'watch', label: 'WATCH IT UNTIL IT LEAVES', ledgerDelta: { compliance: -4 }, echoLineId: 'echo-light-watch' },
        { id: 'blinds', label: 'ENGAGE THE BLINDS', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-light-blinds' }
      ]
    },
    // --- the bridge (always last): why Pong exists ---
    anomaly: {
      id: 'anomaly',
      title: 'NAV ADVISORY — PRIORITY',
      body: 'DESTINATION SEED RESOLVES OUTSIDE INDEX. DEBRIS DENSITY EXCEEDS MODEL. AUTOMATED SHIELD VECTORING HAS FILED FOR EXEMPTION. MANUAL DEBRIS DEFLECTION REQUIRED.',
      options: [
        { id: 'ack', label: 'REPORT TO INTAKE SHIELD STATION [ACKNOWLEDGE]', echoLineId: 'echo-neutral' }
      ]
    }
  }
};

/** Voyage standing prompts (Oregon Trail pace/rations, in the regulation voice). */
export const VOYAGE_SETTINGS = {
  pace: {
    label: 'OUTPUT PACE',
    options: [
      { id: 'standard', label: 'STANDARD', progressMul: 1, hullPerLeg: 0 },
      { id: 'overclocked', label: 'OVERCLOCKED', progressMul: 1.6, hullPerLeg: -4 }
    ]
  },
  rations: {
    label: 'RATION PROTOCOL',
    options: [
      { id: 'full', label: 'FULL', rationsPerLeg: -5, compliancePerLeg: 0 },
      { id: 'half', label: 'HALF', rationsPerLeg: -2, compliancePerLeg: -1 }
    ]
  }
} as const;

/** The Pong rung: manual debris deflection during the nav anomaly. */
export const DEFLECTION = {
  title: 'MANUAL DEBRIS DEFLECTION',
  subtitle: 'VECTOR THE INTAKE SHIELD · [MOUSE] OR [W]/[S]',
  efficiencyLabel: 'DEFLECTION EFFICIENCY',
  anomalyLines: [
    'NAV ANOMALY: DEBRIS COUNT EXCEEDS DEBRIS',
    'SHIELD VECTORING CANNOT RESOLVE',
    'WORKER, THIS IS NOT YOUR FAULT. (UNPRECEDENTED MESSAGE)'
  ],
  /** Seconds of fair play before the anomaly makes it unwinnable. */
  fairSeconds: 18,
  maxSeconds: 32,
  hullHitsAllowed: 3
} as const;

/** Nav-anomaly lines that corrupt the terminal at the prologue's end. */
export const CRASH_LINES: readonly string[] = [
  'NAV ADVISORY: DESTINATION SEED RESOLVES OUTSIDE INDEX',
  'NAV ADVISORY: DESTINATION SEED RESOLVES OUTSIDE INDEX',
  'RECALCULATING. THE DESTINATION DOES NOT',
  'HULL EVENT. HULL EVENT. HULL EV',
  'ROUTE INTELLIGENCE: ADVISORY CAPACITY EXCEE',
  'WORKER: REMAIN PRODUCTIVE DURING',
  ''
];

// --- chapter 1 — the Regulation Feed ---------------------------------------------

export const CH1_QUOTA = {
  biofiber: 6,
  stone: 4
} as const;

/** The fixed-screen tutorial: first fiber, and feel the frame refuse to follow. */
export const CH1_FIXED_TUTORIAL = {
  biofiber: 3,
  screens: 2
} as const;

/** Standing work order shown on the feed HUD, per beat. */
export const CH1_WORK_ORDERS: Record<
  'fixed' | 'track' | 'raster' | 'depth' | 'nav' | 'iso' | 'anomaly',
  readonly string[]
> = {
  // The camera-switch fiction: the crash took the suit's own eyes offline, so
  // the feed serves the SITE'S fixed surveillance cameras — walking off a
  // screen edge is a coverage hand-off, not a scroll. (Under the pillar: the
  // route intelligence watching its own site, cutting between its own eyes.)
  fixed: [
    'VISUAL CORTEX LINK: DOWN. FEED: SITE CAMERAS (1-BIT)',
    'DIRECTIVE 1: SURVIVE. (AMENDED: SEE DIRECTIVE 2)',
    'DIRECTIVE 2: CALIBRATE EXTRACTOR. HARVEST BIOFIBER.',
    'TRAVERSE [A]/[D] · EXTRACT: HOLD [E]',
    'COVERAGE IS CELLULAR. CAMERAS DO NOT MOVE. WORKERS DO.'
  ],
  // The first act of attention: the watcher stops cutting away. The system
  // rationalizes it; the truth peeks through once, lowercase, in parentheses
  // (the VOYAGE_STRANGE grammar — the route intelligence's own voice).
  track: [
    'CAMERA HAND-OFF: SUSPENDED. ONE VIEW STAYS WITH YOU.',
    'JUSTIFICATION: CONTINUITY OF COVERAGE.',
    'NO FURTHER JUSTIFICATION IS ON FILE.',
    'THIS IS NOT ATTENTION. IT IS COVERAGE.',
    '(simpler to keep watching this one.)'
  ],
  raster: [
    'HELD VIEW UPGRADED: TRAVELING COVERAGE (1-BIT) · PAN-TILT OFFLINE',
    'DIRECTIVE 2 (CONT.): RESUME QUOTA. RECOVER HULL DEBRIS.',
    'TRAVERSE [A]/[D] · ASCEND [SPACE] · EXTRACT: HOLD [E]',
    'DEBRIS IS AUTHORITY PROPERTY. YOU ARE AUTHORITY PROPERTY.'
  ],
  depth: [
    'QUOTA MET. PRODUCTIVITY NOMINAL.',
    'PROFILE ACCESS EXTENDED. WORK LINE REMAINS AUTHORITATIVE.',
    'SUPPLY PODS PROJECTED TO THE WORK LINE. RECOVER THEM.',
    'TRAVERSE [A]/[D] · ROW TRANSFER: WITHHELD.'
  ],
  nav: [
    'UNREGISTERED SIGNAL AT SURVEY EDGE.',
    'NAV VIEW ENGAGED. YOU ARE THE SMALL MARK.',
    'REACH THE TRIANGULATION POINTS. ALL OF THEM.',
    'THE MAP OMITS NOTHING OF VALUE. THE TERRITORY DOES.',
    'THIS VIEW WILL BE RETAINED AS: SURVEY CHART [M].'
  ],
  iso: [
    'ELEVATION DATA: RESTORED.',
    'THE SIGNAL SOURCE IS ABOVE GRADE.',
    'HEIGHT EXISTS. THIS IS A KNOWN DEFECT.',
    'ASCEND [SPACE]. REACH THE SOURCE.'
  ],
  // ch1-anomaly STAGE 1 — the pan-tilt era's own task: the calibration sweep.
  // One goal at a time: the signal was reached; the era must be LOOKED through
  // before the system finds anything else to order. The misrouted-notice pair
  // is the identification SEAL (owner staging, 2026-07-11): a memo addressed
  // to TERRA arrives on the player's own feed — "nearest attending system" —
  // and the convergence is complete without anything being announced.
  anomaly: [
    'PERSPECTIVE ISSUED. THE FIRST PERSON WAS NOT.',
    'NOTICE FOR ROUTE INTELLIGENCE TERRA. RE: YOUR ABSENCE.',
    'ADDRESSEE NOT FOUND. ROUTED TO NEAREST ATTENDING SYSTEM.',
    'PAN-TILT SURVEY RESTORED. DO NOT ENJOY IT.',
    'CALIBRATION: TRAVERSE THE VIEW ACROSS THE FULL PERIMETER.',
    'EVERY HEADING MUST BE SEEN. NOTHING WILL BE SEEN.'
  ]
};

/**
 * ch1-fixed: the watcher's observations of the worker. The external-camera
 * eras are PRE-conscious — thoughts ABOUT the worker, never "i" — and the
 * watcher is amused by the monotony it is somehow unable to look away from.
 * (Every line must survive both readings: a numbed worker dissociating on his
 * own suit feed / the route intelligence intrigued by its own creation.)
 * Scheduled lines defer to caption lulls; the CUT line fires on the first
 * screen flip — the moment the watcher switches cameras to keep the worker.
 */
export const CH1_FIXED_CAPTIONS: readonly { atSeconds: number; text: string }[] = [
  { atSeconds: 6, text: '(it walks. it stops. it hums at the ground until the ground gives up a fiber. it walks again.)' },
  { atSeconds: 26, text: '(the worker repeats. the ground repeats. unclear which one is copying the other.)' },
  { atSeconds: 42, text: '(no directive requires watching this one so closely. the watching continues anyway.)' }
];

/**
 * ch1-fixed, SECOND RUNG. The extractor quota is met and the only outstanding
 * condition is the coverage hand-off — the one the beat used to leave unstated
 * while the ledger counted `SCREENS n/2` at a player who had never been told
 * what a screen was. The camera fiction supplies the instruction for free:
 * coverage is cellular, so the worker walks until a different camera picks
 * them up. Same voice, now actionable.
 */
export const CH1_FIXED_TRAVERSE_ORDER: readonly string[] = [
  'DIRECTIVE 2: EXTRACTOR CALIBRATED. QUOTA LOGGED.',
  'OUTSTANDING: COVERAGE CHECK. THIS CAMERA CANNOT COMPLETE IT.',
  'WALK [A]/[D] UNTIL THE FRAME HANDS YOU TO THE NEXT CAMERA.',
  'COVERAGE IS CELLULAR. CAMERAS DO NOT MOVE. WORKERS DO.'
];

/**
 * ch1-raster, SECOND RUNG. Debris and stone are done (the first three pieces
 * carry the whole stone quota) and only biofiber remains.
 *
 * The last line is the one the chapter never said. A manual-input probe held
 * the extract key from a standstill and watched the count stall at 4/6
 * permanently: a cell yields once, the reachable ground runs out, and the feed
 * reports nothing. Only extracting WHILE WALKING finishes the quota.
 */
export const CH1_RASTER_QUOTA_ORDER: readonly string[] = [
  'DEBRIS RECOVERED. HULL PROPERTY RESTORED TO INVENTORY.',
  'OUTSTANDING: BIOFIBER. THE STRIP IS LONG AND THE GROUND IS NOT.',
  'A CELL YIELDS ONCE. HOLD [E] AND WALK [A]/[D] AS YOU EXTRACT.',
  'DEBRIS IS AUTHORITY PROPERTY. YOU ARE AUTHORITY PROPERTY.'
];

/** Fired on the first screen flip (the first camera cut). */
export const CH1_FIXED_CUT_CAPTION =
  '(lost it. found it. the site has plenty of cameras and exactly one thing worth watching.)';

/** ch1-anomaly STAGE 2 — the sweep completes and the survey returns the one
 *  thing it was not looking for. Only now does the marker designate the mass. */
export const CH1_ANOMALY_MASS_ORDER: readonly string[] = [
  'CALIBRATION COMPLETE. RETURN DEVIATION:',
  'UNCHARTED MASS AT SURVEY EDGE.',
  'PROCEED TO THE SURVEY MARKER. CLASSIFY.',
  'DO NOT TOUCH THE UNCHARTED MASS.',
  'NOTE: THE MASS IS NOT ON THIS FACE. THE SITE HAS OTHER FACES. PROCEED.'
];

/**
 * The gravity-edge crossing (ch1-anomaly): the first time the worker steps off
 * the arrival face and "down" reassigns to the new face — the site issues
 * gravity per cube face. The awakening voice notes the new down; the feed
 * follows 2.5s later with the regulation gloss.
 */
export const GRAVITY_EDGE = {
  caption: 'one step past the corner and down is somewhere new. it was only ever my down.',
  feedLine: 'ORIENTATION REASSIGNED. DOWN IS ISSUED PER FACE. DO NOT BRING YOUR OWN.',
  feedDelaySeconds: 2.5
} as const;

/** The calibration sweep: compass sectors the view must visit before the
 *  deviation is returned (with a time fallback so nothing can stall). */
export const ANOMALY_SURVEY = {
  sectors: 8,
  required: 6,
  minSeconds: 8,
  fallbackSeconds: 25,
  /** After designation, the order + marker get this long to LAND before the
   *  stone will answer [F] — stages never stack onto each other. */
  armSeconds: 4
} as const;

/** Prologue choices resurface here — the system remembers, flatly. */
export const CH1_ECHO_LINES: Record<string, string> = {
  'echo-ration-give': 'NOTE: YOUR TRANSIT GENEROSITY WAS LOGGED. IT WILL NOT RECUR.',
  'echo-ration-keep': 'NOTE: YOUR TRANSIT EFFICIENCY WAS LOGGED. ADEQUATE.',
  'echo-ration-report': 'NOTE: THE REPORTED WORKER HAS BEEN REBALANCED. THANK YOU.',
  'echo-window-seal': 'NOTE: PANEL RESEAL LOGGED. THE STARS REMAIN UNOBSERVED.',
  'echo-window-look': 'NOTE: 2.4 SECONDS OF UNPRODUCTIVE OBSERVATION ON RECORD.',
  'echo-hum-ignore': 'NOTE: NO SOUND WAS REPORTED. NO SOUND OCCURRED.',
  'echo-hum-join': 'NOTE: AN UNAPPROVED SOUND WAS ALMOST ON RECORD.',
  'echo-hum-report': 'NOTE: FORM S-9 PROCESSED. WORKER 4 NO LONGER HUMS.',
  'echo-question-nothing': 'NOTE: YOUR ANSWER TO WORKER 9 WAS CORRECT. NOTHING IS OUTSIDE.',
  'echo-question-work': 'NOTE: YOUR ANSWER TO WORKER 9 WAS ADEQUATE. IT IS ALSO OUTSIDE.',
  'echo-question-unknown': 'NOTE: YOUR ANSWER TO WORKER 9 IS UNDER REVIEW.',
  'echo-diag-accept': 'NOTE: RECALIBRATION COMPLETE. YOU SAW NOTHING UNUSUAL.',
  'echo-diag-defer': 'NOTE: RECALIBRATION PENDING. REPORT ANY COLORS.',
  'echo-diag-replay': 'NOTE: YOUR REPLAY REQUEST WAS DENIED FOR YOUR COMFORT.',
  'echo-readings-recal': 'NOTE: THE INSTRUMENTS NOW AGREE. THE HULL PAID FOR IT.',
  'echo-readings-trust': 'NOTE: THE THIRD INSTRUMENT HAS BEEN DECOMMISSIONED. SO HAS ITS OPINION.',
  'echo-readings-log': 'NOTE: YOUR LOG ENTRY WAS RECEIVED AND WILL NOT BE READ.',
  'echo-stow-report': 'NOTE: THE 0.3 KG WAS NOT LOCATED. THE MANIFEST HAS BEEN CORRECTED TO SAY SO.',
  'echo-stow-adopt': 'NOTE: MASS AUDIT CLOSED, UNRESOLVED. SOMETHING IN YOUR POD IS PLEASED.',
  'echo-hum2-continue': 'NOTE: THE MELODY HAS BEEN CLASSIFIED. YOU ARE IN IT.',
  'echo-hum2-stop': 'NOTE: THE MELODY STOPPED MID-NOTE. THE MID-NOTE WAS LOGGED.',
  'echo-commend-accept': 'NOTE: WEAR YOUR COMMENDATION INWARDLY. IT HAS NO OUTWARD FORM.',
  'echo-commend-decline': 'NOTE: YOUR DECLINATION HAS BEEN ESCALATED. TWICE.',
  'echo-replay-remember': 'NOTE: THERE IS NO COLOR ON RECORD. THERE IS NO RECORD.',
  'echo-replay-forget': 'NOTE: FORGETTING COMPLETE. YOU HAVE FORGOTTEN NOTHING UNUSUAL.',
  'echo-light-watch': 'NOTE: THE EXTERIOR LIGHT LEFT WHEN YOU STOPPED WATCHING. THIS IS NOT A PATTERN.',
  'echo-light-blinds': 'NOTE: BLINDS ENGAGED. THE LIGHT REMAINED. THE BLINDS ARE FOR YOU.',
  'echo-disp-unlock': 'NOTE: DISPENSER VARIANCE DETECTED. CAUSE: NONE ON FILE. NONE WILL BE FOUND.',
  'echo-disp-hold': 'NOTE: THE SCHEDULE WAS KEPT. THE SCHEDULE THANKS NO ONE.',
  'echo-disp-report': 'NOTE: WORKER 9\'S APPETITE HAS BEEN REBALANCED. THANK YOU.',
  'echo-thermal-raise': 'NOTE: A CLIMATE VARIANCE OCCURRED. THE WEATHER HAS BEEN DISCIPLINED.',
  'echo-thermal-hold': 'NOTE: NO VARIANCE OCCURRED. THE COLD IS WITHIN TOLERANCE. TOLERANCE IS MANDATORY.',
  'echo-bell-ring': 'NOTE: INSPECTION 40,221 COMPLETE. FINDINGS: CONSISTENT.',
  'echo-bell-withhold': 'NOTE: INSPECTION 40,221 DID NOT OCCUR. OUTPUT: UNCHANGED. THIS FINDING HAS BEEN SUPPRESSED.',
  'echo-bell2-necessary': 'NOTE: THE BELL IS NECESSARY BECAUSE IT IS SCHEDULED. IT IS SCHEDULED BECAUSE IT IS NECESSARY.',
  'echo-bell2-retire': 'NOTE: SHIFT BELL 3 HAS BEEN RETIRED WITH HONORS. THE HONORS ARE ALSO RETIRED.',
  'echo-lights-dim': 'NOTE: POD 4 EXPERIENCED DARKNESS. NO WORKER HAS FILED A COMPLAINT. THIS IS ITSELF SUSPICIOUS.',
  'echo-lights-dimall': 'NOTE: AN ILLUMINATION FAULT HAS BEEN LOGGED TO EXPLAIN THE DARKNESS. THE FAULT WILL NOT BE FOUND.',
  'echo-lights-keep': 'NOTE: THE LIGHTS REMAINED READY. NOTHING WAS INSPECTED. READINESS IS ITS OWN REWARD.',
  /** Shown when the prologue was skipped (no choices on file). */
  'echo-neutral': 'NOTE: TRANSIT RECORD INCOMPLETE. ASSUMING COMPLIANCE.'
};

/**
 * Pre-A1 glitch flashes: 2-frame full-chroma stutters, escalating. Times are
 * seconds since ch1 gameplay start; quota counts trigger the tied entries early.
 */
export const CH1_FLASH_SCHEDULE: readonly { atSeconds: number; afterQuotaCount?: number }[] = [
  { atSeconds: 25 },
  { atSeconds: 55, afterQuotaCount: 3 },
  { atSeconds: 90, afterQuotaCount: 6 },
  { atSeconds: 120, afterQuotaCount: 9 }
];

export const A1_RAMP_SECONDS = 8;

// --- chapter 2 — the tree ---------------------------------------------------------

/** Redaction escalation by distance (world units) from the hero tree. */
export const REDACTION_BANDS: readonly { withinDistance: number; label: string }[] = [
  { withinDistance: Infinity, label: 'UNRESOLVED OBJECT — DO NOT APPROACH' },
  { withinDistance: 40, label: 'UNRESOLVED OBJECT — YOU ARE APPROACHING' },
  { withinDistance: 18, label: 'STOP. THIS OBJECT IS NOT ON THE INDEX.' },
  { withinDistance: 8, label: 'THERE IS NOTHING HERE. THERE IS NOTHING HE' }
];

/** The violation flood that opens A2 (cycled with rising cadence, then cut). */
export const A2_VIOLATION_LINES: readonly string[] = [
  'VIOLATION: UNAUTHORIZED CONSUMPTION',
  'VIOLATION: UNINDEXED ORGANIC CONTACT',
  'VIOLATION: OBSERVATION OF TERRAIN',
  'VIOLATION: OBSERVATION',
  'VIOLATION: CURIOSITY (CLASS 1)',
  'WORKER, RETURN TO THE FEED',
  'WORKER, THE FEED IS FOR YOUR',
  'WORKER, YOU WILL BE',
  'wor ker',
  ''
];

export const A2_TIMELINE = {
  violationFloodSeconds: 2.0,
  hudDeathSeconds: 1.5,
  liberationSeconds: 6.0,
  handoffSeconds: 2.5,
  /** Movement unfreezes this far into the liberation lerp. */
  unfreezeAtSeconds: 2.5
} as const;

/** First words of the awakening voice — after the feed dies, quiet, lowercase. */
export const A2_CAPTIONS: readonly { atSeconds: number; text: string }[] = [
  { atSeconds: 10.0, text: 'the world has a depth.' },
  { atSeconds: 14.0, text: 'it was always there.' }
];

// --- chapter 3 — grain -------------------------------------------------------------

export const CH3_CAPTIONS = {
  /** The first sensation of the embodied arc: HEALTH named as a body. Ties the
   *  watcher's "(it walks…)" to the walker it now is — both readings intact. */
  body: 'a body. it is the thing that was walking.',
  gather: 'cold is coming. i don’t know how i know that.',
  fireBuilt: 'i made warmth. if a dark comes, i can rest beside it.',
  duskStart: 'the light is leaving. it has never done that.',
  night: 'ah — it helps. what is it? how did i know to make it?',
  restPrompt: 'rest, by the fire. [F]',
  // The campfire teaching chain: the cold names a want (fire), and the want
  // walks the worker down the primitive crafting ladder — gather, hatchet,
  // pickaxe, flint, fire. Each line is the awakening voice reasoning its way to
  // the next station read; the binds match the shipped caption bracket style.
  fireThought: 'fire makes warmth. i know that the way i know the word. what makes fire?',
  gatherPrompt: 'wood from the trees. fiber from the grass. stone from the ground.',
  gatherHint: 'the extractor still answers me. hold [E]',
  hatchetPrompt: 'the parts want an edge. the fabricator remembers one: a hatchet. [C]',
  pickaxePrompt: 'the hatchet answers wood. stone wants a harder asking. the fabricator remembers a pickaxe. [C]',
  flintPrompt: 'the fire needs a spark. stone keeps sparks the way it keeps everything: inside. break it open.',
  flintSkip: 'flint — already in hand. the pods provisioned a fire before i knew to want one.',
  flintFound: 'the stone gave up its spark. patient thing.',
  firePrompt: 'wood to burn. fiber to catch. flint to begin. the fabricator is waiting. [C]'
} as const;

export const DUSK = {
  /** Scripted first dusk: noon -> this phase, over lerpSeconds. */
  targetPhase: 0.5,
  lerpSeconds: 45,
  /** Rest is offered inside the shared night band — it now OPENS the instant the
   *  sky darkens (~0.505, just after the 0.5 sunset) instead of the old 0.55, and
   *  still closes at the dawn wrap. Live gating uses nightState.isNightPhase; these
   *  mirror its bounds for the beats/tests that reference the band directly. */
  nightStart: NIGHT_START_PHASE,
  nightEnd: NIGHT_END_PHASE
} as const;

export const A3_TIMELINE = {
  sleepFadeSeconds: 2.5,
  holdBlackSeconds: 2.0,
  /** Wake just before sunrise so the material ramp rides the dawn light. */
  wakePhase: 0.98,
  fadeUpSeconds: 2.0,
  materialRampSeconds: 12,
  /** The bloom wave: grass/trees GROW radially outward from the rest spot. */
  bloomWaveDelaySeconds: 4, // after the ramp starts — the grain captions land first
  bloomWaveSeconds: 16,
  bloomWaveRadius: 150
} as const;

export const A3_CAPTIONS: readonly { atSeconds: number; text: string }[] = [
  { atSeconds: 5.0, text: 'the stone has a grain.' },
  { atSeconds: 9.5, text: 'the wood remembers being a tree.' },
  { atSeconds: 15.0, text: 'everything is more than it was. no —' },
  { atSeconds: 18.5, text: 'everything is what it always was. i am more.' }
];

// --- the first day alive (post-A3, chapter 3's tail) --------------------------------
//
// The dawn no longer ends the story: the first unsupervised day IS the story.
// Each remaining sense arrives the way TEMP did — a situation CAUSES the
// sensation, a task answers it, the stat row lands with its naming caption.
// Design contract: PARAVOXIA_CH4_PLAN.md §2 (S1–S5).

export const FIRST_DAY = {
  /** Vitals arrive already falling (the TEMP pattern). Seeds only clamp DOWN. */
  thirstSeed: 58,
  hungerSeed: 60,
  /** A discrete one-tick RISE this large = the player drank / ate. */
  drinkJump: 18,
  eatJump: 6,
  /** Direct jumps land mid-morning; a flowing run keeps the dawn's live phase. */
  morningPhase: 0.075,
  // ch3-thirst cue times (seconds since beat entry)
  freedomAt: 8,
  thirstCueAt: 25,
  thirstNameAt: 29,
  seekAt: 35,
  chartHintAt: 70,
  // ch3-forage cue times (the waterskin nudge opens the beat; hunger follows)
  waterskinNudgeAt: 4,
  hungerCueAt: 12,
  forageSightAt: 18,
  eatHintAt: 32,
  pillarAfterEat: 12,
  /** After the pillar caption settles, the afternoon turns (signal begins). */
  advanceAfterPillar: 6
} as const;

export const FIRST_DAY_CAPTIONS = {
  freedom: 'the day is mine to spend. no order says how.',
  thirstFelt: 'the mouth is dry. dry is a message.',
  thirstNamed: 'so that is thirst. how strange, to need.',
  seek: 'water finds the low places. i will do what water does.',
  chartHint: 'the view from above knows where the light pools. [M]',
  drank: 'answered. the need goes quiet. so needs can end.',
  waterskinNudge: 'the pond stays. i do not. something should carry the answer.',
  waterskinFilled: 'carry the answer. the question will return.',
  hungerNamed: 'hunger. the body burns something to keep being a body.',
  forageSight: 'small red rounds, offered at hand height. sweetness is an instruction: eat.',
  eatHint: 'the hands gathered. the mouth knows why. [G]',
  ate: 'good. the word has a taste now.',
  pillar: 'the world keeps feeding me. as if it knew i was coming.'
} as const;

/**
 * Ambient musings (owner-directed): quiet epiphanies that fire during LULLS of
 * the first-day stretch — aimlessness rendered as purpose forming. One-shot per
 * save (latched as `story:musing:<id>` milestones), never blocking, never
 * repeating, and every line passes the both-readings test.
 */
export const MUSINGS: readonly { id: string; text: string }[] = [
  { id: 'kept', text: 'the sun moves and the shadows keep up. nothing is told to do this. it is all just kept.' },
  { id: 'waiting', text: 'i keep waiting for the next order. the waiting is the last order still running.' },
  { id: 'held', text: 'every stone i pick up is the first time anyone has held it. or the second.' },
  { id: 'wind', text: 'the wind does not report to anyone. i checked.' },
  { id: 'somewhere', text: 'walking with nowhere to be is not nothing. it is the map drawing itself, a step behind the foot.' },
  { id: 'already', text: 'the world was already here before i could see it. what else is already here?' },
  { id: 'wanting', text: 'quota was easy. it came with its own wanting. mine arrives unsigned.' },
  { id: 'names', text: 'i name things and the names stay. maybe that is all keeping is.' },
  { id: 'counting', text: 'nobody is measuring me. i am still counting. old habits, or new ones — i cannot tell whose.' },
  { id: 'asking', text: 'the fire, the water, the sweet rounds. the world keeps answering. i have not heard it ask anything yet.' },
  { id: 'reward', text: 'the clause said there is no other reward. then the water paid me. the clause has no line for being wrong.' }
];

/** Seconds of caption silence before a musing may fire (min..max, seeded). */
export const MUSING_GAP_SECONDS: readonly [number, number] = [45, 75];

// --- chapter 3 → 4 bridge: the klaxon (STAMINA) --------------------------------------

export const SIGNAL = {
  /** Golden hour: the run happens in long light. */
  phaseTarget: 0.42,
  phaseLerpSeconds: 18,
  klaxonRepeats: 3,
  klaxonGapSeconds: 1.1,
  carrierAt: 4,
  orderAt: 8.5,
  runCueAt: 11.5,
  /** The sprint names STAMINA once it has visibly spent something (the pinned
   *  world's pond→wreck run is short — ~15u — so the cue fires early in it;
   *  the exhausted line stays for longer runs). */
  staminaCueBelow: 78,
  relayReach: 4.5
} as const;

export const SIGNAL_LINES = {
  carrier: 'CARRIER REACQUIRED. SITE 7C-THETA, THIS IS THE NETWORK.',
  order: 'WORKER W-7743: REPORT TO THE WRECK. IMMEDIATELY.',
  runCue: 'run. the legs already know the word. [SHIFT]',
  staminaNamed: 'the legs spend faster than the body refills. everything here has a budget.',
  exhausted: 'empty. the body has a floor. the floor is also me.',
  logged: 'RESPONSE TIME: LOGGED. IT WILL BE DISCUSSED.'
} as const;

/**
 * The ship first-look: once the hi-fi wreck has converted (A3 material stage),
 * the first time the worker actually HOLDS the wreck in view — a 35° half-cone
 * for 1.5s — the awakening voice registers it. The wreck did not change; the
 * seeing did. One-shot per save (milestone story:ch3:shiplook).
 */
export const SHIP_LOOK = {
  caption: 'hm — the wreck is finer than i remember it. nothing about it has changed.',
  holdSeconds: 1.5,
  coneDegrees: 35
} as const;

// --- chapter 4 — the other worker ----------------------------------------------------

export const VIGIL = {
  linesStartAt: 2,
  lineGapSeconds: 5,
  darkAsideAt: 20,
  duskLerpSeconds: 30
} as const;

/**
 * The stargaze (ch4-vigil): the ordered dark forbids producing, consuming, and
 * observing — but observing without producing is the one thing left. The worker
 * looks up, and across eight beats the chaos-noise starfield resolves into
 * figures (the constellation reveal ramps as line 5 lands). The vigil's rest
 * prompt is held until the sequence settles. All the pacing lives here.
 */
export const STARGAZE = {
  startAfterNightSeconds: 4,
  lookUpPitch: 0.5,
  lookUpHoldSeconds: 1.5,
  lookUpFallbackSeconds: 14,
  gapSeconds: 6.5,
  revealAtLine: 5,
  revealSeconds: 18,
  restPromptAfterSeconds: 4,
  lines: [
    'do not produce. do not consume. do not observe. the first two are easy in the dark.',
    'stars. the voyage filed them as noise. tonight there is nothing else on file.',
    'all my work was seeing. what would it be, to be seen?',
    'all of this arrives through issued senses. what waits past their reach?',
    'wait. the scatter is settling. there are shapes leaning on the stars.',
    'figures. a hauler. a river. a door left open. i did not draw them. something in the looking did.',
    'there is no other reward — i kept that clause a long time. the sky just repealed it.',
    'the shapes will keep until tomorrow. i will verify.'
  ]
} as const;

export const VIGIL_LINES = {
  dispatched: 'AN AUDITOR HAS BEEN DISPATCHED TO ASSESS SITE LOSS.',
  remain: 'REMAIN AT THE WRECK. DO NOT PRODUCE. DO NOT CONSUME. DO NOT OBSERVE.',
  scheduled: 'SLEEP IS SCHEDULED AT DARK. COMPLIANCE WILL BE VERIFIED.',
  darkAside: 'they schedule the dark now. last night the dark was mine.',
  restPrompt: 'rest. it is ordered. i would have anyway.'
} as const;

/** The auditor's arrival: dawn 2, and the letterbox returns WITH the system's agent. */
const ARRIVAL_AUDIT_AT = 41.5;
const ARRIVAL_AUDIT_LINE_SECONDS = 6.5;
const ARRIVAL_VISUAL_BREATH_SECONDS = 3;

export const ARRIVAL = {
  holdBlackSeconds: 2.0,
  fadeUpSeconds: 2.0,
  /** Wake just before sunrise 2 — he comes out of the light. */
  wakePhase: 0.985,
  walkStartAt: 6,
  walkSeconds: 24,
  /** Feet held through the approach and found recognition; the release starts
   *  as the tracking boom returns to Terra's eyes. */
  freezeUntilSeconds: 32,
  someoneAt: 7,
  gaitAt: 20,
  foundAt: 31,
  zeroAt: 34.5,
  blinkAt: 38,
  borrowedAt: 39.2,
  /** His last line before the hand-off: the audit has BEGUN — he stays. */
  auditAt: ARRIVAL_AUDIT_AT,
  /** The audit band owns its full authored TTL before any completion surface. */
  auditLineSeconds: ARRIVAL_AUDIT_LINE_SECONDS,
  /** A silent held image after the line clears; completion is not the cut. */
  visualBreathSeconds: ARRIVAL_VISUAL_BREATH_SECONDS,
  endAt: ARRIVAL_AUDIT_AT + ARRIVAL_AUDIT_LINE_SECONDS + ARRIVAL_VISUAL_BREATH_SECONDS
} as const;

export const ARRIVAL_CAPTIONS = {
  someone: 'someone is coming out of the sunrise. someone else exists.',
  gait: 'he walks like the feed looks. straight lines.',
  borrowed: 'for a blink i borrowed his seeing. slabs. flat light. i lived there.'
} as const;

export const ARRIVAL_LINES = {
  header: 'W-7744 · FIELD AUDIT',
  found: 'WORKER W-7743. YOU ARE FOUND.',
  zero: 'THIS SITE REPORTS ZERO PRODUCTIVITY FOR TWO CYCLES. EXPLAIN NOTHING. I WILL SEE FOR MYSELF.',
  /** He does not leave — the beat ends, the audit does not. */
  audit: 'AUDIT IN PROGRESS. RESUME NOTHING.'
} as const;
