#!/usr/bin/env node
/**
 * Chapter manual / recovery / Continue evidence transport.
 *
 * This transport proves *ordinary play*: every input it delivers is a real
 * keyboard or mouse event a player could produce, and every observation is a
 * passive read of `window.__paravoxiaJourneyProbe.snapshot()`. There is no
 * state injection, no debug setter, no teleport, and no config-supplied
 * script: the only page function this file ever evaluates is the fixed
 * read-only reader defined below. A chapter config may therefore describe
 * *what* to press and *what to wait for*, never *what to become*.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireThat, sha } from './contract.mjs';
import { inside, readJson, writeJson, reference } from './store.mjs';
import { mediaRequested, openOwnedSink, closeOwnedSink, readOwnership, startAudioRecorder, stopChild,
  decodeControlMedia, controlMediaProof, mediaProblems, mediaTimeline, audibleLaunchArgs, audibleLaunchEnv,
  recordedSeconds, MIN_AUDIO_SECONDS, PAUSED_HOLD_MS, FINAL_TAIL_MS, CLOCK_NOTE } from './control-media.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KINDS = new Set(['manual', 'recovery', 'continue']);
const MAX_STEPS = 64;
const MAX_WAIT_MS = 30_000;
const MAX_HOLD_MS = 5_000;
const MAX_SESSION_SECONDS = 900;
const POLL_MS = 100;

/** Config keys that would turn a declarative action list into a cheat console. */
const FORBIDDEN_KEYS = new Set(['evaluate', 'eval', 'script', 'scripts', 'addinitscript', 'initscript',
  'exposefunction', 'state', 'setstate', 'inject', 'injectstate', 'storage', 'localstorage', 'teleport',
  'setpose', 'debug', 'debugsetter', 'cheat', 'grantmilestone', 'setmilestone', 'route', 'function']);
const ACTION_TYPES = new Set(['key', 'press', 'text', 'click', 'move', 'wait', 'waitSelector', 'settle', 'walk']);
/** Bounded generic walk: ordinary held movement keys steered from a read-only pose. */
const MAX_WALK_MS = MAX_WAIT_MS;
const WALK_DEFAULTS = { forwardKey: 'KeyW', leftKey: 'KeyA', rightKey: 'KeyD', backKey: 'KeyS',
  arriveWithin: 3, noProgressMs: 4_000, minProgress: 0.25, tickMs: 200 };
/** Ordinary keys only: no OS/browser-level chords that would leave the game. */
const KEY_PATTERN = /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Escape|Enter|Space|Tab|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|F[1-9]|F1[0-2]|Backspace|Minus|Equal|Comma|Period|Slash)$/;

export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortDeep(value[key])]));
  }
  return value;
}
export const canonical = value => JSON.stringify(sortDeep(value));

