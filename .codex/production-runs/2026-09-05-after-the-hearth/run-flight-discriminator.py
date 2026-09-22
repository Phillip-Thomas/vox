from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
parent=json.loads((r/'story-verifier-navigation-invocation.json').read_text());assert parent.get('finishedAt'),'Previous verifier must finish'
assert json.loads((r/'producer-manual3-abort.json').read_text())['cleanupVerified']
receipt=r/'flight-discriminator-invocation.json';assert not receipt.exists()
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p,h in m['hashes'].items():assert sha(repo/p)==h,p
control=json.loads((r/'flight-discriminator-control.json').read_text());assert control.get('action')=='continue' and control.get('activeRole')=='flight-discriminator','Root ownership release required'
commission=r/'flight-discriminator-commission.txt';role=repo/'.claude/agents/story-verifier.md';system=role.read_text()
a={'role':'story-verifier','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'systemPromptSource':str(role.relative_to(repo)),'systemPromptSha256':sha(role),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashedBefore':len(m['hashes']),'scope':'Bounded actual celestial flight/arrival telemetry for one ch13 return cycle; no source/build/contract edits or full verification claim'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'flight-discriminator-stream.jsonl').open('w') as out,(r/'flight-discriminator-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=1200)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for l in (r/'flight-discriminator-stream.jsonl').read_text().splitlines():
 try:x=json.loads(l)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'flight-discriminator-result.json').write_text(json.dumps(x,indent=2)+'\n')
a['sourceDrift']=[p for p,h in m['hashes'].items() if sha(repo/p)!=h];a['sourceFilesRehashedAfter']=len(m['hashes']);receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
