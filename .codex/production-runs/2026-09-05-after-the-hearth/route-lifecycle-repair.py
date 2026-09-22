from pathlib import Path
import json, hashlib, shutil, datetime
repo=Path('/home/thomasphillip/Projects/vox'); r=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
write=lambda p,d:p.write_text(json.dumps(d,indent=2)+'\n')
inv=json.loads((r/'story-verifier-continuation-invocation.json').read_text())
assert inv.get('finishedAt'), 'Verifier must finish before routing mutation'
assert (r/'verification-lifecycle-interim-report.json').is_file()
archive=r/'iterations/lifecycle-verification-findings';assert not archive.exists(),'Never overwrite an iteration'
archive.mkdir(parents=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest=json.loads((r/'implementation-source-manifest.json').read_text())
for name,expected in manifest['hashes'].items():
 p=repo/name;assert sha(p)==expected,f'Unreported source drift: {name}'
 dest=archive/'source'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
for name in ['scene-contract.json','director-signoffs.json','defects.json','repair-contract-disposition.json','implementation-source-manifest.json','implementation.diff','integration-report.json','integration-report.md','check-results.json','implementation-gate-pass.json','verification-ready.json','verifier-findings.json','verification-lifecycle-interim-report.json','verification-lifecycle-interim-report.md','story-verifier-continuation-invocation.json','score-home-anchor-eligibility-interpretation.md','chapter-manual-corner-interpretation.md','producer-manual-corner-risk.json']:
 shutil.copy2(r/name,archive/name)
register=json.loads((r/'defects.json').read_text())
entries=[
 ('CG-IMPL-006','anc.cg.route-drawn','VF-RAIL-2','The new chapter compares live capsule-centre positions with ground-authored poses; the survey movie physically reaches S but its subunit 3D arrival gate remains unsatisfiable.', 'Reconcile chapter physical coordinate semantics for arrival, recording, support, sockets, occupancy, clearance and traversal using actual capsule/up/ground facts. Preserve geometry and all physical predicates; test real centre-to-ground offsets and shared gait behavior.'),
 ('CG-IMPL-007','anc.cg.repeated-measure','VF-DEEPLINK-1','Direct entry to an on-foot ch13 beat can retain surface flight controls; the movie cannot walk or recover.', 'Correct the causal beat-entry/control lifecycle within the existing chapter boundary, preserving valid Continue/manual boarding and continuous return. Do not grant milestones or force manual disembark each tick.'),
 ('CG-IMPL-008','anc.cg.home-steady','VF-ANCHOR-OBS-1','A hydrated home entry performs real review and return actions but activates no home anchors. The ineligible live-install prerequisite and a locally spent rejected anchor are concrete source risks.', 'Enforce the signed eligibility distinction: silent restored home-steady and later actual F anchors remain valid while live install acknowledgement requires its fresh receipt. Repair ordering/latch wiring without global order bypass, phantom receipt or replayed/deferred cue; cover actual AV runtime lifecycle in tests.')
]
for id,anchor,finding,statement,repair in entries:
 assert not any(d['id']==id for d in register['defects'])
 register['defects'].append({'id':id,'severity':'high','category':'implementation-fidelity','status':'open','owner':'integration-engineer','anchor':anchor,'statement':statement,'evidenceRefs':['verifier-findings.json#'+finding,'verification-lifecycle-interim-report.json'],'requestedRepair':repair,'verificationRoute':'Meaningful physical/AV integration regression followed by independent actual browser cold/continuous/manual/Continue evidence and affected independent reviewers. No test-only closure.','sourceReportRefs':['verification-lifecycle-interim-report.json'],'iterationIntroduced':5,'iterationResolved':None,'acceptedExceptionRef':None})
for name in ['verifier-findings.json','verification-lifecycle-interim-report.json','score-home-anchor-eligibility-interpretation.md','chapter-manual-corner-interpretation.md']:
 register.setdefault('sourceReports',[]).append({'path':name,'sha256':sha(r/name)})
register['updatedAt']=now
write(r/'defects.json',register)
direction={'schema':'paravoxia.implementationRepairDirection.v1','runId':r.name,'recordedAt':now,'author':'creative-producer under explicit standing user delegation','contractVersion':'scene-v2','contractSha256':sha(r/'scene-contract.json'),'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'defectRegisterSha256':sha(r/'defects.json'),'defectIds':[e[0] for e in entries],'owner':'integration-engineer','contractChangeRequired':False,'boundedAction':'Repair causal entry-mode, physical coordinate and anchor eligibility integration defects under unchanged signed v2. Diagnose common fixture stall and reproduce manual steering recovery risk; correct only demonstrated in-scope failure while preserving full ordered actual18 traversal and all signed physical/agency conditions. No new creative direction.','evidenceRefs':['verification-lifecycle-interim-report.json','verifier-findings.json','chapter-manual-corner-interpretation.md','score-home-anchor-eligibility-interpretation.md','producer-manual-corner-risk.json'],'manualRiskDisposition':'Browser manual traversal not reached. Engineer may reproduce this recorded source/test risk and implement a bounded correction only if demonstrated; otherwise retain working behavior and report. Chapter existing-contract interpretation is binding, no skipped-ground or unrelated-distance credit.','scope':'Production-lock allowed source only; any new boundary reported before mutation. No publication.','budgetDisposition':'Fourth integration pass overall: original implementation plus three bounded repair passes. Within chapter maxPatchLoops4; ledger rows also include immutable findings/signature checkpoints and are not patch-count proxies.'}
write(r/'lifecycle-repair-direction.json',direction)
d=json.loads((r/'repair-contract-disposition.json').read_text())
d['defectRegisterSha256']=sha(r/'defects.json');d['decidedAt']=now
d['priorImplementationDirection']=d['implementationDirection'];d['implementationDirection']={k:direction[k] for k in ['defectIds','contractChangeRequired','owner','boundedAction','evidenceRefs']}
d['implementationDirection']['directionRef']='lifecycle-repair-direction.json'
write(r/'repair-contract-disposition.json',d)
ready=json.loads((r/'verification-ready.json').read_text());ready.update(ready=False,updatedAt=now,reason='Independent lifecycle findings routed to single integration writer; no source measurement until finished repair and fresh root gate.');write(r/'verification-ready.json',ready)
for name in ['scene-contract.json','defects.json','repair-contract-disposition.json','lifecycle-repair-direction.json','verification-ready.json']:
 shutil.copy2(r/name,archive/('current-'+name))
ledger={'schema':'paravoxia.creativeIteration.v1','runId':r.name,'iteration':5,'contractVersion':'scene-v2','contractRef':'iterations/lifecycle-verification-findings/current-scene-contract.json','contractSha256':sha(r/'scene-contract.json'),'defectRegisterRef':'iterations/lifecycle-verification-findings/current-defects.json','defectRegisterSha256':sha(r/'defects.json'),'route':'revised-and-resigned','budget':direction['budgetDisposition'],'changes':['Independent full verify passed3026tests; real hardware home action now progresses.','Independent on-foot survey probe demonstrates capsule-centre/ground-pose mismatch; direct on-foot chapter entry retains flight mode.','Hydrated home anchor anomaly interpreted by Score; bounded existing-contract correction required.','Common diagnostic and manual-corner source risk remain distinct from earned continuous/manual proof.'],'weightedScore':None,'categoryFloor':None,'gateStatus':'repair_required','openDefects':{'critical':0,'high':6,'mediumUnaccepted':2,'low':0},'evidenceRefs':['verification-lifecycle-interim-report.json','verifier-findings.json','lifecycle-repair-direction.json'],'canonicalUrl':'http://127.0.0.1:43617/','nextAction':'One bounded integration pass, then exact static gate and independent physical journey/AV/UX evidence.','recordedAt':now}
with (r/'iteration-ledger.jsonl').open('a') as f:f.write(json.dumps(ledger)+'\n')
print(json.dumps({'routed':direction['defectIds'],'sourceFilesPreserved':len(manifest['hashes']),'archive':str(archive),'readiness':False}))
