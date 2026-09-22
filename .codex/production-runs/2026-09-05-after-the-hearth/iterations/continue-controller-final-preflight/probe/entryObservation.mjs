/**
 * entryObservation.mjs — PASSIVE entry-input observation helpers.
 *
 * WHY THIS EXISTS
 *   entry-discriminator-report.json recorded that BOTH of that probe's own
 *   read-only click observers threw
 *     TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 *   at click time, because its describe() helper called `tagName.toLowerCase()`
 *   on `event.currentTarget`, which for a document/window listener is a Document
 *   or a Window, not an Element. The lock was granted in that same click, so the
 *   defect was purely in the probe's own bookkeeping — but the click metadata
 *   (isTrusted / pointerType / sourceCapabilities) was LOST and remains
 *   unmeasured. This module is that missing bookkeeping, written so it cannot
 *   throw on Window, Document, Element, text nodes, or null.
 *
 * WHAT THIS IS NOT
 *   - It never calls requestPointerLock, never dispatches or forces a click,
 *     never patches a game handler, never injects key state, never touches focus
 *     or permission policy, and never writes game state. It only ADDS listeners
 *     and READS already-exposed fields.
 *   - It adds no loop, no retry and no timeout. The prior 16:31 failure cause is
 *     UNKNOWN (see entry-discriminator-report.json "causeIfProved": NOT PROVED);
 *     nothing here is tuned to a cause that was never established.
 *   - Observation is NOT acceptance: recording a pointerlockerror or a console
 *     warning proves only that it occurred in that session.
 *
 * INJECTION CONTRACT
 *   `describeEventTarget` and `entryObserverSource` are SELF-CONTAINED (no
 *   closure variables, builtins only) so the probe can inject the EXACT bytes
 *   the CPU self-tests exercise, via Function#toString. The tested function and
 *   the page-side function are therefore the same source.
 */

/**
 * Describe ANY event target/node safely.
 *
 * Handles, without throwing: null, undefined, Window (has .window === self and
 * no tagName), Document (nodeType 9), Element (nodeType 1), text nodes, plain
 * objects, primitives, and objects whose property getters throw.
 *
 * Returns a plain, JSON-safe record. `kind` is the discriminator; `tag` is only
 * present (non-null) when a real string tagName exists.
 */
export function describeEventTarget(t) {
  const safe = (fn, fallback = null) => { try { const v = fn(); return v === undefined ? fallback : v; } catch { return fallback; } };
  if (t === null) return { kind: 'null', tag: null, id: null, cls: null, note: 'target was null' };
  if (t === undefined) return { kind: 'undefined', tag: null, id: null, cls: null, note: 'target was undefined' };
  const type = typeof t;
  if (type !== 'object' && type !== 'function') {
    return { kind: 'primitive', primitiveType: type, tag: null, id: null, cls: null, value: safe(() => String(t)) };
  }
  const nodeType = safe(() => t.nodeType, null);
  const isWindow = safe(() => t.window === t, false) === true
    || (nodeType === null && safe(() => typeof t.document, 'undefined') === 'object' && safe(() => typeof t.location, 'undefined') === 'object');
  if (isWindow) {
    return {
      kind: 'window', tag: null, id: null, cls: null,
      href: safe(() => String(t.location && t.location.href), null),
      innerWidth: safe(() => t.innerWidth, null), innerHeight: safe(() => t.innerHeight, null)
    };
  }
  if (nodeType === 9) {
    return {
      kind: 'document', tag: null, id: null, cls: null,
      title: safe(() => String(t.title), null),
      visibilityState: safe(() => String(t.visibilityState), null),
      readyState: safe(() => String(t.readyState), null)
    };
  }
  const rawTag = safe(() => t.tagName, null);
  if (typeof rawTag === 'string') {
    return {
      kind: nodeType === 1 ? 'element' : 'element-like',
      tag: rawTag.toLowerCase(),
      id: safe(() => (t.id ? String(t.id) : null), null),
      cls: safe(() => (t.className === undefined || t.className === null ? null : String(t.className).slice(0, 80)), null),
      nodeType: nodeType === null ? null : nodeType
    };
  }
  if (nodeType === 3) return { kind: 'text-node', tag: null, id: null, cls: null };
  if (nodeType !== null) return { kind: 'node', tag: null, id: null, cls: null, nodeType };
  const ctor = safe(() => (t.constructor && t.constructor.name ? String(t.constructor.name) : null), null);
  return { kind: 'object', tag: null, id: null, cls: null, constructorName: ctor };
}

/**
 * Normalise ONE recorded click observation into a stable, JSON-safe record.
 * Every field is "unmeasured" (null) rather than guessed when the browser did
 * not expose it; nothing is inferred from another field.
 */
