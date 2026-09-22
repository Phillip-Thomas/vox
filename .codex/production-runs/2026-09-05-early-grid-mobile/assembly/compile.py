from pathlib import Path
import json,hashlib,copy,datetime
RUN=Path(__file__).resolve().parent.parent
ROOT=RUN.parents[2]
ASSEMBLY=RUN/'assembly'
if (ASSEMBLY/'frozen-candidate.json').exists():
 raise SystemExit('Candidate is frozen for authentic director review; do not recompile or change its bytes without explicit revision handling.')
def j(path):return json.loads(path.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def original(name):
 p=RUN/name;s=ASSEMBLY/'originals'/name
 if not s.exists():s.parent.mkdir(parents=True,exist_ok=True);s.write_bytes(p.read_bytes())
 return s
inputs=['chapter-treatment.json','chapter-native-contract-contribution.json','chapter-stage3-proposal.json','cinematography-treatment.json','cinematography-stage3-native-delta.json','score-treatment.json','score-stage3-native-delta.json','production-lock.json','production-lock.md','decision-brief.json','decision-brief.md','shipped-visual-baseline.json','shipped-ux-baseline.json','story-intent.md','score-treatment.md','cinematography-treatment.md']
for n in inputs:original(n)
chapter=j(RUN/'chapter-native-contract-contribution.json');cine=j(RUN/'cinematography-treatment.json');cd=j(RUN/'cinematography-stage3-native-delta.json');sd=j(RUN/'score-stage3-native-delta.json');st=j(RUN/'score-treatment.json')
expected={'chapter-native-contract-contribution.json':'ae1c07da3596bead514af2074e9da044f3c97992640bc4f4a79359778c1ff0d9','chapter-stage3-proposal.json':'0402d9d566a729acb1c01eff4125c0f9b5d06ea1d45aa6f6ac08f8c0f23dd116','cinematography-treatment.json':'04c337f9c04c11fdaeedf900a0770a4ab764eae589d98885cc1d76dc3801723b','score-treatment.json':'9a63e64968e83dd9136c96b5272fffb3be2f45c44231eb51c2b249650d692a5d'}
for n,h in expected.items():assert digest(RUN/n)==h,(n,'source changed')
base=copy.deepcopy(cine['nativeContractContribution']);applied=[]
for source,ops in [('cinematography-stage3-native-delta.json',cd['nativeFieldOperations']),('score-stage3-native-delta.json',sd['nativeFieldOperations'])]:
 for i,op in enumerate(ops):
  keys=op['path'].split('.');parent=base
  for key in keys[:-1]:parent=parent[key]
  key=keys[-1];kind=op['operation'];old=copy.deepcopy(parent.get(key))
  if kind=='replace':parent[key]=copy.deepcopy(op['value'])
  elif kind=='append':
   assert isinstance(parent[key],list)
   assert all(x.get('id')!=op['value'].get('id')for x in parent[key]);parent[key].append(copy.deepcopy(op['value']))
  elif kind in ['replaceById','appendAfterId']:
   ident=op.get('id',op.get('afterId'));indices=[n for n,x in enumerate(parent[key])if x.get('id')==ident];assert len(indices)==1;idx=indices[0]
   if kind=='replaceById':parent[key][idx]=copy.deepcopy(op['value'])
   else:parent[key].insert(idx+1,copy.deepcopy(op['value']))
  else:raise Exception(kind)
  applied.append({'source':source,'operationIndex':i,'operation':kind,'path':op['path'],'oldValueSha256':hashlib.sha256(json.dumps(old,sort_keys=True).encode()).hexdigest()})
base['story']=copy.deepcopy(chapter['story'])
assert base['story']['agencyWindows']==cine['nativeContractContribution']['story']['agencyWindows']
base['story']['agencyWindows']=copy.deepcopy(cine['nativeContractContribution']['story']['agencyWindows'])
base['guidance']=copy.deepcopy(chapter['guidance'])
anchors=copy.deepcopy(cd['nativeSyncAnchorContributions']);cm={x['id']:x for x in chapter['syncAnchorEventMap']};sm={x['id']:x['score']for x in sd['nativeSyncAnchorScoreContributions']}
assert {x['id']for x in anchors}==set(cm)==set(sm)
for i,a in enumerate(anchors):
 # Chapter owns event identity; Cinema's merged stage3 anchors already use these IDs.
 assert a['story']['eventRef']==cm[a['id']]['eventRef']
 assert a['beat']==cm[a['id']]['beat']
 a['order']=i;a['score']=copy.deepcopy(sm[a['id']])
base['syncAnchors']=anchors
criteria=[]
criteriaSources=[]
def criterion(text,ref):
 if text not in criteria:criteria.append(text);criteriaSources.append({'path':'/evidence/acceptanceCriteria/'+str(len(criteria)-1),'source':ref})
for i,capture in enumerate(base['evidence']['captures']):criterion(capture['acceptanceCriterion'],'authored merged capture '+capture['id']+'/acceptanceCriterion')
for i,text in enumerate(j(RUN/'chapter-treatment.json')['requiredNewEvidence']):criterion(text,'chapter-treatment.json#/requiredNewEvidence/'+str(i))
for i,item in enumerate(st['acceptance']):criterion(item['required'],'score-treatment.json#/acceptance/'+str(i)+'/required')
for field in ['nullSuccessorCases','trackCases']:
 for i,text in enumerate(sd['acceptance'][field]):criterion(text,'score-stage3-native-delta.json#/acceptance/'+field+'/'+str(i))
base['evidence']['acceptanceCriteria']=criteria
base['evidence']['mechanicalChecks']=[{'id':'check.early.authored-verification-'+str(i+1),'commandOrProbeRef':'score-treatment.json#requestedVerification/checks/'+str(i),'status':'planned','resultRef':None,'acceptanceCriterion':text}for i,text in enumerate(st['requestedVerification']['checks'])]
base['evidence']['continuity']={'previousBeatRefs':['descent'],'nextBeatRefs':['ch1-depth'],'paletteRefs':[base['palette']['id']],'lensRefs':base['cinematography']['cameraLineage']}
base['evidence']['headedTaste']={'required':True,'realGpuRequired':True,'status':'pending','decisionRef':None}
base['evidence']['directorSignoffsRef']='director-signoffs.json'
write(ASSEMBLY/'evidence-container-provenance.json',{'acceptanceCriteria':criteriaSources,'mechanicalChecks':'Exact Score requestedVerification.checks, each planned with null result. No performed check asserted.','continuity':'Chapter adjacentContinuity, Cinema palette.id and cinematography.cameraLineage.','headedTaste':'Existing scene profile and all three directors require future real-GPU and independent creative review. Pending; no decision.','directorSignoffsRef':'Native expected artifact name only; absent until original directors sign.'})
lock=j(original('production-lock.json'));visual=j(original('shipped-visual-baseline.json'));ux=j(original('shipped-ux-baseline.json'))
boundary=[]
for src,key in [('chapter-treatment.json','proposedRuntimeBoundary'),('chapter-stage3-proposal.json','boundaryAdditions'),('cinematography-stage3-native-delta.json','boundaryAdditions'),('score-treatment.json','proposedRuntimeBoundary'),('score-stage3-native-delta.json','boundaryAdditions')]:
 for item in j(RUN/src).get(key,[]):boundary.append({'source':src,**item})
write(ASSEMBLY/'implementation-boundary.json',{'schema':'paravoxia.assemblyBoundaryLedger.v1','runId':lock['runId'],'authorityRef':'owner-decisions.md','entryRule':'Every originating condition and symbol restriction remains binding. Listed paths are bounded ceilings, not permission to make unrelated changes. No implementation begins before authentic same-hash triad signatures.','entries':boundary})
lock['sourceRevision']=visual['sourceRevision'];lock['mutationBoundary']='bounded-runtime';lock['allowedPaths']=list(dict.fromkeys([f'.codex/production-runs/{RUN.name}/']+[v['path']for v in boundary]));lock['frozenAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
# Exact preserved authority bindings; drift is diagnosed instead of hash-refreshed.
write(RUN/'production-lock.json',lock)
production={'mode':lock['mode'],'authorityRefs':[a['path']for a in lock['authority']]+['owner-decisions.md'],'productionLockRef':'production-lock.json','mutationBoundary':lock['mutationBoundary'],'allowedPaths':lock['allowedPaths'],'protectedPaths':lock['protectedPaths'],'ownerDecisionRefs':['decision-brief.json#early-existing-owner-creative','decision-brief.json#early-existing-owner-boundary','decision-brief.json#early-release-surface'],'canonicalPreviewUrl':None,'frozenAt':None}
scope={'title':'Early grid and mobile','beats':lock['lockedBeats'],'shippedReferenceRefs':['shipped-reference-map.md','shipped-visual-baseline.json','shipped-ux-baseline.json'],'priorEvidenceRefs':['shipped-visual-baseline.json','shipped-ux-baseline.json'],'targetDevices':['desktop','mobile'],'targetQualityTiers':[x['tier']for x in base['variants']['qualityTiers']],'nonGoals':copy.deepcopy(cine['protected']['other'])}
perf=cine['capturePlan']['performance']
base['performance']={'targetFps':perf['targetDesktopFps'],'minimumFps':perf['minimumMobileFps'],'maximumFrameTimeMs':perf['maximumCriticalFrameMs'],'maximumDrawCalls':None,'maximumShaderPrograms':None,'maximumGpuMemoryMb':None,'deviceProfiles':['variant-desktop','variant-mobile'],'criticalAnchors':[a['id']for a in anchors],'measurementPlan':json.dumps(cine['capturePlan'],ensure_ascii=False)+' '+st['proposedContractFieldBindings']['performance']}
perfpath=RUN/'root-native-performance.json'
if perfpath.exists():base['performance']=j(perfpath)['performance']
contract={'schema':'paravoxia.sceneContract.v1','sceneId':'early-grid-mobile','contractVersion':'draft-v1','status':'frozen','production':production,'scope':scope,**base}
# Preserve exact authors' field content first. Reference locator syntax is normalized separately and exhaustively recorded.
write(ASSEMBLY/'scene-contract.authored-projection.json',contract)
normalizations=[]
capture_ids={x['id']for x in contract['evidence']['captures']};base_ids={x['id']for x in cine['currentCutEvidence']}
def normalize(obj,ptr=''):
 if isinstance(obj,dict):
  for k,v in obj.items():
   if k in ['evidenceRefs','priorEvidenceRefs'] and isinstance(v,list):
    for n,ref in enumerate(v):
     new=None
     if ref in capture_ids:new='contract:capture:'+ref
     elif ref in base_ids:new='cinematography-treatment.json#'+ref
     if new:normalizations.append({'path':ptr+'/'+k+'/'+str(n),'old':ref,'new':new,'reason':'native file/contract reference syntax; same authored target'});v[n]=new
   else:normalize(v,ptr+'/'+k)
 elif isinstance(obj,list):
  for n,v in enumerate(obj):normalize(v,ptr+'/'+str(n))
normalize(contract)
for i,text in enumerate(contract['evidence']['acceptanceCriteria']):
 if '<=2frames ->' in text:
  new=text.replace('<=2frames','≤2frames')
  normalizations.append({'path':'/evidence/acceptanceCriteria/'+str(i),'old':text,'new':new,'reason':'Mathematically identical Unicode less-than-or-equal representation prevents numeric comparison plus arrow being mistaken for a template token; exact source criterion preserved in authored projection.'})
  contract['evidence']['acceptanceCriteria'][i]=new
write(RUN/'scene-contract.json',contract)
write(ASSEMBLY/'compilation-report.json',{'schema':'paravoxia.mechanicalAssembly.v1','compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runId':lock['runId'],'contractVersion':'draft-v1','contractSha256':digest(RUN/'scene-contract.json'),'sourceBindings':[{'path':n,'sha256':digest(RUN/n)}for n in inputs if n not in ['production-lock.json','production-lock.md','shipped-visual-baseline.json','shipped-ux-baseline.json']],'operations':applied,'referenceNormalizations':normalizations,'retainedOriginals':[{'path':str(original(n).relative_to(RUN)),'sha256':digest(original(n))}for n in inputs],'directors':{'notesAuthoredByCompiler':0,'repliesAuthoredByCompiler':0,'signaturesAuthoredByCompiler':0},'counts':{'anchors':len(anchors),'objectives':len(base['guidance']['objectives']),'shots':len(base['shots']),'captures':len(base['evidence']['captures']),'scoreCues':len(base['score']['cues'])},'remainingAbsolutePerformanceBudgets':perfpath.exists()==False})
print('compiled',digest(RUN/'scene-contract.json'))
