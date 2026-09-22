from pathlib import Path
import json,hashlib,datetime,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((r/n).read_text())
receipt=r/'integration-arrival-common-metadata-invocation.json';assert not receipt.exists()
assert read('integration-arrival-common-invocation.json').get('finishedAt')
assert read('verifier-control.json')['action']=='hold' and read('verification-ready.json')['ready'] is False
assert (r/'iterations/arrival-common-before-metadata-closure').is_dir()
assert read('producer-arrival-common-metadata-handoff.json')['authorized'] is True
snapshot=read('iterations/arrival-common-before-metadata-closure/current-source-manifest.json')
for p,h in snapshot['hashes'].items():assert sha(repo/p)==h,p
commission=r/'integration-arrival-common-metadata-commission.txt'
system='You are the single integration engineer completing exact metadata binding for the existing seventh repair. Preserve all completed gameplay changes and previous proof. No creative redesign, new gameplay patch, GPU, publication or new repair loop. Follow the bounded commission and actual repository toolchain.'
a={'role':'integration-engineer-metadata-closure','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionSha256':sha(commission),'contractSha256':sha(r/'scene-contract.json'),'currentSourceSnapshotSha256':sha(r/'iterations/arrival-common-before-metadata-closure/current-source-manifest.json'),'materialRepairIteration':7,'scope':'Complete exact approved v3 registry/generator/schema identity bindings and final fullverify; no gameplay change'}
receipt.write_text(json.dumps(a,indent=2)+'\n')
cmd=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob,Write,Edit','--allowedTools','Bash,Read,Grep,Glob,Write,Edit','--strict-mcp-config','--system-prompt',system]
try:
 with (r/'integration-arrival-common-metadata-stream.jsonl').open('w') as out,(r/'integration-arrival-common-metadata-stderr.txt').open('w') as err:
  proc=subprocess.run(cmd,input=commission.read_text(),text=True,stdout=out,stderr=err,cwd=repo,timeout=1200)
 a['exitCode']=proc.returncode
except subprocess.TimeoutExpired:a.update(exitCode=124,transportTimeout=True)
a['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (r/'integration-arrival-common-metadata-stream.jsonl').read_text().splitlines():
 try:x=json.loads(line)
 except json.JSONDecodeError:continue
 if x.get('type')=='system' and x.get('subtype')=='init':a.update(model=x.get('model'),sessionId=x.get('session_id'))
 if x.get('type')=='result':a['isError']=x.get('is_error');(r/'integration-arrival-common-metadata-result.json').write_text(json.dumps(x,indent=2)+'\n')
receipt.write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a));sys.exit(a['exitCode'])
