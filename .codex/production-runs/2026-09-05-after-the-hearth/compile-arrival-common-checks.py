from pathlib import Path
import json,hashlib,datetime,subprocess,shutil
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda b:hashlib.sha256(b).hexdigest()
inv=json.loads((r/'integration-arrival-common-invocation.json').read_text())
if (r/'integration-arrival-common-metadata-invocation.json').exists():
 assert inv.get('finishedAt'), 'Original integration must finish first'
 inv=json.loads((r/'integration-arrival-common-metadata-invocation.json').read_text())
assert inv.get('finishedAt') and inv.get('exitCode')==0 and inv.get('isError') is False,'Repair must finish successfully'
report=json.loads((r/'integration-arrival-common-report.json').read_text())
# Normalize equivalent fields from this engineer's retained report; do not rewrite its signed bytes.
report['contractSha256']=report['contract']['sha256']
t=report['testTotals']; t.update(tests=t.get('postRepairTests',t.get('finalTests')),addedByThisPass=t['testsAdded'],removed=t['testsRemoved'])
report['checks']=[dict(row,logPath=row['log']) for row in report['checks'] if row.get('log')]
assert report['contractSha256']==sha((r/'scene-contract.json').read_bytes())
assert report['testTotals']['preRepairBaseline']==3158
assert report['testTotals']['tests']==report['testTotals']['preRepairBaseline']+report['testTotals']['addedByThisPass']-report['testTotals']['removed']
prior=json.loads((r/'iterations/arrival-common-findings/implementation-source-manifest.json').read_text())
external_report_rows=[row for row in report['changedPaths'] if row.get('phase')=='EXTERNAL — not mine']
owned_report_rows=[row for row in report['changedPaths'] if row not in external_report_rows]
changes={row['path']:row for row in owned_report_rows}
direction=json.loads((r/'arrival-common-repair-direction.json').read_text())
assert set(changes).issubset(set(direction['allowedSourcePaths'])), 'Repair changed paths outside exact direction'
assert len(changes)==len(owned_report_rows), 'Duplicate changed path'
assert direction['sourceMutationAuthorized'] and direction['contractSha256']==report['contractSha256']
external={}
external_ref=r/'producer-concurrent-validation-tooling-review.json'
if external_ref.exists():
 ext=json.loads(external_ref.read_text());assert ext['acceptedForCurrentVerification'] is True
 external=ext['sourceHashOverrides'];assert not set(external)&set(changes), 'External changes cannot be attributed to integration'
 for name,h in ext['observedAuxiliaryFiles'].items():assert sha((repo/name).read_bytes())==h, f'Concurrent auxiliary tooling drift: {name}'
for row in external_report_rows:
 assert row['path'] in external and row['inAllowedPaths'] is False, 'External report row needs independent root review'
 historical=ext.get('reportObservedHistoricalHashRefs',{}).get(row['path'])
 assert (sha((r/historical).read_bytes()) if historical else external[row['path']])==row['afterSha256'], 'Reported external bytes need retained evidence'
for name,old in prior['hashes'].items():
 expected=changes[name]['afterSha256'] if name in changes else external.get(name,old)
 assert sha((repo/name).read_bytes())==expected,f'Unreported repair drift: {name}'
 if name in changes:assert changes[name]['beforeSha256']==old
for name,row in changes.items():
 if name not in prior['hashes']:
  assert row['beforeSha256'] is None, f'Unproven added file: {name}'
  assert sha((repo/name).read_bytes())==row['afterSha256'],f'Added file drift: {name}'
subprocess.run(['python3',str(r/'compile-arrival-common-snapshot.py')],cwd=repo,check=True)
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
  measured_package=repo/'.codex/production-runs/2026-09-05-after-the-hearth/iterations/concurrent-validation-tooling/current/main/package.json'
  assert json.loads(measured_package.read_text())['scripts']['verify']==verify_script
  x['componentScriptSourceSha256']=sha(measured_package.read_bytes())
  x['componentScriptSnapshotRef']=str(measured_package.relative_to(r))
  x['currentPackageSha256']=sha((repo/'main/package.json').read_bytes())
def refs_for(variants):
 direct=[x['evidenceRef'] for x in commands if x['command'] in variants]
 refs=direct or [x['evidenceRef'] for x in verify_commands]
 assert refs, f'No actual passing command/log for {variants}'
 return list(dict.fromkeys(refs))
type_refs=refs_for(['npm run typecheck','npm --prefix main run typecheck'])
test_refs=refs_for(['npm test','npm run test','npm --prefix main run test'])
build_refs=refs_for(['npm run build','npm --prefix main run build'])
checks={'schema':'paravoxia.checkResults.v1','runId':r.name,'contractVersion':'scene-v3','contractSha256':report['contractSha256'],'sourceRevision':json.loads((r/'production-lock.json').read_text())['sourceRevision'],'compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceManifestSha256':sha((r/'implementation-source-manifest.json').read_bytes()),'productionScope':{'status':'passed','evidenceRefs':['implementation.diff','implementation-source-manifest.json','production-lock.json','producer-boundary-completion.json']},'creativeContract':{'status':'passed','evidenceRefs':['contract-gate-pass.json','scene-v3-contract-gate.log','final-contract-gate-pass.json','scene-v3-final-contract-gate.log','director-signoffs.json']},'typecheck':{'status':'passed','evidenceRefs':type_refs},'tests':{'status':'passed','evidenceRefs':test_refs},'build':{'status':'passed','evidenceRefs':build_refs},'commands':commands,'scope':'Final arrival/common implementation checks. Independent full verify, actual manual/movie/AV/hardware evidence and creative acceptance remain pending.'}
if external:
 checks['productionScope']['evidenceRefs'].append('producer-concurrent-validation-tooling-review.json')
 checks['externalSourceChanges']={'reviewRef':'producer-concurrent-validation-tooling-review.json','reviewSha256':sha(external_ref.read_bytes()),'hashes':external}
(r/'check-results.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'commands':len(commands),'tests':report['testTotals'],'contractSha256':report['contractSha256'],'sourceManifestSha256':checks['sourceManifestSha256']}))
