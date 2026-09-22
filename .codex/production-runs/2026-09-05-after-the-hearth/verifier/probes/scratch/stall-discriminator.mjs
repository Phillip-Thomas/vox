#!/usr/bin/env node
/* BOUNDED DISCRIMINATOR for VF4-SURVEY-STALL-1.
   Question: while the rail is frozen mid-walk, is the body blocked by physical
   collision, or is the navigator simply issuing no controls?
   Method: reach the frozen state, sample the pose, then send ORDINARY shipped
   movement keys (the same keys a player presses) for bounded windows and
   measure real displacement. No teleport, no grant, no predicate change, no
   progress setter. Movement input is not a rescue and no result here is
   counted as journey progress. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { openParavoxia, waitReady } from '../../../../../../main/tools/lib/evidence.mjs';
import { ART, CAPTURES } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir } from '../lib/sourceSnapshot.mjs';

const outDir = resolve(CAPTURES, process.argv[process.argv.indexOf('--out') + 1]);
assertFreshOutputDir(outDir, { what: 'stall-discriminator' });
mkdirSync(outDir, { recursive: true });
const own = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (own.state !== 'running') throw new Error('preview not running');
const log = [];
const say = (m) => { console.log(`[disc] ${m}`); log.push(`${new Date().toISOString()} ${m}`); };
const snap = (page) => page.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return { bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, supported: s.supported,
    rail: s.rail, railCursor: s.railCursor, phase: s.diagnostic?.survey?.phase,
    samples: s.diagnostic?.survey?.samples, walked: s.diagnostic?.survey?.walkedUnits,
    hold: s.diagnostic?.holdReason };
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const guard = createOwnedSessionGuard({ log: say, label: 'stall-discriminator' });
const results = [];
try {
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1&movie=1',
    preview: { url: own.url, stop() {} }, build: false, viewport: { width: 1280, height: 720 }
  }));
  await waitReady(session.page, 60000);
  // wait for the frozen drawing state
  let st = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 500));
    st = await snap(session.page);
    if (st?.phase === 'drawing' && st.railCursor === 1) break;
  }
  say(`reached: ${JSON.stringify(st)}`);
  // confirm it is actually frozen for 8 s with no input
  const before = st.bodyCentre;
  await new Promise((r) => setTimeout(r, 8000));
  let after = (await snap(session.page)).bodyCentre;
  const driftNoInput = dist(before, after);
  say(`baseline 8 s with NO input: displacement ${driftNoInput}`);
  results.push({ trial: 'no-input-8s', displacement: driftNoInput, before, after });

  // ORDINARY movement keys, one at a time, bounded
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    const b = (await snap(session.page)).bodyCentre;
    await session.page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 1200));
    await session.page.keyboard.up(key);
    await new Promise((r) => setTimeout(r, 600));
    const s2 = await snap(session.page);
    const d = dist(b, s2.bodyCentre);
    say(`${key} held 1.2 s -> displacement ${d.toFixed(4)}  cursor=${s2.railCursor} phase=${s2.phase} samples=${s2.samples} walked=${s2.walked}`);
    results.push({ trial: key, displacement: d, before: b, after: s2.bodyCentre, state: s2 });
  }
  const post = await snap(session.page);
  say(`post-input state: ${JSON.stringify(post)}`);
  // does the rail resume on its own after being nudged?
  await new Promise((r) => setTimeout(r, 10000));
  const later = await snap(session.page);
  say(`10 s after input, no further keys: ${JSON.stringify(later)}`);
  results.push({ trial: 'post-input-idle-10s', state: later });
  writeFileSync(join(outDir, 'discriminator.json'), `${JSON.stringify({
    schema: 'paravoxia.verifier.stallDiscriminator.v1',
    question: 'physical collision vs navigator issuing no controls',
    isAcceptance: false,
    inputNote: 'Ordinary shipped movement keys only. No teleport, grant, predicate change or progress setter. Not counted as journey progress.',
    renderer: session.renderer, results, log
  }, null, 2)}\n`);
} finally {
  await guard.stopOnce('finally');
  say(`cleanup ${guard.cleanupReceipt({ probe: 'stall-discriminator' }).state}`);
}
