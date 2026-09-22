from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'handoff-standby-source-audit-invocation.json';assert not receipt.exists()
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
commission=r/'handoff-standby-source-audit-commission.txt';system='You are a read-only mechanical source auditor. Use opus-level mechanical reasoning. Follow the explicit commission, keep evidence distinct from inference, never mutate game source or invoke a browser or GPU. Produce only the commissioned run-local report and optional bounded scratch.'
a={'role':'handoff-standby-source-auditor','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Read-only causal source diagnosis for measured return handoff reset and standby physical target; no game edits, GPU or acceptance'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write','--allowedTools','Bash,Read,Grep,Glob,Write','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'handoff-standby-source-audit-stream.jsonl').open('w') as out,(r/'handoff-standby-source-audit-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=900)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'handoff-standby-source-audit-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'handoff-standby-source-audit-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h]
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
