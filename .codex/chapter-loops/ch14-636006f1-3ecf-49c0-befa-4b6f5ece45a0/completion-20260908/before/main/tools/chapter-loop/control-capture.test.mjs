import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedActionCount, canonicalDurableState, deltaProof, validateControlConfig, verdict, obligationsFor } from './control-capture.mjs';
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