/** RFC 6901 JSON pointer read. Read-only by construction: it only descends. */
export function pointer(document, jsonPointer) {
  requireThat(typeof jsonPointer === 'string' && (jsonPointer === '' || jsonPointer.startsWith('/')),
    `Invalid JSON pointer: ${String(jsonPointer)}`);
  if (jsonPointer === '') return document;
  let node = document;
  for (const raw of jsonPointer.slice(1).split('/')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

function scanForbidden(node, trail = '') {
  if (Array.isArray(node)) { node.forEach((item, index) => scanForbidden(item, `${trail}/${index}`)); return; }
  if (!node || typeof node !== 'object') {
    requireThat(typeof node !== 'function', `Config may not carry executable values (${trail})`);
    if (typeof node === 'string') {
      requireThat(!/^\s*(javascript|data):/i.test(node), `Config may not carry executable URLs (${trail})`);
      requireThat(!/^\s*(\(|function\b|async\b|=>)/.test(node) && !node.includes('=>'),
        `Config may not carry page scripts (${trail})`);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    requireThat(!FORBIDDEN_KEYS.has(key.toLowerCase()) || (key === 'route' && trail === '')
      || (key === 'state' && node.type === 'waitSelector'),
      `Config key "${key}" would bypass ordinary controls (${trail || '/'})`);
    scanForbidden(value, `${trail}/${key}`);
  }
}

function validateWait(action, trail) {
  requireThat(Number.isInteger(action.timeoutMs) && action.timeoutMs > 0 && action.timeoutMs <= MAX_WAIT_MS,
    `${trail}: wait timeoutMs must be a bounded integer <= ${MAX_WAIT_MS}`);
}

/**
 * A walk is ordinary held input steered from a read-only pose reading. It never
 * sets state: it only decides which movement key to hold next, and it must
 * declare its own bound and give up when it stops making progress.
 */
export function validateWalk(action, trail) {
  requireThat(Number.isInteger(action.timeoutMs) && action.timeoutMs > 0 && action.timeoutMs <= MAX_WALK_MS,
    `${trail}: walk needs an explicit timeoutMs integer 1..${MAX_WALK_MS}`);
  const hasPointer = action.targetPointer !== undefined;
  const hasPosition = action.target !== undefined;
  requireThat(hasPointer !== hasPosition, `${trail}: walk needs exactly one of targetPointer or target`);
  if (hasPointer) {
    requireThat(typeof action.targetPointer === 'string' && action.targetPointer.startsWith('/'),
      `${trail}: walk targetPointer must be a snapshot JSON pointer`);
  } else {
    requireThat(Array.isArray(action.target) && action.target.length === 3 && action.target.every(Number.isFinite),
      `${trail}: walk target must be [x, y, z] finite numbers`);
  }
  requireThat(typeof action.posePointer === 'string' && action.posePointer.startsWith('/'),
    `${trail}: walk requires an explicit on-foot posePointer`);
  for (const key of ['forwardKey', 'leftKey', 'rightKey', 'backKey']) {
    if (action[key] === undefined) continue;
    requireThat(KEY_PATTERN.test(action[key]), `${trail}: walk ${key} ${action[key]} is not an ordinary gameplay key`);
  }
  for (const [key, max] of [['arriveWithin', 1e6], ['minProgress', 1e6]]) {
    if (action[key] === undefined) continue;
    requireThat(Number.isFinite(action[key]) && action[key] > 0 && action[key] <= max,
      `${trail}: walk ${key} must be a positive finite number`);
  }
  const noProgressMs = action.noProgressMs ?? WALK_DEFAULTS.noProgressMs;
  requireThat(Number.isInteger(noProgressMs) && noProgressMs > 0 && noProgressMs <= action.timeoutMs,
    `${trail}: walk noProgressMs must be a positive integer <= its own timeoutMs`);
  const tickMs = action.tickMs ?? WALK_DEFAULTS.tickMs;
  requireThat(Number.isInteger(tickMs) && tickMs >= 50 && tickMs <= 1_000, `${trail}: walk tickMs must be 50..1000`);
  return { ...WALK_DEFAULTS, ...action };
}

// Session-local calibration is invalidated by view input, navigation, world/beat
// changes and observed disagreement. It is never persisted in a game save.
export function walkBasis(snapshot, action) {
  return canonical([action.posePointer, action.forwardKey, action.backKey, action.leftKey, action.rightKey,
    snapshot?.story?.runId, snapshot?.story?.beat, snapshot?.unfinishedMap?.worldId,
    snapshot?.commonGround?.up?.map(n => Math.round(n * 10) / 10)]);
}

// Read the ordinary camera's tangent frame instead of walking four directions
// to infer it. Authored lenses keep their existing measured movement basis.
export function walkViewDirections(view, action, speed = 0.005) {
  if (!view?.ordinaryLook || ![view.forward,view.up].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))) return null;
  const norm=v=>{const n=Math.hypot(...v);return n>1e-6?v.map(x=>x/n):null;};
  const up=norm(view.up);if(!up)return null;
  const vertical=view.forward.reduce((n,x,i)=>n+x*up[i],0);
  const forward=norm(view.forward.map((x,i)=>x-up[i]*vertical));if(!forward)return null;
  const right=[forward[1]*up[2]-forward[2]*up[1],forward[2]*up[0]-forward[0]*up[2],forward[0]*up[1]-forward[1]*up[0]];
  return [[action.forwardKey,forward],[action.backKey,forward.map(x=>-x)],
    [action.leftKey,right.map(x=>-x)],[action.rightKey,right]].map(([key,unit])=>({key,unit,speed}));
}

export async function faceWalkTarget(action,{read,move,wait,now=Date.now}) {
  const a=validateWalk(action,'walk'),until=now()+Math.min(6000,a.timeoutMs);let turns=0;
  while(now()<until){
    const s=await read(),directions=walkViewDirections(s?.view,a);
    if(!directions||!s.view.pointerLocked)return {turns,owned:false};
    const p=pointer(s,a.posePointer),target=a.target??pointer(s,a.targetPointer);
    if(![p,target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return {turns,owned:false};
    const delta=target.map((x,i)=>x-p[i]);if(Math.hypot(...delta)<=a.arriveWithin)return {turns,owned:true};
    const forward=directions[0].unit,right=directions[3].unit;
    const angle=Math.atan2(right.reduce((n,x,i)=>n+x*delta[i],0),forward.reduce((n,x,i)=>n+x*delta[i],0));
    if(Math.abs(angle)<0.035)return {turns,owned:true,aligned:true,angleError:angle};
    // Small real mouse motions give a visible turn. Feedback closes the loop;
    // no camera setter or duplicated game sensitivity is needed.
    await move(Math.max(-32,Math.min(32,angle*250)));turns++;await wait(40);
  }
  return {turns,owned:true,aligned:false};
}
export async function walkByInputs(action, { read, hold, release = async () => {}, memory = {}, chords = false,
  now = Date.now, tick = async () => {}, calibrated = async () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const a = validateWalk(action, 'walk'), until = now() + a.timeoutMs;
  const vector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  const sub = (x,y) => x.map((v,i) => v-y[i]), length = v => Math.hypot(...v);
  const dot = (x,y) => x.reduce((sum,v,i) => sum+v*y[i],0);
  const sample = async () => {
    const snapshot = await read(), p = pointer(snapshot,a.posePointer), target = a.target ?? pointer(snapshot,a.targetPointer);
    requireThat(vector(p) && vector(target), 'Walk needs live on-foot position and target vectors');
    const rawUp = snapshot?.commonGround?.up;
    const up = vector(rawUp) && length(rawUp)>0 ? rawUp.map(n=>n/length(rawUp)) : null;
    return {p,target,up,view:snapshot?.view,d:length(sub(target,p)),basis:walkBasis(snapshot,a)};
  };
  const tangent = (delta,up) => up ? delta.map((n,i)=>n-up[i]*dot(delta,up)) : delta;
  let pulses = 0, calibrations = 0, s = await sample(), best = s.d, progressAt = now(), previousKey = null, disagreements = 0;
  const segmentStart = [...s.p];
  const finish = async () => {
    await release(); let previous = await sample(), steady = 0;
    while (now() < until) {
      await wait(Math.min(150,until-now())); await tick(); const current = await sample();
      if (current.d > a.arriveWithin) return null;
      steady = length(sub(current.p,previous.p)) <= 0.015 ? steady+1 : 0; previous = current;
      if (steady >= 2) return {arrived:true,distance:current.d,pulses,calibrations,settled:true};
    }
    return null;
  };
  const calibrate = async () => {
    await release(); await wait(Math.min(200,Math.max(0,until-now())));
    const directions = []; calibrations++; disagreements=0;
    for (const key of [a.forwardKey,a.backKey,a.leftKey,a.rightKey]) {
      requireThat(now() < until, 'Walk timed out while measuring controls'); const before = (await sample()).p;
      await hold(key,80); pulses++; await release(); await wait(Math.min(80,Math.max(0,until-now())));
      s = await sample(); const delta = tangent(sub(s.p,before),s.up), distance = length(delta);
      if (distance > 0.005) directions.push({key,unit:delta.map(v => v/distance),speed:distance/80});
    }
    requireThat(directions.length > 0, 'Ordinary movement produced no measured displacement');
    if (chords && [a.forwardKey,a.backKey,a.leftKey,a.rightKey].every(k=>/^(Key[A-Z]|Arrow(?:Up|Down|Left|Right))$/.test(k))) for (const longitudinal of [a.forwardKey,a.backKey]) for (const lateral of [a.leftKey,a.rightKey]) {
      const first=directions.find(d=>d.key===longitudinal),second=directions.find(d=>d.key===lateral);
      if (!first || !second) continue;
      const sum=first.unit.map((n,i)=>n+second.unit[i]),norm=length(sum);
      if (norm>0.5) directions.push({key:[longitudinal,lateral],unit:sum.map(n=>n/norm),speed:(first.speed+second.speed)/2});
    }
    memory.basis = s.basis; memory.directions = directions; previousKey = null;
    await calibrated({at:now(),position:s.p,up:s.up,basis:s.basis,directions});
  };
  try {
    while (now() < until) {
      s = await sample();
      if (s.d <= a.arriveWithin) { const result = await finish(); if (result) return result; continue; }
      if (s.d < best-a.minProgress) { best = s.d; progressAt = now(); }
      requireThat(now()-progressAt < a.noProgressMs, 'Walk stopped making progress toward its target');
      const liveDirections=walkViewDirections(s.view,a);
      if(liveDirections){
        if(chords)for(const f of liveDirections.slice(0,2))for(const r of liveDirections.slice(2,4)){
          const sum=f.unit.map((x,i)=>x+r.unit[i]),n=length(sum);
          liveDirections.push({key:[f.key,r.key],unit:sum.map(x=>x/n),speed:f.speed});
        }
        memory.basis=s.basis;memory.directions=liveDirections;
      } else if (memory.basis !== s.basis || !memory.directions?.length) { await calibrate(); continue; }
      // Follow the declared segment with a short lookahead. Steering only at
      // the distant endpoint can cut across a ledge before correcting sideways.
      const segment=sub(s.target,segmentStart),span=length(segment),unit=segment.map(n=>n/(span||1));
      const along=Math.max(0,Math.min(span,dot(sub(s.p,segmentStart),unit)));
      const aim=segmentStart.map((n,i)=>n+unit[i]*Math.min(span,along+0.7));
      const desired = sub(aim,s.p), directions = memory.directions;
      let choice = directions.reduce((best,d) => !best || dot(d.unit,desired) > dot(best.unit,desired) ? d : best,null);
      const previous = directions.find(d => canonical(d.key) === previousKey);
      // Keep a useful direction through tiny projection ties; never retain a
      // key that points away from the destination.
      if (previous && dot(previous.unit,desired) > 0 && dot(previous.unit,desired) >= dot(choice.unit,desired)*0.9) choice = previous;
      requireThat(dot(choice.unit,desired) > 0, 'Calibrated movement cannot approach the target');
      const ms = Math.min(a.tickMs,Math.max(30,(s.d-a.arriveWithin)/choice.speed*0.45),until-now());
      if (ms <= 0) break;
      await hold(choice.key,ms); pulses++; previousKey = canonical(choice.key);
      // Browser reads take real wall time. Close to a tight waypoint, stop
      // before reading so observation latency cannot carry us past it.
      if (s.d <= Math.max(1,a.arriveWithin+choice.speed*a.tickMs*3)) {
        await release(); await wait(Math.min(80,Math.max(0,until-now())));
      }
      await tick();
      const next = await sample(), delta = tangent(sub(next.p,s.p),next.up), moved = length(delta);
      disagreements = moved > 0.02 && dot(delta,choice.unit)/moved < 0.8 ? disagreements+1 : 0;
      if (next.basis !== memory.basis || disagreements >= 2) {
        delete memory.directions; await release();
      }
    }
    throw new Error('Walk did not reach its target within the declared bound');
  } finally { await release(); }
}

// Consecutive observations keep the same key held. Only a direction change or
// the end of a walk releases it, including every exceptional exit.
export function heldWalkInput(keyboard, wait) {
  const held=new Set();
  const release=async()=>{for(const key of [...held]){held.delete(key);await keyboard.up(key);}};
  return {release,hold:async(keys,ms)=>{
    const next=new Set(Array.isArray(keys)?keys:[keys]);
    for(const key of [...held])if(!next.has(key)){held.delete(key);await keyboard.up(key);}
    for(const key of next)if(!held.has(key)){await keyboard.down(key);held.add(key);}
    await wait(ms);
  }};
}

export function validateAction(action, trail) {
  requireThat(action && typeof action === 'object' && !Array.isArray(action), `${trail}: action must be an object`);
  requireThat(ACTION_TYPES.has(action.type), `${trail}: unsupported action type ${JSON.stringify(action.type)}`);
  const fields={key:['code','holdMs'],press:['code'],text:['value'],click:['selector','x','y','button','timeoutMs'],
    move:['x','y'],wait:['pointer','equals','exists','changes','atLeast','includes','timeoutMs'],
    waitSelector:['selector','state','timeoutMs'],settle:['ms'],
    walk:['target','targetPointer','posePointer','timeoutMs','forwardKey','backKey','leftKey','rightKey','arriveWithin','noProgressMs','minProgress','tickMs']};
  for(const key of Object.keys(action))requireThat(key==='type'||fields[action.type].includes(key),`${trail}: unknown ${action.type} field ${key}`);
  if (action.type === 'key' || action.type === 'press') {
    requireThat(KEY_PATTERN.test(action.code ?? ''), `${trail}: ${action.code} is not an ordinary gameplay key`);
    if (action.holdMs !== undefined) {
      requireThat(Number.isInteger(action.holdMs) && action.holdMs > 0 && action.holdMs <= MAX_HOLD_MS,
        `${trail}: holdMs must be a bounded integer <= ${MAX_HOLD_MS}`);
    }
  } else if (action.type === 'text') {
    requireThat(typeof action.value === 'string' && action.value.length > 0 && action.value.length <= 120,
      `${trail}: text value must be a short string`);
  } else if (action.type === 'click' || action.type === 'move') {
    const hasPoint = Number.isFinite(action.x) && Number.isFinite(action.y);
    const hasSelector = typeof action.selector === 'string' && action.selector.length > 0;
    requireThat(hasPoint || (hasSelector && action.type === 'click'),
      `${trail}: ${action.type} needs numeric x/y${action.type === 'click' ? ' or a selector' : ''}`);
    if (action.button !== undefined) {
      requireThat(['left', 'right', 'middle'].includes(action.button), `${trail}: unsupported mouse button`);
    }
  } else if (action.type === 'wait') {
    requireThat(typeof action.pointer === 'string' && action.pointer.startsWith('/'),
      `${trail}: wait needs a snapshot JSON pointer`);
    const modes = ['equals', 'exists', 'changes', 'atLeast', 'includes'].filter(mode => action[mode] !== undefined);
    requireThat(modes.length === 1, `${trail}: wait needs exactly one of equals/exists/changes/atLeast/includes`);
    validateWait(action, trail);
  } else if (action.type === 'waitSelector') {
    requireThat(typeof action.selector === 'string' && action.selector.length > 0, `${trail}: waitSelector needs a selector`);
    requireThat(['visible', 'hidden', 'attached'].includes(action.state ?? 'visible'), `${trail}: unsupported selector state`);
    validateWait(action, trail);
  } else if (action.type === 'settle') {
    requireThat(Number.isInteger(action.ms) && action.ms > 0 && action.ms <= MAX_WAIT_MS,
      `${trail}: settle ms must be a bounded integer <= ${MAX_WAIT_MS}`);
  } else if (action.type === 'walk') {
    validateWalk(action, trail);
  }
  return action;
}

function validateSteps(steps, trail) {
  requireThat(Array.isArray(steps) && steps.length > 0, `${trail} must be a non-empty array of actions`);
  requireThat(steps.length <= MAX_STEPS, `${trail} exceeds ${MAX_STEPS} actions`);
  steps.forEach((action, index) => validateAction(action, `${trail}[${index}]`));
  return steps;
}

const stringList = (value, trail, { min = 1 } = {}) => {
  requireThat(Array.isArray(value) && value.length >= min && value.every(item => typeof item === 'string' && item),
    `${trail} must be an array of ${min} or more names`);
  return [...value];
};

/**
 * Strict, whitelist-first config validation. Anything not understood is
 * refused: an unknown key in a control config is a claim this transport cannot
 * honestly make.
 */
export function validateControlConfig(config, kind) {
  requireThat(config && typeof config === 'object' && !Array.isArray(config), 'Control config must be an object');
  requireThat(KINDS.has(kind), `Unsupported case ${JSON.stringify(kind)}`);
  scanForbidden(config);
  const known = new Set(['chapter', 'sourceManifest', 'previewOwnership', 'route', 'viewport', 'maxSessionSeconds',
    'beats', 'acceptedMilestones', 'deltaPointers', 'durablePointers', 'steps', 'newActionSteps', 'bootstrapSteps', 'pause',
    'continue', 'readySelector', 'readyPointer', 'completionMilestones', 'notes']);
  for (const key of Object.keys(config)) requireThat(known.has(key), `Unknown control config key "${key}"`);
  requireThat(typeof config.chapter === 'string' && config.chapter, 'Control config needs a chapter id');
  const route = config.route ?? '/?journeyprobe=1';
  requireThat(typeof route === 'string' && route.startsWith('/') && !route.includes('..'),
    'route must be a same-origin absolute path');
  requireThat(route.includes('journeyprobe=1') || route.includes('chapterjourney=1'),
    'route must enable the read-only journey probe');
  const entry = new URL(route, 'http://localhost');
  requireThat(entry.origin === 'http://localhost' && !entry.searchParams.has('movie')
    && !entry.searchParams.has('swgpu'), 'Manual controls cannot use an automatic or software route');
  const maxSessionSeconds = config.maxSessionSeconds ?? 300;
  requireThat(Number.isInteger(maxSessionSeconds) && maxSessionSeconds > 0 && maxSessionSeconds <= MAX_SESSION_SECONDS,
    `maxSessionSeconds must be a bounded integer <= ${MAX_SESSION_SECONDS}`);
  const normalized = {
    chapter: config.chapter,
    sourceManifest: config.sourceManifest ?? null,
    previewOwnership: config.previewOwnership ?? null,
    route,
    viewport: config.viewport ?? { width: 1280, height: 720 },
    maxSessionSeconds,
    beats: stringList(config.beats ?? [], 'beats', { min: kind === 'manual' ? 1 : 0 }),
    acceptedMilestones: stringList(config.acceptedMilestones, 'acceptedMilestones'),
    completionMilestones: stringList(config.completionMilestones ?? [config.acceptedMilestones?.at(-1)], 'completionMilestones'),
    deltaPointers: stringList(config.deltaPointers ?? ['/state/systemFlight/pose/position'], 'deltaPointers'),
    durablePointers: stringList(config.durablePointers
      ?? ['/story/chapter', '/story/beat', '/state/localActor/milestones', '/receipts'], 'durablePointers'),
    bootstrapSteps: config.bootstrapSteps === undefined || config.bootstrapSteps === null
      ? null : validateSteps(config.bootstrapSteps, 'bootstrapSteps'),
    steps: validateSteps(config.steps, 'steps'),
    newActionSteps: config.newActionSteps ? validateSteps(config.newActionSteps, 'newActionSteps') : null,
    readySelector: config.readySelector ?? null,
    readyPointer: config.readyPointer ?? '/story/active',
    pause: null,
    continue: null
  };
  for (const jsonPointer of [...normalized.deltaPointers, ...normalized.durablePointers, normalized.readyPointer]) {
    requireThat(typeof jsonPointer === 'string' && jsonPointer.startsWith('/'), `Invalid snapshot pointer ${jsonPointer}`);
  }
  requireThat(Number.isInteger(normalized.viewport.width) && Number.isInteger(normalized.viewport.height),
    'viewport must be integer width/height');
  if (kind === 'recovery') {
    const pause = config.pause;
    requireThat(pause && typeof pause === 'object', 'recovery config needs a pause block');
    requireThat((pause.key ?? 'Escape') === 'Escape', 'recovery must interrupt with the ordinary Escape key');
    requireThat(typeof pause.pausedPointer === 'string' && pause.pausedPointer.startsWith('/'),
      'pause.pausedPointer must be a snapshot JSON pointer');
    requireThat(typeof pause.resumeSelector === 'string' && pause.resumeSelector,
      'pause.resumeSelector must name the visible resume control');
    normalized.pause = {
      key: 'Escape',
      pausedPointer: pause.pausedPointer,
      pausedValue: pause.pausedValue ?? true,
      resumeSelector: pause.resumeSelector,
      timeoutMs: pause.timeoutMs ?? 10_000
    };
    validateWait(normalized.pause, 'pause');
    requireThat(normalized.newActionSteps, 'recovery config needs newActionSteps for the post-resume action');
  }
  if (kind === 'continue') {
    const resume = config.continue;
    requireThat(resume && typeof resume === 'object', 'continue config needs a continue block');
    requireThat(typeof resume.ctaSelector === 'string' && resume.ctaSelector,
      'continue.ctaSelector must name the visible landing Continue control');
    requireThat(typeof resume.checkpointPointer === 'string' && resume.checkpointPointer.startsWith('/'),
      'continue.checkpointPointer must be a snapshot JSON pointer');
    normalized.continue = {
      ctaSelector: resume.ctaSelector,
      checkpointPointer: resume.checkpointPointer,
      timeoutMs: resume.timeoutMs ?? 20_000
    };
    validateWait(normalized.continue, 'continue');
    requireThat(normalized.newActionSteps, 'continue config needs newActionSteps for the post-Continue action');
  }
  return normalized;
}

/**
 * Report every problem in one pass so a broken config can be fixed in one edit
 * instead of one error per run. Each message names the field and the bound.
 */
export function collectControlConfigProblems(config, kind) {
  const problems = [];
  try { validateControlConfig(config, kind); } catch (error) { problems.push(error.message); }
  if (!problems.length) return problems;
  if (config && typeof config === 'object') {
    const lists = [['steps', config.steps], ['bootstrapSteps', config.bootstrapSteps],
      ['newActionSteps', config.newActionSteps]];
    for (const [name, steps] of lists) {
      if (!Array.isArray(steps)) continue;
      steps.forEach((action, index) => {
        try { validateAction(action, `${name}[${index}]`); } catch (error) { problems.push(error.message); }
      });
    }
    for (const [name, block] of [['pause', config.pause], ['continue', config.continue]]) {
      if (!block || typeof block !== 'object' || block.timeoutMs === undefined) continue;
      try { validateWait(block, name); } catch (error) { problems.push(error.message); }
    }
  }
  return [...new Set(problems)];
}

/**
 * Preflight for a whole case file, run BEFORE any build or preview: a config
 * this transport cannot honour must never cost a build.
 */
export function validateCaseFile(settings, { chapter, kind } = {}) {
  requireThat(settings && typeof settings === 'object' && !Array.isArray(settings), 'Control configuration must be an object');
  requireThat(!chapter || settings.chapter === chapter,
    `Control configuration chapter is ${JSON.stringify(settings.chapter ?? null)}, expected ${JSON.stringify(chapter)}`);
  requireThat(KINDS.has(kind), `Unsupported case ${JSON.stringify(kind)}`);
  const block = settings[kind];
  requireThat(block && typeof block === 'object' && !Array.isArray(block), `Missing real ${kind} configuration`);
  requireThat(block.chapter === undefined || block.chapter === settings.chapter, 'Nested control chapter differs');
  const problems = collectControlConfigProblems({ ...block, chapter: block.chapter ?? settings.chapter }, kind);
  requireThat(problems.length === 0,
    `Invalid ${kind} config (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n  - ${problems.join('\n  - ')}`);
  return true;
}

/**
 * A milestone the run did not earn cannot be an accepted action. Only names in
 * `accepted` that are absent from the baseline and present afterwards count.
 */
export function acceptedActionCount({ baselineMilestones = [], milestones = [], accepted = [] }) {
  const before = new Set(baselineMilestones);
  const acceptable = new Set(accepted);
  return [...new Set(milestones)].filter(name => acceptable.has(name) && !before.has(name)).length;
}
export function acceptedActionNames({ baselineMilestones = [], milestones = [], accepted = [] }) {
  const before = new Set(baselineMilestones);
  const acceptable = new Set(accepted);
  return [...new Set(milestones)].filter(name => acceptable.has(name) && !before.has(name)).sort();
}

/** An unchanged pose is not evidence of an action: identical readings prove nothing. */
export function deltaProof(before, after, pointers) {
  const changed = pointers.filter(jsonPointer =>
    pointer(before, jsonPointer) !== undefined && pointer(after, jsonPointer) !== undefined &&
    canonical(pointer(before, jsonPointer)) !== canonical(pointer(after, jsonPointer)));
  return { changed, moved: changed.length > 0 };
}

export function inputReceipts(snapshot) {
  const input = snapshot?.input ?? {};
  return {
    revision: input.revision ?? null,
    hotkeyActivations: input.hotkeyActivations ?? null,
    submitCount: input.submitCount ?? null,
    events: Array.isArray(input.events) ? input.events.length : null
  };
}
export function receiptsAdvanced(before, after) {
  const a = inputReceipts(before), b = inputReceipts(after);
  return ['revision', 'hotkeyActivations', 'submitCount', 'events']
    .some(key => Number.isFinite(a[key]) && Number.isFinite(b[key]) && b[key] > a[key]);
}

export function canonicalDurableState(snapshot, pointers) {
  return sortDeep(Object.fromEntries(pointers.map(jsonPointer => {
    const value = pointer(snapshot, jsonPointer);
    requireThat(value !== undefined, `Missing durable state: ${jsonPointer}`);
    return [jsonPointer, jsonPointer === '/state/localActor/milestones' && Array.isArray(value)
      ? [...value].sort() : sortDeep(value)];
  })));
}

const OBLIGATIONS = {
  manual: ['ordinaryControls', 'acceptedAction', 'completePath', 'hardware', 'cleanup'],
  recovery: ['ordinaryControls', 'acceptedAction', 'interrupted', 'recovered', 'newAcceptedAction', 'hardware', 'cleanup'],
  continue: ['ordinaryControls', 'acceptedAction', 'freshCheckpoint', 'clickedContinue',
    'stateEqual', 'newAcceptedAction', 'hardware', 'cleanup']
};
/** Recovery and Continue are heard as well as read: an interruption case that
 * produced no decodable owned recording is inconclusive, not passed. */
const MEDIA_OBLIGATIONS = ['videoDecodes', 'audioDecodes', 'audioIsolated', 'mediaCleanup'];
export function obligationsFor(kind, media = false) {
  return [...(OBLIGATIONS[kind] ?? []), ...(media && OBLIGATIONS[kind] ? MEDIA_OBLIGATIONS : [])];
}

/** A numeric obligation passes only when it counted something real. */
export function verdict(kind, proof, media = false) {
  const required = obligationsFor(kind, media);
  const missing = required.filter(key => {
    const value = proof?.[key];
    return typeof value === 'number' ? !(value > 0) : value !== true;
  });
  return { passed: missing.length === 0 && required.length > 0, missing };
}

/** The only page function this transport ever evaluates. Passive read. */
const READ_SNAPSHOT = () => {
  const bridge = window.__paravoxiaJourneyProbe;
  const reader = bridge && (bridge.snapshot ?? bridge.getSnapshot);
  if (typeof reader !== 'function') return null;
  try { const value = reader.call(bridge); return value && typeof value === 'object' ? value : null; }
  catch { return null; }
};

function sourceIdentity({ repo, config, provenance }) {
  const sourceFile = config.sourceManifest ? inside(repo, config.sourceManifest) : null;
  const source = sourceFile ? readJson(sourceFile) : provenance?.sourceManifest;
  requireThat(source && Object.keys(source.hashes ?? {}).length > 0, 'Exact source manifest with file hashes required');
  const verify = () => {
    for (const [file, expected] of Object.entries(source.hashes)) {
      requireThat(sha(fs.readFileSync(inside(repo, file))) === expected, `Source changed: ${file}`);
    }
  };
  verify();
  const ownershipFile = config.previewOwnership ? inside(repo, config.previewOwnership) : null;
  const ownership = ownershipFile ? readJson(ownershipFile) : provenance?.previewOwnership;
  requireThat(ownership?.files?.['index.html'], 'Exact preview build ownership manifest required');
  const sourceManifestSha256 = sourceFile ? sha(fs.readFileSync(sourceFile)) : sha(source);
  requireThat(!ownership.sourceManifestSha256 || ownership.sourceManifestSha256 === sourceManifestSha256,
    'Preview was built from a different source manifest');
  return { source, ownership, sourceManifestSha256, buildSha256: sha(ownership.files), verify };
}

async function verifyPreview(url, ownership) {
  for (const [name, expected] of Object.entries(ownership.files)) {
    requireThat(!name.startsWith('/') && !name.split('/').includes('..'), 'Invalid owned build path');
    const response = await fetch(new URL(name, url), { signal: AbortSignal.timeout(10_000) });
    const body = Buffer.from(await response.arrayBuffer());
    requireThat(response.ok && sha(body) === (typeof expected === 'string' ? expected : expected?.sha256), `Served build differs: ${name}`);
    if (name === 'index.html') requireThat(body.toString().includes('<title>Paravoxia</title>'), 'Wrong preview application');
  }
  const response = await fetch(new URL('/index.html', url), { signal: AbortSignal.timeout(10_000) });
  const body = Buffer.from(await response.arrayBuffer());
  const expected = ownership.files['index.html'];
  const actual = sha(body);
  const matches = actual === (typeof expected === 'string' ? expected : expected?.sha256);
  requireThat(matches, 'Preview is not serving the exact owned build');
  return { url, indexSha256: actual, checkedAtWallMs: Date.now() };
}

const hardwareRenderer = renderer => /NVIDIA|AMD|Intel|Apple/i.test(renderer ?? '') && !/swiftshader|software|llvmpipe/i.test(renderer);

export function describeControlCapabilities({ repo = ROOT, kind = null, config = null } = {}) {
  const require_ = createRequire(import.meta.url);
  const checks = {};
  const record = (name, supported, detail) => { checks[name] = { supported, detail }; };
  try { require_.resolve('playwright-core'); record('playwright', true, 'playwright-core resolvable'); }
  catch { record('playwright', false, 'playwright-core is not installed'); }
  let chrome = null;
  try { ({ chromePath: chrome } = { chromePath: process.env.CHROME_PATH ?? '/snap/bin/chromium' }); } catch { /* ignore */ }
  record('chromium', Boolean(chrome && fs.existsSync(chrome)), chrome ?? 'no chromium path');
  record('display', Boolean(process.env.DISPLAY), process.env.DISPLAY ?? 'no DISPLAY for a headed hardware run');
  record('case', KINDS.has(kind), kind ? `case=${kind}` : 'no --case given');
  const media = KINDS.has(kind) && mediaRequested(kind);
  if (media) {
    for (const [tool, args] of [['pactl', ['info']], ['parec', ['--version']], ['ffmpeg', ['-version']], ['ffprobe', ['-version']]]) {
      try { execFileSync(tool, args, { stdio: 'ignore', timeout: 15_000 }); record(`media:${tool}`, true, `${tool} available`); }
      catch (error) { record(`media:${tool}`, false, `${tool} unavailable: ${error.message}`); }
    }
  }
  let normalized = null, pending = null;
  if (!config) {
    pending = 'chapter-config-missing';
    record('chapterConfig', false, 'no chapter control config supplied; this chapter is PENDING, not supported');
  } else {
    try {
      const raw = typeof config === 'string' ? readJson(inside(repo, config)) : config;
      normalized = validateControlConfig(raw, kind);
      record('chapterConfig', true, `${normalized.steps.length} declared ordinary actions`);
    } catch (error) {
      record('chapterConfig', false, `invalid chapter control config: ${error.message}`);
    }
  }
  const supported = Object.values(checks).every(check => check.supported);
  return {
    schema: 'paravoxia.controlCaptureCapabilities.v1',
    chapter: normalized?.chapter ?? null,
    case: kind,
    supported,
    status: supported ? 'supported' : pending ? 'pending' : 'unsupported',
    pending,
    media: media ? { required: true, files: [{ kind: 'video', path: 'video.webm' }, { kind: 'audio', path: 'audio.wav' }, { kind: 'frame', path: 'frame.png' }] }
      : { required: false, files: [{ kind: 'frame', path: 'frame.png' }] },
    obligations: obligationsFor(kind, media),
    actionSchema: { types: [...ACTION_TYPES], maxSteps: MAX_STEPS, maxWaitMs: MAX_WAIT_MS,
      maxWalkMs: MAX_WALK_MS, walkDefaults: { ...WALK_DEFAULTS }, keyPattern: KEY_PATTERN.source },
    forbidden: [...FORBIDDEN_KEYS].sort(),
    checks
  };
}

export async function captureControls(options) {
  const kind = options.kind;
  requireThat(KINDS.has(kind), `Unsupported case ${JSON.stringify(kind)}`);
  const repo = path.resolve(options.repo ?? ROOT);
  requireThat(options.config, 'A chapter control config is required (--config)');
  const configFile = typeof options.config === 'string' ? inside(repo, options.config) : null;
  const config = validateControlConfig(configFile ? readJson(configFile) : options.config, kind);
  if (options.chapter) requireThat(config.chapter === options.chapter, 'Config chapter does not match --chapter');
  const out = path.resolve(options.out ?? path.join(repo, 'artifacts', `control-${kind}`));
  const artifactRoot = out.startsWith(`${repo}${path.sep}`) ? repo : out;
  const raw = path.join(out, 'raw');
  requireThat(!fs.existsSync(raw), 'Control capture output must be fresh');
  fs.mkdirSync(raw, { recursive: true });
  const identity = sourceIdentity({ repo, config, provenance: options.provenance });

  const { chromium } = await import('playwright-core');
  const { CHROMIUM_ARGS, chromePath, assertHardwareGl, startParavoxiaPreview } = await import('../lib/previewServer.mjs');

  const trace = [], gestures = [], errors = [], pageErrors = [];
  const cleanup = { phase: 'running', errors: [], closed: {} };
  const startedAtWallMs = Date.now();
  const deadline = startedAtWallMs + config.maxSessionSeconds * 1000;
  const media = mediaRequested(kind, options.media);
  const audioFile = path.join(out, 'audio.wav');
  const videoFile = path.join(out, 'video.webm');
  const proof = {
    ordinaryControls: false, acceptedAction: 0, completePath: false, interrupted: false, recovered: false,
    freshCheckpoint: false, clickedContinue: false, ctaBeforeRuntimeReady: false, stateEqual: false,
    newAcceptedAction: 0, hardware: false, cleanup: false,
    ...(media ? { videoDecodes: false, audioDecodes: false, audioIsolated: false, mediaCleanup: false, mediaCaptured: false } : {})
  };
  const isolation = [], marks = [];
  const mediaCleanup = { requested: media };
  const mark = (name, note = null) => { marks.push({ mark: name, note, wallMs: Date.now() }); };
  const run = {
    schema: 'paravoxia.controlCapture.v1', kind, chapter: config.chapter, config,
    sourceManifestSha256: identity.sourceManifestSha256, sourceFiles: identity.source.hashes,
    buildSha256: identity.buildSha256, headed: true, tier: 'hardware-high',
    startedAtWallMs, deadlineWallMs: deadline,
    transportSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    ownedPreview: false,
    media: media
      ? 'real rendered frames plus an owned isolated PulseAudio WAV and a Playwright video of this same session'
      : 'real rendered frames only; this case does not require audible evidence',
    beatsSeen: [], clickCount: 0, injections: 'none: no state injection, debug setter, teleport or config script'
  };

  let preview = null, server = null, browser = null, context = null, page = null, aborted = null;
  const mousePosition={x:0,y:0};
  const moveMouse=async(x,y,options)=>{await page.mouse.move(x,y,options);mousePosition.x=x;mousePosition.y=y;};
  let device = null, recorder = null, videoHandle = null, nextIsolationAt = 0;
  const abort = signal => { aborted = `Control capture interrupted by ${signal}`; void browser?.close().catch(() => {}); };
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, () => abort(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  const watchdog = setTimeout(() => abort('session deadline'), config.maxSessionSeconds * 1000);

  const remaining = () => deadline - Date.now();
  const guard = () => { requireThat(!aborted, aborted ?? 'aborted'); requireThat(remaining() > 0, 'Session deadline reached'); };
  const walkMemory = {};
  const snapshot = async () => { guard(); return page.evaluate(READ_SNAPSHOT); };
  const observe = async (phase, note = null) => {
    const value = await snapshot();
    const record = {
      t: Date.now(), phase, note,
      runtimeReady: Boolean(value),
      story: value?.story ?? null,
      view: value?.view ?? null,
      unfinishedMap: value?.unfinishedMap ?? null,
      milestones: pointer(value, '/state/localActor/milestones') ?? null,
      pointers: Object.fromEntries([...config.deltaPointers, ...config.durablePointers,
        ...(config.continue ? [config.continue.checkpointPointer] : []),
        ...(config.pause ? [config.pause.pausedPointer] : [])]
        .map(jsonPointer => [jsonPointer, pointer(value, jsonPointer) ?? null])),
      receipts: inputReceipts(value),
      inputEvents: (value?.input?.events ?? []).slice(-6),
      visiblePromptCount: pointer(value, '/interaction/visiblePromptCount') ?? null
    };
    trace.push(record);
    fs.appendFileSync(path.join(raw, 'trace.ndjson'), `${JSON.stringify(record)}\n`);
    if (media && device && run.browserPid && Date.now() >= nextIsolationAt) {
      nextIsolationAt = Date.now() + 1000;
      const owned = { wallMs: Date.now(), ...readOwnership(device, run.browserPid) };
      isolation.push(owned);
      // A voice in this recording that the browser did not make would make the
      // WAV worthless as evidence about the game. Fail closed, never trim.
      requireThat(owned.foreign.length === 0, 'Foreign audio stream reached the owned capture sink');
      if (recorder && (recorder.exitCode !== null || recorder.signalCode !== null)) {
        throw new Error('Audio recorder exited before the control capture completed');
      }
    }
    const beat = value?.story?.beat;
    if (beat && run.beatsSeen[run.beatsSeen.length - 1] !== beat) {
      run.beatsSeen.push(beat);
      if (config.beats.includes(beat)) await page.screenshot({path:path.join(raw,`frame-${run.beatsSeen.length}.png`)});
    }
    return value;
  };
  const waitForRuntime = async (timeoutMs, note) => {
    const until = Date.now() + Math.min(timeoutMs, Math.max(1, remaining()));
    let value = null;
    while (Date.now() < until) {
      value = await observe('await-runtime', note);
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
    return value;
  };
  const matches = (action, value, initial) => {
    if (action.equals !== undefined) return canonical(value) === canonical(action.equals);
    if (action.exists !== undefined) return action.exists ? value !== undefined && value !== null : value == null;
    if (action.changes !== undefined) return canonical(value) !== canonical(initial);
    if (action.atLeast !== undefined) return Number.isFinite(value) && value >= action.atLeast;
    if (action.includes !== undefined) return Array.isArray(value) && value.includes(action.includes);
    return false;
  };
  const perform = async (action, label) => {
    guard();
    const startedAt = Date.now();
    if (['move','click','press'].includes(action.type)) delete walkMemory.directions;
    const gesture = { label, type: action.type, startedAt, detail: null, ok: false };
    if (action.type === 'key') {
      await page.keyboard.down(action.code);
      try { await new Promise(resolve => setTimeout(resolve, Math.min(action.holdMs ?? 120, MAX_HOLD_MS))); }
      finally { await page.keyboard.up(action.code); }
      gesture.detail = { code: action.code, holdMs: action.holdMs ?? 120 };
    } else if (action.type === 'press') {
      await page.keyboard.press(action.code);
      gesture.detail = { code: action.code };
    } else if (action.type === 'text') {
      await page.keyboard.type(action.value, { delay: 30 });
      gesture.detail = { length: action.value.length };
    } else if (action.type === 'move') {
      await moveMouse(action.x, action.y, { steps: 12 });
      gesture.detail = { x: action.x, y: action.y };
    } else if (action.type === 'click') {
      if (action.selector) {
        const locator = page.locator(action.selector).first();
        await locator.waitFor({ state: 'visible', timeout: Math.min(action.timeoutMs ?? 10_000, Math.max(1, remaining())) });
        const box = await locator.boundingBox();
        requireThat(box, `Control ${action.selector} has no visible box to click`);
        await moveMouse(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
        await page.mouse.down({ button: action.button ?? 'left' });
        await page.mouse.up({ button: action.button ?? 'left' });
        gesture.detail = { selector: action.selector, box };
      } else {
        await moveMouse(action.x, action.y, { steps: 8 });
        await page.mouse.down({ button: action.button ?? 'left' });
        await page.mouse.up({ button: action.button ?? 'left' });
        gesture.detail = { x: action.x, y: action.y };
      }
      run.clickCount += 1;
    } else if (action.type === 'wait') {
      const initial = pointer(await snapshot(), action.pointer);
      const until = Date.now() + Math.min(action.timeoutMs, Math.max(1, remaining()));
      let satisfied = false;
      while (Date.now() < until && !satisfied) {
        const value = pointer(await observe('wait', action.pointer), action.pointer);
        satisfied = matches(action, value, initial);
        if (!satisfied) await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      requireThat(satisfied, `${label}: bounded wait on ${action.pointer} was not satisfied`);
      gesture.detail = { pointer: action.pointer };
    } else if (action.type === 'waitSelector') {
      await page.locator(action.selector).first().waitFor({
        state: action.state ?? 'visible', timeout: Math.min(action.timeoutMs, Math.max(1, remaining()))
      });
      gesture.detail = { selector: action.selector, state: action.state ?? 'visible' };
    } else if (action.type === 'settle') {
      await new Promise(resolve => setTimeout(resolve, Math.min(action.ms, Math.max(1, remaining()))));
      gesture.detail = { ms: action.ms };
    } else if (action.type === 'walk') {
      // A real reload can release pointer capture without opening Pause. Use
      // the game's visible recovery affordance before sending movement keys.
      const recoverySelector = '[data-testid="pointer-lock-recovery"]';
      const recovery = page.locator(recoverySelector).first();
      if (await recovery.isVisible()) {
        await perform({type:'click',selector:recoverySelector}, `${label}.resume-control`);
        await recovery.waitFor({state:'hidden',timeout:Math.min(3000,Math.max(1,remaining()))});
      }
      const input = heldWalkInput(page.keyboard, async ms => {
        guard(); await new Promise(resolve => setTimeout(resolve,Math.min(ms,Math.max(1,remaining()))));
      });
      // Keep the mouse's actual transport position across clicks and turns so
      // pointer-lock movement stays relative, without recentering camera jumps.
      await input.release();
      const facing=await faceWalkTarget(action,{read:snapshot,
        move:dx=>moveMouse(mousePosition.x+dx,mousePosition.y),
        wait:async ms=>{guard();await new Promise(resolve=>setTimeout(resolve,ms));}});
      if(facing.turns){delete walkMemory.directions;delete walkMemory.basis;}
      gesture.detail = await walkByInputs(action, { read:snapshot, ...input, memory:walkMemory, chords:true,
        tick:() => observe('walk',label),
        calibrated:measurement => fs.appendFileSync(path.join(raw,'walk-calibration.ndjson'),JSON.stringify({label,...measurement})+'\n') });
      gesture.detail.facing=facing;
    }
    gesture.ok = true;
    gesture.endedAt = Date.now();
    gestures.push(gesture);
    await observe('after-action', label);
    return gesture;
  };
  const runSteps = async (steps, label) => {
    for (const [index, action] of steps.entries()) await perform(action, `${label}[${index}]`);
  };
  /** Wait without acting: no input is delivered, the trace keeps running, and
   * the recorder keeps the interval. Bounded by the session deadline. */
  const holdOnRecording = async (ms, phase) => {
    const startedAt = Date.now();
    const until = startedAt + Math.min(ms, Math.max(0, remaining() - 5_000));
    while (Date.now() < until) {
      await observe(phase);
      await new Promise(resolve => setTimeout(resolve, Math.min(POLL_MS * 5, Math.max(1, until - Date.now()))));
    }
    return Date.now() - startedAt;
  };

  let passed = false;
  try {
    let url = options.preview ?? process.env.PARAVOXIA_URL ?? null;
    if (!url) {
      preview = await startParavoxiaPreview({ build: false, log: () => {} });
      url = preview.url;
      run.ownedPreview = true;
    }
    run.previewUrl = url;
    run.previewBefore = await verifyPreview(url, identity.ownership);
    const target = new URL(config.route, url).toString();
    run.url = target;

    // Audible run: the browser gets a private null sink of its own and keeps
    // the machine's default output untouched. --mute-audio is removed only for
    // that owned sink; nothing here is routed to real speakers.
    if (media) {
      device = openOwnedSink();
      run.audioDevice = { sinkName: device.sinkName, sinkIndex: device.sinkIndex, moduleId: device.moduleId,
        monitor: device.monitor, defaultSinkBefore: device.defaultSinkBefore, defaultChanged: false };
    }
    const base = CHROMIUM_ARGS.filter(arg => arg !== '--enable-unsafe-swiftshader');
    const args = media ? audibleLaunchArgs(base) : [...base, '--enable-gpu', '--use-angle=gl'];
    server = await chromium.launchServer({
      executablePath: chromePath(), headless: false, args,
      env: media ? audibleLaunchEnv(process.env, device) : { ...process.env, DISPLAY: process.env.DISPLAY ?? ':0' },
      timeout: Math.min(60_000, Math.max(1, remaining()))
    });
    run.browserPid = server.process().pid;
    run.launchArgs = args;
    browser = await chromium.connect(server.wsEndpoint());
    context = await browser.newContext({ viewport: config.viewport,
      ...(media ? { recordVideo: { dir: path.join(raw, 'video'), size: config.viewport } } : {}) });
    if (media) run.videoStartedAtWallMs = Date.now();
    page = await context.newPage();
    if (media) videoHandle = page.video();
    page.on('pageerror', error => pageErrors.push(error.message));
    run.navigations = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        delete walkMemory.directions;
        run.navigations.push({wallMs:Date.now(),url:frame.url()});
      }
    });
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: Math.min(90_000, Math.max(1, remaining())) });
    // Recording starts BEFORE any declared action, so the interruption and the
    // resume are inside one continuous recording rather than reconstructed.
    if (media) {
      recorder = startAudioRecorder({ device, file: audioFile, logFile: path.join(raw, 'recorder.log'),
        onError: message => errors.push(message) });
      run.audioStartedAtWallMs = Date.now();
      run.recorderPid = recorder.pid;
      mark('recording-started');
    }
    const renderer = await assertHardwareGl(page, () => {});
    run.renderer = renderer;
    proof.hardware = hardwareRenderer(renderer);
    requireThat(proof.hardware, 'Headed hardware GPU proof unavailable');

    // Landing controls may exist before the story bridge mounts. Bootstrap
    // uses ordinary inputs only and is excluded from chapter action credit.
    if (config.bootstrapSteps) await runSteps(config.bootstrapSteps, 'bootstrap');

    if (config.readySelector) {
      await page.locator(config.readySelector).first()
        .waitFor({ state: 'visible', timeout: Math.min(MAX_WAIT_MS, Math.max(1, remaining())) });
    }
    const baseline = await waitForRuntime(MAX_WAIT_MS, 'baseline');
    requireThat(baseline, 'Read-only journey probe never became available');
    const baselineMilestones = pointer(baseline, '/state/localActor/milestones') ?? [];
    run.baselineMilestones = [...baselineMilestones];
    run.baselineCheckpoint = config.continue ? pointer(baseline, config.continue.checkpointPointer) ?? null : null;

    await runSteps(config.steps, 'steps');
    const afterSteps = await observe('after-steps');
    requireThat(afterSteps, 'Runtime snapshot unavailable after the declared actions');
    await page.screenshot({path:path.join(out,'frame.png')});
    const firstMilestones = pointer(afterSteps, '/state/localActor/milestones') ?? [];
    const firstDelta = deltaProof(baseline, afterSteps, config.deltaPointers);
    run.firstDelta = firstDelta;
    run.acceptedActionNames = acceptedActionNames({
      baselineMilestones, milestones: firstMilestones, accepted: config.acceptedMilestones
    });
    // An accepted action must be *earned*: a milestone already present at
    // baseline is not proof, and a milestone with no observable runtime delta
    // is not an action.
    proof.acceptedAction = firstDelta.moved
      ? acceptedActionCount({ baselineMilestones, milestones: firstMilestones, accepted: config.acceptedMilestones })
      : 0;
    const receiptsMoved = receiptsAdvanced(baseline, afterSteps);
    run.receiptsAdvanced = receiptsMoved;
    proof.ordinaryControls = gestures.length > 0 && gestures.every(gesture => gesture.ok)
      && (receiptsMoved || firstDelta.moved);

    if (kind === 'manual') {
      const seen = run.beatsSeen;
      let cursor = 0;
      for (const beat of config.beats) {
        const found = seen.indexOf(beat, cursor);
        if (found < 0) { cursor = -1; break; }
        cursor = found + 1;
      }
      proof.completePath = config.beats.length > 0 && cursor >= 0 && config.completionMilestones.every(m =>
        firstMilestones.includes(m) && !baselineMilestones.includes(m));
      run.declaredBeats = config.beats;
    }

    if (kind === 'recovery') {
      mark('interruption', 'ordinary Escape press');
      await perform({ type: 'press', code: 'Escape' }, 'recovery.escape');
      const until = Date.now() + config.pause.timeoutMs;
      let pausedSnapshot = null;
      while (Date.now() < until && !pausedSnapshot) {
        const value = await observe('paused-check');
        if (value && canonical(pointer(value, config.pause.pausedPointer)) === canonical(config.pause.pausedValue)) {
          pausedSnapshot = value;
        } else await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      const resume = page.locator(config.pause.resumeSelector).first();
      const resumeVisible = Boolean(pausedSnapshot) && await resume.isVisible().catch(() => false);
      proof.interrupted = Boolean(pausedSnapshot) && resumeVisible;
      run.pausedValue = pointer(pausedSnapshot, config.pause.pausedPointer) ?? null;
      requireThat(proof.interrupted, 'Escape did not produce a verified paused state with a visible resume control');
      // Hold the paused state on the recording. A reviewer has to be able to
      // HEAR what the game does while it is interrupted, not infer it.
      run.pausedHoldMs = await holdOnRecording(PAUSED_HOLD_MS, 'paused-hold');
      mark('recovery-cta', `click ${config.pause.resumeSelector}`);
      await perform({ type: 'click', selector: config.pause.resumeSelector, timeoutMs: config.pause.timeoutMs }, 'recovery.resume');
      const untilResumed = Date.now() + config.pause.timeoutMs;
      let resumed = false;
      while (Date.now() < untilResumed && !resumed) {
        const value = await observe('resume-check');
        resumed = Boolean(value) && canonical(pointer(value, config.pause.pausedPointer)) !== canonical(config.pause.pausedValue);
        if (!resumed) await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      proof.recovered = resumed;
      requireThat(resumed, 'Game did not resume after the visible resume control was clicked');
    }

    let beforeReload = afterSteps;
    let beforeMilestones = firstMilestones;
    if (kind === 'continue') {
      const checkpointBefore = pointer(afterSteps, config.continue.checkpointPointer) ?? null;
      // The checkpoint must be *earned in this session* by ordinary controls:
      // a checkpoint that already existed at baseline proves nothing.
      proof.freshCheckpoint = checkpointBefore != null
        && canonical(checkpointBefore) !== canonical(run.baselineCheckpoint);
      run.checkpointBefore = checkpointBefore;
      requireThat(proof.freshCheckpoint, 'No fresh checkpoint was earned with ordinary controls before reload');

      const durableBefore = canonicalDurableState(afterSteps, config.durablePointers);
      run.durableBefore = durableBefore;
      beforeMilestones = firstMilestones;

      // Same origin, same browser context: an ordinary page reload.
      mark('interruption', 'ordinary page reload');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: Math.min(90_000, Math.max(1, remaining())) });
      run.reloaded = { url: page.url(), sameOrigin: new URL(page.url()).origin === new URL(target).origin, sameContext: true };
      requireThat(run.reloaded.sameOrigin, 'Reload left the original origin');
      await observe('after-reload');

      // The landing Continue CTA must be VISIBLE before the story runtime is
      // ready; a CTA that only appears after the game has already booted is
      // not a landing resume affordance.
      const cta = page.locator(config.continue.ctaSelector).first();
      const untilCta = Date.now() + config.continue.timeoutMs;
      let ctaVisible = false, runtimeReadyAtCta = null;
      while (Date.now() < untilCta && !ctaVisible) {
        ctaVisible = await cta.isVisible().catch(() => false);
        if (ctaVisible) {
          const atCta = await observe('cta-visible');
          runtimeReadyAtCta = Boolean(atCta) && pointer(atCta, config.readyPointer) === true;
        } else {
          await observe('await-cta');
          await new Promise(resolve => setTimeout(resolve, POLL_MS));
        }
      }
      requireThat(ctaVisible, 'Landing Continue CTA never became visible after reload');
      proof.ctaBeforeRuntimeReady = runtimeReadyAtCta === false;
      run.runtimeReadyAtCta = runtimeReadyAtCta;

      // Hold the interrupted landing state on the recording before resuming.
      run.pausedHoldMs = await holdOnRecording(PAUSED_HOLD_MS, 'landing-hold');
      mark('continue-cta', `click ${config.continue.ctaSelector}`);
      const clicksBefore = run.clickCount;
      await perform({ type: 'click', selector: config.continue.ctaSelector, timeoutMs: config.continue.timeoutMs }, 'continue.click');
      proof.clickedContinue = run.clickCount === clicksBefore + 1;
      run.continueClicks = run.clickCount - clicksBefore;

      const afterClick = await waitForRuntime(config.continue.timeoutMs, 'first-runtime-after-continue');
      requireThat(afterClick, 'No runtime snapshot after clicking Continue');
      const durableAfter = canonicalDurableState(afterClick, config.durablePointers);
      run.durableAfter = durableAfter;
      proof.stateEqual = canonical(durableBefore) === canonical(durableAfter);
      requireThat(proof.stateEqual, 'Durable gameplay state did not survive the Continue reload');
      const reviewStorage = path.join(raw,'review-storage.json');
      await context.storageState({path:reviewStorage});
      run.reviewEntry = {storageState:reference(artifactRoot,reviewStorage),origin:new URL(page.url()).origin,chapter:afterClick.story.chapter,beat:afterClick.story.beat};
      beforeReload = afterClick;
    }

    if (config.newActionSteps) {
      const preNew = await observe('before-new-action');
      requireThat(preNew, 'Runtime snapshot unavailable before the new action');
      const preMilestones = pointer(preNew, '/state/localActor/milestones') ?? [];
      mark('new-action-start');
      await runSteps(config.newActionSteps, 'newActionSteps');
      mark('new-action-end');
      const postNew = await observe('after-new-action');
      requireThat(postNew, 'Runtime snapshot unavailable after the new action');
      const postMilestones = pointer(postNew, '/state/localActor/milestones') ?? [];
      const newDelta = deltaProof(preNew, postNew, config.deltaPointers);
      run.newDelta = newDelta;
      // NEW: measured against everything held before the interruption/reload,
      // so a milestone that was already earned cannot be replayed as proof.
      const earned = new Set([...beforeMilestones, ...preMilestones]);
      run.newAcceptedActionNames = acceptedActionNames({
        baselineMilestones: [...earned], milestones: postMilestones, accepted: config.acceptedMilestones
      });
      proof.newAcceptedAction = newDelta.moved
        ? acceptedActionCount({ baselineMilestones: [...earned], milestones: postMilestones, accepted: config.acceptedMilestones })
        : 0;
      proof.ordinaryControls = proof.ordinaryControls && gestures.every(gesture => gesture.ok)
        && (receiptsAdvanced(preNew, postNew) || newDelta.moved);
    }

    // Keep playing on the recording after the proved new action so the tail —
    // handback, score decay, whatever the game does next — is audible.
    if (media) {
      run.tailMs = await holdOnRecording(FINAL_TAIL_MS, 'final-tail');
      mark('recording-tail-end');
      run.recordedAudioSecondsAtStop = recordedSeconds(audioFile);
    }

    run.previewAfter = await verifyPreview(url, identity.ownership);
    identity.verify();
    run.identityStable = true;
  } catch (error) {
    errors.push(error.message);
  } finally {
    clearTimeout(watchdog);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    const close = async (name, thing, method = 'close') => {
      if (!thing) { cleanup.closed[name] = 'absent'; return; }
      try { await thing[method](); cleanup.closed[name] = 'closed'; }
      catch (error) { cleanup.closed[name] = `failed: ${error.message}`; cleanup.errors.push(`${name}: ${error.message}`); }
    };
    // Recorder first: parec must flush its WAV before the browser that feeds
    // the sink disappears. Then the video, which only exists once the context
    // has closed. Then the browser, then the owned sink.
    if (media) {
      try { mediaCleanup.recorderStopped = await stopChild(recorder); run.audioStoppedAtWallMs = Date.now(); }
      catch (error) { mediaCleanup.recorderStopped = false; cleanup.errors.push(`recorder: ${error.message}`); }
    }
    await close('page', page);
    await close('context', context);
    if (media) {
      try {
        if (videoHandle) await videoHandle.saveAs(videoFile);
        run.videoStoppedAtWallMs = Date.now();
        cleanup.closed.video = fs.existsSync(videoFile) ? 'saved' : 'missing';
      } catch (error) { cleanup.closed.video = `failed: ${error.message}`; cleanup.errors.push(`video: ${error.message}`); }
    }
    await close('browser', browser);
    await close('browserServer', server);
    if (media) {
      try {
        Object.assign(mediaCleanup, closeOwnedSink(device));
        run.audioDevice = { ...(run.audioDevice ?? {}), defaultSinkAfter: mediaCleanup.defaultSinkAfter,
          defaultChanged: mediaCleanup.defaultSinkUnchanged === false };
      } catch (error) {
        mediaCleanup.moduleRemoved = false; mediaCleanup.defaultSinkUnchanged = false;
        cleanup.errors.push(`audio cleanup: ${error.message}`);
      }
    }
    if (preview) { try { preview.stop(); cleanup.closed.preview = 'stopped'; } catch (error) { cleanup.errors.push(`preview: ${error.message}`); } }
    cleanup.phase = 'done';
    cleanup.media = mediaCleanup;
    proof.cleanup = cleanup.errors.length === 0
      && ['page', 'context', 'browser'].every(name => ['closed', 'absent'].includes(cleanup.closed[name]))
      && (!media || (mediaCleanup.recorderStopped === true && mediaCleanup.moduleRemoved === true
        && mediaCleanup.defaultSinkUnchanged === true));
  }

  run.gestures = gestures;
  // Decode after teardown: only what the recorder actually flushed and the
  // decoder could actually read counts as audible/visible evidence.
  let decoded = { video: null, audio: null };
  if (media) {
    decoded = decodeControlMedia({ videoFile, audioFile });
    Object.assign(proof, controlMediaProof({ ...decoded, isolation, mediaCleanup, minAudioSeconds: MIN_AUDIO_SECONDS }));
    run.mediaTimeline = mediaTimeline({ marks,
      audioStartedAtWallMs: run.audioStartedAtWallMs ?? null, audioStoppedAtWallMs: run.audioStoppedAtWallMs ?? null,
      videoStartedAtWallMs: run.videoStartedAtWallMs ?? null, videoStoppedAtWallMs: run.videoStoppedAtWallMs ?? null });
    run.mediaClock = CLOCK_NOTE;
    run.mediaDecode = decoded;
    for (const problem of mediaProblems(proof, { ...decoded, isolation })) errors.push(problem);
    writeJson(path.join(raw, 'media-proof.json'), { ...decoded, isolation, timeline: run.mediaTimeline, cleanup: mediaCleanup });
  }
  run.proof = proof;
  const decision = verdict(kind, proof, media);
  passed = decision.passed && errors.length === 0;
  writeJson(path.join(raw, 'provenance.json'), run);
  writeJson(path.join(raw, 'cleanup.json'), cleanup);
  writeJson(path.join(raw, 'observations.json'), { trace: trace.slice(-400), pageErrors, errors });
  const rawRefs = fs.readdirSync(raw).filter(file => fs.statSync(path.join(raw, file)).isFile())
    .map(file => reference(artifactRoot, path.join(raw, file)));
  const report = {
    schema: 'paravoxia.chapterLoopProbe.v1',
    candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    kind, chapter: config.chapter, proof, missing: decision.missing,
    raw: rawRefs,
    reviewEntry: passed && kind === 'continue' ? run.reviewEntry : null,
    media: [
      ...(fs.existsSync(path.join(out, 'frame.png')) ? [{ kind: 'frame', ...reference(artifactRoot, path.join(out, 'frame.png')) }] : []),
      ...(media && fs.existsSync(videoFile) ? [{ kind: 'video', ...reference(artifactRoot, videoFile) }] : []),
      ...(media && fs.existsSync(audioFile) ? [{ kind: 'audio', ...reference(artifactRoot, audioFile) }] : [])
    ],
    mediaTimeline: run.mediaTimeline ?? null,
    artifactRoot,
    exitCode: passed ? 0 : 2, reused: false, status: passed ? 'passed' : 'inconclusive', errors,
    provenance: {
      sourceManifestSha256: identity.sourceManifestSha256,
      buildSha256: identity.buildSha256,
      transportSha256: run.transportSha256
    }
  };
  writeJson(path.join(out, 'report.json'), report);
  requireThat(passed, `PROBE-ERROR-INCONCLUSIVE: ${errors.join('; ') || decision.missing.join(', ')}`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = name => { const index = process.argv.indexOf(`--${name}`); return index < 0 ? undefined : process.argv[index + 1]; };
  const options = {
    repo: path.resolve(value('repo') ?? ROOT), chapter: value('chapter'), kind: value('case'),
    config: value('config'), preview: value('preview'), out: value('out')
  };
  try {
    if (process.argv.includes('--describe')) {
      const result = describeControlCapabilities(options);
      if (options.out) writeJson(path.join(options.out, 'capabilities.json'), result);
      console.log(JSON.stringify(result));
      if (!result.supported) process.exitCode = 2;
    } else {
      const report = await captureControls(options);
      console.log(JSON.stringify({ status: report.status, kind: report.kind, proof: report.proof }));
    }
  } catch (error) {
    console.error(`PROBE-ERROR-INCONCLUSIVE: ${error.message}`);
    process.exitCode = 2;
  }
}
