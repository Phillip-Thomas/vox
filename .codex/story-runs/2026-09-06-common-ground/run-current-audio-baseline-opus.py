import pathlib, subprocess, json, datetime, hashlib, sys
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/story-runs/2026-09-06-common-ground'
commission = (run / 'current-audio-baseline-opus-commission.txt').read_text()
system = (repo / '.claude/agents/story-verifier.md').read_text().split('---', 2)[-1].strip()
tools = 'Bash,Read,Grep,Glob,Write,Edit'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--permission-mode', 'default', '--tools', tools, '--allowedTools', tools, '--strict-mcp-config', '--system-prompt', system]
record = {'role': 'story-verifier', 'requestedModel': 'opus', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'safeMode': True, 'permissionMode':'default', 'tools': tools.split(','), 'systemPromptSha256': hashlib.sha256(system.encode()).hexdigest(), 'commissionSha256': hashlib.sha256(commission.encode()).hexdigest(), 'scope': 'two targeted current offline audio baseline excerpts; no source edits or GPU rendering'}
receipt = run / 'current-audio-baseline-opus-invocation.json'
receipt.write_text(json.dumps(record, indent=2)+'\n')
try:
    with (run / 'current-audio-baseline-opus-stream.jsonl').open('w') as out, (run / 'current-audio-baseline-opus-stderr.txt').open('w') as err:
        result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err, cwd=repo, timeout=1200)
    record['exitCode'] = result.returncode
except subprocess.TimeoutExpired:
    record['exitCode'] = 124
    record['transportTimeout'] = True
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (run / 'current-audio-baseline-opus-stream.jsonl').read_text().splitlines():
    try: row = json.loads(line)
    except json.JSONDecodeError: continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id'); record['model'] = row.get('model'); record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (run / 'current-audio-baseline-opus-result.json').write_text(json.dumps(row, indent=2)+'\n')
        record['isError'] = row.get('is_error')
receipt.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record))
sys.exit(record['exitCode'])
