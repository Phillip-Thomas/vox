from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'continue-pose-scope-audit-invocation.json';assert not receipt.exists()
assert (r/'verifier/captures/earned-continue-3d/attempt-1/cleanup-receipt.json').exists()
assert (r/'producer-continue-3d-runtime-failure-direction.json').exists()
ready=json.loads((r/'verification-ready.json').read_text())
assert ready.get('ready') and ready.get('contractVersion')=='scene-v3'
assert ready['sourceManifestSha256']==sha(r/'implementation-source-manifest.json')
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
commission=r/'continue-pose-scope-audit-commission.txt';system=(repo/'.claude/agents/story-verifier.md').read_text()+'\nCURRENT MACHINE RULE OVERRIDES OLD HEADLESS EXAMPLES: headless:false, existing immutable34413 preview, shipped headed helper and realGPU assertion, inherited exclusive shared lock. No headless launch allowed. This task is read-only SOURCE diagnosis with CPU replay only: do not launch any browser. Read clock and invocation for ACTUAL10minute budget. Never edit producer control or invocation receipts. GPU authority must match commissioned role before browser; CPU preparation may proceed while another role holds it.'
a={'role':'continue-pose-scope-audit','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Read-only actual Continue pose load/validation/scoping causal audit, bounded CPUreplay, no GPU/game changes'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'continue-pose-scope-audit-stream.jsonl').open('w') as out,(r/'continue-pose-scope-audit-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=600)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'continue-pose-scope-audit-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'continue-pose-scope-audit-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h]
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
