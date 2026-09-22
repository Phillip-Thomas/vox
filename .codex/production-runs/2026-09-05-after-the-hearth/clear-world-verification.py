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

inv = read('integration-world-repair-invocation.json')
assert inv.get('finishedAt') and inv.get('exitCode') == 0 and inv.get('isError') is False
assert read('harness-prep-invocation.json').get('finishedAt')
prep = read('harness-final-prep-invocation.json')
assert prep.get('finishedAt') and prep.get('exitCode') == 0 and prep.get('isError') is False
report = read('integration-world-repair-report.json')
manifest = read('implementation-source-manifest.json')
checks = read('check-results.json')
gate = read('creative-run-quality-report.json')
contract_sha = sha(run / 'scene-contract.json')
manifest_sha = sha(run / 'implementation-source-manifest.json')
review = read('producer-world-source-review.json')
assert review.get('acceptedForIndependentVerification') is True
assert review.get('sourceManifestSha256') == manifest_sha
assert review.get('integrationReportSha256') == sha(run / 'integration-world-repair-report.json')
assert report['contractSha256'] == manifest['contractSha256'] == checks['contractSha256'] == contract_sha
assert checks['sourceManifestSha256'] == manifest_sha
assert gate['passed'] and gate['phase'] == 'implementation' and gate['failureCount'] == 0
assert datetime.datetime.fromisoformat(gate['checkedAt'].replace('Z', '+00:00')) > datetime.datetime.fromisoformat(checks['compiledAt'])
for path, expected in manifest['hashes'].items():
    assert sha(repo / path) == expected, f'Post-gate source drift: {path}'
assert manifest['unexpectedDrift'] == []
archive = run / 'iterations/implemented-world-repair'
assert not archive.exists(), 'Never overwrite an immutable iteration'
archive.mkdir()
for name in ['scene-contract.json', 'director-signoffs.json', 'production-lock.json', 'defects.json', 'repair-contract-disposition.json', 'world-repair-direction.json', 'integration-report.json', 'integration-report.md', 'integration-world-repair-report.json', 'integration-world-repair-report.md', 'integration-world-repair-invocation.json', 'implementation-source-manifest.json', 'implementation.diff', 'check-results.json', 'creative-run-quality-report.json', 'world-implementation-gate.log', 'lifecycle-mutation-cleanup-deviation.json', 'producer-probe-observer-concern.json', 'producer-midbeat-anchor-restore-concern.json', 'chapter-corner-candidate-disposition.json', 'harness-prep-report.json', 'harness-prep-interface-resolution.json']:
    shutil.copy2(run / name, archive / name)
for path in manifest['hashes']:
    dest = archive / 'source' / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / path, dest)
for check in report['checks']:
    ref = Path(check['logPath'])
    src = ref if ref.is_absolute() else (repo / ref if str(ref).startswith('.codex/') else run / ref)
    relative_log = src.resolve().relative_to(run.resolve())
    assert sha(src) == check['logSha256']
    dest = archive / relative_log
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
shutil.copy2(run / 'producer-world-source-review.json', archive / 'producer-world-source-review.json')
for name in ['verification-world-interim-report.json', 'producer-world-verification-review.json']:
    shutil.copy2(run / name, archive / name)
