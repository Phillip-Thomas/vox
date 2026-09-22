import json,hashlib,sys,os
root='/home/thomasphillip/Projects/vox'
m=json.load(open(os.path.join(root,'.codex/production-runs/2026-09-05-after-the-hearth/implementation-source-manifest.json')))
h=m['hashes']
bad=[];miss=[]
recs={}
for p,exp in sorted(h.items()):
    fp=os.path.join(root,p)
    if not os.path.exists(fp): miss.append(p); continue
    a=hashlib.sha256(open(fp,'rb').read()).hexdigest()
    recs[p]=a
    if a!=exp: bad.append({'path':p,'expected':exp,'actual':a})
agg=hashlib.sha256(''.join(f'{p}\x00{recs[p]}\n' for p in sorted(recs)).encode()).hexdigest()
out={'files':len(h),'matched':len(h)-len(bad)-len(miss),'mismatched':bad,'missing':miss,'aggregate':agg,'label':sys.argv[1]}
print(json.dumps(out,indent=1))
