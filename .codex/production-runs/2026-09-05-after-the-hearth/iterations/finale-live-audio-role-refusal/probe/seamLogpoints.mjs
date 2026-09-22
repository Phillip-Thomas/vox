/**
 * FINALE-AUTHORITY-SEAM logpoint specs, rewritten to authority-pins-corrected.json
 * plus executable-resolved token pins (Qwe/hwe/LKA) derived from candidate-pins
 * declarations (declCol + len("function NAME(params){")), verified against the
 * pinned bundle bytes.
 *
 * Every condition is a non-pausing CDP conditional breakpoint: it ends in `,!1`
 * and is wrapped in try/catch so a TDZ / undeclared-identifier throw can never
 * pause gameplay. Conditions only READ module locals and APPEND to an isolated
 * probe-owned global (globalThis.__seamProbe). No assignment to game state, no
 * setter/AudioParam monkeypatching, no forced story/pause flags.
 */
export const BUNDLE_SHA256 = '68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b';
export const BUNDLE_URL_SUFFIX = '/assets/index-C1X65dZp.js';

/** Executable-resolved token pins (not in authority-pins-corrected.json). */
export const EXTRA_PINS = Object.freeze({
  BEGIN_Qwe:    { line0: 7839, column0: 190104, statement: 'return A.restoredCompletion||A.audioUnavailable...', note: 'token creation entry; e=beat, A=options' },
  DEADLINE_hwe: { line0: 7839, column0: 190317, statement: 'const A=EI.finalTexture;', note: 'deadline tick entry; A is TDZ at pin, read EI.finalTexture' },
  RELEASE_LKA:  { line0: 7839, column0: 190403, statement: 'const e=EI.finalTexture;', note: 'release entry; e is TDZ at pin, read EI.finalTexture' },
});

/**
 * Probe-owned sink. Bounded, but NEVER silently truncated: once the cap is hit
 * every further hit increments droppedByCap and per-key drop counters that are
 * emitted in the harvest. Numeric-only pulse discipline: no DOM, no game write.
 */
export const SINK_SOURCE = `(()=>{if(globalThis.__seamProbe)return{installed:true,already:true};
const ev=[],seen=Object.create(null),dropped=Object.create(null),skipped=Object.create(null);let capDrop=0,skipTotal=0,errs=0;
globalThis.__seamProbe={v:2,cap:4000,
 rec(k,o){try{
   if(ev.length>=this.cap){capDrop++;dropped[k]=(dropped[k]||0)+1;return!1}
   o=o||{};o.k=k;o.mono=performance.now();o.wall=Date.now();o.seq=ev.length;
   o.first=!seen[k];seen[k]=(seen[k]||0)+1;ev.push(o)
 }catch(_){errs++}return!1},
 /** sparse gate: keep FIRST live hit of a pin, or near-deadline observations.
  *  NOTE: lifecycle keys (begin/release/cancel/authority/mood) are ALWAYS kept
  *  by their callers and never routed through this age rule. */
 sparse(k,ageS){try{
   if(!seen[k])return!0;
   return typeof ageS==='number'&&ageS>=4.8
 }catch(_){errs++;return!0}},
 /** counted skip: increments a per-key counter WITHOUT appending an event, so
  *  the 4000 cap is never consumed by the skip bookkeeping itself. */
 skip(k){try{skipped[k]=(skipped[k]||0)+1;skipTotal++}catch(_){errs++}return!1},
 err(){errs++;return!1},
 stats(){return{count:ev.length,cap:this.cap,capDrop,dropped:Object.assign({},dropped),
   skipTotal,skipped:Object.assign({},skipped),
   seen:Object.assign({},seen),evaluationErrors:errs}},
 drain(){return{ev:ev.slice(),stats:this.stats()}}};
return{installed:true,already:false}})()`;

/** Wrap: safe, non-pausing, error-counted. */
const R = (k, fields) =>
  `(()=>{try{return globalThis.__seamProbe.rec(${JSON.stringify(k)},{${fields}})}` +
  `catch(_){try{globalThis.__seamProbe.err()}catch(__){}return!1}})(),!1`;

/** Sparse variant: only first-live or age>=4.8s; drops are counted, not silent. */
const RS = (k, ageExpr, fields) =>
  `(()=>{try{var __a=(${ageExpr});` +
  `if(!globalThis.__seamProbe.sparse(${JSON.stringify(k)},__a))` +
  `{return globalThis.__seamProbe.skip(${JSON.stringify(k)}),!1}` +
  `return globalThis.__seamProbe.rec(${JSON.stringify(k)},{${fields}})}` +
  `catch(_){try{globalThis.__seamProbe.err()}catch(__){}return!1}})(),!1`;

