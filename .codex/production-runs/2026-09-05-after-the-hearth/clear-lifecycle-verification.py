"""Root handoff only: archive an independently rehashed, freshly gated repair."""
from pathlib import Path
import datetime
import hashlib
import json
import shutil

repo = Path('/home/thomasphillip/Projects/vox')
run = Path(__file__).resolve().parent
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
read = lambda name: json.loads((run / name).read_text())
write = lambda name, value: (run / name).write_text(json.dumps(value, indent=2) + '\n')

inv = read('integration-lifecycle-repair-invocation.json')
assert inv.get('finishedAt') and inv.get('exitCode') == 0 and inv.get('isError') is False
assert read('harness-prep-invocation.json').get('finishedAt')
report = read('integration-lifecycle-repair-report.json')
manifest = read('implementation-source-manifest.json')
checks = read('check-results.json')
gate = read('creative-run-quality-report.json')
contract_sha = sha(run / 'scene-contract.json')
manifest_sha = sha(run / 'implementation-source-manifest.json')
assert report['contractSha256'] == manifest['contractSha256'] == checks['contractSha256'] == contract_sha
assert checks['sourceManifestSha256'] == manifest_sha
assert gate['passed'] and gate['phase'] == 'implementation' and gate['failureCount'] == 0
assert datetime.datetime.fromisoformat(gate['checkedAt'].replace('Z', '+00:00')) > datetime.datetime.fromisoformat(checks['compiledAt'])
for path, expected in manifest['hashes'].items():
    assert sha(repo / path) == expected, f'Post-gate source drift: {path}'
assert manifest['unexpectedDrift'] == []
archive = run / 'iterations/implemented-lifecycle-repair'
assert not archive.exists(), 'Never overwrite an immutable iteration'
archive.mkdir()
for name in ['scene-contract.json', 'director-signoffs.json', 'production-lock.json', 'defects.json', 'repair-contract-disposition.json', 'lifecycle-repair-direction.json', 'integration-report.json', 'integration-report.md', 'integration-lifecycle-repair-report.json', 'integration-lifecycle-repair-report.md', 'integration-lifecycle-repair-invocation.json', 'implementation-source-manifest.json', 'implementation.diff', 'check-results.json', 'creative-run-quality-report.json', 'lifecycle-implementation-gate.log', 'lifecycle-mutation-cleanup-deviation.json', 'producer-probe-observer-concern.json', 'producer-midbeat-anchor-restore-concern.json', 'chapter-corner-candidate-disposition.json', 'harness-prep-report.json', 'harness-prep-interface-resolution.json']:
    shutil.copy2(run / name, archive / name)
for path in manifest['hashes']:
    dest = archive / 'source' / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / path, dest)
for check in report['checks']:
    src = run / check['logPath']
    assert sha(src) == check['logSha256']
    dest = archive / check['logPath']
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
shutil.copy2(run / 'producer-lifecycle-source-review.json', archive / 'producer-lifecycle-source-review.json')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
gate_pass = {'passed': True, 'phase': 'implementation', 'contractSha256': contract_sha, 'sourceManifestSha256': manifest_sha, 'checkedAt': gate['checkedAt'], 'checkCount': gate['checkCount'], 'gateReportSha256': sha(run / 'creative-run-quality-report.json'), 'gateReportRef': str((archive / 'creative-run-quality-report.json').relative_to(run)), 'publicationAuthorized': False}
write('implementation-gate-pass.json', gate_pass)
shutil.copy2(run / 'implementation-gate-pass.json', archive / 'implementation-gate-pass.json')
defects = read('defects.json')['defects']
counts = {key: sum(d['severity'] == sev and d['status'] == 'open' for d in defects) for key, sev in [('critical', 'critical'), ('high', 'high'), ('mediumUnaccepted', 'medium'), ('low', 'low')]}
ledger = run / 'iteration-ledger.jsonl'
rows = [json.loads(line) for line in ledger.read_text().splitlines() if line.strip()]
row = {'schema': 'paravoxia.creativeIteration.v1', 'runId': run.name, 'iteration': max(x['iteration'] for x in rows) + 1, 'contractVersion': 'scene-v2', 'contractRef': str((archive / 'scene-contract.json').relative_to(run)), 'contractSha256': contract_sha, 'defectRegisterRef': str((archive / 'defects.json').relative_to(run)), 'defectRegisterSha256': sha(archive / 'defects.json'), 'route': 'revised-and-resigned', 'budget': 'Same chapter run; fourth integration pass overall, original plus three repairs under unchanged signed v2. Ledger rows also record findings, not only patches.', 'changes': ['Reconciled physical body centre and authored ground pose at the chapter boundary; corrected on-foot entry ownership.', 'Repaired eligible anchor ordering and Continue; withdrew the corner-credit allowance; made diagnostics passive.', f"Final engineer suite: {report['testTotals']['tests']} tests. Fresh root gate: {gate['checkCount']} checks. Exact source preservation rechecked.", 'The dirty-file checkout incident was recovered from the immutable pre-repair bytes and remains documented.'], 'weightedScore': None, 'categoryFloor': None, 'gateStatus': 'implementation_passed_evidence_pending', 'openDefects': counts, 'evidenceRefs': ['integration-lifecycle-repair-report.json', 'implementation-gate-pass.json', 'implementation-source-manifest.json', 'check-results.json', 'lifecycle-mutation-cleanup-deviation.json'], 'canonicalUrl': None, 'nextAction': 'Independent full verify, immutable preview replacement, targeted actual physical journeys, then comprehensive evidence and fresh reviews.', 'recordedAt': now}
with ledger.open('a') as file:
    file.write(json.dumps(row) + '\n')
write('verifier-control.json', {'updatedAt': now, 'action': 'continue', 'sourceManifestSha256': manifest_sha, 'instruction': 'Current source is now frozen and gated. First independent full verify/build, announce BUILD READY, then wait for root-owned preview replacement. No browser measurement on the older snapshot. Read the current commission and inbox.'})
write('verification-ready.json', {'schema': 'paravoxia.verificationReadiness.v1', 'ready': True, 'readyAt': now, 'runId': run.name, 'contractVersion': 'scene-v2', 'contractSha256': contract_sha, 'integrationInvocationRef': 'integration-lifecycle-repair-invocation.json', 'integrationFinishedAt': inv['finishedAt'], 'sourceManifestRef': 'implementation-source-manifest.json', 'sourceManifestSha256': manifest_sha, 'implementationGateRef': 'implementation-gate-pass.json', 'implementationGateChecks': gate['checkCount'], 'checkResultsRef': 'check-results.json', 'instructions': 'Use verification-lifecycle-commission.txt. Full independent verify/build first, then current immutable preview. Old failures retained; all current acceptance remains unmeasured.', 'publicationAuthorized': False, 'limitations': ['Static checks do not prove gameplay, rendering, hearing, hardware budgets or creative acceptance.', 'Manual corner recovery and mid-beat Continue need independent physical/AV evidence.', 'The currently running preview is older source until root explicitly replaces it.']})
print(json.dumps({'ready': True, 'sourceManifestSha256': manifest_sha, 'tests': report['testTotals']['tests'], 'gateChecks': gate['checkCount'], 'archivedFiles': len(manifest['hashes']), 'ledgerIteration': row['iteration']}))
