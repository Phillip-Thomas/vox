from pathlib import Path
import json,datetime,re
r=Path(__file__).resolve().parent
print(datetime.datetime.now(datetime.timezone.utc).isoformat())
roles = [('integration-v2','integration-progress.md'),('story-verifier','verifier-progress.md')]
if (r/'integration-movie-repair-invocation.json').exists(): roles=[('integration-movie-repair','integration-movie-repair-progress.md')]
if (r/'story-verifier-continuation-invocation.json').exists(): roles.append(('story-verifier-continuation','verifier-progress.md'))
if (r/'integration-lifecycle-repair-invocation.json').exists(): roles.append(('integration-lifecycle-repair','integration-lifecycle-repair-progress.md'))
if (r/'story-verifier-lifecycle-invocation.json').exists(): roles.append(('story-verifier-lifecycle','verifier-progress.md'))
if (r/'harness-prep-invocation.json').exists(): roles.append(('harness-prep','harness-prep-progress.md'))
if (r/'integration-world-repair-invocation.json').exists(): roles.append(('integration-world-repair','integration-world-repair-progress.md'))
if (r/'harness-final-prep-invocation.json').exists(): roles.append(('harness-final-prep','harness-final-prep-progress.md'))
if (r/'story-verifier-world-invocation.json').exists(): roles.append(('story-verifier-world','verifier-progress.md'))
if (r/'partial-continue-verifier-invocation.json').exists(): roles.append(('partial-continue-verifier','partial-continue-progress.md'))
active = [(role,progress) for role,progress in roles if (r/(role+'-invocation.json')).exists() and not json.loads((r/(role+'-invocation.json')).read_text()).get('finishedAt')]
roles = active or roles[-1:]
for role,progress in roles:
 print('ROLE',role)
 invocation=r/(role+'-invocation.json')
 if invocation.exists():
  d=json.loads(invocation.read_text());print(json.dumps({k:d.get(k) for k in ['startedAt','finishedAt','model','exitCode','isError']}))
 p=r/progress
 if p.exists():
  started=datetime.datetime.fromisoformat(d['startedAt']).timestamp()
  age=datetime.datetime.now(datetime.timezone.utc).timestamp()-p.stat().st_mtime
  if p.stat().st_mtime >= started and age < 120:print('PROGRESS:',p.read_text()[-900:])
  elif p.stat().st_mtime >= started:print(f'PROGRESS: last written {int(age)}s ago; current activity below')
  else:print('PROGRESS: retained prior report; current phase is in the stream below')
 p=r/(role+'-stream.jsonl');rows=[];test_summaries=[]
 if p.exists():
  for l in p.read_text().splitlines():
   try:d=json.loads(l)
   except json.JSONDecodeError:continue
   if d.get('type')=='assistant':
    for c in d.get('message',{}).get('content',[]):
     if c.get('type')=='text':rows.append(c['text'][:750])
     elif c.get('type')=='tool_use':rows.append(c['name']+': '+str(c.get('input',{}).get('description',c.get('input',{}).get('file_path','')))[:160])
   elif d.get('type')=='user':
    for c in d.get('message',{}).get('content',[]):
     if c.get('type')=='tool_result':
      t=c.get('content','')
      if isinstance(t,str) and 'Test Files ' in t:
       test_summaries.append(' / '.join(x.strip() for x in t.splitlines() if re.match(r'\s*(Test Files|Tests)\s',x)))
   elif d.get('type')=='result':rows.append('RESULT: '+str(d.get('subtype'))+' error='+str(d.get('is_error')))
 print('\n'.join(rows[-4:]))
 if test_summaries:print('LATEST TEST OUTPUT:',test_summaries[-1])
