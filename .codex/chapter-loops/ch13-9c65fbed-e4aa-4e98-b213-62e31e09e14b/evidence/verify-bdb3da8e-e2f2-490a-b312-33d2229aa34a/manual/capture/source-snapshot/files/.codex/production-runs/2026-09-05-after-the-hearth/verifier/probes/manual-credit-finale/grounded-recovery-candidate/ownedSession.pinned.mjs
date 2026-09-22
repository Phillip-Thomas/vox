/**
 * OWNED BROWSER SESSION CLEANUP — run-local to 2026-09-05-after-the-hearth.
 *
 * WHY THIS EXISTS
 * ---------------
 * Both probes ended with `await session.stop()` as the last top-level statement.
 * Any throw before it — a capture failure, a `frameStats` failure, a
 * summary-writing failure, a checkpoint path failure — skipped that line and
 * left the probe's OWN Chromium alive. `cg-footing-diag.mjs` previously threw at
 * `frameStats(...).catch` (frameStats is synchronous, so `.catch` is not a
 * function) at exactly that point; that TypeError is already corrected, but the
 * structural hole it exposed is what this guard closes for the NEXT failure,
 * whatever it turns out to be.
 *
 * Rules this guard keeps, deliberately:
 *   - it stops ONLY the session the probe itself opened (`adopt`), and calls
 *     that session's own `stop()` AT MOST ONCE;
 *   - it NEVER stops the root-owned preview or anyone else's browser. The probes
 *     pass `preview: { url, stop() {} }`, so the shipped `evidence.mjs` stop path
 *     leaves the root preview running; nothing here reaches past `session.stop`;
 *   - it NEVER kills processes, never shuts down browsers globally, never sends
 *     signals;
 *   - it NEVER swallows or rewrites the original failure. Cleanup runs in a
 *     `finally`, the original error propagates unchanged, and the process exit
 *     code is whatever that failure produces. A failure INSIDE cleanup is
 *     recorded on the guard and logged, never allowed to replace the real one.
 *
 * No browser is started here and nothing in this file is a browser proof.
 */

export const OWNED_SESSION_GUARD_SCHEMA = 'paravoxia.verifier.ownedSessionGuard.v1';

/**
 * @param {object} [opts]
 * @param {(msg:string)=>void} [opts.log]
 * @param {string} [opts.label]
 */
