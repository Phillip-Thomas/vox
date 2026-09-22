import pathlib, subprocess, json, datetime, hashlib, sys
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/production-runs/2026-09-05-after-the-hearth'
invocation = json.loads((run / 'integration-lifecycle-repair-invocation.json').read_text())
assert invocation.get('finishedAt'), 'Lifecycle repair must finish before verification'
ready = json.loads((run / 'verification-ready.json').read_text())
assert ready.get('ready') is True, 'Root must clear exact repaired source'
manifest_sha = hashlib.sha256((run / 'implementation-source-manifest.json').read_bytes()).hexdigest()
assert ready.get('sourceManifestSha256') == manifest_sha, 'Readiness must bind the current source manifest'
for path, expected in json.loads((run / 'implementation-source-manifest.json').read_text())['hashes'].items():
    assert hashlib.sha256((repo / path).read_bytes()).hexdigest() == expected, f'Source changed after clearance: {path}'
assert (run / 'integration-report.json').is_file(), 'An implementation report is required'
assert not (run / 'story-verifier-lifecycle-invocation.json').exists(), 'Do not duplicate verifier'
assert json.loads((run / 'contract-gate-pass.json').read_text())['contractSha256'] == hashlib.sha256((run / 'scene-contract.json').read_bytes()).hexdigest(), 'Signed contract must be exact'
if (run / 'harness-prep-invocation.json').exists():
    assert json.loads((run / 'harness-prep-invocation.json').read_text()).get('finishedAt'), 'Harness preparation must finish before verifier owns probes'
commission = (run / 'verification-lifecycle-commission.txt').read_text()
role = repo / '.claude/agents/story-verifier.md'
system = role.read_text()
tool_names = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tool_names, '--allowedTools', tool_names, '--strict-mcp-config', '--system-prompt', system]
record = {'role':'story-verifier', 'requestedModel':'opus', 'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode':True, 'permissionMode':'default', 'tools':tool_names.split(','), 'systemPromptSource':str(role.relative_to(repo)), 'systemPromptSha256':hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256':hashlib.sha256(commission.encode()).hexdigest(), 'scope':'Independent verification after physical-coordinate, entry and home-anchor lifecycle repair; same production run and retained prior failures; no game-source edits, taste verdict or publication'}
receipt = run / 'story-verifier-lifecycle-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'story-verifier-lifecycle-stream.jsonl').open('w') as out, (run / 'story-verifier-lifecycle-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=7200)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'story-verifier-lifecycle-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'story-verifier-lifecycle-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
