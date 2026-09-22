from pathlib import Path
import json, hashlib, difflib, datetime
repo=Path('/home/thomasphillip/Projects/vox')
r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
for name in ['integration-v2', 'integration-movie-repair', 'integration-lifecycle-repair', 'integration-world-repair', 'integration-navigation-repair', 'integration-navigation-closure', 'integration-navigation-wording', 'integration-handoff-standby']:
 p=r/(name+'-invocation.json')
 if p.exists():assert json.loads(p.read_text()).get('finishedAt'), f'{name} must finish before stable snapshot'
lock=json.loads((r/'production-lock.json').read_text())
m=json.loads((r/'integration-before-manifest.json').read_text())
expected=dict(m['hashes'])
for row in json.loads((r/'producer-boundary-completion.json').read_text())['addedPaths']:
 expected[row['path']]=row['preimplementationSha256']
absent=set(m['absent'])
sha=lambda b:hashlib.sha256(b).hexdigest()
changed=[];diffs=[];current={}
for name in lock['allowedPaths']:
 if name.startswith('.codex/'):continue
 p=repo/name
 if name in expected:
  before=r/'evidence/integration-before'/name
  assert before.is_file(), f'Missing baseline: {name}'
  b=before.read_bytes();assert sha(b)==expected[name], f'Baseline drift: {name}'
 elif name in absent:b=b''
 elif not p.exists():continue
 else:raise AssertionError(f'Unproven baseline: {name}')
 after=p.read_bytes() if p.is_file() else b''
 if p.is_file():current[name]=sha(after)
 if b==after:continue
 assert not any(name==x.rstrip('/') or name.startswith(x.rstrip('/')+'/') for x in lock['protectedPaths']),f'Protected change: {name}'
 header=f'diff --git a/{name} b/{name}\n'
 delta=''.join(difflib.unified_diff(b.decode().splitlines(keepends=True),after.decode().splitlines(keepends=True),fromfile='a/'+name if b else '/dev/null',tofile='b/'+name if after else '/dev/null'))
 diffs.append(header+delta)
 changed.append({'path':name,'beforeSha256':sha(b) if name in expected else None,'afterSha256':sha(after) if p.is_file() else None,'kind':'modified' if name in expected else 'added'})
(r/'implementation.diff').write_text(''.join(diffs))
initial=json.loads((r/'initial-source-hashes.json').read_text());unexpected=[]
for name,old in initial['hashes'].items():
 p=repo/name
 if not p.is_file() or sha(p.read_bytes())!=old:
  if not any(name==x.rstrip('/') or name.startswith(x.rstrip('/')+'/') for x in lock['allowedPaths']):unexpected.append(name)
initial_extensions={Path(name).suffix for name in initial['hashes']}
for p in (repo/'main/src').rglob('*'):
 if not p.is_file() or p.suffix not in initial_extensions:continue
 name=str(p.relative_to(repo))
 if name not in initial['hashes'] and not any(name==x.rstrip('/') or name.startswith(x.rstrip('/')+'/') for x in lock['allowedPaths']):unexpected.append(name)
assert not unexpected, f'Unexpected source drift or additions: {unexpected}'
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest={'schema':'paravoxia.implementationSnapshot.v1','capturedAt':now,'contractSha256':sha((r/'scene-contract.json').read_bytes()),'sourceRevision':lock['sourceRevision'],'beforeManifestRefs':['integration-before-manifest.json','producer-boundary-completion.json'],'preservationChecked':len(initial['hashes']),'unexpectedDrift':unexpected,'changedPaths':changed,'hashes':current,'implementationDiffSha256':sha((r/'implementation.diff').read_bytes())}
(r/'implementation-source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'changedPaths':len(changed),'snapshotFiles':len(current),'unexpectedDrift':unexpected,'manifestSha256':sha((r/'implementation-source-manifest.json').read_bytes())}))