export function summariseClickObservation(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const bool = (v) => (typeof v === 'boolean' ? v : null);
  const str = (v) => (typeof v === 'string' ? v : null);
  return {
    at: str(r.at),
    type: str(r.type),
    phase: str(r.phase),
    isTrusted: bool(r.isTrusted),
    pointerType: str(r.pointerType),
    pointerId: num(r.pointerId),
    buttons: num(r.buttons),
    detail: num(r.detail),
    sourceCapabilities: r.sourceCapabilities && typeof r.sourceCapabilities === 'object'
      ? { firesTouchEvents: bool(r.sourceCapabilities.firesTouchEvents) }
      : (r.sourceCapabilities === null ? { firesTouchEvents: null } : null),
    target: r.target === undefined ? describeEventTarget(undefined) : r.target,
    currentTarget: r.currentTarget === undefined ? describeEventTarget(undefined) : r.currentTarget,
    observerError: str(r.observerError)
  };
}

/**
 * Verdict over a completed passive observation record. PURELY DESCRIPTIVE: it
 * classifies what WAS captured and what stayed unmeasured. It gates nothing and
 * it never claims a cause.
 */
export function entryObservationVerdict(obs) {
  const o = obs && typeof obs === 'object' ? obs : {};
  const clicks = Array.isArray(o.clicks) ? o.clicks : [];
  const lockChanges = Array.isArray(o.pointerLockChanges) ? o.pointerLockChanges : [];
  const lockErrors = Array.isArray(o.pointerLockErrors) ? o.pointerLockErrors : [];
  const consoleWarnings = Array.isArray(o.consoleWarnings) ? o.consoleWarnings : [];
  const consoleErrors = Array.isArray(o.consoleErrors) ? o.consoleErrors : [];
  const pageErrors = Array.isArray(o.pageErrors) ? o.pageErrors : [];
  const observerErrors = clicks.filter((c) => c && typeof c.observerError === 'string' && c.observerError.length > 0);
  const trusted = clicks.filter((c) => c && c.isTrusted === true);
  const untrusted = clicks.filter((c) => c && c.isTrusted === false);
  const unmeasured = [];
  if (clicks.length === 0) unmeasured.push('no click event reached the passive observer: pointerType/isTrusted/sourceCapabilities are UNMEASURED');
  else {
    if (clicks.every((c) => !c || c.pointerType === null)) unmeasured.push('pointerType was not exposed on any observed click');
    if (clicks.every((c) => !c || !c.sourceCapabilities || c.sourceCapabilities.firesTouchEvents === null)) {
      unmeasured.push('sourceCapabilities.firesTouchEvents was not exposed on any observed click');
    }
  }
  if (lockChanges.length === 0 && lockErrors.length === 0) unmeasured.push('neither pointerlockchange nor pointerlockerror was observed');
  if (o.focusState === undefined || o.focusState === null) unmeasured.push('focus state was not sampled');
  if (o.touchState === undefined || o.touchState === null) unmeasured.push('touch state was not sampled');
  return {
    clickCount: clicks.length,
    trustedClickCount: trusted.length,
    untrustedClickCount: untrusted.length,
    pointerLockChangeCount: lockChanges.length,
    pointerLockErrorCount: lockErrors.length,
    consoleWarningCount: consoleWarnings.length,
    consoleErrorCount: consoleErrors.length,
    pageErrorCount: pageErrors.length,
    observerErrorCount: observerErrors.length,
    observerClean: observerErrors.length === 0 && pageErrors.length === 0,
    unmeasured,
    note: 'Passive observation only. No cause is claimed; an absent record means UNMEASURED, never "did not happen".'
  };
}

/**
 * Page-side observer body, as SOURCE, to be injected with the exact
 * describeEventTarget bytes above. It installs capture-phase, passive listeners
 * on window and document and publishes them on a private namespace. It requests
 * nothing, cancels nothing (`passive: true`, no preventDefault), forces no
 * click, and never calls requestPointerLock.
 */
export function entryObserverSource(namespace = '__arrivalEntryObservation') {
  const ns = String(namespace).replace(/[^A-Za-z0-9_$]/g, '');
  return `(() => {
  ${describeEventTarget.toString()}
  if (window.${ns} && window.${ns}.installed) return { installed: true, alreadyInstalled: true };
  const bag = {
    installed: true, alreadyInstalled: false, installedAt: new Date().toISOString(),
    clicks: [], pointerLockChanges: [], pointerLockErrors: []
  };
  const safe = (fn, fb = null) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const onClick = (phase) => (ev) => {
    let rec;
    try {
      rec = {
        at: new Date().toISOString(), type: safe(() => String(ev.type)), phase,
        isTrusted: safe(() => (typeof ev.isTrusted === 'boolean' ? ev.isTrusted : null)),
        pointerType: safe(() => (typeof ev.pointerType === 'string' ? ev.pointerType : null)),
        pointerId: safe(() => (typeof ev.pointerId === 'number' ? ev.pointerId : null)),
        buttons: safe(() => (typeof ev.buttons === 'number' ? ev.buttons : null)),
        detail: safe(() => (typeof ev.detail === 'number' ? ev.detail : null)),
        sourceCapabilities: safe(() => (ev.sourceCapabilities
          ? { firesTouchEvents: (typeof ev.sourceCapabilities.firesTouchEvents === 'boolean' ? ev.sourceCapabilities.firesTouchEvents : null) }
          : null)),
        target: describeEventTarget(safe(() => ev.target, null)),
        currentTarget: describeEventTarget(safe(() => ev.currentTarget, null)),
        pointerLockElement: describeEventTarget(safe(() => document.pointerLockElement, null)),
        observerError: null
      };
    } catch (e) {
      rec = { at: new Date().toISOString(), type: 'click', phase, isTrusted: null, pointerType: null,
        pointerId: null, buttons: null, detail: null, sourceCapabilities: null,
        target: describeEventTarget(null), currentTarget: describeEventTarget(null),
        observerError: String((e && e.message) || e) };
    }
    bag.clicks.push(rec);
  };
  window.addEventListener('click', onClick('window-capture'), { capture: true, passive: true });
  document.addEventListener('click', onClick('document-capture'), { capture: true, passive: true });
  document.addEventListener('pointerlockchange', () => {
    bag.pointerLockChanges.push({ at: new Date().toISOString(), element: describeEventTarget(safe(() => document.pointerLockElement, null)) });
  }, { passive: true });
  document.addEventListener('pointerlockerror', (ev) => {
    bag.pointerLockErrors.push({ at: new Date().toISOString(), type: safe(() => String(ev.type), 'pointerlockerror'),
      target: describeEventTarget(safe(() => ev.target, null)) });
  }, { passive: true });
  window.${ns} = bag;
  return { installed: true, alreadyInstalled: false };
})()`;
}

