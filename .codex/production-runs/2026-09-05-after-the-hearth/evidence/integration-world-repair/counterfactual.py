#!/usr/bin/env python3
"""Task-specific counterfactual harness.

Mutates ONE allowed source file to a task-named variant kept under this run's
evidence/temp, runs a command, and restores the EXACT original bytes in a
`finally` block, asserting the before/after sha256 match. It never invokes git.
"""
import hashlib, json, os, subprocess, sys, datetime

ROOT = '/home/thomasphillip/Projects/vox'
RUN = os.path.join(ROOT, '.codex/production-runs/2026-09-05-after-the-hearth')
TEMP = os.path.join(RUN, 'evidence/integration-world-repair/temp')

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def run(label, rel, replacements, command, cwd):
    os.makedirs(TEMP, exist_ok=True)
    path = os.path.join(ROOT, rel)
    original = open(path, 'rb').read()
    before = hashlib.sha256(original).hexdigest()
    backup = os.path.join(TEMP, f'{label}.{os.path.basename(rel)}.exact-bytes')
    with open(backup, 'wb') as fh:
        fh.write(original)
    assert sha(backup) == before
    result = {'label': label, 'path': rel, 'beforeSha256': before,
              'privateByteBackup': os.path.relpath(backup, ROOT),
              'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    mutation_exit = None
    try:
        text = original.decode()
        for old, new in replacements:
            assert text.count(old) == 1, f'anchor not unique: {old[:60]!r}'
            text = text.replace(old, new)
        with open(path, 'w') as fh:
            fh.write(text)
        result['mutatedSha256'] = sha(path)
        proc = subprocess.run(command, cwd=cwd, shell=True, capture_output=True, text=True)
        mutation_exit = proc.returncode
        log = os.path.join(TEMP, f'{label}.log')
        with open(log, 'w') as fh:
            fh.write(proc.stdout + proc.stderr)
        result['mutationCommand'] = command
        result['mutationCwd'] = cwd
        result['mutationExitCode'] = mutation_exit
        result['mutationLog'] = os.path.relpath(log, ROOT)
        result['mutationLogTail'] = (proc.stdout + proc.stderr)[-2500:]
    finally:
        with open(path, 'wb') as fh:
            fh.write(open(backup, 'rb').read())
        after = sha(path)
        result['afterSha256'] = after
        result['restoredExactly'] = after == before
        result['cleanupExitCode'] = 0 if after == before else 1
        result['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    out = os.path.join(RUN, f'evidence/integration-world-repair/counterfactual-{label}.json')
    json.dump(result, open(out, 'w'), indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != 'mutationLogTail'}, indent=1))
    if not result['restoredExactly']:
        raise SystemExit('RESTORE FAILED')
    return result
