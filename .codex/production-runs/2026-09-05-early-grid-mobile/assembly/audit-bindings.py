from pathlib import Path
import json,hashlib,datetime
r=Path(__file__).resolve().parent.parent;repo=r.parents[2];refs=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def walk(o,src,ptr=''):
 if isinstance(o,dict):
  if isinstance(o.get('path'),str)and isinstance(o.get('sha256'),str)and len(o['sha256'])==64:refs.append((src,ptr,o['path'],o['sha256']))
  for k,v in o.items():walk(v,src,ptr+'/'+k)
 elif isinstance(o,list):
  for n,v in enumerate(o):walk(v,src,ptr+'/'+str(n))
for f in r.glob('*'):
 if f.suffix not in ['.json','.jsonl']or f.name in ['shipped-visual-baseline.json','shipped-ux-baseline.json']:continue
 if f.suffix=='.json':walk(json.loads(f.read_text()),f.name)
 else:
  for i,l in enumerate(f.read_text().splitlines()):
   if l.strip():walk(json.loads(l),f.name,'/line'+str(i+1))
issues=[];passed=[];staged=[]
for src,ptr,p,h in refs:
 name=p.split('/'+r.name+'/',1)[-1]
 candidates=[r/p,repo/p,r/'baseline-source'/p,r/'assembly/originals'/p,r/'assembly/originals'/name]
 if name=='story-intent.md':candidates.append(r/'chapter-stage3-input-story-intent.md')
 if name=='decision-brief.json':candidates.append(r/'assembly/originals/decision-brief.pre-stage3.json')
 match=next((f for f in candidates if f.is_file()and sha(f)==h),None)
 if match and p.startswith('main/'):
  snapshot=r/'assembly/source-snapshots'/p;snapshot.parent.mkdir(parents=True,exist_ok=True)
  if snapshot.exists():assert sha(snapshot)==h,(p,h,sha(snapshot))
  else:snapshot.write_bytes(match.read_bytes())
  staged.append({'path':p,'snapshotPath':str(snapshot.relative_to(r)),'sha256':h});match=snapshot
 rec={'source':src,'pointer':ptr,'authoredPath':p,'expectedSha256':h,'matchedPath':str(match.relative_to(r))if match and match.is_relative_to(r)else str(match)if match else None}
 (passed if match else issues).append(rec)
assert not issues,issues
out={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exactMatchedReferences':len(passed),'unresolved':issues,'matches':passed,'additionalSourceSnapshots':list({x['path']:x for x in staged}.values()),'method':'Literal authored SHA matched only against actual original bytes, exact archived sources or targeted log recovery; no hash refresh.'};(r/'assembly/authored-binding-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print('authored bindings',len(passed),'unresolved',len(issues),'additional source snapshots',len(out['additionalSourceSnapshots']))
