from pathlib import Path
import json,hashlib,subprocess,datetime,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert json.loads((r/'integration-navigation-closure-invocation.json').read_text()).get('finishedAt')
assert json.loads((r/'verification-ready.json').read_text())['ready'] is False
for k,v in json.loads((r/'producer-navigation-wording-direction.json').read_text())['sourceHashes'].items():assert sha(repo/k)==v,k
receipt=r/'integration-navigation-wording-invocation.json';assert not receipt.exists()
commission=(r/'integration-navigation-wording-commission.txt').read_text()
system='You are the single mechanical integration engineer completing a bounded producer review finding in an unfinished repair. Preserve exact dirty source, existing behavior and evidence. You are not a creative director or independent verifier.'
names='Bash,Read,Grep,Glob,Write,Edit'
argv=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools',names,'--allowedTools',names,'--strict-mcp-config','--system-prompt',system]
rec={'role':'integration-engineer','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Non-behavioral terminology correction for an existing implementation gate false positive; same unfinished repair, no gate change or GPU','safeMode':True,'permissionMode':'default','tools':names.split(','),'commissionSha256':sha(r/'integration-navigation-wording-commission.txt'),'systemPromptSha256':hashlib.sha256(system.encode()).hexdigest()}
receipt.write_text(json.dumps(rec,indent=2)+'\n')
try:
 with (r/'integration-navigation-wording-stream.jsonl').open('w') as out,(r/'integration-navigation-wording-stderr.txt').open('w') as err:
  result=subprocess.run(argv,input=commission,text=True,stdout=out,stderr=err,cwd=repo,timeout=2700)
 rec['exitCode']=result.returncode
except subprocess.TimeoutExpired:rec.update(exitCode=124,transportTimeout=True)
rec['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (r/'integration-navigation-wording-stream.jsonl').read_text().splitlines():
 try:x=json.loads(line)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':rec.update(sessionId=x.get('session_id'),model=x.get('model'),actualTools=x.get('tools'))
 if x.get('type')=='result':
  (r/'integration-navigation-wording-result.json').write_text(json.dumps(x,indent=2)+'\n');rec['isError']=x.get('is_error')
receipt.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec));sys.exit(rec['exitCode'])
