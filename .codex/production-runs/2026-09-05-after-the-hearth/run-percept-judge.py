from pathlib import Path
import sys,json,datetime,hashlib,subprocess,tempfile,re
repo=Path('/home/thomasphillip/Projects/vox');run=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
assert len(sys.argv)==3,'Pass a unique safe invocation slug and the exact COMMISSION.md path'
slug=sys.argv[1];assert re.fullmatch('[a-z0-9-]+',slug)
commission=Path(sys.argv[2]).resolve();assert commission.is_relative_to(run.resolve()) and commission.name=='COMMISSION.md' and commission.is_file()
receipt=run/f'percept-{slug}-invocation.json';assert not receipt.exists(),'Never duplicate a percept commission'
assert not (commission.parent/'verdict.json').exists(),'Never overwrite a verdict'
role=repo/'.claude/agents/scene-naive-viewer.md';system=role.read_text();prompt='Read only this commission and its explicitly listed evidence, schema and rubric; follow it exactly and write the required verdict at the path it names: '+str(commission)
sha=lambda b:hashlib.sha256(b).hexdigest();work=Path(tempfile.mkdtemp(prefix='paravoxia-blind-judge-'))
record={'role':'scene-naive-viewer','requestedModel':'opus','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commissionRef':str(commission.relative_to(run)),'commissionSha256':sha(commission.read_bytes()),'systemPromptSource':str(role.relative_to(repo)),'systemPromptSha256':sha(system.encode()),'prompt':prompt,'cwd':str(work),'isolation':'Fresh CLI context outside project ancestors. Only commission, schema/rubric and enumerated media; no source/canon/contract or peer reviews. Read,Glob,Write tools only. Verdict JSON is sole deliverable.'}
receipt.write_text(json.dumps(record,indent=2)+'\n')
argv=['claude','-p','--model','opus','--safe-mode','--output-format','stream-json','--verbose','--no-session-persistence','--permission-mode','default','--tools','Read,Glob,Write','--allowedTools','Read,Glob,Write','--strict-mcp-config','--system-prompt',system]
try:
 with (run/f'percept-{slug}-stream.jsonl').open('w') as out,(run/f'percept-{slug}-stderr.txt').open('w') as err:
  proc=subprocess.run(argv,input=prompt,text=True,stdout=out,stderr=err,cwd=work,timeout=1800)
 record['exitCode']=proc.returncode
except subprocess.TimeoutExpired:record.update(exitCode=124,transportTimeout=True)
record['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run/f'percept-{slug}-stream.jsonl').read_text().splitlines():
 try:row=json.loads(line)
 except json.JSONDecodeError:continue
 if row.get('type')=='system' and row.get('subtype')=='init':record.update(sessionId=row.get('session_id'),model=row.get('model'))
 if row.get('type')=='result':
  record['isError']=row.get('is_error');(run/f'percept-{slug}-result.json').write_text(json.dumps(row,indent=2)+'\n')
verdict=commission.parent/'verdict.json';record['verdictExists']=verdict.is_file()
if verdict.is_file():record['verdictSha256']=sha(verdict.read_bytes())
record['validated']=False
receipt.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));sys.exit(record['exitCode'])
