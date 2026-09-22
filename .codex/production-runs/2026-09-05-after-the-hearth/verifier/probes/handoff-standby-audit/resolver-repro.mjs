// READ-ONLY CPU reproduction of the SHIPPED story world resolvers.
// No game source is modified; module is bundled out-of-tree and executed in node.
import {
  resolveStoryRuntimeWorldId,
  resolveStoryBootWorldId,
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID
} from './bundle/tidegardenRoute.mjs';

const ORIGIN = STORY_PRIMARY_WORLD_ID;   // slot 0
const HEARTH = TIDEGARDEN_WORLD_ID;      // slot 1 (departure)
const pt = beat => ({ chapter: 'ch13', beat });

const cases = [
  // label, currentWorldId, activePlanetId, beat
  ['pre-handoff  (cruising)', HEARTH, HEARTH, 'ch13-return'],
  ['POST-handoff (committed)', ORIGIN, ORIGIN, 'ch13-return'],
  ['post-landing survey',      ORIGIN, ORIGIN, 'ch13-survey'],
  ['post-landing common',      ORIGIN, ORIGIN, 'ch13-common'],
  ['ch10 control post-handoff', ORIGIN, ORIGIN, 'ch10-ask'],
  ['ch8 control post-handoff', HEARTH, HEARTH, 'ch8-crossing']
];
console.log('ORIGIN=%s  HEARTH=%s', ORIGIN, HEARTH);
for (const [label, cw, apid, beat] of cases) {
  const runtime = resolveStoryRuntimeWorldId(cw, true, pt(beat), apid);
  const boot = resolveStoryBootWorldId(cw, true, pt(beat));
  console.log('%s | beat=%-12s current=%-8s active=%-8s -> runtime=%-8s boot=%-8s %s',
    label.padEnd(26), beat, cw, apid, runtime, boot,
    runtime === cw ? 'STABLE' : '*** SWAP BACK TO ' + runtime + ' ***');
}
