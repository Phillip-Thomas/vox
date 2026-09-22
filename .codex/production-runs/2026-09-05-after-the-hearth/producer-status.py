from pathlib import Path
import json,datetime,sys
s=Path(__file__).resolve().parent
print(datetime.datetime.now(datetime.timezone.utc).isoformat())
p=s/'integration-progress.md'
if '--brief' not in sys.argv:
 print(p.read_text()[-3200:] if p.exists() else 'Integrator progress file not yet written.')
rows=[]
f=s/'integration-engineer-stream.jsonl'
if f.exists():
 for line in f.read_text().splitlines():
  try:r=json.loads(line)
  except json.JSONDecodeError:continue
  if r.get('type')=='assistant':
   for c in r.get('message',{}).get('content',[]):
    if c.get('type')=='text':rows.append(c['text'][:1000])
    elif c.get('type')=='tool_use':rows.append(c['name']+': '+str(c.get('input',{}).get('description',c.get('input',{}).get('file_path','')))[:180])
  elif r.get('type')=='result':rows.append('RESULT: '+str(r.get('subtype'))+' error='+str(r.get('is_error')))
print('\n'.join(rows[-4:]))
