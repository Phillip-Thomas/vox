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
//   Never explains. Appears only after color exists.

// --- prologue -------------------------------------------------------------------

/** The Star-Wars-style crawl, written as the document it diegetically is. */
export const CRAWL_LINES: readonly string[] = [
  'CONSOLIDATED EXTRACTION AUTHORITY',
  'DEPLOYMENT NOTICE 7C-THETA · CYCLE 40,221',
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
  'Your hauler departs immediately.',
  'Productivity is its own reward.',
  'There is no other reward.'
];

export interface PrologueEventOption {
  id: string;
  label: string;
  /** Cosmetic ledger deltas (the voyage stats are theater, not simulation). */
  ledgerDelta?: Partial<Record<LedgerStat, number>>;
  /** Ch1 work-order line this choice echoes back as (see CH1_ECHO_LINES). */
  echoLineId: string;
}

export interface PrologueEventCard {
  id: string;
  title: string;
  body: string;
  options: PrologueEventOption[];
}

export type LedgerStat = 'rations' | 'hull' | 'compliance' | 'transit';

/** Oregon-Trail voyage event cards. 3 real choices; consequences echo in Ch1. */
export const PROLOGUE_EVENTS: readonly PrologueEventCard[] = [
  {
    id: 'ration',
    title: 'TRANSIT EVENT 01 — SHORTFALL',
    body: 'Ration units for this transit were provisioned at 96% of requirement. A worker in your pod requests your surplus unit.',
    options: [
      { id: 'give', label: 'TRANSFER YOUR UNIT', ledgerDelta: { rations: -8, compliance: -2 }, echoLineId: 'echo-ration-give' },
      { id: 'keep', label: 'RETAIN YOUR UNIT', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-ration-keep' },
      { id: 'report', label: 'REPORT THE REQUEST', ledgerDelta: { compliance: 4 }, echoLineId: 'echo-ration-report' }
    ]
  },
  {
    id: 'window',
    title: 'TRANSIT EVENT 02 — VIEWPORT',
    body: 'A maintenance panel has slipped, exposing a viewport. Outside: stars. Regulation stipulates viewports remain sealed to prevent unproductive observation.',
    options: [
      { id: 'seal', label: 'RESEAL THE PANEL', ledgerDelta: { compliance: 3 }, echoLineId: 'echo-window-seal' },
      { id: 'look', label: 'LOOK. BRIEFLY.', ledgerDelta: { compliance: -3 }, echoLineId: 'echo-window-look' }
    ]
  },
  {
    id: 'hum',
    title: 'TRANSIT EVENT 03 — AUDITORY',
    body: 'Worker 4 has begun to hum. The sound is not on the approved list of sounds. Other workers have not reported it. Yet.',
    options: [
      { id: 'ignore', label: 'DO NOT HEAR IT', ledgerDelta: {}, echoLineId: 'echo-hum-ignore' },
      { id: 'join', label: 'HUM ALONG, QUIETLY', ledgerDelta: { compliance: -4 }, echoLineId: 'echo-hum-join' },
      { id: 'report', label: 'FILE FORM S-9 (SOUND)', ledgerDelta: { compliance: 4 }, echoLineId: 'echo-hum-report' }
    ]
  },
  {
    id: 'question',
    title: 'TRANSIT EVENT 04 — INQUIRY',
    body: 'Worker 9 asks you, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.',
    options: [
      { id: 'nothing', label: '"NOTHING IS OUTSIDE."', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-question-nothing' },
      { id: 'work', label: '"MORE WORK IS OUTSIDE."', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-question-work' },
      { id: 'unknown', label: '"I DON\'T KNOW." (TRUE)', ledgerDelta: { compliance: -3 }, echoLineId: 'echo-question-unknown' }
    ]
  },
  {
    id: 'diagnostic',
    title: 'TRANSIT EVENT 05 — DIAGNOSTIC',
    body: 'Your suit\'s visual cortex link reports a fault it cannot name. For 0.4 seconds, the diagnostic feed displayed something other than numbers. It has offered to recalibrate you.',
    options: [
      { id: 'accept', label: 'ACCEPT RECALIBRATION', ledgerDelta: { compliance: 3 }, echoLineId: 'echo-diag-accept' },
      { id: 'defer', label: 'DEFER TO ARRIVAL', ledgerDelta: {}, echoLineId: 'echo-diag-defer' },
      { id: 'replay', label: 'ASK TO SEE IT AGAIN', ledgerDelta: { compliance: -5 }, echoLineId: 'echo-diag-replay' }
    ]
  }
];

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
  'WORKER: REMAIN PRODUCTIVE DURING',
  ''
];

// --- chapter 1 — the Regulation Feed ---------------------------------------------

export const CH1_QUOTA = {
  biofiber: 6,
  stone: 4
} as const;

/** Standing work order shown on the feed HUD, per beat. */
export const CH1_WORK_ORDERS: Record<'raster' | 'anomaly', readonly string[]> = {
  raster: [
    'VISUAL CORTEX LINK: RASTER MODE (1-BIT) · PAN-TILT OFFLINE',
    'DIRECTIVE 1: SURVIVE. (AMENDED: SEE DIRECTIVE 2)',
    'DIRECTIVE 2: RESUME QUOTA.',
    'TRAVERSE [A]/[D] · ASCEND [SPACE] · EXTRACT: HOLD [E]',
    'HAULER STATUS: DISASSEMBLED (UNSCHEDULED)'
  ],
  anomaly: [
    'QUOTA MET. PRODUCTIVITY NOMINAL.',
    'PAN-TILT SURVEY RESTORED. DO NOT ENJOY IT.',
    'RETURN DEVIATION: UNCHARTED MASS AT SURVEY EDGE',
    'PROCEED TO THE SURVEY MARKER. CLASSIFY.',
    'DO NOT TOUCH THE UNCHARTED MASS.'
  ]
};

/** Prologue choices resurface here — the system remembers, flatly. */
export const CH1_ECHO_LINES: Record<string, string> = {
  'echo-ration-give': 'NOTE: YOUR TRANSIT GENEROSITY WAS LOGGED. IT WILL NOT RECUR.',
  'echo-ration-keep': 'NOTE: YOUR TRANSIT EFFICIENCY WAS LOGGED. ADEQUATE.',
  'echo-ration-report': 'NOTE: THE REPORTED WORKER HAS BEEN REBALANCED. THANK YOU.',
  'echo-window-seal': 'NOTE: PANEL RESEAL LOGGED. THE STARS REMAIN UNOBSERVED.',
  'echo-window-look': 'NOTE: 2.4 SECONDS OF UNPRODUCTIVE OBSERVATION ON RECORD.',
  'echo-hum-ignore': 'NOTE: NO SOUND WAS REPORTED. NO SOUND OCCURRED.',
  'echo-hum-join': 'NOTE: AN UNAPPROVED SOUND WAS ALMOST ON RECORD. CAUTION.',
  'echo-hum-report': 'NOTE: FORM S-9 PROCESSED. WORKER 4 NO LONGER HUMS.',
  'echo-question-nothing': 'NOTE: YOUR ANSWER TO WORKER 9 WAS CORRECT. NOTHING IS OUTSIDE.',
  'echo-question-work': 'NOTE: YOUR ANSWER TO WORKER 9 WAS ADEQUATE. IT IS ALSO OUTSIDE.',
  'echo-question-unknown': 'NOTE: YOUR ANSWER TO WORKER 9 IS UNDER REVIEW.',
  'echo-diag-accept': 'NOTE: RECALIBRATION COMPLETE. YOU SAW NOTHING UNUSUAL.',
  'echo-diag-defer': 'NOTE: RECALIBRATION PENDING. REPORT ANY COLORS.',
  'echo-diag-replay': 'NOTE: YOUR REPLAY REQUEST WAS DENIED FOR YOUR COMFORT.',
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
  gather: 'cold is coming. i don’t know how i know that.',
  duskStart: 'the light is leaving. it has never done that.',
  night: 'the fire helps. i made the fire. i made something.',
  restPrompt: 'rest.'
} as const;

export const DUSK = {
  /** Scripted first dusk: noon -> this phase, over lerpSeconds. */
  targetPhase: 0.45,
  lerpSeconds: 90,
  /** Rest is offered inside this night band (phase 0.5 sunset .. 1.0 sunrise). */
  nightStart: 0.55,
  nightEnd: 0.95
} as const;

export const A3_TIMELINE = {
  sleepFadeSeconds: 2.5,
  holdBlackSeconds: 2.0,
  /** Wake just before sunrise so the material ramp rides the dawn light. */
  wakePhase: 0.98,
  fadeUpSeconds: 2.0,
  materialRampSeconds: 12
} as const;

export const A3_CAPTIONS: readonly { atSeconds: number; text: string }[] = [
  { atSeconds: 5.0, text: 'the stone has a grain.' },
  { atSeconds: 9.5, text: 'the wood remembers being a tree.' },
  { atSeconds: 15.0, text: 'everything is more than it was. no —' },
  { atSeconds: 18.5, text: 'everything is what it always was. i am more.' }
];
