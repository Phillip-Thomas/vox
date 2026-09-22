from pathlib import Path
import json,hashlib,datetime,subprocess,shutil
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda b:hashlib.sha256(b).hexdigest()
inv=json.loads((r/'integration-world-repair-invocation.json').read_text())
assert inv.get('finishedAt') and inv.get('exitCode')==0 and inv.get('isError') is False,'Repair must finish successfully'
report=json.loads((r/'integration-world-repair-report.json').read_text())
assert report['contractSha256']==sha((r/'scene-contract.json').read_bytes())
assert report['testTotals']['preRepairV2Baseline']==3068
assert report['testTotals']['tests']==report['testTotals']['preRepairV2Baseline']+report['testTotals']['addedByThisPass']-report['testTotals']['removed']
prior=json.loads((r/'iterations/implemented-lifecycle-repair/implementation-source-manifest.json').read_text())
changes={row['path']:row for row in report['changedPaths']}
for name,old in prior['hashes'].items():
 expected=changes[name]['afterSha256'] if name in changes else old
 assert sha((repo/name).read_bytes())==expected,f'Unreported repair drift: {name}'
 if name in changes:assert changes[name]['beforeSha256']==old
for name,row in changes.items():
 if name not in prior['hashes']:
  assert row['beforeSha256'] is None, f'Unproven added file: {name}'
  assert sha((repo/name).read_bytes())==row['afterSha256'],f'Added file drift: {name}'
subprocess.run(['python3',str(r/'compile-implementation-snapshot.py')],cwd=repo,check=True)
commands=[]
for row in report['checks']:
 if row['name'] in ['creative-triad-gate-implementation','creative:gate --phase implementation']:continue
 assert row['exitCode']==0,f'Failed check: {row}'
 ref=Path(row['logPath'])
 p=ref if ref.is_absolute() else (repo/ref if str(ref).startswith('.codex/') else r/ref)
 evidence_ref=str(p.resolve().relative_to(r.resolve()))
 assert p.is_file() and sha(p.read_bytes())==row['logSha256'],f'Changed check log: {p}'
 command=row['command'];cwd='.' if command.startswith('npm --prefix main ') else 'main'
 if row.get('cwd'):
  reported_cwd=Path(row['cwd'])
  cwd=str(reported_cwd.relative_to(repo)) if reported_cwd.is_absolute() else str(reported_cwd)
 if command.endswith(' (cwd main)'):command=command[:-11]
 commands.append({'command':command,'commandAsReported':row['command'],'cwd':cwd,'status':'passed','exitCode':row['exitCode'],'evidenceRef':evidence_ref,'evidenceSha256':row['logSha256']})
assert any(x['command'] in ['npm test','npm run test','npm --prefix main run test'] for x in commands)
assert any(x['command'] in ['npm run build','npm --prefix main run build'] for x in commands)
assert any(x['command'] in ['npm run typecheck','npm --prefix main run typecheck'] for x in commands)
checks={'schema':'paravoxia.checkResults.v1','runId':r.name,'contractVersion':'scene-v2','contractSha256':report['contractSha256'],'sourceRevision':json.loads((r/'production-lock.json').read_text())['sourceRevision'],'compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceManifestSha256':sha((r/'implementation-source-manifest.json').read_bytes()),'productionScope':{'status':'passed','evidenceRefs':['implementation.diff','implementation-source-manifest.json','production-lock.json','producer-boundary-completion.json']},'creativeContract':{'status':'passed','evidenceRefs':['contract-gate-pass.json','scene-v2-contract-gate.log','director-signoffs.json']},'typecheck':{'status':'passed','evidenceRefs':['evidence/integration-world-repair/typecheck.log','integration-world-repair-report.json']},'tests':{'status':'passed','evidenceRefs':['evidence/integration-world-repair/vitest-full.log','evidence/integration-world-repair/vitest-story.log']},'build':{'status':'passed','evidenceRefs':['evidence/integration-world-repair/build.log']},'commands':commands,'scope':'Final world-repair implementation checks. Independent full verify, actual manual/movie/AV/hardware evidence and creative acceptance remain pending.'}
(r/'check-results.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'commands':len(commands),'tests':report['testTotals'],'contractSha256':report['contractSha256'],'sourceManifestSha256':checks['sourceManifestSha256']}))
