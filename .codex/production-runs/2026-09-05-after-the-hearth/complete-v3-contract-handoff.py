from pathlib import Path
import datetime, hashlib, json, shutil, subprocess

repo = Path('/home/thomasphillip/Projects/vox')
run = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda n: json.loads((run / n).read_text())
def write(n, d):
    (run / n).write_text(json.dumps(d, indent=2) + '\n')

contract_sha = sha(run / 'scene-contract.json')
assert contract_sha == '5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54'
assert not (run / 'integration-arrival-common-invocation.json').exists()
assert read('verification-ready.json')['ready'] is False
assert read('verifier-control.json')['action'] == 'hold'
notes, responses = [], {}
fragment_hashes = {}
for lane in ['chapter', 'score', 'cinematography']:
    for suffix in ['peer-notes', 'reconciliation']:
        name = f'{lane}-{suffix}.jsonl'
        rows = [json.loads(line) for line in (run / name).read_text().splitlines() if line.strip()]
        assert len(rows) == 2 and all(row['contractVersion'] == 'scene-v3' for row in rows), name
        fragment_hashes[name] = sha(run / name)
        if suffix == 'peer-notes':
            assert all(row['from'] == lane and row['status'] == 'open' for row in rows)
            notes.extend(rows)
        else:
            for row in rows:
                assert row['director'] == lane and row['response']['by'] == lane
                assert row['status'] in ['accepted', 'resolved', 'closed']
                assert row['noteId'] not in responses
                responses[row['noteId']] = row
assert {row['id'] for row in notes} == set(responses)
for row in notes:
    reply = responses[row['id']]
    assert reply['director'] == row['to']
    for key in ['status', 'response', 'disposition']:
        row[key] = reply[key]
(run / 'director-notes.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in notes))
for name, expected in fragment_hashes.items():
    assert sha(run / name) == expected

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
cmd = ['npm', '--prefix', 'main', 'run', 'creative:gate', '--', '--run', str(run.relative_to(repo)), '--phase', 'contract']
log = run / 'scene-v3-contract-gate.log'
with log.open('w') as out:
    proc = subprocess.run(cmd, cwd=repo, stdout=out, stderr=subprocess.STDOUT)
write('scene-v3-contract-gate-command.json', {
    'command': ' '.join(cmd), 'cwd': str(repo), 'startedAt': started,
    'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'exitCode': proc.returncode, 'log': log.name, 'logSha256': sha(log),
})
print('\n'.join(log.read_text().splitlines()[-25:]))
assert proc.returncode == 0, 'Contract gate failed; source remains held'
gate = read('creative-run-quality-report.json')
assert gate['passed'] and gate['phase'] == 'contract' and gate['failureCount'] == 0
archive = run / 'iterations/signed-v3-contract'
archive.mkdir(exist_ok=False)
files = ['scene-contract.json', 'scene-cinema-lane.json', 'story-intent.md', 'director-signoffs.json', 'director-notes.jsonl', 'scene-v3-contract-gate.log', 'scene-v3-contract-gate-command.json', 'creative-run-quality-report.json', 'producer-v3-decision.json']
files += list(fragment_hashes)
files += [f'{lane}-contract-signoff.json' for lane in ['chapter', 'score', 'cinematography']]
for name in files:
    shutil.copy2(run / name, archive / name)
write('contract-gate-pass.json', {
    'passed': True, 'phase': 'contract', 'contractSha256': contract_sha,
    'checkedAt': gate['checkedAt'], 'checkCount': gate['checkCount'],
    'gateReportSha256': sha(run / 'creative-run-quality-report.json'),
    'gateReportRef': 'iterations/signed-v3-contract/creative-run-quality-report.json',
    'publicationAuthorized': False,
})
shutil.copy2(run / 'contract-gate-pass.json', archive / 'contract-gate-pass.json')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
direction = read('arrival-common-repair-direction.json')
direction.update(sourceMutationAuthorized=True, sourceMutationPending=None, sourceHandoffAt=now, contractGateRef='contract-gate-pass.json', contractGateSha256=sha(run / 'contract-gate-pass.json'))
write('arrival-common-repair-direction.json', direction)
disposition = read('repair-contract-disposition.json')
disposition['implementationDirection'].update(sourceMutationAuthorizedNow=True, boundedAction='Exact signed v3 arrival guidance and safe private COMMON steering over unchanged original geometry and strict physical proof; final direction and contract gate complete.')
write('repair-contract-disposition.json', disposition)
budget = read('producer-arrival-common-budget-decision.json')
budget.update(sourceMutationAuthorizedNow=True, sourceMutationPending=None, sourceHandoffAt=now)
write('producer-arrival-common-budget-decision.json', budget)
promotion = read('scene-v3-promotion.json')
promotion.update(gatePending=False, gatePassedAt=gate['checkedAt'], contractGateRef='contract-gate-pass.json', sourceMutationAuthorized=True, sourceMutationDirectionRef='arrival-common-repair-direction.json')
write('scene-v3-promotion.json', promotion)
print(json.dumps({'contractSha256': contract_sha, 'contractChecks': gate['checkCount'], 'seventhRepairAuthorized': True, 'gameSourceChangedByThisScript': False}))