for name in ['harness-final-prep-report.json', 'harness-final-prep-report.md', 'harness-final-prep-invocation.json', 'producer-harness-final-review.json']:
    shutil.copy2(run / name, archive / name)
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
gate_pass = {'passed': True, 'phase': 'implementation', 'contractSha256': contract_sha, 'sourceManifestSha256': manifest_sha, 'checkedAt': gate['checkedAt'], 'checkCount': gate['checkCount'], 'gateReportSha256': sha(run / 'creative-run-quality-report.json'), 'gateReportRef': str((archive / 'creative-run-quality-report.json').relative_to(run)), 'publicationAuthorized': False}
write('implementation-gate-pass.json', gate_pass)
shutil.copy2(run / 'implementation-gate-pass.json', archive / 'implementation-gate-pass.json')
defects = read('defects.json')['defects']
counts = {key: sum(d['severity'] == sev and d['status'] == 'open' for d in defects) for key, sev in [('critical', 'critical'), ('high', 'high'), ('mediumUnaccepted', 'medium'), ('low', 'low')]}
ledger = run / 'iteration-ledger.jsonl'
rows = [json.loads(line) for line in ledger.read_text().splitlines() if line.strip()]
row = {'schema': 'paravoxia.creativeIteration.v1', 'runId': run.name, 'iteration': max(x['iteration'] for x in rows) + 1, 'contractVersion': 'scene-v2', 'contractRef': str((archive / 'scene-contract.json').relative_to(run)), 'contractSha256': contract_sha, 'defectRegisterRef': str((archive / 'defects.json').relative_to(run)), 'defectRegisterSha256': sha(archive / 'defects.json'), 'route': 'revised-and-resigned', 'budget': 'Same chapter run; fifth integration pass overall, original plus four repairs under unchanged signed v2. Ledger rows also record findings, not only patches.', 'changes': ['Repaired the routed live-world support and home boot/Continue integration cases; precise scope and remaining limitations are in the engineer and producer reports.', 'Preserved signed geometry, actual route proof, prior controller/coordinate repairs and passive diagnostics.', f"Final engineer suite: {report['testTotals']['tests']} tests. Fresh root gate: {gate['checkCount']} checks. Exact source preservation rechecked.", 'Current preservation was checked against the existing dirty snapshots; the historical checkout incident remains documented separately.'], 'weightedScore': None, 'categoryFloor': None, 'gateStatus': 'implementation_passed_evidence_pending', 'openDefects': counts, 'evidenceRefs': ['integration-world-repair-report.json', 'implementation-gate-pass.json', 'implementation-source-manifest.json', 'check-results.json', 'lifecycle-mutation-cleanup-deviation.json'], 'canonicalUrl': None, 'nextAction': 'Independent full verify, immutable preview replacement, targeted actual physical journeys, then comprehensive evidence and fresh reviews.', 'recordedAt': now}
with ledger.open('a') as file:
    file.write(json.dumps(row) + '\n')
write('verifier-control.json', {'updatedAt': now, 'action': 'continue', 'sourceManifestSha256': manifest_sha, 'instruction': 'Current source is now frozen and gated. First independent full verify/build, announce BUILD READY, then wait for root-owned preview replacement. No browser measurement on the older snapshot. Read the current commission and inbox.'})
write('verification-ready.json', {'schema': 'paravoxia.verificationReadiness.v1', 'ready': True, 'readyAt': now, 'runId': run.name, 'contractVersion': 'scene-v2', 'contractSha256': contract_sha, 'integrationInvocationRef': 'integration-world-repair-invocation.json', 'integrationFinishedAt': inv['finishedAt'], 'sourceManifestRef': 'implementation-source-manifest.json', 'sourceManifestSha256': manifest_sha, 'implementationGateRef': 'implementation-gate-pass.json', 'implementationGateChecks': gate['checkCount'], 'checkResultsRef': 'check-results.json', 'instructions': 'Use verification-world-commission.txt. Full independent verify/build first, then current immutable preview. Old failures retained; all current acceptance remains unmeasured.', 'publicationAuthorized': False, 'limitations': ['Static checks do not prove gameplay, rendering, hearing, hardware budgets or creative acceptance.', 'Manual corner recovery and mid-beat Continue need independent physical/AV evidence.', 'The currently running preview is older source until root explicitly replaces it.']})
print(json.dumps({'ready': True, 'sourceManifestSha256': manifest_sha, 'tests': report['testTotals']['tests'], 'gateChecks': gate['checkCount'], 'archivedFiles': len(manifest['hashes']), 'ledgerIteration': row['iteration']}))
