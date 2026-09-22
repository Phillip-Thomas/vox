import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyLadderDifference as classify } from './storyLadderDiff.mjs';

const row = (health, changes = {}) => ({
  beat: 'ch1-depth', objective: { id: 'pod', health, workOrder: ['RECOVER POD.'] },
  policy: { allowMine: false }, ...changes
});
const missing = row('missing-marker'), ready = row('ready');
const options = { allowHealth: true };

test('exact traces pass without any exception', () => {
  assert.equal(classify([ready], [structuredClone(ready)]).unchanged, true);
});
test('readiness upgrade needs the explicit original exception', () => {
  assert.equal(classify([missing], [ready]).allowed, false);
  assert.equal(classify([missing], [ready], options).allowed, true);
});
test('health regressions and other changes never pass by stripping health', () => {
  for (const [a, b] of [[ready, missing], [row('idle'), ready], [missing, row('failed')]]) {
    assert.equal(classify([a], [b], options).allowed, false);
  }
});
test('one or two leading observations of the same missing target may disappear', () => {
  assert.equal(classify([missing, ready], [ready], options).dropped, 1);
  assert.equal(classify([missing, missing, ready], [ready], options).dropped, 2);
  assert.equal(classify([missing, missing, missing, ready], [ready], options).allowed, false);
});
test('a dropped action cannot hide behind a later occurrence of its objective id', () => {
  const changed = row('missing-marker', { objective: { id: 'pod', health: 'missing-marker', workOrder: ['HARVEST FIRST.'] } });
  assert.equal(classify([changed, ready], [ready], options).allowed, false);
  assert.equal(classify([ready, ready], [ready], options).allowed, false);
});
test('a missing objective remains a failure', () => {
  assert.deepEqual(classify([ready], [], options).missing, ['pod']);
  assert.equal(classify([ready], [], options).allowed, false);
});
test('copy and input-policy differences remain failures during readiness upgrades', () => {
  const changedCopy = row('ready', { objective: { ...ready.objective, workOrder: ['NEW ACTION.'] } });
  const changedPolicy = row('ready', { policy: { allowMine: true } });
  for (const after of [changedCopy, changedPolicy]) {
    assert.equal(classify([missing], [after], options).allowed, false);
  }
});
test('matched comparisons do not mutate the retained evidence', () => {
  const before = [missing, ready], after = [ready];
  const saved = structuredClone({ before, after });
  classify(before, after, options);
  assert.deepEqual({ before, after }, saved);
});
