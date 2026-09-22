import json,hashlib,datetime,os,sys
R='/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth'
S=f'{R}/verifier/captures/common-physical-discriminator/run2/summary.json'
s=json.load(open(S)) if os.path.exists(S) else None
D=(s or {}).get('discriminator')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
rep={'schema':'paravoxia.verifier.commonPhysicalDiscriminator.report.v1','role':'common-physical-discriminator','writtenAt':now,
 'startedAt':'2026-09-06T19:59:37.252325+00:00','actualDeadlineUtc':'2026-09-06T20:19:37Z',
 'isAcceptance':False,'isMovementProof':bool(D and D.get('vertices')),
 'ranBrowser':bool(s),'headed':(s or {}).get('headed'),'renderer':(s or {}).get('renderer'),
 'identity':(s or {}).get('identity'),'fixture':(s or {}).get('fixture'),'gates':(s or {}).get('gates'),
 'prerequisiteVerdict':(s or {}).get('verdict'),'discriminator':D,'cleanup':(s or {}).get('cleanup'),
 'closing':(s or {}).get('closing'),'elapsedMs':(s or {}).get('elapsedMs')}
if not s:
    rep['verdict']='NO-GPU-HANDOFF-WITHIN-ACTUAL-DEADLINE'
    rep['causalFailure']='verifier-control.json activeRole never became common-physical-discriminator before the actual 20-minute deadline. CPU probe was implemented, syntax-checked, logic-selftested and proven to refuse correctly pre-browser. No headless substitute was run.'
elif not D or D.get('stoppedAt'):
    rep['verdict']='PREREQUISITE-FAILED-'+str((D or {}).get('stoppedAt'))
else:
    a=D.get('analysis') or {}
    rep['verdict']='COMMON-CREDIT-CALLEE-ENTERED' if a.get('calleeEntered') else 'COMMON-CREDIT-CALLEE-NEVER-ENTERED-ON-MEASURED-LEG'
    rep['numericGapToRouteUnits']=a.get('numericGapToRouteUnits')
open(f'{R}/common-physical-discriminator-report.json','w').write(json.dumps(rep,indent=1)+'\n')
L=[]
L.append('# common-physical-discriminator report\n')
L.append(f"- verdict: **{rep['verdict']}**")
L.append(f"- written {now}; started 19:59:37Z; actual deadline 20:19:37Z")
L.append(f"- browser run: {rep['ranBrowser']}; headed={rep['headed']}; renderer={rep['renderer']}")
L.append(f"- prerequisite (SHORT held-reference) verdict: {rep['prerequisiteVerdict']}")
if D:
    L.append('\n## Approach to E (ordinary keys, avoiding H)')
    ap=D.get('approach') or {}
    L.append(f"- route: {ap.get('route')}; avoidedH={ap.get('avoidedH')}")
    for l in ap.get('legs',[]): L.append(f"  - {l['label']} reached={l['reached']} d={l.get('finalDistance')} distToH={l.get('distanceToH')} supported={(l.get('pose') or {}).get('supported')}")
    L.append(f"- atE: {json.dumps(D.get('atE'))[:600]}")
    L.append('\n## Vertices 1-4')
    for v in D.get('vertices',[]):
        L.append(f"- v{v['vertex']} target={v['target']} crossed={v['crossed']} finalS={v['finalS']} supported={v['supported']} pulses={len(v.get('pulses',[]))} terraAfter={((v.get('commonAfter') or {}).get('common') or {}).get('terraUnits')}")
    L.append('\n## Credit records')
    L.append(f"- {json.dumps(D.get('records'))}")
    L.append(f"- analysis: {json.dumps(D.get('analysis'))}")
    L.append(f"- clearance: {json.dumps(D.get('clearanceChain'))[:400]}")
else:
    L.append(f"\n- causal failure: {rep.get('causalFailure')}")
L.append('\n## Artifacts')
L.append('- probe: verifier/probes/common-physical-discriminator/common-physical-discriminator-probe.mjs')
L.append('- logs: verifier/logs/common-physical-discriminator/')
L.append('- captures: verifier/captures/common-physical-discriminator/')
open(f'{R}/common-physical-discriminator-report.md','w').write('\n'.join(L)+'\n')
print(rep['verdict'])
