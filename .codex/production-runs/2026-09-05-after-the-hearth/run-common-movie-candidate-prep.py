from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'common-movie-candidate-prep-invocation.json';assert not receipt.exists()
m=json.loads((r/'implementation-source-manifest.json').read_text())
assert (r/'producer-earned-continue-3d-runtime-review.json').exists()
# Source is frozen; this role only prepares an independent run-local SHORT probe.
commission=r/'common-movie-candidate-prep-commission.txt';system='You are a mechanical private-probe engineer. Follow the explicit commission and ownership. Edit only commissioned private probe files, tests and report/logs. No game source, archive or producer mutations; no browser or GPU. Distinguish instrumentation proof from gameplay.'
a={'role':'common-movie-candidate-prepor','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFrozen':False,'sourceReference':'iterations/implemented-arrival-common-repair/source','scope':'Narrow private preflight correction of actualCOMMONmovie harness preparation at correctdepth after manual-as-movie substitution; additional5minute CPU commission under standing authorization, no material game repair or GPU'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'common-movie-candidate-prep-stream.jsonl').open('w') as out,(r/'common-movie-candidate-prep-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=300)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'common-movie-candidate-prep-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'common-movie-candidate-prep-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceFrozen']=False;a['gameSourceMutationAuthorized']=False;receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
