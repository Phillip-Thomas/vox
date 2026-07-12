export type WarpMetricDetails = Record<string, string | number | boolean | null | undefined>;

interface WarpMetricEvent {
  label: string;
  atMs: number;
  durationMs?: number;
  details?: WarpMetricDetails;
}

interface WarpLongFrame {
  atMs: number;
  gapMs: number;
}

interface WarpMetricSession {
  id: number;
  destination: string;
  startedAt: number;
  events: WarpMetricEvent[];
  rafFrames: number;
  maxRafGapMs: number;
  longFrames: WarpLongFrame[];
  lastRafAt?: number;
}

export interface WarpMetricReport {
  id: number;
  destination: string;
  totalMs: number;
  rafFrames: number;
  maxRafGapMs: number;
  longFrames: WarpLongFrame[];
  events: WarpMetricEvent[];
}

const LONG_FRAME_MS = 50;

let enabledCache: boolean | null = null;
let nextSessionId = 1;
let activeSession: WarpMetricSession | null = null;
let lastReport: WarpMetricReport | null = null;
let systemProbeEnabledCache: boolean | null = null;

interface SystemMeasuredSpan {
  label: string;
  startedAt: number;
  durationMs: number;
  details?: WarpMetricDetails;
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function cleanDetails(details?: WarpMetricDetails): WarpMetricDetails | undefined {
  if (!details) return undefined;
  const cleaned: WarpMetricDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function exposeReport(report: WarpMetricReport): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __lastWarpMetrics?: WarpMetricReport }).__lastWarpMetrics = report;
}

function exposeActiveSession(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __activeWarpMetrics?: WarpMetricSession | null }).__activeWarpMetrics = activeSession;
}

export function isWarpMetricsEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === 'undefined') {
    enabledCache = false;
    return enabledCache;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    enabledCache = params.get('warpprobe') === '1';
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

export function startWarpMetrics(destination: string): void {
  if (!isWarpMetricsEnabled()) return;

  activeSession = {
    id: nextSessionId++,
    destination,
    startedAt: nowMs(),
    events: [],
    rafFrames: 0,
    maxRafGapMs: 0,
    longFrames: []
  };

  markWarpMetric('warp:start', { destination });
  exposeActiveSession();
}

export function markWarpMetric(label: string, details?: WarpMetricDetails): void {
  if (!isWarpMetricsEnabled() || !activeSession) return;

  activeSession.events.push({
    label,
    atMs: Number((nowMs() - activeSession.startedAt).toFixed(2)),
    details: cleanDetails(details)
  });
  exposeActiveSession();
}

export function measureWarpMetric<T>(
  label: string,
  fn: () => T,
  detailsForResult?: (result: T) => WarpMetricDetails | undefined
): T {
  const recordWarp = isWarpMetricsEnabled() && activeSession !== null;
  const recordSystemProbe = isSystemProbeMeasurementEnabled();
  if (!recordWarp && !recordSystemProbe) return fn();

  const startedAt = nowMs();
  try {
    const result = fn();
    const durationMs = Number((nowMs() - startedAt).toFixed(2));
    const details = cleanDetails(detailsForResult?.(result));
    if (recordWarp && activeSession) {
      activeSession.events.push({
        label,
        atMs: Number((startedAt - activeSession.startedAt).toFixed(2)),
        durationMs,
        details
      });
      exposeActiveSession();
    }
    if (recordSystemProbe) recordSystemMeasuredSpan({ label, startedAt, durationMs, details });
    return result;
  } catch (error) {
    const durationMs = Number((nowMs() - startedAt).toFixed(2));
    if (recordWarp && activeSession) {
      activeSession.events.push({
        label,
        atMs: Number((startedAt - activeSession.startedAt).toFixed(2)),
        durationMs,
        details: { threw: true }
      });
      exposeActiveSession();
    }
    if (recordSystemProbe) {
      recordSystemMeasuredSpan({ label, startedAt, durationMs, details: { threw: true } });
    }
    throw error;
  }
}

function isSystemProbeMeasurementEnabled(): boolean {
  if (systemProbeEnabledCache !== null) return systemProbeEnabledCache;
  if (typeof window === 'undefined') return false;
  systemProbeEnabledCache = new URLSearchParams(window.location.search).get('systemprobe') === '1';
  return systemProbeEnabledCache;
}

function recordSystemMeasuredSpan(span: SystemMeasuredSpan): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { __paravoxiaSystemMeasuredSpans?: SystemMeasuredSpan[] };
  const spans = win.__paravoxiaSystemMeasuredSpans ?? [];
  spans.push(span);
  if (spans.length > 240) spans.splice(0, spans.length - 240);
  win.__paravoxiaSystemMeasuredSpans = spans;
}

export function recordWarpMetricFrame(timestamp = nowMs()): void {
  if (!isWarpMetricsEnabled() || !activeSession) return;

  if (activeSession.lastRafAt !== undefined) {
    const gapMs = timestamp - activeSession.lastRafAt;
    activeSession.maxRafGapMs = Math.max(activeSession.maxRafGapMs, gapMs);
    if (gapMs >= LONG_FRAME_MS) {
      activeSession.longFrames.push({
        atMs: Number((timestamp - activeSession.startedAt).toFixed(2)),
        gapMs: Number(gapMs.toFixed(2))
      });
    }
  }

  activeSession.lastRafAt = timestamp;
  activeSession.rafFrames += 1;
  exposeActiveSession();
}

export function finishWarpMetrics(reason = 'warp:end'): WarpMetricReport | null {
  if (!isWarpMetricsEnabled() || !activeSession) return null;

  markWarpMetric(reason);
  const session = activeSession;
  const report: WarpMetricReport = {
    id: session.id,
    destination: session.destination,
    totalMs: Number((nowMs() - session.startedAt).toFixed(2)),
    rafFrames: session.rafFrames,
    maxRafGapMs: Number(session.maxRafGapMs.toFixed(2)),
    longFrames: session.longFrames,
    events: session.events
  };

  activeSession = null;
  lastReport = report;
  exposeReport(report);
  exposeActiveSession();

  console.groupCollapsed(
    `[warpprobe] #${report.id} ${report.destination} total=${report.totalMs}ms ` +
      `maxFrameGap=${report.maxRafGapMs}ms longFrames=${report.longFrames.length}`
  );
  console.table(
    report.events.map(event => ({
      atMs: event.atMs,
      durationMs: event.durationMs ?? '',
      label: event.label,
      details: event.details ? JSON.stringify(event.details) : ''
    }))
  );
  if (report.longFrames.length > 0) {
    console.table(report.longFrames);
  }
  console.groupEnd();

  return report;
}

export function getLastWarpMetricsReport(): WarpMetricReport | null {
  return lastReport;
}
