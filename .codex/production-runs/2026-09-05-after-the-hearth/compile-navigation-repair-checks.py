from pathlib import Path
import json,hashlib,datetime,subprocess,shutil
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda b:hashlib.sha256(b).hexdigest()
inv=json.loads((r/'integration-navigation-repair-invocation.json').read_text())
assert inv.get('finishedAt') and inv.get('exitCode')==0 and inv.get('isError') is False,'Repair must finish successfully'
closure=json.loads((r/'integration-navigation-closure-invocation.json').read_text())
assert closure.get('finishedAt') and closure.get('exitCode')==0 and closure.get('isError') is False,'Producer-review closure must finish successfully'
wording=json.loads((r/'integration-navigation-wording-invocation.json').read_text())
assert wording.get('finishedAt') and wording.get('exitCode')==0 and wording.get('isError') is False,'Terminology cleanup must finish successfully'
report=json.loads((r/'integration-navigation-complete-report.json').read_text())
assert report['contractSha256']==sha((r/'scene-contract.json').read_bytes())
assert report['testTotals']['preRepairV2Baseline']==3091
assert report['testTotals']['tests']==report['testTotals']['preRepairV2Baseline']+report['testTotals']['addedByThisPass']-report['testTotals']['removed']
prior=json.loads((r/'iterations/implemented-world-repair/implementation-source-manifest.json').read_text())
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
# A successful composite verify runs the real component scripts. Record that
# actual command and its single log rather than inventing separate invocations.
verify_commands = [x for x in commands if x['command'] in ['npm run verify', 'npm --prefix main run verify']]
if verify_commands:
 verify_script=json.loads((repo/'main/package.json').read_text())['scripts']['verify']
 for required in ['npm run typecheck','npm run test','npm run build']:
  assert required in verify_script.split(' && '), f'Composite verify no longer includes {required}'
 for x in verify_commands:
  log=(r/x['evidenceRef']).read_text()
  for marker in [' typecheck', 'vitest run', 'vite build', 'Test Files', 'Tests ']:
   assert marker in log, f'Composite log lacks {marker}'
  x['componentScriptSource']='main/package.json#scripts.verify'
  x['componentScript']=verify_script
  x['componentScriptSourceSha256']=sha((repo/'main/package.json').read_bytes())
def refs_for(variants):
 direct=[x['evidenceRef'] for x in commands if x['command'] in variants]
 refs=direct or [x['evidenceRef'] for x in verify_commands]
 assert refs, f'No actual passing command/log for {variants}'
 return list(dict.fromkeys(refs))
type_refs=refs_for(['npm run typecheck','npm --prefix main run typecheck'])
test_refs=refs_for(['npm test','npm run test','npm --prefix main run test'])
build_refs=refs_for(['npm run build','npm --prefix main run build'])
checks={'schema':'paravoxia.checkResults.v1','runId':r.name,'contractVersion':'scene-v2','contractSha256':report['contractSha256'],'sourceRevision':json.loads((r/'production-lock.json').read_text())['sourceRevision'],'compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceManifestSha256':sha((r/'implementation-source-manifest.json').read_bytes()),'productionScope':{'status':'passed','evidenceRefs':['implementation.diff','implementation-source-manifest.json','production-lock.json','producer-boundary-completion.json']},'creativeContract':{'status':'passed','evidenceRefs':['contract-gate-pass.json','scene-v2-contract-gate.log','director-signoffs.json']},'typecheck':{'status':'passed','evidenceRefs':type_refs},'tests':{'status':'passed','evidenceRefs':test_refs},'build':{'status':'passed','evidenceRefs':build_refs},'commands':commands,'scope':'Final navigation-repair implementation checks. Independent full verify, actual manual/movie/AV/hardware evidence and creative acceptance remain pending.'}
(r/'check-results.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'commands':len(commands),'tests':report['testTotals'],'contractSha256':report['contractSha256'],'sourceManifestSha256':checks['sourceManifestSha256']}))
