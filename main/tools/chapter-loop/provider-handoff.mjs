import fs from 'node:fs';
import path from 'node:path';
import {sha,requireThat} from './contract.mjs';
import {readJson,writeJson,reference,checkRef,snapshot,differences,inside,acquireLock} from './store.mjs';
import {elapsedClock} from './budget.mjs';

// Explicit owner handoff after a provider rejected the first role without
// generating content. This is not a retry of completed creative work.
export function prepareProviderHandoff(repo,state,a,{policySeal,now=Date.now()}={}) {
  requireThat(a?.schema==='paravoxia.chapterProviderHandoffAuthority.v1'&&a.runId===state.id
    &&a.request==='RUN THAT BITCH'&&a.resume===true,'Explicit owner provider handoff required');
  requireThat(state.status==='BLOCKED_INFRASTRUCTURE'&&!state.active&&!state.activeRole
    &&state.queue[state.cursor]==='plan'&&!state.providerHandoffs?.length
    &&state.usage.roleLaunches===1&&state.usage.inputTokens===0&&state.usage.outputTokens===0
    &&state.usage.cacheReadTokens===0&&Object.keys(state.receipts).every(k=>k==='preflight'),
  'Only the first quota-rejected, zero-content plan may change provider');
  requireThat(policySeal(state)===state.policySha256&&a.previousStateSha256===sha(state),'Retained checkpoint differs');
  requireThat(state.retries<state.limits.infrastructureRetries,'Infrastructure recovery allowance exhausted');
  const transport=readJson(checkRef(repo,a.transport));
  const lines=fs.readFileSync(checkRef(repo,a.transcript),'utf8').split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
  const result=lines.findLast(e=>e.type==='result');
  requireThat(transport.session&&transport.reported===true&&transport.completed===false&&transport.failed===true
    &&transport.requestedModel===state.brief.provider.models.creative
    &&result?.session_id===transport.session&&result.is_error===true&&result.api_error_status===429
    &&result.usage?.input_tokens===0&&result.usage?.output_tokens===0
    &&result.usage?.cache_read_input_tokens===0&&result.usage?.cache_creation_input_tokens===0,
  'Provider handoff requires the retained zero-content quota rejection');
  const start=Date.parse(a.requestedAt),wall=elapsedClock(state,now);
  requireThat(Number.isFinite(start)&&start<=now&&start>=Date.parse(state.failure.at)&&wall.remainingMs>0,
    'Handoff needs the actual new request time within the original operation deadline');
  requireThat(a.provider?.provider==='codex'&&a.provider.permissionMode==='full'
    &&a.provider.models?.creative==='gpt-6-astra'&&a.provider.models?.mechanical==='gpt-5.6-sol',
  'Bind the explicitly selected available Codex models and full permissions');
  const current=snapshot(repo),listed=new Map((a.files??[]).map(f=>[f.path,f]));
  const changed=new Set([...differences(state.acceptedSource,current),...Object.keys(state.frozen).filter(n=>
    !fs.existsSync(inside(repo,n,{exists:false}))||sha(fs.readFileSync(inside(repo,n)))!==state.frozen[n])]);
  for(const name of changed)requireThat(listed.has(name),`Unlisted provider handoff change: ${name}`);
  for(const [name,f]of listed){
    requireThat(name==='main/tools/chapter-loop.mjs'||/^main\/tools\/chapter-loop\/(?:provider-handoff|runner|budget|loop\.test)\.mjs$/.test(name),
      'Provider handoff cannot change game source, commissions or numerical limits');
    requireThat(f.before===(state.frozen[name]??state.acceptedSource[name]??null)
      &&f.after===sha(fs.readFileSync(inside(repo,name))),`Handoff source hash differs: ${name}`);
  }
  const validation=readJson(checkRef(repo,a.validation));
  requireThat(validation.passed===true&&validation.handoffSha256===sha(a.files),'Validation must bind this exact handoff');
  const next=structuredClone(state);
  next.brief.provider=a.provider;next.status='RUNNING';next.retries++;
  next.acceptedSource=current;
  for(const [name,f]of listed)next.frozen[name]=f.after;
  const firstPlayableDeadlineAt=new Date(Math.min(start+state.limits.firstPlayableMs,Date.parse(wall.deadlineAt))).toISOString();
  requireThat(Date.parse(firstPlayableDeadlineAt)>now,'Renewed playable window has expired');
  next.providerHandoffs=[{requestedAt:a.requestedAt,firstPlayableDeadlineAt,previousProvider:state.brief.provider,
    provider:a.provider,originalFailure:state.failure,retainedUsage:state.usage,originalClock:state.clock}];
  return next;
}

export function handoffProvider(repo,run,authorityFile,{policySeal}={}) {
  const unlock=acquireLock(path.join(run,'.runner.lock'));
  try{
    const stateFile=path.join(run,'state.json'),bytes=fs.readFileSync(stateFile),previous=JSON.parse(bytes);
    const authority=reference(repo,authorityFile),next=prepareProviderHandoff(repo,previous,readJson(authorityFile),{policySeal});
    const archive=path.join(run,'provider-handoffs',authority.sha256,'previous-state.json');
    fs.mkdirSync(path.dirname(archive),{recursive:true});fs.writeFileSync(archive,bytes,{flag:'wx',mode:0o400});
    Object.assign(next.providerHandoffs[0],{authority,previousState:reference(repo,archive)});
    for(const ref of [authority,next.providerHandoffs[0].previousState])next.frozen[ref.path]=ref.sha256;
    next.policySha256=policySeal(next);writeJson(stateFile,next);
    fs.appendFileSync(path.join(run,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),type:'owner-provider-handoff',...next.providerHandoffs[0]})+'\n');
    return {status:next.status,run,provider:next.brief.provider,clock:next.clock,firstPlayableDeadlineAt:next.providerHandoffs[0].firstPlayableDeadlineAt};
  }finally{unlock();}
}
