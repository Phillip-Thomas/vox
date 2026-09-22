from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'finale-wrapper-transport-invocation.json';assert not receipt.exists()
assert json.loads((r/'finale-window-pid-closure-invocation.json').read_text()).get('finishedAt'), 'Prior owner must finish'
m=json.loads((r/'implementation-source-manifest.json').read_text())
assert json.loads((r/'verification-ready.json').read_text()).get('ready') is True, 'Exact source must be ready'
# Source is frozen; this role only prepares an independent run-local SHORT probe.
commission=r/'finale-wrapper-transport-commission.txt';system='You are a mechanical probe engineer. Follow the explicit CPU-only preparation commission; own only its run-local probe files and reports. No browser or GPU now, no game mutation.'
a={'role':'finale-wrapper-transportor','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFrozen':True,'sourceReference':'iterations/implemented-arrival-common-repair/source','scope':'CPU-only preparation of atomic finale window and isolated actual audio capture; no GPU/game edits'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'finale-wrapper-transport-stream.jsonl').open('w') as out,(r/'finale-wrapper-transport-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=720)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'finale-wrapper-transport-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'finale-wrapper-transport-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceFrozen']=True;a['gameSourceMutationAuthorized']=False;receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
