from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((r/n).read_text())
receipt=r/'integration-manual-credit-finale-frontier-invocation.json';assert not receipt.exists(),'No duplicate repair'
for n in ['common-entry-crossing-invocation.json','earned-continue-3d-runtime-invocation.json','finale-window-capture-continuation-invocation.json','continue-pose-scope-audit-invocation.json']:
 assert read(n).get('finishedAt'),n
cs=sha(r/'scene-contract.json');gate=read('final-contract-gate-pass.json')
assert cs=='5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54'
assert gate['passed'] and gate['contractSha256']==cs
assert read('verification-ready.json')['ready'] is False
assert read('verifier-control.json')['action']=='hold'
d=read('manual-credit-finale-repair-direction.json');assert d['sourceMutationAuthorized'] is True and d['contractSha256']==cs
assert read('producer-manual-credit-finale-budget-decision.json')['runLocalBudgetOverride']['valueForThisRun']==8
assert read('producer-common-entry-crossing-review.json')['acceptedForBoundedRepair'] is True
original=read('integration-manual-credit-finale-invocation.json');assert original.get('finishedAt')
deadline=datetime.datetime.fromisoformat(original['startedAt'])+datetime.timedelta(seconds=2700);remaining=(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds();assert remaining>0
m=read('implementation-source-manifest.json');draft=read('manual-credit-finale-frontier-handoff-hashes.json')['hashes']
for p,h in m['hashes'].items():assert sha(repo/p)==draft.get(p,h),p
commission=r/'integration-manual-credit-finale-frontier-commission.txt';assert commission.exists()
assert not commission.read_text().startswith('DRAFT'), 'Never launch draft commission'
system='You are the single software integration engineer. Implement exact signed scene-v3 manual-credit and normal-done final-token fidelity under the production boundary. Preserve dirty files and actual physical proof. You are not a creative director, independent verifier or acceptance judge. No GPU or publication.'
a={'role':'integration-engineer','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'contractSha256':cs,'sourceManifestSha256Before':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'originalDeadline':deadline.isoformat(),'originalInvocationRef':'integration-manual-credit-finale-invocation.json','scope':'Same bounded eighth material repair: actual ordered manual corner accounting and final-token normal-done exception; unchanged contract, no proof relaxation, GPU or publication'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'integration-manual-credit-finale-frontier-stream.jsonl').open('w') as out,(r/'integration-manual-credit-finale-frontier-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=remaining)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'integration-manual-credit-finale-frontier-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'integration-manual-credit-finale-frontier-result.json').write_text(json.dumps(x,indent=2)+'\n')
receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
