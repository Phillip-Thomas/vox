from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'common-manual-probe-prep-invocation.json';assert not receipt.exists()
m=json.loads((r/'implementation-source-manifest.json').read_text())
# Integration is concurrently changing its authorized files; source evidence remains immutable in the prior snapshot.
before={p:sha(repo/p) for p in m['hashes']}
commission=r/'common-manual-probe-prep-commission.txt';system='You are a read-only mechanical source auditor. Use opus-level mechanical reasoning. Follow the explicit commission, keep evidence distinct from inference, never mutate game source or invoke a browser or GPU. Produce only the commissioned owned probe preparation and report. No GPU or game edits. Source integration is concurrent, so the immutable before-source snapshot governs your source reading.'
a={'role':'common-manual-probe-prepor','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Prepare bounded manual COMMON18-unit recovery probe without game edits or GPU; concurrent source integrator, no freeze or acceptance claim'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write','--allowedTools','Bash,Read,Grep,Glob,Write','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'common-manual-probe-prep-stream.jsonl').open('w') as out,(r/'common-manual-probe-prep-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=900)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'common-manual-probe-prep-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'common-manual-probe-prep-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['concurrentSourceChangesObserved']=[p for p,h in before.items() if sha(repo/p)!=h]; a['isSourceFreezeProof']=False
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