export function createOwnedSessionGuard({ log = () => {}, label = 'owned-session' } = {}) {
  let session = null;
  let adoptedAtMs = null;
  let stopRequests = 0;      // how many times cleanup was ASKED for
  let stopInvocations = 0;   // how many times session.stop() actually ran
  let stopped = false;
  let stopError = null;
  let stopReason = null;
  let stopPromise = null;

  const guard = {
    schema: OWNED_SESSION_GUARD_SCHEMA,
    label,

    /** Take ownership of a session THIS probe opened. */
    adopt(s) {
      if (session) throw new Error(`${label}: a session is already adopted; this guard owns exactly one`);
      if (!s || typeof s.stop !== 'function') throw new Error(`${label}: refusing to adopt a value without a stop() method`);
      session = s;
      adoptedAtMs = Date.now();
      return s;
    },

    get adopted() { return session != null; },
    get stopRequests() { return stopRequests; },
    /** How many times the underlying session.stop() was actually called. */
    get stopInvocations() { return stopInvocations; },
    get stopped() { return stopped; },
    get stopError() { return stopError; },

    /**
     * Idempotent cleanup. Safe to call from a `finally`, from the normal end of
     * the probe, and from both at once — the underlying stop runs exactly once.
     * Resolves to a record; it does NOT throw, so it can never mask the failure
     * that brought us here.
     */
    async stopOnce(reason = 'unspecified') {
      stopRequests += 1;
      if (!session) {
        return { stopped: false, invoked: false, reason: 'no-owned-session', requests: stopRequests };
      }
      if (stopPromise) {
        await stopPromise;
        return { stopped, invoked: false, alreadyStopped: true, reason: stopReason, requests: stopRequests, error: stopError };
      }
      stopReason = reason;
      stopInvocations += 1;
      stopPromise = (async () => {
        try {
          await session.stop();
          stopped = true;
          log(`${label}: stopped the probe-owned browser session (reason=${reason}); the root-owned preview was not touched`);
        } catch (e) {
          stopError = String(e && e.stack ? e.stack : e).slice(0, 400);
          log(`${label}: cleanup FAILED (reason=${reason}): ${stopError.split('\n')[0]} — the original outcome is unchanged and still reported`);
        }
      })();
      await stopPromise;
      return { stopped, invoked: true, reason, requests: stopRequests, error: stopError };
    },

    /**
     * Run the measuring body with guaranteed cleanup. The body's error — not a
     * cleanup error — is what propagates.
     */
    async runGuarded(fn, { reason = 'run-guarded-finally' } = {}) {
      try {
        return await fn();
      } finally {
        await guard.stopOnce(reason);
      }
    },

    /** Provenance for the summary. Never claims anything about the browser run. */
    describe() {
      return {
        schema: OWNED_SESSION_GUARD_SCHEMA,
        label,
        adopted: session != null,
        adoptedAtMs,
        cleanupRequests: stopRequests,
        sessionStopInvocations: stopInvocations,
        sessionStopped: stopped,
        cleanupError: stopError,
        cleanupReason: stopReason,
        stopsOnlyProbeOwnedSession: true,
        stopsRootPreview: false,
        killsProcesses: false,
        hidesFailureExitCode: false,
        note: 'Cleanup of the browser session THIS probe opened, guaranteed by try/finally and idempotent. It never stops the root-owned preview, never kills a process, and never changes the reported outcome or exit code.'
      };
    },

    /**
     * POST-FINALLY RECEIPT (root review correction, 2026-09-06).
     *
     * `describe()` is embedded in summary.json from INSIDE the try block, which
     * is necessarily before the `finally` has run — so the `sessionStopped`
     * field it carries is a PRE-CLEANUP observation and was mis-read as a
     * cleanup outcome. This method is called AFTER `stopOnce` has settled and
     * reports what actually happened, including the failure paths.
     *
     * It reports; it never retries, never kills anything and never changes the
     * probe's outcome or exit code.
     */
    cleanupReceipt({ probe = null, outcomeUnchanged = true } = {}) {
      const d = guard.describe();
      const state = !d.adopted
        ? 'no-session-adopted'
        : d.sessionStopped
          ? 'stopped'
          : d.cleanupError
            ? 'stop-failed'
            : d.sessionStopInvocations > 0
              ? 'stop-invoked-not-confirmed'
              : 'never-requested';
      return {
        schema: 'paravoxia.verifier.ownedSessionCleanupReceipt.v1',
        probe,
        writtenAt: new Date().toISOString(),
        phase: 'post-finally',
        supersedesForCleanupState: 'summary.json .cleanup (captured pre-finally; its sessionStopped is a pre-cleanup value, not the outcome)',
        state,
        cleanupCompleted: state === 'stopped',
        ...d,
        outcomeUnchanged,
        note: 'Recorded AFTER the finally block ran. This is the actual cleanup outcome of the browser session this probe owned. A stop-failed or never-requested state is reported honestly and does NOT alter the capture outcome, the retained evidence, or the process exit code. It says nothing about the game.'
      };
    }
  };
  return guard;
}

/**
 * Build the honest failure record written next to a partial capture when the
 * probe throws. It is INCONCLUSIVE by construction: a crashed capture is never
 * a pass, and the partial trace/media it leaves behind stay exactly as written.
 */
export function failureRecord({ probe, error, phase = 'capture', extra = {} }) {
  const err = error ?? new Error('unknown failure');
  return {
    schema: 'paravoxia.verifier.probeFailure.v1',
    probe,
    outcome: 'PROBE-ERROR-INCONCLUSIVE',
    outcomeIsAcceptance: false,
    failed: true,
    phase,
    error: {
      name: err.name ?? null,
      message: String(err.message ?? err).slice(0, 2000),
      stack: err.stack ? String(err.stack).slice(0, 4000) : null
    },
    at: new Date().toISOString(),
    partialEvidenceRetained: true,
    note: 'The capture FAILED. Whatever trace lines and frames were already written are kept as partial evidence and are not a measurement of the chapter. The original error is re-thrown, so the process exit code still reports the failure.',
    ...extra
  };
}
