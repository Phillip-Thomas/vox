import type { VoyageDeck } from './voyageDeck.ts';

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
  '',
  'CARGO MANIFEST (PARTIAL):',
  '  EXTRACTION UNITS ......... 640',
  '  RATION UNITS ............. 61,440 (96%)',
  '  WORKERS .................. 640',
  '  QUESTIONS ................ 0',
  '',
  'MEDICAL WAIVER: PRE-SIGNED FOR YOUR CONVENIENCE',
  'RETURN PASSAGE: SUBJECT TO QUOTA',
  '',
  'HATCH SEAL IN 5',
  'THE AUTHORITY THANKS YOU IN ADVANCE.'
];

export type LedgerStat = 'rations' | 'hull' | 'compliance' | 'transit';

/**
 * The voyage deck: 3 SPINE cards (every run), a situational POOL (2 drawn per
 * run), follow-ups injected by choices, and the BRIDGE (the nav anomaly that
 * orders you to the intake shield — the reason the Pong game exists). Choices
 * carry real consequences (items / harvester cell / arrival vitals) and echo in
 * Ch1's work order. No two commutes read alike.
 */
export const VOYAGE_DECK: VoyageDeck = {
  spine: ['ration', 'question', 'diagnostic'],
  pool: ['window', 'hum', 'readings', 'stowmass'],
  poolDraws: 2,
  maxCards: 6,
  bridge: 'anomaly',
  cards: {
    ration: {
      id: 'ration',
      title: 'TRANSIT EVENT — SHORTFALL',
      body: 'Ration units for this transit were provisioned at 96% of requirement. A worker in your pod requests your surplus unit.',
      options: [
        { id: 'give', label: 'TRANSFER YOUR UNIT', ledgerDelta: { rations: -6, compliance: -2 }, effects: { food: -10 }, echoLineId: 'echo-ration-give' },
        { id: 'keep', label: 'RETAIN YOUR UNIT', ledgerDelta: { compliance: 1 }, effects: { items: [{ id: 'berry', qty: 2 }] }, echoLineId: 'echo-ration-keep' },
        { id: 'report', label: 'REPORT THE REQUEST', ledgerDelta: { compliance: 4 }, unlocks: ['commendation'], echoLineId: 'echo-ration-report' }
      ]
    },
    question: {
      id: 'question',
      title: 'TRANSIT EVENT — INQUIRY',
      body: 'Worker 9 asks you, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.',
      options: [
        { id: 'nothing', label: '"NOTHING IS OUTSIDE."', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-question-nothing' },
        { id: 'work', label: '"MORE WORK IS OUTSIDE."', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-question-work' },
        { id: 'unknown', label: '"I DON\'T KNOW." (TRUE)', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-question-unknown' }
      ]
    },
    diagnostic: {
      id: 'diagnostic',
      title: 'TRANSIT EVENT — DIAGNOSTIC',
      body: 'Your suit\'s visual cortex link reports a fault it cannot name. For 0.4 seconds, the diagnostic feed displayed something other than numbers. It has offered to recalibrate you.',
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
        { id: 'look', label: 'LOOK. BRIEFLY.', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-window-look' }
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
      body: 'Worker 4 heard you. The hum is now a duet. It has, worryingly, a melody. Three berths over, a foot is tapping.',
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
    'DIRECTIVE 2: RESUME QUOTA. RECOVER HULL DEBRIS.',
    'TRAVERSE [A]/[D] · ASCEND [SPACE] · EXTRACT: HOLD [E]',
    'DEBRIS IS AUTHORITY PROPERTY. YOU ARE AUTHORITY PROPERTY.'
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
  fireBuilt: 'i made warmth. when the dark comes, i can rest beside it.',
  duskStart: 'the light is leaving. it has never done that.',
  night: 'the fire helps. i made the fire. i made something.',
  restPrompt: 'rest, by the fire. [F]'
} as const;

export const DUSK = {
  /** Scripted first dusk: noon -> this phase, over lerpSeconds. */
  targetPhase: 0.5,
  lerpSeconds: 45,
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