/** Page-side reader source: returns the collected bag plus focus/touch/policy state. */
export function entryObserverReadSource(namespace = '__arrivalEntryObservation') {
  const ns = String(namespace).replace(/[^A-Za-z0-9_$]/g, '');
  return `(() => {
  ${describeEventTarget.toString()}
  const safe = (fn, fb = null) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const bag = window.${ns} || null;
  return {
    installed: !!bag,
    clicks: bag ? bag.clicks.slice() : [],
    pointerLockChanges: bag ? bag.pointerLockChanges.slice() : [],
    pointerLockErrors: bag ? bag.pointerLockErrors.slice() : [],
    focusState: {
      hasFocus: safe(() => document.hasFocus()),
      visibilityState: safe(() => String(document.visibilityState)),
      activeElement: describeEventTarget(safe(() => document.activeElement, null)),
      pointerLockElement: describeEventTarget(safe(() => document.pointerLockElement, null)),
      userActivationIsActive: safe(() => (navigator.userActivation ? navigator.userActivation.isActive : null)),
      userActivationHasBeenActive: safe(() => (navigator.userActivation ? navigator.userActivation.hasBeenActive : null))
    },
    touchState: {
      maxTouchPoints: safe(() => navigator.maxTouchPoints),
      ontouchstartInWindow: safe(() => ('ontouchstart' in window)),
      innerWidth: safe(() => window.innerWidth),
      pointerCoarse: safe(() => (window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : null)),
      pointerFine: safe(() => (window.matchMedia ? window.matchMedia('(pointer: fine)').matches : null)),
      hoverNone: safe(() => (window.matchMedia ? window.matchMedia('(hover: none)').matches : null)),
      touchJoystickMounted: safe(() => !!document.querySelector('[data-testid="touch-joystick"]')),
      touchElementCount: safe(() => document.querySelectorAll('[data-testid^="touch-"]').length)
    },
    policyState: {
      inputPolicy: safe(() => (window.__storyInputPolicy
        ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode }
        : null)),
      permissionsApiPresent: safe(() => !!(navigator.permissions && navigator.permissions.query)),
      documentPointerLockElementPresent: safe(() => !!document.pointerLockElement)
    }
  };
})()`;
}

/**
 * Attach passive page-level console/pageerror capture to a Playwright page and
 * return the accumulating sinks. Bounded by `max` so a chatty page cannot grow
 * the report without limit; the overflow count is reported, never dropped
 * silently. No page behaviour is altered.
 */
export function attachPassivePageSinks(page, { max = 400 } = {}) {
  const sinks = {
    consoleWarnings: [], consoleErrors: [], consoleAll: [], pageErrors: [],
    dropped: { consoleAll: 0, consoleWarnings: 0, consoleErrors: 0, pageErrors: 0 }
  };
  const push = (arr, key, rec) => { if (arr.length < max) arr.push(rec); else sinks.dropped[key] += 1; };
  if (!page || typeof page.on !== 'function') return sinks;
  page.on('console', (msg) => {
    let rec;
    try { rec = { at: new Date().toISOString(), type: String(msg.type()), text: String(msg.text()).slice(0, 600) }; }
    catch (e) { rec = { at: new Date().toISOString(), type: 'unreadable', text: String((e && e.message) || e) }; }
    push(sinks.consoleAll, 'consoleAll', rec);
    if (rec.type === 'warning' || rec.type === 'warn') push(sinks.consoleWarnings, 'consoleWarnings', rec);
    if (rec.type === 'error') push(sinks.consoleErrors, 'consoleErrors', rec);
  });
  page.on('pageerror', (err) => {
    push(sinks.pageErrors, 'pageErrors', {
      at: new Date().toISOString(),
      message: String((err && err.message) || err).slice(0, 600),
      stack: String((err && err.stack) || '').slice(0, 900)
    });
  });
  return sinks;
}
