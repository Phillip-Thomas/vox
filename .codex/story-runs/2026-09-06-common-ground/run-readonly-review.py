import sys, pathlib, subprocess, json, datetime, hashlib

base = pathlib.Path('/tmp/paravoxia-next-story-prep')
repo = pathlib.Path('/home/thomasphillip/Projects/vox')
role = sys.argv[1]
agents = {'inventory': 'story-verifier', 'canon': 'story-canon-auditor', 'blind': 'story-naive-reader', 'documentation': 'story-canon-auditor', 'documentation2': 'story-canon-auditor', 'alignment': 'story-alignment-judge', 'cohesion': 'story-cohesion-judge'}
agent = agents[role]
commission = (base / f'{role}-commission.txt').read_text()
system = (repo / '.claude/agents' / f'{agent}.md').read_text().split('---', 2)[-1].strip()
tools = '' if role == 'blind' else 'Read,Grep,Glob'
argv = ['claude', '-p', '--model', 'opus', '--safe-mode', '--output-format', 'stream-json',
        '--verbose', '--no-session-persistence', '--permission-mode', 'default',
        '--tools', tools, '--strict-mcp-config', '--system-prompt', system]
if tools:
    argv += ['--allowedTools', tools]
record = {'role': role, 'agent': agent, 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'tools': tools.split(',') if tools else [], 'safeMode': True,
          'systemPromptSha256': hashlib.sha256(system.encode()).hexdigest(),
          'commissionSha256': hashlib.sha256(commission.encode()).hexdigest()}
(base / f'{role}-safe-invocation.json').write_text(json.dumps(record, indent=2) + '\n')
with (base / f'{role}-safe-stream.jsonl').open('w') as out, (base / f'{role}-safe-stderr.txt').open('w') as err:
    result = subprocess.run(argv, input=commission, text=True, stdout=out, stderr=err,
                            cwd='/tmp' if role == 'blind' else repo, timeout=900)
record['exitCode'] = result.returncode
record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
for line in (base / f'{role}-safe-stream.jsonl').read_text().splitlines():
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue
    if row.get('type') == 'system' and row.get('subtype') == 'init':
        record['sessionId'] = row.get('session_id')
        record['model'] = row.get('model')
        record['actualTools'] = row.get('tools')
    if row.get('type') == 'result':
        (base / f'{role}-safe-result.json').write_text(json.dumps(row, indent=2) + '\n')
        record['isError'] = row.get('is_error')
(base / f'{role}-safe-invocation.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record))
sys.exit(result.returncode)
