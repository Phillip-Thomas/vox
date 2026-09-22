from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((r/n).read_text())
receipt=r/'integration-arrival-common-invocation.json';assert not receipt.exists(),'No duplicate repair'
for n in ['common-manual-runtime-invocation.json','earned-continue-probe-prep-invocation.json','entry-discriminator-invocation.json','integration-handoff-standby-invocation.json']:
 assert read(n).get('finishedAt'),n
assert read('common-terminal-source-audit-invocation.json')['exitCode']==0
cs=sha(r/'scene-contract.json');gate=read('contract-gate-pass.json')
assert cs=='5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54'
assert gate['passed'] and gate['contractSha256']==cs
assert read('verification-ready.json')['ready'] is False
assert read('verifier-control.json')['action']=='hold'
d=read('arrival-common-repair-direction.json');assert d['sourceMutationAuthorized'] is True and d['contractSha256']==cs
assert read('producer-arrival-common-budget-decision.json')['runLocalBudgetOverride']['valueForThisRun']==7
assert read('producer-arrival-common-findings-review.json')['acceptedForBoundedRepair'] is True
m=read('implementation-source-manifest.json')
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
commission=r/'integration-arrival-common-commission.txt';assert commission.exists()
assert not commission.read_text().startswith('DRAFT'), 'Never launch draft commission'
system='You are the single software integration engineer. Implement exact signed scene-v3 and bounded arrival/common steering direction under the production boundary. Preserve dirty files and actual physical proof. You are not a creative director, independent verifier or acceptance judge. No GPU or publication.'
a={'role':'integration-engineer','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'contractSha256':cs,'sourceManifestSha256Before':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'One bounded seventh material repair: safe COMMON movie steering and exact scene-v3 arrival guidance/metadata; no geometry/proof relaxation, GPU or publication'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'integration-arrival-common-stream.jsonl').open('w') as out,(r/'integration-arrival-common-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=3600)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'integration-arrival-common-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'integration-arrival-common-result.json').write_text(json.dumps(x,indent=2)+'\n')
receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
