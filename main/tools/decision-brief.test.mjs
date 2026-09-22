import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDecisionBrief} from './creative-triad-gate.mjs';
function errors(items,iterations=[]){const errors=[];const collector={assert:(ok,code)=>{if(!ok)errors.push(code);},warn:()=>{}};validateDecisionBrief({schema:'paravoxia.decisionBrief.v1',runId:'repair',authoredBy:'chapter-director',authoredAt:'2026-09-06T00:00:00Z',items},{runId:'repair',authority:[]},'final',iterations,collector);return errors;}
test('settled scope needs no synthetic approval questions',()=>assert.deepEqual(errors([]),[]));
test('unresolved question still blocks; invented delegation cannot authorize work',()=>{
 const item={id:'decision',kind:'creative',question:'Choose the reveal?',options:['Small'],recommended:'Small',decidedBy:'delegate',status:'pending'};
 assert.ok(errors([item]).includes('brief.pending'));assert.ok(errors([item]).includes('brief.item-authority'));
});
test('a later discovered question is a lesson instead of retroactive creative failure',()=>assert.deepEqual(errors([],[{route:'contract-question',iteration:1,questionId:'later'}]),[]));

import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
test('standing delegation must match current bytes in the lock and cannot authorize release', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-authority-'));
  try {
    const grant = JSON.stringify({schema:'paravoxia.ownerStandingAuthority.v1',scope:'Repair the existing scene',instructions:['Approve in-scope repairs']});
    writeFileSync(join(root,'authority.json'),grant);
    const ref = {path:'authority.json',sha256:createHash('sha256').update(grant).digest('hex')};
    const item = {id:'repair',kind:'creative',question:'Repair the existing action?',options:['Repair'],recommended:'Repair',decidedBy:'delegate',status:'decided',decision:'Repair',decidedAt:'2026-09-06T00:00:00Z',authorityRef:ref,delegationRationale:'The owner delegated this in-scope repair.'};
    const check = () => {
      const errors=[];
      validateDecisionBrief({schema:'paravoxia.decisionBrief.v1',runId:'repair',authoredBy:'director',authoredAt:item.decidedAt,items:[item]}, {runId:'repair',authority:[ref]}, 'final', [], {assert:(ok,code)=>{if(!ok)errors.push(code);},warn:()=>{}}, root);
      return errors;
    };
    assert.deepEqual(check(),[]);
    item.kind='release'; assert.ok(check().includes('brief.item-authority'));
    item.kind='creative'; writeFileSync(join(root,'authority.json'),grant+' ');
    assert.ok(check().includes('brief.item-authority'));
  } finally {rmSync(root,{recursive:true,force:true});}
});
