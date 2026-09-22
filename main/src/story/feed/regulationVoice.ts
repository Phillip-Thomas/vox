import type { SurveyTargetPresentation } from './surveyBrackets.ts';
import type { GuidedStoryObjective } from '../ux/objectiveDirector.ts';

const REGULATION_VOICE: Record<
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

/** Exact original track lineage. The middle three lines are retired from automatic presentation. */
export const TRACK_SYSTEM_LINE = REGULATION_VOICE.track[0];
export const TRACK_WATCHER_LINE = REGULATION_VOICE.track[4];
export const RETIRED_TRACK_LINES = REGULATION_VOICE.track.slice(1, 4);

/** Era voice is a presentation of the active objective, never another stored order. */
export function presentRegulationObjective(objective: Readonly<GuidedStoryObjective>, echoes: readonly string[] = [], presentation?: Readonly<SurveyTargetPresentation> | null): readonly string[] {
  const id = objective.id;
  if (presentation?.objective === objective && presentation.objectiveId === id
    && presentation.horizontalOffscreen && presentation.direction && !presentation.nativeActionable
    && ['ch1:fixed:recover-first-debris', 'ch1:fixed:calibrate-extractor', 'ch1:raster:recover-quota', 'ch1:raster:extract-fiber-quota'].includes(id)) {
    const target = presentation.targetLabel === 'BIOFIBER' ? 'BIOFIBER' : presentation.targetLabel === 'DEBRIS' ? 'DEBRIS' : null;
    if (target) return [`WALK [${presentation.direction}] TO ${target}.`];
  }
  if (['ch1:fixed:', 'ch1:raster:', 'ch1:track:', 'ch1:depth:'].some(prefix => id.startsWith(prefix))) return objective.workOrder;
  void echoes;
  if (id.startsWith('ch1:nav:')) return REGULATION_VOICE.nav;
  if (id.startsWith('ch1:iso:')) return REGULATION_VOICE.iso;
  if (id.startsWith('ch1:lift:')) return ['PAN-TILT SURVEY: CALIBRATING…', 'HOLD POSITION. PERSPECTIVE IS BEING ISSUED.'];
  return objective.workOrder;
}
