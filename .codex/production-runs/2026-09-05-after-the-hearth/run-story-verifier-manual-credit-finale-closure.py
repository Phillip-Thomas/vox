import pathlib, subprocess, json, datetime, hashlib, sys
repo=pathlib.Path('/home/thomasphillip/Projects/vox');run=repo/'.codex/production-runs/2026-09-05-after-the-hearth'
assert not (run/'story-verifier-manual-credit-finale-closure-invocation.json').exists()
assert json.loads((run/'story-verifier-manual-credit-finale-invocation.json').read_text()).get('finishedAt')
deadline=datetime.datetime.fromisoformat('2026-09-06T22:04:34.043543+00:00')
remaining_seconds=max(1,(deadline-datetime.datetime.now(datetime.timezone.utc)).total_seconds())
for p,h in json.loads((run/'implementation-source-manifest.json').read_text())['hashes'].items():
 assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h,p
commission = (run / 'verification-manual-credit-finale-closure-commission.txt').read_text()
role = repo / '.claude/agents/story-verifier.md'
system = role.read_text()
tool_names = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tool_names, '--allowedTools', tool_names, '--strict-mcp-config', '--system-prompt', system]
record = {'originalDeadline': deadline.isoformat(), 'remainingWallSecondsAtLaunch': remaining_seconds, 'role':'story-verifier', 'requestedModel':'opus', 'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode':True, 'permissionMode':'default', 'tools':tool_names.split(','), 'systemPromptSource':str(role.relative_to(repo)), 'systemPromptSha256':hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256':hashlib.sha256(commission.encode()).hexdigest(), 'scope':'Independent preparation then affected manual/finale runtime and one stable full verify after eighth repair; no source, taste or publishing'}
receipt = run / 'story-verifier-manual-credit-finale-closure-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'story-verifier-manual-credit-finale-closure-stream.jsonl').open('w') as out, (run / 'story-verifier-manual-credit-finale-closure-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=remaining_seconds)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'story-verifier-manual-credit-finale-closure-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'story-verifier-manual-credit-finale-closure-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
