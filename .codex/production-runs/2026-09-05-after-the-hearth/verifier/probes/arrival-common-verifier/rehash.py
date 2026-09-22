import json,hashlib,sys,os
ROOT='/home/thomasphillip/Projects/vox'
RUN='/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth'
m=json.load(open(os.path.join(RUN,'implementation-source-manifest.json')))
def sha(p):
    try:
        return hashlib.sha256(open(p,'rb').read()).hexdigest()
    except FileNotFoundError:
        return 'MISSING'
out={'label':sys.argv[1],'manifest':{}, 'aux':{}, 'external':{}}
mm=0
for p,h in m['hashes'].items():
    a=sha(os.path.join(ROOT,p))
    out['manifest'][p]={'expected':h,'actual':a,'match':a==h}
    if a!=h: mm+=1
for p,h in m['auxiliaryToolingHashes'].items():
    a=sha(os.path.join(ROOT,p))
    out['aux'][p]={'expected':h,'actual':a,'match':a==h}
    if a!=h: mm+=1
for p,h in m['externalSourceChanges']['hashes'].items():
    a=sha(os.path.join(ROOT,p))
    out['external'][p]={'expected':h,'actual':a,'match':a==h}
    if a!=h: mm+=1
out['mismatches']=mm
out['manifestFileSha256']=sha(os.path.join(RUN,'implementation-source-manifest.json'))
out['contractSha256']=sha(os.path.join(RUN,'scene-contract.json'))
json.dump(out,open(os.path.join(RUN,'logs/arrival-common-verifier','rehash-%s.json'%sys.argv[1]),'w'),indent=1)
print(sys.argv[1],'mismatches',mm,'manifestSha',out['manifestFileSha256'],'contractSha',out['contractSha256'])
