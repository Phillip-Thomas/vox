from pathlib import Path
import json,hashlib,datetime
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
get=lambda n:json.loads((r/n).read_text())
for name in ['integration-navigation-repair','integration-navigation-closure','integration-navigation-wording']:
 inv=get(name+'-invocation.json');assert inv.get('finishedAt') and inv.get('exitCode')==0 and inv.get('isError') is False,name
assert get('verification-ready.json')['ready'] is False
main=get('integration-navigation-repair-report.json');closure=get('navigation-closure-report.json');review=get('producer-navigation-preclosure-review.json');wording=get('navigation-wording-report.json')
assert main['contract']['sha256']==closure['contract']['sha256']==sha(r/'scene-contract.json')
assert main['testTotals']['postRepairTests']==closure['testTotals']['preclosureBaselineTests']==3137
merged={x['path']:dict(x) for x in main['changedPaths']}
for c in closure['changedPaths']:
 k=c['path'];assert merged[k]['afterSha256']==c['preclosureBeforeSha256']==review['sourceHashes'][k]
 merged[k]['afterSha256']=c['finalAfterSha256'];merged[k]['closureBeforeSha256']=c['preclosureBeforeSha256']
for k,c in wording['changedFiles'].items():
 assert merged[k]['afterSha256']==c['before'],f'Wording baseline mismatch: {k}'
 merged[k]['wordingBeforeSha256']=c['before'];merged[k]['afterSha256']=c['after']
assert wording['materialBehaviorChange'] is False and wording['gateChanged'] is False
assert wording['totals']['tests']==closure['testTotals']['finalTests']
assert wording['totals']['testFiles']==closure['testTotals']['finalTestFiles']
assert wording['bundleComparison']['before']==wording['bundleComparison']['after']
for k,v in wording['bundleComparison']['after'].items():assert sha(repo/'main'/k)==v,k
expected=dict(review['sourceHashes'])
for k,c in merged.items():expected[k]=c['afterSha256']
for k,v in expected.items():assert sha(repo/k)==v,f'Unreported final drift: {k}'
checks=[]
for c in wording['checks']:
 assert c['exitCode']==0
 ref=Path(c['logPath']);log=ref if ref.is_absolute() else (repo/ref if str(ref).startswith('.codex/') else r/ref)
 assert sha(log)==c['logSha256']
 row={**c,'name':'composite-verify' if c['command']=='npm run verify' else 'story-ux-check','logPath':str(log.relative_to(repo))}
 if c['command']=='npm run verify':
  body=log.read_text();assert '3139 passed' in body and '350 passed' in body
  row.update(tests=wording['totals']['tests'],testFiles=wording['totals']['testFiles'])
 checks.append(row)
final=closure['testTotals'];assert final['finalTests']==3137+final['testsAdded']-final['testsRemoved']
assert main['testTotals']['testsRemoved']==final['testsRemoved']==0
assert any(c['command']=='npm run verify' and c['tests']==final['finalTests'] for c in checks)
inputs=[]
for n in ['integration-navigation-repair-report.json','navigation-closure-report.json','integration-navigation-repair-invocation.json','integration-navigation-closure-invocation.json','navigation-wording-report.json','integration-navigation-wording-invocation.json']:
 inputs.append({'ref':n,'sha256':sha(r/n)})
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
out={'schema':'paravoxia.implementationReport.v1','runId':r.name,'authoredBy':'root producer compiling the actual repair, closure and lexical-cleanup engineer reports; not an engineer or reviewer signature','compiledAt':now,'isAcceptance':False,'isChapterVerificationComplete':False,'publicationAuthorized':False,'contractSha256':sha(r/'scene-contract.json'),'contractVersion':'scene-v2','contractChangeRequired':False,'sourceReports':inputs,'nonBehavioralWordingCleanup':{'reportRef':'navigation-wording-report.json','changedLines':25,'runtimeJavaScriptByteIdentical':True,'gateUnchanged':True},'repairDispositionRef':'producer-navigation-preclosure-review.json','testTotals':{'preRepairV2Baseline':3091,'baselineFiles':349,'files':final['finalTestFiles'],'tests':final['finalTests'],'addedByThisPass':final['finalTests']-3091,'removed':0,'contributions':{'mainRepairAdded':main['testTotals']['testsAdded'],'producerReviewClosureAdded':final['testsAdded']},'precisionNote':'Main report testsChanged2 includes a revision of the foreign-actor test added in this same repair; it is not evidence of two pre-existing tests changed. Original empty-restore case was made to invoke the real restore lifecycle. No test deletion reported; suite total independently checked in final verify log.'},'changedPaths':list(merged.values()),'sourceFilesRehashed':len(expected),'checks':checks,'preservation':{'unexpectedFinalDrift':[],'preclosureReviewRef':'producer-navigation-preclosure-review.json','parentReportedTemporaryScopeDeviation':'A temporary __continue-counterfactual.test.ts outside allowedPaths was created and removed; no pre-existing bytes there were overwritten. Kept in the original report. Closure reused only its two authorized source paths.','historicalGitIncidentRef':'lifecycle-mutation-cleanup-deviation.json'},'resolvedSourceReview':['Terminal exact-goal navigation uses real control output and certified neighboring support at the same height; target-specific cache handles subunit target changes.','Late restore replaces only an empty placeholder; unhydrated and rejected saved data survives autosave.','A present read invalidates stale known-empty ownership; genuine newer work remains authoritative.','Explicit chapter-only clear remains durable and preserves construction/other-world state.'],'counterfactualRefs':['tmp/runtime-seam-result.json','tmp/continue-counterfactual-result.json','logs/navigation-closure/counterfactual-summary.json'],'limitations':['No hardware, rendering, hearing, full chapter, movie or manual acceptance from source tests.','The incomplete old deep-link fixture lawfully resumes departure without an origin-landed receipt; actual earned return must be used for valid Continue proof.','All open implementation/creative defects remain open until current independent evidence and reviews close them.','HABITAT-CARRY-SYMMETRY remains an unmeasured source observation outside this repair; no expansion or fix claimed.'],'nextAction':'Fresh root source/implementation gate, then independent full verify/build, new immutable preview and physical chapter evidence.'}
text=json.dumps(out,indent=2)+'\n'
(r/'integration-navigation-complete-report.json').write_text(text)
(r/'integration-report.json').write_text(text)
md=f'''# Navigation and Continue repair — producer compilation\n\nThe survey movie can now request the precise terminal goal through the shared walker. Save restoration preserves an earned drawing through boot, late hydration and rejected payloads; an explicit clear still removes only the chapter field.\n\nThis document compiles the actual repair and closure reports plus the non-behavioral wording report listed in the JSON. It does not substitute a producer signature for either engineer. All original reports and invocation records are retained.\n\nFinal checks: **{final['finalTests']} tests / {final['finalTestFiles']} files**, full npm run verify and story UX check passed. {len(expected)} source files independently rehashed; seven paths differ from the prior world repair, including one new allowed test file. The closure changed only state ownership and its test. A final lexical-only cleanup left all three production JavaScript bundles byte-identical and the gate unchanged.\n\nSource proof is ready for producer gate review. Physical browser progression, real Continue, manual/movie experience, audiovisual and hardware budgets, and independent creative reviews are still required. Chapter acceptance and publication are not claimed.\n'''
(r/'integration-navigation-complete-report.md').write_text(md);(r/'integration-report.md').write_text(md)
print(json.dumps({'tests':final['finalTests'],'files':final['finalTestFiles'],'sourceFiles':len(expected),'changedPaths':len(merged),'reportSha256':sha(r/'integration-navigation-complete-report.json')}))
