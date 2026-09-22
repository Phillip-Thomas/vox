from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'short-lifecycle-candidate-runtime-invocation.json';assert not receipt.exists()
assert json.loads((r/'finale-cancellation-repin-invocation.json').read_text()).get('finishedAt'), 'Wait for current verifier completion'
assert (r/'producer-manual-endpoint-negative-review.json').exists()
assert json.loads((r/'manual-endpoint-negative-repin-invocation.json').read_text()).get('finishedAt')
control=json.loads((r/'verifier-control.json').read_text())
assert control['activeRole']=='short-lifecycle-candidate-runtime' and control['action']=='continue'
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
deadline=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=12)
commission=r/'short-lifecycle-candidate-runtime-commission.txt'
commission.write_text('Absolute UTC deadline: '+deadline.isoformat()+'. These are wall-clock limits, not mandatory phase durations. Begin from current prepared artifacts.\n\n'+(r/'short-lifecycle-candidate-runtime-commission.draft.txt').read_text().replace('DRAFT pending GPU handoff and current source/build repin. ', 'GPU handoff is complete; current source/build repin remains your first private check. '))
system=(repo/'.claude/agents/story-verifier.md').read_text()+'\nCurrent owner machine rule overrides old headless/dev-server examples above: all actual captures in this task must use existing root immutable preview, headless:false, actual hardware adapter assertion and exclusive shared heavy lock. Never use headless for this measurement. Use actual UTC clock for time budget. Do not edit producer transport invocation receipts or control files.'
a={'role':'short-lifecycle-candidate-runtime','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'deadlineAt':deadline.isoformat(),'scope':'Actual SHORT witness leave/reenter and physical untested-tail revision; no game mutation'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'short-lifecycle-candidate-runtime-stream.jsonl').open('w') as out,(r/'short-lifecycle-candidate-runtime-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=max(1,(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds()))
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'short-lifecycle-candidate-runtime-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'short-lifecycle-candidate-runtime-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h]
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
