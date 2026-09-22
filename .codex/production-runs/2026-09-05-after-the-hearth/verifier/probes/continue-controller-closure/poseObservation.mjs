/**
 * PER-WORLD PLAYER-POSE BYTE RETENTION + CDP DOMStorage OBSERVATION
 * (PREPARED, NEVER YET RUN).
 *
 * WHAT WAS MISSING
 * ----------------
 * The shipped player pose does NOT live inside the WorldSave blob. persistence.ts
 * savePlayerPose/loadPlayerPose write and read a SEPARATE per-world key
 * `<prefix>.world.<worldId>.player` holding { pos, forward, pitch }.
 * earned-1 listed that key and its byte LENGTH (171) in
 * phases.save.beforeNavigation.keys and never retained its CONTENTS. So the one
 * question that matters — what position was actually saved, and what did the
 * Continue boot read back — has no evidence at all in that capture.
 *
 * WHAT THIS MODULE ADDS
 * ---------------------
 *  1. Verbatim retention of every `.player` key's raw bytes plus a sha256, at
 *     four points: pre-navigation, post-beforeunload/menu boot, after the real
 *     Continue click, and at any later point the caller samples.
 *  2. A PASSIVE CDP DOMStorage observation across the REAL navigation. CDP
 *     `DOMStorage.enable` emits domStorageItemAdded / domStorageItemUpdated /
 *     domStorageItemRemoved with old and new values, from the browser side. It
 *     needs no page script and CHANGES NO GAME VALUE, so the question
 *     "did the shipped save write this, or did an early menu-boot cleanup
 *     overwrite it?" is answered by ordered, timestamped events rather than by
 *     a monkeypatched localStorage.setItem.
 *  3. If DOMStorage is unavailable on this Chromium/Playwright pairing, the
 *     module records the failure and marks the observation GAP. It NEVER falls
 *     back to patching the page's storage.
 *
 * Nothing here writes to localStorage, and nothing here interprets a pose.
 */
import { createHash } from 'node:crypto';

export const POSE_KEY_RE = /^pvx\.v1\.world\..+\.player$/;
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Every `.player` key currently in localStorage, with RAW BYTES retained. */
export const readPoseKeys = (page) => page.evaluate(() => {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!/\.player$/.test(k)) continue;
    out.push({ key: k, raw: localStorage.getItem(k) ?? '' });
  }
  return out;
});

/**
 * One labelled pose sample: raw bytes, sha, byte length and — if it parses —
 * the shipped PlayerPose fields verbatim. A parse failure is retained, not
 * swallowed.
 */
export async function samplePoses(page, label) {
  const rows = await readPoseKeys(page);
  return {
    label,
    at: new Date().toISOString(),
    count: rows.length,
    poses: rows.map(({ key, raw }) => {
      let parsed = null; let parseError = null;
      try { parsed = JSON.parse(raw); } catch (e) { parseError = String(e && e.message ? e.message : e); }
      return {
        key,
        bytes: raw.length,
        sha256: sha(raw),
        raw,                       // VERBATIM — this is the evidence earned-1 lacked
        pos: parsed?.pos ?? null,
        forward: parsed?.forward ?? null,
        pitch: parsed?.pitch ?? null,
        parseError
      };
    })
  };
}

/** Compare two pose samples by key, byte-exactly. No tolerance, no rounding. */
export function posesDiff(before, after) {
  const b = new Map((before?.poses ?? []).map((p) => [p.key, p]));
  const a = new Map((after?.poses ?? []).map((p) => [p.key, p]));
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort();
  return keys.map((key) => {
    const x = b.get(key); const y = a.get(key);
    return {
      key,
      presentBefore: !!x,
      presentAfter: !!y,
      shaBefore: x?.sha256 ?? null,
      shaAfter: y?.sha256 ?? null,
      byteIdentical: !!x && !!y && x.sha256 === y.sha256,
      posBefore: x?.pos ?? null,
      posAfter: y?.pos ?? null,
      changed: !x || !y || x.sha256 !== y.sha256
    };
  });
}

/**
 * Attach a PASSIVE CDP DOMStorage recorder. Returns a handle whose `events`
 * array fills in browser order. `available:false` with a retained `error` means
 * the observation is a declared GAP for this run — never silently absent, and
 * never replaced by a page-side patch.
 */
