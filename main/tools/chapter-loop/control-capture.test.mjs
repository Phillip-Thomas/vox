import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedActionCount, canonicalDurableState, deltaProof, validateControlConfig, verdict, obligationsFor, describeControlCapabilities } from './control-capture.mjs';
const config = { chapter: 'ch99', route: '/?story=ch99-entry&journeyprobe=1', beats: ['ch99-entry', 'ch99-exit'], acceptedMilestones: ['first', 'last'], steps: [{type:'press',code:'KeyF'}] };
test('accepted actions cannot replay an old milestone or count duplicate receipts', () => {
  assert.equal(acceptedActionCount({ baselineMilestones:['old'], milestones:['old','new','new'], accepted:['old','new'] }),1);
  assert.equal(acceptedActionCount({ baselineMilestones:['old'], milestones:['old'], accepted:['old'] }),0);
});
test('unchanged or missing poses do not prove movement', () => {
  assert.equal(deltaProof({p:[1,2]}, {p:[1,2]}, ['/p']).moved,false);
  assert.equal(deltaProof({}, {p:[1,2]}, ['/p']).moved,false);
  assert.equal(deltaProof({p:[1,2]}, {p:[2,2]}, ['/p']).moved,true);
});
test('durable equality fails closed on absent values and preserves route sequence', () => {
  assert.throws(()=>canonicalDurableState({}, ['/story/beat']), /Missing durable/);
  assert.notDeepEqual(canonicalDurableState({route:['a','b']},['/route']),canonicalDurableState({route:['b','a']},['/route']));
});
test('Continue requires a real click, equality and a newly accepted action', () => {
  const proof = Object.fromEntries(obligationsFor('continue').map(k=>[k,true]));
  assert.equal(verdict('continue',proof).passed,true);
  for(const key of ['clickedContinue','stateEqual','newAcceptedAction','freshCheckpoint']) assert.equal(verdict('continue',{...proof,[key]:false}).passed,false);
  assert.equal(verdict('continue',{...proof,newAcceptedAction:0}).passed,false);
});
test('manual configuration rejects automatic routes, injection and missing chapter action data', () => {
  assert.equal(validateControlConfig(config,'manual').chapter,'ch99');
  assert.throws(()=>validateControlConfig({...config,route:config.route+'&movie=1'},'manual'),/automatic/);
  assert.throws(()=>validateControlConfig({...config,steps:[]},'manual'),/non-empty/);
  assert.throws(()=>validateControlConfig({...config,storageState:{}},'manual'));
  assert.throws(()=>validateControlConfig(config,'continue'),/continue block/);
});

test('interruption cases must also produce owned, decodable, audible media', () => {
  for (const kind of ['recovery', 'continue']) {
    const withMedia = obligationsFor(kind, true);
    for (const name of ['videoDecodes', 'audioDecodes', 'audioIsolated', 'mediaCleanup']) {
      assert.ok(withMedia.includes(name), `${kind} must require ${name}`);
      const proof = Object.fromEntries(withMedia.map(k => [k, true]));
      assert.equal(verdict(kind, { ...proof, [name]: false }, true).passed, false);
      // The same proof without the media obligations still passes the legacy
      // control verdict, so media never silently re-judges control behaviour.
      assert.equal(verdict(kind, { ...proof, [name]: false }).passed, true);
    }
  }
  // Manual play may be captured without audio: by default it carries no media
  // obligation, and an explicitly audible manual run is held to the same bar.
  assert.deepEqual(obligationsFor('manual', false), obligationsFor('manual'));
  assert.ok(!obligationsFor('manual').includes('audioDecodes'));
  assert.ok(obligationsFor('manual', true).includes('audioDecodes'));
  assert.equal(verdict('nope', {}, true).passed, false);
  assert.deepEqual(obligationsFor('nope', true), []);
});

test('capabilities publish the media files an interruption case will produce', () => {
  const recovery = describeControlCapabilities({ kind: 'recovery' });
  assert.equal(recovery.media.required, true);
  assert.deepEqual(recovery.media.files.map(m => m.kind).sort(), ['audio', 'frame', 'video']);
  assert.ok(recovery.obligations.includes('audioIsolated'));
  const manual = describeControlCapabilities({ kind: 'manual' });
  assert.equal(manual.media.required, false);
  assert.deepEqual(manual.media.files, [{ kind: 'frame', path: 'frame.png' }]);
});
