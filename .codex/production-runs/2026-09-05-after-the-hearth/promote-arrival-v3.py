from pathlib import Path
import json,hashlib,datetime,shutil
r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((r/n).read_text())
write=lambda n,d:(r/n).write_text(json.dumps(d,indent=2)+'\n')
for n in ['common-manual-runtime-invocation.json','earned-continue-probe-prep-invocation.json','entry-discriminator-invocation.json']:
 assert read(n).get('finishedAt'),f'Active role must finish before contract/source handoff: {n}'
assert (r/'producer-arrival-common-findings-review.json').is_file(),'Root must review actual manual and preparation results before promotion'
assert sha(r/'scene-contract.json')=='4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e'
c=r/'arrival-v3-candidate';cs=sha(c/'scene-contract.json');assert cs=='5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54'
sigs={}
for lane,name in [('chapter','chapter-v3-contract-signoff.json'),('score','score-v3-contract-signoff.json'),('cinematography','cinematography-v3-contract-signoff.json')]:
 d=read(name);assert d['contractVersion']=='scene-v3' and d['contractSha256']==cs and d['disposition'] in ['approve','approve-with-notes'];sigs[lane]=d
assert read('producer-v3-decision.json')['contractSha256']==cs
archive=r/'iterations/pre-v3-arrival-promotion';archive.mkdir(exist_ok=False)
for p in r.iterdir():
 if p.is_file() and p.name in ['scene-contract.json','scene-cinema-lane.json','story-intent.md','director-signoffs.json','chapter-contract-signoff.json','score-contract-signoff.json','cinematography-contract-signoff.json','contract-gate-pass.json','verification-ready.json','verifier-control.json','defects.json','repair-contract-disposition.json','production-lock.json']:
  shutil.copy2(p,archive/p.name)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
ready=read('verification-ready.json');ready.update(ready=False,revokedAt=now,reason='Signed v3 arrival amendment promoted; exact contract gate, seventh source repair and new independent verification pending.');write('verification-ready.json',ready)
control=read('verifier-control.json');control.update(updatedAt=now,action='hold',activeRole=None,instruction='All captures held during signed v3 promotion and pending source repair. Existing preview remains prior immutable v2 source.');write('verifier-control.json',control)
for n in ['scene-contract.json','scene-cinema-lane.json','story-intent.md']:shutil.copy2(c/n,r/n)
aggregate={'schema':'paravoxia.directorSignoffs.v1','contractRevision':'scene-v3','contractSha256':cs,'sameRevision':True}
for lane,d in sigs.items():
 aggregate[lane]={k:d[k] for k in ['disposition','contractSha256','signedBy','signedAt']};aggregate[lane]['revision']=d['contractVersion']
 name={'chapter':'chapter','score':'score','cinematography':'cinematography'}[lane]+'-contract-signoff.json'
 shutil.copy2(r/({'chapter':'chapter','score':'score','cinematography':'cinematography'}[lane]+'-v3-contract-signoff.json'),r/name)
write('director-signoffs.json',aggregate)
d=read('defects.json');d.update(contractVersion='scene-v3',contractSha256=cs,updatedAt=now);write('defects.json',d)
d=read('repair-contract-disposition.json');d.update(activeContractVersion='scene-v3',activeContractSha256=cs,defectRegisterSha256=sha(r/'defects.json'),contractChangeRequired=True,triadResignRequired=True,triadResignComplete=True,decidedAt=now,priorImplementationDirection=d.get('implementationDirection'))
d['directionRefs']=['chapter-arrival-guidance-interpretation.json','chapter-common-terminal-interpretation.json','producer-common-terminal-audit-review.json'];d['implementationDirection']={'defectIds':['CG-IMPL-010','CG-IMPL-014'],'contractChangeRequired':True,'owner':'integration-engineer','boundedAction':'Exact signed conditional arrival guidance and safe movie steering over unchanged original COMMON route; final mutation direction pending root review and contract gate.','directionRef':'arrival-common-repair-direction.json','sourceMutationAuthorizedNow':False};write('repair-contract-disposition.json',d)
receipt={'schema':'paravoxia.producerContractPromotion.v1','promotedAt':now,'priorContractSha256':'4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e','contractVersion':'scene-v3','contractSha256':cs,'candidateCopiedByteExactly':sha(r/'scene-contract.json')==cs,'archiveRef':str(archive.relative_to(r)),'signatureMapping':'contractVersion to revision only; exact director disposition/name/time/hash preserved','gatePending':True,'sourceMutationAuthorized':False}
write('scene-v3-promotion.json',receipt);print(json.dumps(receipt))
