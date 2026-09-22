from pathlib import Path
import sys,json,hashlib,datetime,subprocess
repo=Path('/home/thomasphillip/Projects/vox')
run=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
reports={'story-canon-auditor':'story-audit.md','player-experience-auditor':'ux-audit.md','cinematography-continuity-auditor':'cinematography-audit.md','score-continuity-auditor':'score-audit.md'}
assert len(sys.argv)==2 and sys.argv[1] in reports,'Pass one approved independent role'
role=sys.argv[1]; report=reports[role]
sha=lambda b:hashlib.sha256(b).hexdigest()
ready=json.loads((run/'review-ready.json').read_text())
assert ready.get('ready') is True,'Root must clear current review evidence'
manifest_bytes=(run/'implementation-source-manifest.json').read_bytes()
assert ready['sourceManifestSha256']==sha(manifest_bytes),'Stale review source identity'
assert ready['verificationReportSha256']==sha((run/'verification-report.json').read_bytes()),'Stale review evidence'
assert ready['contractSha256']==sha((run/'scene-contract.json').read_bytes()),'Stale contract'
manifest=json.loads(manifest_bytes)
for name,expected in manifest['hashes'].items():
 assert sha((repo/name).read_bytes())==expected,f'Source drift: {name}'
receipt=run/f'review-{role}-invocation.json'
assert not receipt.exists(),'Do not duplicate first-wave review'
commission_path=run/f'review-{role}-commission.txt'
commission=commission_path.read_text()
role_path=repo/f'.claude/agents/{role}.md'
system=role_path.read_text()
record={'role':role,'requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'systemPromptSource':str(role_path.relative_to(repo)),'systemPromptSha256':sha(system.encode()),'commissionSha256':sha(commission.encode()),'sourceManifestSha256':sha(manifest_bytes),'verificationReportSha256':ready['verificationReportSha256'],'contractSha256':ready['contractSha256'],'firstWaveIndependent':True,'reportRef':report,'tools':['Bash','Read','Grep','Glob']}
receipt.write_text(json.dumps(record,indent=2)+'\n')
argv=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Bash,Read,Grep,Glob','--allowedTools','Bash,Read,Grep,Glob','--strict-mcp-config','--system-prompt',system]
try:
 with (run/f'review-{role}-stream.jsonl').open('w') as out,(run/f'review-{role}-stderr.txt').open('w') as err:
  result=subprocess.run(argv,input=commission,text=True,stdout=out,stderr=err,cwd=repo,timeout=3600)
 record['exitCode']=result.returncode
except subprocess.TimeoutExpired:
 record['exitCode']=124;record['transportTimeout']=True
record['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
final=None
for line in (run/f'review-{role}-stream.jsonl').read_text().splitlines():
 try:row=json.loads(line)
 except json.JSONDecodeError:continue
 if row.get('type')=='system' and row.get('subtype')=='init':
  record.update(sessionId=row.get('session_id'),model=row.get('model'))
 if row.get('type')=='result':
  final=row;record['isError']=row.get('is_error')
  (run/f'review-{role}-result.json').write_text(json.dumps(row,indent=2)+'\n')
if final and not final.get('is_error') and record['exitCode']==0 and final.get('result','').strip():
 for name,expected in manifest['hashes'].items():
  assert sha((repo/name).read_bytes())==expected,f'Source drift during review: {name}'
 archive=run/'iterations/pre-independent-review-templates';archive.mkdir(exist_ok=True)
 target=run/report
 if target.exists() and not (archive/report).exists():(archive/report).write_bytes(target.read_bytes())
 target.write_text(final['result'].rstrip()+'\n')
 record['reportSha256']=sha(target.read_bytes());record['reportWrittenVerbatim']=True
else:record['reportWrittenVerbatim']=False
receipt.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
