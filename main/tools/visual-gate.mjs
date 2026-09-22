// --- The visual gate -----------------------------------------------------------------
//
// Boots its own preview server, runs the HUD overlap sweep against it, and
// tears the server down. One command, no manual setup, safe to run in CI.
//
// This exists because the sweep was previously a script you had to remember to
// run, with a server you had to remember to start — which is the same failure
// mode the sweep itself was built to prevent. An invariant nobody invokes is
// not an invariant.
//
// It is deliberately NOT part of `npm run verify`: it needs a build plus a real
// browser and takes minutes, where `verify` is the fast gate. Run it before
// shipping HUD or story-surface changes, and in CI.
//
//   npm run verify:visual
//   PARAVOXIA_VISUAL_ALL=1 npm run verify:visual     # every beat in the order
//
// Server lifecycle and the identity check live in tools/lib/previewServer.mjs,
// shared with every other probe: a probe once measured a different project
// after its port was taken over, and nothing looked wrong.

import process from 'node:process';
import { run, startParavoxiaPreview } from './lib/previewServer.mjs';

const tag = message => console.log(`[visual-gate] ${message}`);

let preview;
let exitCode = 1;
try {
  preview = await startParavoxiaPreview({ build: !process.env.PARAVOXIA_URL, log: tag });
  exitCode = await run('node', ['tools/hud-overlap-sweep.mjs'], {
    PARAVOXIA_URL: preview.url,
    ...(process.env.PARAVOXIA_VISUAL_ALL === '1' ? { PARAVOXIA_HUD_SWEEP_ALL: '1' } : {})
  });
} catch (error) {
  console.error(`[visual-gate] ${error.message}`);
  exitCode = 1;
} finally {
  preview?.stop();
}

process.exit(exitCode);
