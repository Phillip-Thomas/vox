from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'continue-controller-wire-invocation.json';assert not receipt.exists()
m=json.loads((r/'implementation-source-manifest.json').read_text())
assert (r/'producer-earned-continue-3d-runtime-review.json').exists()
# Source is frozen; this role only prepares an independent run-local SHORT probe.
original=json.loads((r/'continue-controller-closure-invocation.json').read_text()); deadline=datetime.datetime.fromisoformat(original['startedAt'])+datetime.timedelta(seconds=1200); remaining=(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds();assert remaining>0
commission=r/'continue-controller-wire-commission.txt';system='You are a read-only mechanical source auditor. Use opus-level mechanical reasoning. Follow the explicit commission, keep evidence distinct from inference, never mutate game source or invoke a browser or GPU. Produce only the commissioned run-local report and optional bounded scratch.'
a={'role':'continue-controller-wireor','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFrozen':False,'originalDeadline':deadline.isoformat(),'originalInvocationRef':'continue-controller-closure-invocation.json','sourceReference':'iterations/implemented-arrival-common-repair/source','scope':'Private probe-only correction of curved-face calibration thrash and signed-action gating; CPU only while independent source integration may proceed'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'continue-controller-wire-stream.jsonl').open('w') as out,(r/'continue-controller-wire-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=remaining)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'continue-controller-wire-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'continue-controller-wire-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceFrozen']=False;a['gameSourceMutationAuthorized']=False;receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
