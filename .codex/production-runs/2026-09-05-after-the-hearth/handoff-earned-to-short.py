from pathlib import Path
import json,hashlib,datetime,fcntl,time,subprocess,sys
repo=Path('/home/thomasphillip/Projects/vox');r=repo/'.codex/production-runs/2026-09-05-after-the-hearth';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
start=time.monotonic()
while not json.loads((r/'arrival-common-earned-runtime-invocation.json').read_text()).get('finishedAt'):
 if time.monotonic()-start>600:raise SystemExit('Earned role has not finished; SHORT remains not launched. Preserve checkpoint.')
 time.sleep(5)
assert not (r/'arrival-common-short-runtime-invocation.json').exists()
c=json.loads((r/'verifier-control.json').read_text());assert c['activeRole']=='arrival-common-earned',c['activeRole']
p=r/'verifier/captures/arrival-common-earned/earned-1/cleanup-receipt.json';cl=json.loads(p.read_text());assert cl['sessionStopped'] and cl['cleanupError'] is None,cl
m=json.loads((r/'implementation-source-manifest.json').read_text())
for p0,h in m['hashes'].items():assert sha(repo/p0)==h,p0
with open('/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock','a') as f:
 fcntl.flock(f.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(f.fileno(),fcntl.LOCK_UN)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
h={'at':now,'from':'arrival-common-earned','to':'arrival-common-short-runtime','priorRoleFinished':True,'cleanupReceipt':{'path':str(p.relative_to(r)),'sha256':sha(p)},'sourceManifestSha256':sha(r/'implementation-source-manifest.json'),'sourceFilesRehashed':len(m['hashes']),'isAcceptance':False,'sourceMutationAuthorized':False}
(r/'producer-earned-short-gpu-handoff.json').write_text(json.dumps(h,indent=2)+'\n')
c.update(updatedAt=now,action='continue',activeRole='arrival-common-short-runtime',instruction='Sole GPU authority is arrival-common-short-runtime after earned role finished and browser cleaned. Execute existing prepared commission; no fullsuite/source changes. Immutable34413/source99 current.')
(r/'verifier-control.json').write_text(json.dumps(c,indent=2)+'\n')
print('SHORT source-bound handoff at '+now,flush=True)
subprocess.run([sys.executable,str(r/'run-arrival-common-short-runtime.py')],check=True,cwd=repo)
