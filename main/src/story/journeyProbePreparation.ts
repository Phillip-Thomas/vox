// Query-gated browser-probe preparation receipts. Gameplay never reads this
// state: it exists only to make direct-entry diagnostic assistance explicit in
// the captured evidence instead of letting a reconstructed prerequisite masquerade
// as ordinary chapter continuity.

export const JOURNEY_PROBE_PREPARE_EVENT = 'paravoxia:journey-probe-prepare';

export type JourneyProbePreparationStatus = 'waiting' | 'prepared' | 'denied';

export interface JourneyProbePreparationEvidence {
  [key: string]: string | number | boolean | null | readonly number[];
}

export interface JourneyProbePreparationRecord {
  scenarioId: string;
  status: JourneyProbePreparationStatus;
  attempts: number;
  handlerId: string | null;
  storyBeat: string | null;
  reason: string | null;
  evidence: JourneyProbePreparationEvidence | null;
  updatedAt: number;
}

export interface JourneyProbePrepareEventDetail {
  scenarioId: string;
  storyBeat: string | null;
  handled: boolean;
  handlerId: string | null;
  evidence: JourneyProbePreparationEvidence | null;
}

let record: JourneyProbePreparationRecord | null = null;

function nextRecord(
  scenarioId: string,
  status: JourneyProbePreparationStatus,
  storyBeat: string | null,
  options: {
    handlerId?: string | null;
    reason?: string | null;
    evidence?: JourneyProbePreparationEvidence | null;
  } = {}
): JourneyProbePreparationRecord {
  const attempts = record?.scenarioId === scenarioId ? record.attempts + 1 : 1;
  record = Object.freeze({
    scenarioId,
    status,
    attempts,
    handlerId: options.handlerId ?? null,
    storyBeat,
    reason: options.reason ?? null,
    evidence: options.evidence ? Object.freeze({ ...options.evidence }) : null,
    updatedAt: Date.now()
  });
  return { ...record, evidence: record.evidence ? { ...record.evidence } : null };
}

export function acknowledgeJourneyProbePreparation(
  detail: JourneyProbePrepareEventDetail,
  handlerId: string,
  evidence: JourneyProbePreparationEvidence
): void {
  detail.handled = true;
  detail.handlerId = handlerId;
  detail.evidence = { ...evidence };
}

/** Dispatch a synchronous request to the currently mounted story surface. */
export function requestJourneyProbePreparation(
  scenarioId: string,
  storyBeat: string | null
): JourneyProbePreparationRecord {
  if (record?.scenarioId === scenarioId && record.status === 'prepared') {
    return { ...record, evidence: record.evidence ? { ...record.evidence } : null };
  }
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
    return nextRecord(scenarioId, 'waiting', storyBeat, {
      reason: 'browser-event-boundary-unavailable'
    });
  }
  const detail: JourneyProbePrepareEventDetail = {
    scenarioId,
    storyBeat,
    handled: false,
    handlerId: null,
    evidence: null
  };
  window.dispatchEvent(new CustomEvent<JourneyProbePrepareEventDetail>(
    JOURNEY_PROBE_PREPARE_EVENT,
    { detail }
  ));
  return nextRecord(scenarioId, detail.handled ? 'prepared' : 'waiting', storyBeat, {
    handlerId: detail.handlerId,
    reason: detail.handled ? null : 'scenario-consumer-not-ready',
    evidence: detail.evidence
  });
}

export function recordJourneyProbePreparation(
  scenarioId: string,
  storyBeat: string | null,
  options: {
    status: JourneyProbePreparationStatus;
    handlerId?: string | null;
    reason?: string | null;
    evidence?: JourneyProbePreparationEvidence | null;
  }
): JourneyProbePreparationRecord {
  if (record?.scenarioId === scenarioId && record.status === 'prepared') {
    return { ...record, evidence: record.evidence ? { ...record.evidence } : null };
  }
  return nextRecord(scenarioId, options.status, storyBeat, options);
}

export function getJourneyProbePreparationSnapshot(): JourneyProbePreparationRecord | null {
  return record ? { ...record, evidence: record.evidence ? { ...record.evidence } : null } : null;
}

export function resetJourneyProbePreparationForTests(): void {
  record = null;
}
