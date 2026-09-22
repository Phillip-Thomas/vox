/**
 * FINALE-AUTHORITY-SEAM logpoint specs. PREPARED, NOT RUN.
 * Passive CDP conditional breakpoints: every condition ends in `,!1` so the
 * debugger NEVER pauses gameplay. Conditions only READ game state and APPEND to
 * an isolated probe-owned global (globalThis.__seamProbe). No assignment to game
 * state, no monkeypatch, no AudioParam wrap, no forced story/action/pose.
 * Locals below are the minified names resolved offline from
 * assets/index-C1X65dZp.js sha256 68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b.
 */
export const BUNDLE_SHA256 = '68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b';
export const BUNDLE_URL_SUFFIX = '/assets/index-C1X65dZp.js';
/** Probe sink bootstrap; installed via Page.addScriptToEvaluateOnNewDocument. */
export const SINK_SOURCE = `(()=>{if(globalThis.__seamProbe)return;const ev=[];
globalThis.__seamProbe={v:1,ev,cap:4000,
 rec(k,o){if(ev.length>=this.cap)return!1;o=o||{};o.k=k;o.mono=performance.now();o.wall=Date.now();ev.push(o);return!1},
 drain(){return ev.slice()}};})()`;
/** e()=>expression evaluated in the paused-frame scope, always falsy. */
const R = (k, fields) => `globalThis.__seamProbe&&globalThis.__seamProbe.rec(${JSON.stringify(k)},{${fields}}),!1`;
export const LOGPOINTS = Object.freeze([
  { id: 'begin', pinRef: 'BEGIN_Qwe',
    condition: R('begin', 'beat:e,restored:A&&A.restoredCompletion,audioUnavailable:A&&A.audioUnavailable,alreadyLive:!!EI.finalTexture,startedAtMs:EI.finalTexture&&EI.finalTexture.startedAtMs') },
  { id: 'deadline-check', pinRef: 'DEADLINE_hwe',
    condition: R('deadline-check', 'has:!!EI.finalTexture,startedAtMs:EI.finalTexture&&EI.finalTexture.startedAtMs,ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,cap:Bwe,willRelease:!!(EI.finalTexture&&vKA(EI.finalTexture.startedAtMs)>=Bwe)') },
  { id: 'release', pinRef: 'RELEASE_LKA',
    condition: R('release', 'startedAtMs:EI.finalTexture&&EI.finalTexture.startedAtMs,beat:EI.finalTexture&&EI.finalTexture.beat,ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,beatBefore:EI.beat,moodBefore:EI.mood') },
  { id: 'cancel', pinRef: 'CANCEL_ngA',
    condition: R('cancel', 'live:!!EI.finalTexture,startedAtMs:EI.finalTexture&&EI.finalTexture.startedAtMs,ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,reasonArgObservable:false') },
  { id: 'clear-beat', pinRef: 'CLEARBEAT_B4',
    condition: R('clear-beat', 'arg:e,selectedBefore:IQ&&IQ.beat,leadingBefore:c4,noop:!(IQ&&(!e||IQ.beat===e))') },
  { id: 'authority', pinRef: 'AUTHORITY_E4',
    condition: R('authority', 'arg:e,leadingBefore:c4,isRelease:!e,noop:c4===e') },
]);
/** Fields that CANNOT be observed at these pins; never alias them. */
export const KNOWN_UNOBSERVABLE = Object.freeze({
  cancelReason: 'ngA(e) discards its argument before any observable use; at the pin the reason is the raw param `e`, but source shows it is never stored. Recorded as reasonArgObservable:false rather than a fabricated reason.',
  tokenId: 'No token id exists. Stable identity = captured startedAtMs (monotonic performance.now at creation).',
  scheduleStoryAuthorityAtTime: '$Z() takes no arguments at the E4(null) callsite; atTime/4.5s endpoints are internal and NOT pinned offline. Must not be reported as measured.',
  audioContextState: 'context.running/currentTime are not in scope at any pin above; they require a separate read-only evaluation, not a logpoint alias.',
});
export const PERTURBATION_LIMITS = Object.freeze({
  mechanism: 'CDP conditional breakpoints force deoptimization of the pinned functions and add per-hit condition-eval cost in the main thread.',
  pauseRisk: 'None by construction: every condition terminates in `,!1`. A throwing condition would, however, pause; all conditions are null-guarded.',
  timingBias: 'Recorded mono is taken INSIDE the condition, after the debugger reaches the pin: it is an upper bound on the true callsite time, not exact.',
  capping: 'Sink is capped at 4000 events and drops silently past the cap; drops must be reported, never interpolated.',
  audioNote: 'No AudioParam/AudioContext is touched; release tail vs live interval must be distinguished from event ordering only.',
});
