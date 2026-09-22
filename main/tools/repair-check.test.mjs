import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runChecks} from './repair-check.mjs';
const plan={schema:'paravoxia.repairChecks.v1',runtime:[['probe','manual-and-movie']],checks:[['tests','affected']],final:[['npm','run','verify']]};
function fixture(fn){const out=mkdtempSync(join(tmpdir(),'repair-check-'));try{fn(out);}finally{rmSync(out,{recursive:true,force:true});}}
test('a failing player action prevents broad checks',()=>fixture(out=>{const calls=[];const report=runChecks(plan,{out,identify:()=> 'a',final:true,execute:(cmd)=>{calls.push(cmd);return {status:1,stdout:'stalled'};}});assert.deepEqual(calls,['probe']);assert.equal(report.passed,false);}));
test('same source reuses successful static proof but always probes runtime',()=>fixture(out=>{const calls=[];const opts={out,identify:()=> 'a',final:true,execute:(cmd)=>{calls.push(cmd);return {status:0,stdout:'pass'};}};runChecks(plan,opts);calls.length=0;const report=runChecks(plan,opts);assert.deepEqual(calls,['probe']);assert.equal(report.checks.filter(c=>c.reused).length,2);assert.equal(report.accepted,false);calls.length=0;runChecks(plan,{...opts,identify:()=> 'changed'});assert.deepEqual(calls,['probe','tests','npm']);}));
test('source drift during probe stops acceptance and further checks',()=>fixture(out=>{let source='a';const report=runChecks(plan,{out,identify:()=>source,execute:()=>{source='b';return {status:0};}});assert.equal(report.blocker,'source-changed-during-checks');assert.equal(report.passed,false);}));

test('preparation recreates build outputs and final verification cannot be omitted',()=>fixture(out=>{
 const calls=[];
 const opts={out,identify:()=> 'a',final:true,execute:(cmd)=>{calls.push(cmd);return {status:0,stdout:'pass'};}};
 const focused={...plan,prepare:[['build']],final:[]};
 runChecks(focused,opts);assert.deepEqual(calls,['build','probe','tests','npm']);
 calls.length=0;runChecks(focused,opts);assert.deepEqual(calls,['build','probe']);
}));
