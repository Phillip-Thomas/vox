from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=r/'continue-pose-handoff-closure-invocation.json';assert not receipt.exists()
assert json.loads((r/'continue-pose-handoff-runtime-invocation.json').read_text()).get('finishedAt')
control=json.loads((r/'verifier-control.json').read_text())
assert control['activeRole']=='continue-pose-handoff-runtime' and control['action']=='continue'
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
commission=r/'continue-pose-handoff-closure-commission.txt';system=(repo/'.claude/agents/story-verifier.md').read_text()+'\nCurrent owner machine rule overrides old headless/dev-server examples above: all actual captures in this task must use existing root immutable preview, headless:false, actual hardware adapter assertion and exclusive shared heavy lock. Never use headless for this measurement. Use actual UTC clock for time budget. Do not edit producer transport invocation receipts or control files.'
a={'role':'continue-pose-handoff-closure','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Close actual position handoff observation gaps within original Continue observation deadline; no game mutation'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'continue-pose-handoff-closure-stream.jsonl').open('w') as out,(r/'continue-pose-handoff-closure-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=270)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'continue-pose-handoff-closure-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'continue-pose-handoff-closure-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h]
a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
