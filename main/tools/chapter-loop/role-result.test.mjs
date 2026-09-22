import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRoleResult} from './role-result.mjs';
import {validateResult} from './contract.mjs';
const raw={schema:'paravoxia.chapterLoopRole.v1',summary:'A concrete authored direction.',verdict:'PASS',evidence:[],findings:[],keep:[],direction:{dramaticQuestion:'The question',playerActions:['Real action'],entryState:'Original entry',exitState:'Original ending',signatureMoment:'The original moment'},anchors:[{id:'entry',event:'The actual first act.'},{id:'exit',event:'The actual final act.'}]};
test('named event objects retain exact order and event text through contract validation',()=>{
  const result=decodeRoleResult('plan',JSON.stringify(raw));validateResult('plan',result);
  assert.deepEqual(result.anchors,['entry','exit']);assert.deepEqual(result.anchorEvents,raw.anchors);
  for(const key of Object.keys(raw).filter(k=>k!=='anchors'))assert.deepEqual(result[key],raw[key]);
});
test('existing string anchors and reviewer results are unchanged',()=>{
  const strings={...raw,anchors:['entry','exit']};assert.deepEqual(decodeRoleResult('plan',JSON.stringify(strings)),strings);
  assert.deepEqual(decodeRoleResult('player',JSON.stringify(raw)),raw);
});
test('ambiguous, duplicate or lossy anchor representations are refused',()=>{
  for(const anchors of [[{id:'entry',event:'A',extra:true}],[{id:'entry'}],[{id:'same',event:'A'},{id:'same',event:'B'}]])
    assert.throws(()=>decodeRoleResult('plan',JSON.stringify({...raw,anchors})));
  assert.throws(()=>decodeRoleResult('plan',JSON.stringify({...raw,anchorEvents:[]})));
});
