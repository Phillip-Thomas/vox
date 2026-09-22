import pathlib, subprocess, json, datetime, hashlib, sys
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/production-runs/2026-09-05-after-the-hearth'
gate = json.loads((run / 'contract-gate-pass.json').read_text())
assert gate['passed'] is True and gate['contractSha256'] == hashlib.sha256((run / 'scene-contract.json').read_bytes()).hexdigest(), 'Exact signed contract gate must pass first'
assert json.loads((run / 'story-verifier-invocation.json').read_text()).get('finishedAt'), 'Verifier must be paused before source repair'
assert json.loads((run / 'integration-v2-invocation.json').read_text()).get('finishedAt'), 'Previous integrator must be finished'
assert not (run / 'integration-movie-repair-invocation.json').exists(), 'No duplicate repair'
commission = (run / 'integration-movie-repair-commission.txt').read_text()
system = 'You are the single software integration engineer. Implement the signed creative contract under the exact production boundary; preserve dirty work. You are not a creative director or independent reviewer.'
tools = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tools, '--allowedTools', tools, '--strict-mcp-config', '--system-prompt', system]
record = {'role': 'integration-engineer', 'requestedModel': 'opus', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode': True, 'permissionMode':'default', 'tools': tools.split(','), 'systemPromptSha256': hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256': hashlib.sha256(commission.encode()).hexdigest(), 'scope': 'CG-IMPL-004/005 bounded movie-controller repair under unchanged signed scene-v2; no publication or GPU probes'}
receipt = run / 'integration-movie-repair-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'integration-movie-repair-stream.jsonl').open('w') as out, (run / 'integration-movie-repair-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=7200)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'integration-movie-repair-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'integration-movie-repair-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
