from pathlib import Path
import json,hashlib,datetime,shutil
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
get=lambda n:json.loads((r/n).read_text())
assert get('integration-navigation-repair-invocation.json')['finishedAt']
assert get('verification-ready.json')['ready'] is False
report=get('integration-navigation-repair-report.json');prior=get('implementation-source-manifest.json');changes={x['path']:x for x in report['changedPaths']}
expected=dict(prior['hashes'])
for k,v in changes.items():
 assert v['beforeSha256']==prior['hashes'].get(k)
 expected[k]=v['afterSha256']
for k,v in expected.items():assert sha(repo/k)==v,k
archive=r/'iterations/navigation-preclosure';archive.mkdir(exist_ok=False)
for n in ['scene-contract.json','production-lock.json','defects.json','implementation-source-manifest.json','integration-navigation-repair-report.json','integration-navigation-repair-report.md','integration-navigation-repair-invocation.json','navigation-repair-open-review-items.json','navigation-repair-direction.json','producer-navigation-budget-decision.json']:
 shutil.copy2(r/n,archive/n)
for k in expected:
 dest=archive/'source'/k;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(repo/k,dest)
for c in report['checks']:
 p=repo/c['log'];assert sha(p)==c['logSha256'];dest=archive/c['log'].split(r.name+'/',1)[1];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
review={'schema':'paravoxia.producerNavigationPreclosureReview.v1','recordedAt':now,'sourceHashes':expected,'reportRef':'integration-navigation-repair-report.json','reportSha256':sha(r/'integration-navigation-repair-report.json'),'sourceFilesVerified':len(expected),'acceptedForIndependentVerification':False,'reason':'Existing CG-IMPL011 restore lifetime requirement remains open: stale known-empty membership can authorize an empty save after a later present payload is rejected. Last inbox entry13:47:57 was not incorporated before role ended13:50:35. No claim that all SAVE-ENTRY cases are closed.','testBaseline':3137,'fileBaseline':350,'scope':'Close only this remaining source-review finding before the current fifth material repair is handed to independent verification. Same contract, source work, run and repair allowance. No new browser-triggered repair, no new creative pass, no accepted candidate withdrawn.','budgetRef':'producer-navigation-budget-decision.json','newMaterialRepairLoop':False,'additionalSourceCall':'integration-navigation-closure','noAdditionalGPUOrPublication':True,'observations':['Real autopilot control counterfactual passes repaired and fails prior with zero directional frames.','Actual save counterfactual retains4samples versus prior0; latest full check passes350files3137tests.','Report testsChanged2 includes revision of a newly added foreign-actor test, not necessarily two pre-existing tests; root will verify against immutable baseline.','Temporary out-of-boundary __continue-counterfactual.test.ts was created then removed; no original source file was overwritten there. Preserve this history, not an incident-free scope claim.','Canonical integration-report.json remains the older world-pass report; root will collate final source/checks explicitly after closure.']}
(r/'producer-navigation-preclosure-review.json').write_text(json.dumps(review,indent=2)+'\n')
print(json.dumps({'sourceFiles':len(expected),'sourceClearance':False,'archive':str(archive)}))