export const LOGPOINTS = Object.freeze([
  // ---- token lifecycle (always retained; never age-filtered) ----
  { id: 'begin', pinRef: 'BEGIN_Qwe', extra: true,
    condition: R('begin',
      'beat:e,restored:!!(A&&A.restoredCompletion),audioUnavailable:!!(A&&A.audioUnavailable),' +
      'alreadyLive:!!EI.finalTexture,prevStartedAtMs:EI.finalTexture?EI.finalTexture.startedAtMs:null,' +
      'cap:Bwe,beatSel:EI.beat,moodSel:EI.mood') },

  // deadline tick is per-frame -> SPARSE (first live + age>=4.8s only).
  { id: 'deadline', pinRef: 'DEADLINE_hwe', extra: true,
    condition: RS('deadline',
      'EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null',
      'has:!!EI.finalTexture,startedAtMs:EI.finalTexture?EI.finalTexture.startedAtMs:null,' +
      'ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,cap:Bwe,' +
      'deadlineAtMs:EI.finalTexture?EI.finalTexture.startedAtMs+5000:null,' +
      'willRelease:!!(EI.finalTexture&&vKA(EI.finalTexture.startedAtMs)>=Bwe)') },

  { id: 'release', pinRef: 'RELEASE_LKA', extra: true,
    condition: R('release',
      'startedAtMs:EI.finalTexture?EI.finalTexture.startedAtMs:null,' +
      'beat:EI.finalTexture?EI.finalTexture.beat:null,' +
      'ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,' +
      'deadlineAtMs:EI.finalTexture?EI.finalTexture.startedAtMs+5000:null,' +
      'overshootMs:EI.finalTexture?(vKA(EI.finalTexture.startedAtMs)*1000-5000):null,' +
      'beatBefore:EI.beat,moodBefore:EI.mood') },

  // cancel: raw reason arg IS observable at entry even though never persisted.
  // NOT age-gated -- a ~1s Escape cancellation must never be filtered by 4.8s.
  { id: 'cancel', pinRef: 'CANCEL_ngA_ENTRY',
    condition: R('cancel',
      'reasonArg:(typeof e===\'string\'?e:(e==null?null:String(e))),reasonArgObservable:true,' +
      'live:!!EI.finalTexture,startedAtMs:EI.finalTexture?EI.finalTexture.startedAtMs:null,' +
      'ageS:EI.finalTexture?vKA(EI.finalTexture.startedAtMs):null,' +
      'willRelease:!!EI.finalTexture') },

  // ---- audio authority chain (always retained) ----
  { id: 'mood-entry', pinRef: 'MOOD_LY_ENTRY',
    condition: R('mood-entry',
      'nextMood:(e==null?null:String(e)),wasLeading:!Ka,idleBefore:Ka') },

  { id: 'mood-ctx', pinRef: 'MOOD_LY_CTX',
    condition: R('mood-ctx',
      'built:!!jZ,ctxPresent:!!WI,ctxState:(WI?WI.state:null),' +
      'ctxCurrentTime:(WI?WI.currentTime:null),idleNow:Ka') },

  { id: 'mood-calls-mma', pinRef: 'MOOD_LY_CALLS_mMA',
    condition: R('mood-calls-mma',
      'wasLeading:t,nowLeading:!Ka,idleNow:Ka,transition:(t!==!Ka),' +
      'noop:(t===!Ka),atTime:(i?i.currentTime:null),ctxState:(i?i.state:null)') },

  { id: 'authority-entry', pinRef: 'AUTHORITY_START_mMA_ENTRY',
    condition: R('authority-entry',
      'storyLeads:e,atTime:A,crossfadeS:XF,masterPresent:!!na,masterLevel:ZZ,' +
      'isRelease:(e===!1),targetGain:(e?ZZ:0),fadeEndAt:(A+XF)') },

  { id: 'authority-tail', pinRef: 'AUTHORITY_END_mMA_TAIL',
    condition: R('authority-tail',
      'prevFadeUntil:(typeof fMA===\'number\'?fMA:null),newFadeUntil:(A+XF),' +
      'atTime:A,crossfadeS:XF,storyLeads:e') },

  { id: 'bed-callback', pinRef: 'AUTHORITY_BEDCB_Gq',
    condition: R('bed-callback',
      'bedCallbackPresent:(Gq!=null),bedCallbackInvoked:(Gq!=null),' +
      'storyLeads:e,atTime:A,durationS:XF,bedEndAt:(A+XF)') },
]);

/**
 * Fields that genuinely CANNOT be observed at these pins. Never alias them.
 */
export const KNOWN_UNOBSERVABLE = Object.freeze({
  tokenId: 'No token id exists in source. Stable identity = startedAtMs (monotonic KKA() at creation).',
  cancelReasonPersisted:
    'ngA(e) discards its argument; the pin records the RAW entry parameter only. ' +
    'A recorded reasonArg is the caller argument, not a stored token field.',
  bedAutomationEndpoints:
    'Gq is a callback reference; the pin proves INVOCATION and its (storyLeads,atTime,4.5s) ' +
    'arguments. The bed callback body is a separate function and is NOT pinned, so the ' +
    'realised bed AudioParam endpoints are not directly measured here.',
  pcmAlignment:
    'Owned-sink WAV start is not proven to coincide with the recorder wall start; no PCM/event ' +
    'alignment or audible claim may be derived from these events.',
});

export const PERTURBATION_LIMITS = Object.freeze({
  deoptimization:
    'Setting a CDP breakpoint on a minified function forces V8 to deoptimize and reparse that ' +
    'function; LY/mMA/hwe run slower than in an uninstrumented build. Per-frame deadline ' +
    'observations therefore carry an unquantified positive timing bias. Do not report a ' +
    'sub-frame overshoot as exact.',
  nonPausing: 'All conditions terminate in ,!1 so the debugger never pauses; no gameplay stall.',
  readOnly: 'No game state assignment, no setter or AudioParam wrapping, no forced pause flag.',
});