export async function attachDomStorageObserver(page, { say = () => {} } = {}) {
  const events = [];
  let client = null;
  let available = false;
  let error = null;
  try {
    client = await page.context().newCDPSession(page);
    await client.send('DOMStorage.enable');
    const push = (kind) => (e) => {
      events.push({
        atWall: new Date().toISOString(),
        atMs: Date.now(),
        kind,
        isLocalStorage: e?.storageId?.isLocalStorage ?? null,
        securityOrigin: e?.storageId?.securityOrigin ?? e?.storageId?.storageKey ?? null,
        key: e?.key ?? null,
        oldValue: e?.oldValue ?? null,
        newValue: e?.newValue ?? null,
        isPoseKey: e?.key ? POSE_KEY_RE.test(e.key) : false
      });
    };
    client.on('DOMStorage.domStorageItemAdded', push('added'));
    client.on('DOMStorage.domStorageItemUpdated', push('updated'));
    client.on('DOMStorage.domStorageItemRemoved', push('removed'));
    client.on('DOMStorage.domStorageItemsCleared', push('cleared'));
    available = true;
    say('CDP DOMStorage observer attached (passive: reads events only, writes nothing)');
  } catch (e) {
    error = String(e && e.message ? e.message : e);
    say(`CDP DOMStorage observer UNAVAILABLE — retained as an observation gap: ${error}`);
  }
  return {
    available,
    error,
    events,
    /** Marks a phase boundary in the same ordered stream. */
    mark(label) { events.push({ atWall: new Date().toISOString(), atMs: Date.now(), kind: 'probe-mark', label }); },
    async detach() {
      if (!client) return { detached: false, reason: 'never-attached' };
      try { await client.send('DOMStorage.disable'); await client.detach(); return { detached: true }; } catch (e) {
        return { detached: false, reason: String(e && e.message ? e.message : e) };
      }
    }
  };
}

/**
 * Order the pose-key writes between two probe marks so a SHIPPED SAVE write can
 * be told apart from an EARLY MENU-BOOT OVERWRITE. This classifies by WHEN the
 * write landed relative to marks the probe itself placed; it does not guess at
 * a cause, and `undetermined` is a legitimate, retained outcome.
 */
export function classifyPoseWrites(events, { saveMark, menuBootMark, continueMark } = {}) {
  const idx = (label) => events.findIndex((e) => e.kind === 'probe-mark' && e.label === label);
  const iSave = idx(saveMark);
  const iMenu = idx(menuBootMark);
  const iCont = idx(continueMark);
  const writes = events
    .map((e, i) => ({ ...e, i }))
    .filter((e) => e.isPoseKey && e.kind !== 'probe-mark');
  const windowOf = (i) => {
    if (iSave >= 0 && i > iSave && (iMenu < 0 || i < iMenu)) return 'shipped-save (beforeunload/navigation)';
    if (iMenu >= 0 && i > iMenu && (iCont < 0 || i < iCont)) return 'menu-boot BEFORE the Continue click';
    if (iCont >= 0 && i > iCont) return 'after the real Continue click';
    if (i < iSave || iSave < 0) return 'before the save mark';
    return 'undetermined';
  };
  const classified = writes.map((w) => ({
    key: w.key, kind: w.kind, atWall: w.atWall,
    oldValue: w.oldValue, newValue: w.newValue,
    window: windowOf(w.i),
    valueChanged: w.oldValue !== w.newValue
  }));
  return {
    marksFound: { save: iSave >= 0, menuBoot: iMenu >= 0, continue: iCont >= 0 },
    poseWriteCount: classified.length,
    writes: classified,
    overwriteBeforeContinue: classified.some((c) => c.window === 'menu-boot BEFORE the Continue click' && c.valueChanged),
    note: 'Windows are named from probe-placed marks in the SAME ordered CDP stream. A write inside the menu-boot window with a changed value is the early-overwrite signature App.tsx\'s autosave-effect cleanup doSave(false) -> savePlayerPose(world) could produce; this records the observation and asserts no cause.'
  };
}

/**
 * The saved-pose validation branch in EfficientScene.tsx is NOT observable from
 * outside: `isDryClearResumePosition` -> `findValidSpawnSite` ->
 * `arrivalPose.playerSurfacePosition` all run inside one useState initialiser
 * and publish no marker. This turns the retained bytes plus the observed spawn
 * into the three DISTINGUISHABLE outcomes, and leaves the branch itself as a
 * declared gap.
 */
export function spawnVsSavedPose({ savedPose = null, observedBodyPose = null, arrivalFallbackPose = null, toleranceUnits = 0.75 } = {}) {
  const d = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null);
  const dSaved = d(savedPose, observedBodyPose);
  const dFallback = d(arrivalFallbackPose, observedBodyPose);
  let outcome = 'undetermined';
  if (dSaved != null && dSaved <= toleranceUnits) outcome = 'resumed-at-saved-pose';
  else if (dFallback != null && dFallback <= toleranceUnits) outcome = 'resumed-at-arrival-fallback';
  else if (dSaved != null) outcome = 'resumed-at-neither (unexplained spawn)';
  return {
    savedPose, observedBodyPose, arrivalFallbackPose,
    distanceFromSavedPose: dSaved,
    distanceFromArrivalFallback: dFallback,
    toleranceUnits,
    outcome,
    branchObserved: false,
    gap: 'EfficientScene.tsx does not publish which of resumeIsSafe / findValidSpawnSite / arrivalPose produced the spawn. Only the resulting position is measurable here, and no source change is proposed by this probe.'
  };
}
