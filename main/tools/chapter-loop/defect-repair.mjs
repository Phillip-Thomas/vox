import fs from 'node:fs';
import path from 'node:path';
import {requireThat,sha} from './contract.mjs';
import {acquireLock,readJson,writeJson,checkRef,reference,snapshot,differences,assertFrozen,inside,allowedPath} from './store.mjs';

// A subsequent, explicit owner bug-fix commission is separate from the default
// single creative refinement. Keep its receipt, original spend and failed proof.
export function repairDefects(repo,run,authorityFile,{policySeal,validateBrief}) {
 const unlock=acquireLock(path.join(run,'.runner.lock'));
 try {
  const file=path.join(run,'state.json'),bytes=fs.readFileSync(file),state=JSON.parse(bytes),a=readJson(authorityFile);
  requireThat(!state.active&&!state.activeRole&&state.policySha256===policySeal(state),'Exact inactive policy required');
  requireThat(!fs.existsSync(path.join(run,'STOP')),'Owner stop remains authoritative');
  requireThat(a.schema==='paravoxia.ownerDefectRepair.v1'&&a.request==='fix them'&&a.runId===state.id
   &&a.previousStateSha256===sha(bytes)&&a.failureSha256===sha(state.failure)&&a.oneTargetedPass===true,'Explicit owner defect-fix request and exact checkpoint required');
  requireThat(state.status==='BLOCKED_INFRASTRUCTURE'&&state.queue[state.cursor]==='verify-final'
   &&state.refinementUsed&&!state.ownerDefectRepairs?.length,'Only one newly commissioned defect repair at this stopped final verification');
  const failed=readJson(checkRef(repo,a.failedProof));
  requireThat(failed.kind==='continue'&&failed.chapter===state.chapter&&failed.status==='inconclusive'
   &&failed.proof.clickedContinue===true&&failed.proof.stateEqual===true&&failed.proof.newAcceptedAction===0,'Retained real Continue failure required');
  const menuPaths=['main/src/components/ui/LandingMenu.tsx','main/src/components/ui/LandingMenu.test.tsx'];
  requireThat(a.allowedPaths?.length>0&&a.allowedPaths.every(n=>(allowedPath(n,state.brief.allowedPaths)||menuPaths.includes(n))&&n.startsWith('main/src/')),'Repair ownership must narrow existing game ownership');
  const rows=a.files,listed=new Map(rows.map(r=>[r.path,r])),current=snapshot(repo);
  requireThat(listed.size===rows.length&&rows.length>0,'Unique exact tool handoff required');
  for(const n of differences(state.acceptedSource,current))requireThat(listed.has(n),`Unlisted change: ${n}`);
  for(const r of rows){
   requireThat(/^main\/tools\/chapter-loop(?:\/[^/]+\.mjs|\.mjs)$/.test(r.path)&&r.path!=='main/tools/chapter-loop/contract.mjs','Preparation may change transport only');
   requireThat(r.before===(state.frozen[r.path]??state.acceptedSource[r.path]??null)&&r.after===sha(fs.readFileSync(inside(repo,r.path))),`Handoff hash differs: ${r.path}`);
  }
  assertFrozen(repo,Object.fromEntries(Object.entries(state.frozen).filter(([n])=>!listed.has(n))));
  const validation=readJson(checkRef(repo,a.validation));
  requireThat(validation.passed===true&&validation.command==='npm --prefix main run chapter:loop:test'&&validation.filesSha256===sha(rows),'Exact passing adapter tests required');
  checkRef(repo,validation.log);checkRef(repo,a.handoff);checkRef(repo,a.findings);
  const archive=path.join(run,'owner-defect-repairs',sha(a));fs.mkdirSync(archive,{recursive:true});fs.writeFileSync(path.join(archive,'previous-state.json'),bytes,{flag:'wx'});
  state.ownerDefectRepairs=[{authority:reference(repo,authorityFile),previousState:reference(repo,path.join(archive,'previous-state.json')),priorRefinement:state.receipts.refine,priorFailure:state.failure,allowedPaths:a.allowedPaths,at:new Date().toISOString()}];
  state.continuationHandoff=a.handoff;state.receipts.findings=a.findings;
  state.queue=state.queue.slice(0,state.cursor).concat(['refine',...state.queue.slice(state.cursor)]);
  state.brief.previewQuery={kind:'normal-save',query:'?journeyprobe=1&profile=HIGH'};
  state.brief.playerEntry='earned-continue';
  state.brief.allowedPaths=[...new Set([...state.brief.allowedPaths,...a.allowedPaths.filter(n=>menuPaths.includes(n))])];
  for(const r of rows)state.frozen[r.path]=r.after;
  state.brief.toolRefs=state.brief.toolRefs.map(r=>({...r,sha256:state.frozen[r.path]??r.sha256}));
  for(const ref of [reference(repo,authorityFile),a.handoff,a.findings,a.validation,state.ownerDefectRepairs[0].previousState])state.frozen[ref.path]=ref.sha256;
  validateBrief(repo,state.brief);state.acceptedSource=current;state.status='RUNNING';state.failure=null;state.policySha256=policySeal(state);writeJson(file,state);
  fs.appendFileSync(path.join(run,'events.jsonl'),JSON.stringify({type:'owner-commissioned-defect-repair',...state.ownerDefectRepairs[0],retainedUsage:state.usage,retainedClock:state.clock})+'\n');
  return {status:state.status,next:'refine',retainedUsage:state.usage,clock:state.clock};
 }finally{unlock();}
}
