"""Root handoff after a completed, independently rehashed and gated repair."""
from pathlib import Path
import datetime, hashlib, json, shutil
repo=Path('/home/thomasphillip/Projects/vox'); run=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((run/n).read_text())
def write(n,x):(run/n).write_text(json.dumps(x,indent=2)+'\n')
inv=read('integration-handoff-standby-invocation.json')
assert inv.get('finishedAt') and inv.get('exitCode')==0 and inv.get('isError') is False
prep=read('common-manual-probe-prep-invocation.json')
assert prep.get('finishedAt') and prep.get('exitCode')==0 and prep.get('isError') is False
report=read('integration-handoff-standby-report.json');manifest=read('implementation-source-manifest.json');checks=read('check-results.json');gate=read('creative-run-quality-report.json');review=read('producer-handoff-standby-source-review.json')
cs=sha(run/'scene-contract.json');ms=sha(run/'implementation-source-manifest.json')
# Equivalent schema adapter only; original report remains untouched.
report['contractSha256']=report['contract']['sha256'];report['testTotals']['tests']=report['testTotals']['postRepairTests']
report['checks']=[dict(row,logPath=row['log']) for row in report['checks'] if row.get('log')]
assert review.get('acceptedForIndependentVerification') is True and review.get('sourceManifestSha256')==ms
assert review.get('integrationReportSha256')==sha(run/'integration-handoff-standby-report.json')
assert report['contractSha256']==manifest['contractSha256']==checks['contractSha256']==cs
assert checks['sourceManifestSha256']==ms and manifest['unexpectedDrift']==[]
assert gate['passed'] and gate['phase']=='implementation' and gate['failureCount']==0
assert datetime.datetime.fromisoformat(gate['checkedAt'].replace('Z','+00:00'))>datetime.datetime.fromisoformat(checks['compiledAt'])
for p,h in manifest['hashes'].items():assert sha(repo/p)==h,p
archive=run/'iterations/implemented-handoff-standby-repair';archive.mkdir(exist_ok=False)
files=['scene-contract.json','director-signoffs.json','production-lock.json','defects.json','repair-contract-disposition.json','handoff-standby-repair-direction.json','producer-handoff-standby-budget-decision.json','producer-handoff-standby-audit-review.json','producer-focused-evidence-review.json','integration-handoff-standby-report.json','integration-handoff-standby-report.md','integration-handoff-standby-invocation.json','producer-handoff-standby-source-review.json','implementation-source-manifest.json','implementation.diff','check-results.json','creative-run-quality-report.json','handoff-standby-implementation-gate.log','common-manual-probe-prep-report.json','common-manual-probe-prep-report.md','common-manual-probe-prep-invocation.json','lifecycle-mutation-cleanup-deviation.json','chapter-corner-candidate-disposition.json','producer-common-manual-probe-review.json']
for name in files:shutil.copy2(run/name,archive/name)
for p in manifest['hashes']:
 dest=archive/'source'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(repo/p,dest)
for row in report['checks']:
 ref=Path(row['logPath']);src=ref if ref.is_absolute() else (repo/ref if str(ref).startswith('.codex/') else run/ref)
 assert sha(src)==row['logSha256']; dest=archive/src.resolve().relative_to(run.resolve());dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
passed={'passed':True,'phase':'implementation','contractSha256':cs,'sourceManifestSha256':ms,'checkedAt':gate['checkedAt'],'checkCount':gate['checkCount'],'gateReportSha256':sha(run/'creative-run-quality-report.json'),'gateReportRef':str((archive/'creative-run-quality-report.json').relative_to(run)),'publicationAuthorized':False}
write('implementation-gate-pass.json',passed);shutil.copy2(run/'implementation-gate-pass.json',archive/'implementation-gate-pass.json')
defects=read('defects.json')['defects'];counts={key:sum(d['severity']==sev and d['status']=='open' for d in defects) for key,sev in [('critical','critical'),('high','high'),('mediumUnaccepted','medium'),('low','low')]}
ledger=run/'iteration-ledger.jsonl';rows=[json.loads(x) for x in ledger.read_text().splitlines() if x.strip()]
row={'schema':'paravoxia.creativeIteration.v1','runId':run.name,'iteration':max(x['iteration'] for x in rows)+1,'contractVersion':'scene-v2','contractRef':str((archive/'scene-contract.json').relative_to(run)),'contractSha256':cs,'defectRegisterRef':str((archive/'defects.json').relative_to(run)),'defectRegisterSha256':sha(archive/'defects.json'),'route':'revised-and-resigned','budget':'Same chapter run; seventh integration pass overall, original plus six material repairs. One further bounded extension5-to6 explicitly recorded in producer-handoff-standby-budget-decision.json under standing user delegation. No seventh repair authorized. Ledger also records findings-only checkpoints.','changes':['Corrected committed Origin runtime-world ownership and physically qualified chapter-local standby under unchanged signed v2; source proof is distinct from fresh gameplay acceptance.','Preserved prior navigation, save, ordered-route, score/camera/agency and dirty-source work.',f"Final engineer suite {report['testTotals']['tests']} tests; fresh root implementation gate {gate['checkCount']} checks."],'weightedScore':None,'categoryFloor':None,'gateStatus':'implementation_passed_evidence_pending','openDefects':counts,'evidenceRefs':['integration-handoff-standby-report.json','implementation-gate-pass.json','implementation-source-manifest.json','check-results.json','producer-handoff-standby-source-review.json'],'canonicalUrl':None,'nextAction':'Fresh independent full verify/build, root immutable preview replacement, focused physical flight/survey/manual/Continue then full evidence and independent reviews.','recordedAt':now}
with ledger.open('a') as f:f.write(json.dumps(row)+'\n')
write('verifier-control.json',{'updatedAt':now,'action':'continue','activeRole':'handoff-standby-verifier','sourceManifestSha256':ms,'instruction':'Source frozen/gated. Fresh independent fullverify first. NO browser on older38803snapshot. Root publishes final newpreview URL/index/build before capture release. Read currentcommission/inbox.'})
write('verification-ready.json',{'schema':'paravoxia.verificationReadiness.v1','ready':True,'readyAt':now,'runId':run.name,'contractVersion':'scene-v2','contractSha256':cs,'integrationInvocationRef':'integration-handoff-standby-invocation.json','integrationFinishedAt':inv['finishedAt'],'sourceManifestRef':'implementation-source-manifest.json','sourceManifestSha256':ms,'implementationGateRef':'implementation-gate-pass.json','implementationGateChecks':gate['checkCount'],'checkResultsRef':'check-results.json','instructions':'Independent fullverify/build first, then root-owned new immutable preview. All prior evidence retained; no new gameplay acceptance implied.','publicationAuthorized':False,'limitations':['Static checks and harness preparation do not prove gameplay, GPU/AV or taste.','Signed COMMON18-unit manual recovery, lawful earnedContinue and full chapter journeys remain pending.','Existing38803preview is PRIOR source until root replaces it.']})
print(json.dumps({'ready':True,'sourceManifestSha256':ms,'tests':report['testTotals']['tests'],'gateChecks':gate['checkCount'],'archivedFiles':len(manifest['hashes']),'ledgerIteration':row['iteration']}))
