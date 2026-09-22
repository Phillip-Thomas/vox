import pathlib, subprocess, json, datetime, hashlib, sys
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/production-runs/2026-09-05-after-the-hearth'
gate = json.loads((run / 'contract-gate-pass.json').read_text())
assert gate['passed'] is True and gate['contractSha256'] == hashlib.sha256((run / 'scene-contract.json').read_bytes()).hexdigest(), 'Exact signed contract gate must pass first'
for name in ['manual-focused','flight-discriminator','handoff-standby-source-audit']:
    record = json.loads((run / f'{name}-invocation.json').read_text())
    assert record.get('finishedAt') and record.get('exitCode') == 0 and record.get('isError') is False and record.get('sourceDrift') == [], name
assert json.loads((run / 'verification-ready.json').read_text()).get('ready') is False, 'Root must revoke capture readiness before mutation'
assert (run / 'handoff-standby-repair-direction.json').is_file(), 'Root repair direction required'
assert json.loads((run / 'handoff-standby-repair-direction.json').read_text()).get('sourceMutationAuthorized') is True, 'Exact final repair direction must authorize mutation'
assert json.loads((run / 'producer-handoff-standby-budget-decision.json').read_text())['runLocalBudgetOverride']['additionalMaterialRepairsAuthorized'] == 1, 'Bounded standing-authority extension required'
for path, expected in json.loads((run / 'implementation-source-manifest.json').read_text())['hashes'].items():
    assert hashlib.sha256((repo / path).read_bytes()).hexdigest() == expected, f'Unreported source drift: {path}'
assert json.loads((run / 'integration-navigation-wording-invocation.json').read_text()).get('finishedAt'), 'Previous integrator must be finished'
assert not (run / 'integration-handoff-standby-invocation.json').exists(), 'No duplicate repair'
commission = (run / 'integration-handoff-standby-commission.txt').read_text()
system = 'You are the single software integration engineer. Implement the signed creative contract under the exact production boundary; preserve dirty work. You are not a creative director or independent reviewer.'
tools = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tools, '--allowedTools', tools, '--strict-mcp-config', '--system-prompt', system]
record = {'role': 'integration-engineer', 'requestedModel': 'opus', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode': True, 'permissionMode':'default', 'tools': tools.split(','), 'systemPromptSha256': hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256': hashlib.sha256(commission.encode()).hexdigest(), 'scope': 'One bounded sixth repair for Origin runtime-world reclaim and physically qualified chapter-local standby; unchanged scene-v2, preserve dirtysource, noGPU orpublication'}
receipt = run / 'integration-handoff-standby-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'integration-handoff-standby-stream.jsonl').open('w') as out, (run / 'integration-handoff-standby-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=3600)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'integration-handoff-standby-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'integration-handoff-standby-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
