import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepareFinishRenewal, renewFinish, releasePolicySnapshot } from './finish-renewal.mjs';
import { sha, DEFAULT_LIMITS } from './contract.mjs';
import { writeJson, readJson, reference, snapshot } from './store.mjs';
import { firstPlayableDeadline } from './budget.mjs';

function fixture(t) {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'finish-renewal-'));t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  execFileSync('git',['init','-q'],{cwd:repo});
  const run=path.join(repo,'.codex/chapter-loops/ch14-test');fs.mkdirSync(run,{recursive:true});
  writeJson(path.join(repo,'main/story-authority.json'),{status:{releaseStoryCeiling:'ch4-arrival'}});
  const put=(name,obj)=>{const file=path.join(run,name);writeJson(file,obj);return reference(repo,file);};
  const role='roles/6-build'; const raw={verdict:'BLOCKED',summary:'Capture setup unavailable'};
  const builderResult=put(`${role}/last-message.txt`,raw),builderTransport=put(`${role}/transport.json`,{completed:true,reported:true,exitCode:0,session:'retained'}),builderPacket=put(`${role}/packet.json`,{stage:'build'});
  fs.writeFileSync(path.join(run,role,'transcript.jsonl'),JSON.stringify({type:'item.completed',item:{type:'agent_message',text:fs.readFileSync(path.join(repo,builderResult.path),'utf8')}})+'\n');
  const recipe=put('recipe.json',{direction:'untouched'});const limits={...DEFAULT_LIMITS};
  const state={id:'ch14-test',chapter:'ch14',status:'BLOCKED_CONTRACT',active:null,cursor:1,queue:['council','build','compose'],receipts:{recipe},
    brief:{allowedPaths:['main/src/story/'],toolRefs:[],verification:{observe:{look:{media:[]}}}},limits,usage:{roleLaunches:6,modelTurns:61,inputTokens:206197,cacheReadTokens:4563072,outputTokens:36485},activeMs:1429005,retries:1,
    sessions:['prior'],refinementUsed:false,frozen:{},acceptedSource:snapshot(repo),clock:{startedAt:'2026-09-08T00:06:46.000Z',deadlineAt:'2026-09-08T08:06:46.000Z'},failure:{message:'Finding needs actual evidence'},providerHandoffs:[{firstPlayableDeadlineAt:'2026-09-08T03:43:32.000Z'}]};
  const policySeal=s=>sha({brief:s.brief,limits:s.limits,frozen:s.frozen,clock:s.clock,finishRenewals:s.finishRenewals});state.policySha256=policySeal(state);
  const review=put('review.json',{verdict:'PASS',handoffSha256:sha([])}),checks=[put('tests.json',{passed:true})];
  const a={schema:'paravoxia.chapterFinishAuthority.v1',request:'lets fix the blockers you encountered and finish it up',runId:state.id,runPath:run,chapter:'ch14',extraInfrastructureRetries:1,
    previousPolicySha256:state.policySha256,previousStateSha256:sha(state),requestedAt:'2026-09-08T20:33:28.000Z',deadlineAt:'2026-09-09T04:33:28.000Z',recipeSha256:recipe.sha256,
    builderTransport,builderResult,builderPacket,files:[],handoff:put('handoff.json',{repair:'existing implementation'}),validation:put('validation.json',{passed:true,handoffSha256:sha([]),review,checks})};
  a.allowedPathAdditions=['main/story-authority.json','main/src/game/systems/interactionSystem.ts'];a.lookMedia=[{kind:'frame',path:'frame.png'}];
  const helpers={policySeal,validateBrief(){},now:Date.parse('2026-09-08T20:40:00Z')};
  writeJson(path.join(run,'state.json'),state);writeJson(path.join(run,'observations.json'),{look:2,listen:0,firstPlayable:null,receipts:[]});
  writeJson(path.join(repo,'.codex/chapter-loops/chapters.json'),{ch14:path.relative(repo,run)});
  return {repo,run,state,a,helpers,put};
}
test('explicit finish continuation retains recipe, all spend, observations and index',t=>{
  const f=fixture(t),before=structuredClone(f.state),auth=f.put('authority.json',f.a);
  renewFinish(f.repo,f.run,path.join(f.repo,auth.path),f.helpers);const s=readJson(path.join(f.run,'state.json'));
  for(const key of ['usage','activeMs','retries','limits','receipts','queue','cursor','sessions','refinementUsed'])assert.deepEqual(s[key],before[key]);
  assert.equal(s.status,'RUNNING');assert.equal(s.finishRenewals.length,1);assert.equal(s.ownerRecoveries.length,1);
  assert.equal(readJson(path.join(f.run,'observations.json')).look,2);
  assert.equal(readJson(path.join(f.repo,'.codex/chapter-loops/chapters.json')).ch14,path.relative(f.repo,f.run));
  assert.deepEqual(readJson(path.join(f.repo,s.finishRenewals[0].previousState.path)),before);
  assert.equal(firstPlayableDeadline(s),Date.parse(f.a.requestedAt)+DEFAULT_LIMITS.firstPlayableMs);
});
test('finish continuation rejects absent authority, substituted recipe, clock extension and repeat',t=>{
  const f=fixture(t);
  for(const change of [{request:'continue'},{recipeSha256:'0'.repeat(64)},{deadlineAt:'2026-09-10T04:33:28Z'},{previousStateSha256:'0'.repeat(64)},{allowedPathAdditions:[]}])
    assert.throws(()=>prepareFinishRenewal(f.repo,f.state,{...f.a,...change},f.helpers));
  assert.throws(()=>prepareFinishRenewal(f.repo,{...f.state,finishRenewals:[{}]},f.a,f.helpers),/unsuccessful builder/);
});
test('release protection includes newly added release and demo fields but permits runtime registration',()=>{
 const before={status:{releaseStoryCeiling:'ch4-arrival',runtimeStoryCeiling:'ch13-common'},demo:{enabled:false}};
 assert.deepEqual(releasePolicySnapshot(before),releasePolicySnapshot({...before,status:{...before.status,runtimeStoryCeiling:'ch14-return'}}));
 assert.notDeepEqual(releasePolicySnapshot(before),releasePolicySnapshot({...before,publish:{enabled:true}}));
 assert.notDeepEqual(releasePolicySnapshot(before),releasePolicySnapshot({...before,demo:{enabled:true}}));
});
test('finish continuation refuses altered builder bytes and unlisted game edits',t=>{
  const f=fixture(t);writeJson(path.join(f.repo,'main/story-authority.json'),{status:{releaseStoryCeiling:'changed'}});
  assert.throws(()=>prepareFinishRenewal(f.repo,f.state,f.a,f.helpers),/Unlisted finish repair/);
  writeJson(path.join(f.repo,'main/story-authority.json'),{status:{releaseStoryCeiling:'ch4-arrival'}});
  fs.appendFileSync(path.join(f.repo,f.a.builderResult.path),' ');
  assert.throws(()=>prepareFinishRenewal(f.repo,f.state,f.a,f.helpers),/Evidence changed/);
});
