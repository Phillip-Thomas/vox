from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'common-exact-input-runtime-invocation.json';assert not receipt.exists()
assert json.loads((r/'common-exact-input-prep-invocation.json').read_text()).get('finishedAt'), 'Prior private owner must finish'
assert (r/'producer-common-exact-input-prep-review.json').exists(), 'Producer review required'
assert json.loads((r/'story-verifier-arrival-common-invocation.json').read_text()).get('finishedAt'), 'Prior GPU verifier must finish'
assert json.loads((r/'producer-common-exact-input-prep-review.json').read_text())['acceptedForBoundedRuntime'] is True
assert (r/'producer-short-exact-input-gpu-handoff.json').exists(), 'Prior GPU cleanup required'
assert json.loads((r/'verifier-control.json').read_text())['activeRole']=='common-exact-input-runtime'
ready=json.loads((r/'verification-ready.json').read_text())
assert ready.get('ready') and ready.get('contractVersion')=='scene-v3'
assert ready['sourceManifestSha256']==sha(r/'implementation-source-manifest.json')
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
commission=r/'common-exact-input-runtime-commission.txt';system=(repo/'.claude/agents/story-verifier.md').read_text()
a={'role':'common-exact-input-runtime','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Actual bounded manual COMMON credit-call discriminator; no game mutation'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'common-exact-input-runtime-stream.jsonl').open('w') as out,(r/'common-exact-input-runtime-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=1200)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'common-exact-input-runtime-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'common-exact-input-runtime-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h]
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
