#!/usr/bin/env node
/* Run-local INTERFACE RECHECK. Read-only: calls only __paravoxiaCommonGround.snapshot()
   and reports its shape. No game source, no grants, no capture claims. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openParavoxia, waitReady } from '../../../../../../main/tools/lib/evidence.mjs';
import { ART } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard } from '../lib/ownedSession.mjs';

const own = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (own.state !== 'running') throw new Error('preview not running');
const guard = createOwnedSessionGuard({ log: (m) => console.log(m), label: 'hook-recheck' });
let session = null;
try {
  session = guard.adopt(await openParavoxia({
    url: '?story=ch13-home&journeyprobe=1&debug=1&movie=1',
    preview: { url: own.url, stop() {} }, build: false,
    viewport: { width: 1280, height: 720 }
  }));
  await waitReady(session.page, 60000);
  for (const t of [1000, 4000, 9000]) {
    await new Promise((r) => setTimeout(r, t === 1000 ? 1000 : 3000));
    const r = await session.page.evaluate(() => {
      const ns = window.__paravoxiaCommonGround;
      const out = { atMs: Date.now(), nsPresent: !!ns, keys: ns ? Object.keys(ns) : null };
      if (ns && typeof ns.snapshot === 'function') {
        try {
          const s = ns.snapshot();
          out.snapshotKeys = Object.keys(s);
          out.bodyCentre = s.bodyCentre; out.bodyPose = s.bodyPose; out.up = s.up;
          out.supported = s.supported; out.worldBound = s.worldBound;
          out.groundOffsetUnits = s.groundOffsetUnits;
          out.rail = s.rail; out.railCursor = s.railCursor;
          out.score = s.score; out.pendingAnchors = s.pendingAnchors;
          out.beat = s.beat;
          out.diagnosticKeys = s.diagnostic ? Object.keys(s.diagnostic) : null;
          out.diagnostic = s.diagnostic;
        } catch (e) { out.snapshotError = String(e); }
      }
      out.otherHooks = {
        diagnosticMember: !!(ns && typeof ns.diagnostic === 'function'),
        scoreDiagnosticMember: !!(ns && typeof ns.scoreDiagnostic === 'function')
      };
      return out;
    });
    console.log(`--- t=${t}\n${JSON.stringify(r, null, 1)}`);
  }
} finally {
  await guard.stopOnce('recheck-finally');
  console.log('cleanup:', JSON.stringify(guard.cleanupReceipt({ probe: 'hook-recheck' }).state));
}
