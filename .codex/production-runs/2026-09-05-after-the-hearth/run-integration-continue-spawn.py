from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((r/n).read_text())
receipt=r/'integration-continue-spawn-invocation.json';assert not receipt.exists(),'No duplicate repair'
for role in ['continue-pose-handoff-runtime','continue-pose-handoff-closure','manual-recovery-candidate-runtime','manual-recovery-candidate-closure']:
 assert read(role+'-invocation.json').get('finishedAt'),role
assert read('verification-ready.json')['ready'] is False
assert read('verifier-control.json')['action']=='hold'
d=read('continue-spawn-repair-direction.json');assert d['sourceMutationAuthorized'] and d['materialRepairIteration']==9
assert read('producer-continue-spawn-budget-decision.json')['runLocalBudgetOverride']['valueForThisRun']==9
assert read('producer-continue-pose-handoff-closure-review.json')['acceptedForBoundedRepair']
assert sha(r/'scene-contract.json')=='5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54'
m=read('implementation-source-manifest.json');baseline=dict(m['hashes'])
for row in read('producer-continue-spawn-boundary-completion.json')['addedPaths']:baseline[row['path']]=row['preimplementationSha256']
for p,h in baseline.items():assert sha(repo/p)==h,p
allowed=d['allowedSourcePaths'];absent=[p for p in allowed if not (repo/p).exists()]
commission=r/'integration-continue-spawn-commission.txt';assert not commission.read_text().startswith('DRAFT')
system='You are the single software integration engineer. Implement only the signed scene-v3 Continue saved on-foot spawn-precedence fidelity correction under the explicit narrow production boundary. Preserve dirty files, safe spawn validation and later lawful ship disembark. You are not a creative director, independent verifier or acceptance judge. No GPU, build, publication or production metadata changes. Routine in-scope fixes and focused checks are already authorized.'
a={'role':'integration-continue-spawn','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallBudgetSeconds':1200,'commissionSha256':sha(commission),'contractSha256':sha(r/'scene-contract.json'),'sourceManifestSha256Before':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(baseline),'additionalAllowedBeforeAbsent':absent,'scope':'One ninth material repair CG-IMPL-011: preserve validated matching on-foot Continue pose without changing actual later ship egress; unchanged signed contract and physical predicates.'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'integration-continue-spawn-stream.jsonl').open('w') as out,(r/'integration-continue-spawn-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=1200)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'integration-continue-spawn-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'integration-continue-spawn-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['changedKnownSourcePaths']=[p for p,h in baseline.items() if not (repo/p).is_file() or sha(repo/p)!=h]
a['addedAllowedPaths']=[p for p in absent if (repo/p).is_file()]
a['sourceDriftOutsideAllowed']=[p for p in a['changedKnownSourcePaths'] if p not in allowed]
receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
