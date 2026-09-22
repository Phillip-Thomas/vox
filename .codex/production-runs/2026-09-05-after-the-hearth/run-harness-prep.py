import pathlib, subprocess, json, datetime, hashlib, sys
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/production-runs/2026-09-05-after-the-hearth'
assert not (run / 'harness-prep-invocation.json').exists(), 'No duplicate harness preparation'
assert json.loads((run / 'story-verifier-continuation-invocation.json').read_text()).get('finishedAt'), 'Previous verifier must be finished'
commission = (run / 'harness-prep-commission.txt').read_text()
system = 'You prepare bounded run-local verifier tooling only. No game source edits, no browser, build, GPU or chapter acceptance. Preserve dirty work and all existing evidence.'
tools = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tools, '--allowedTools', tools, '--strict-mcp-config', '--system-prompt', system]
record = {'role': 'verifier-harness-preparer', 'requestedModel': 'opus', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode': True, 'permissionMode':'default', 'tools': tools.split(','), 'systemPromptSha256': hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256': hashlib.sha256(commission.encode()).hexdigest(), 'scope': 'Run-local harness provenance/diagnostics/stall preparation only, while game writer is active; no game source edit, browser, build or GPU'}
receipt = run / 'harness-prep-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'harness-prep-stream.jsonl').open('w') as out, (run / 'harness-prep-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=1800)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'harness-prep-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'harness-prep-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
