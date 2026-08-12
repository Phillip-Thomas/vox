#!/usr/bin/env python3
"""draft-v7 FINAL stamp: rebuild evidence-registry.json from disk with fresh
hashes and ffprobe readings, purging stale rows.

Run from the production-run folder.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

RUN = os.path.dirname(os.path.abspath(__file__))
CONTRACT_VERSION = 'draft-v7'
CONTRACT_SHA = '32122245bf6b6630c4228da65204db2c6422e9ddb3a446c63ee6990986626860'
SOURCE_REVISION = '929e3d0a650fedccd2d04e68db792e09634d416e'
WORKING_TREE = ('uncommitted ch10 working tree, draft-v7 final evidence pass: '
                'reboard rung, ST-0 gaze solver, ST-0 occlusion, berth-ring '
                'suppression, chapter10GuidanceTrace')

SKIP_DIRS = {'__pycache__', '.git'}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def ffprobe(path):
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_streams', '-show_format',
             '-of', 'json', path],
            capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            return None
        d = json.loads(out.stdout)
        st = (d.get('streams') or [{}])[0]
        fmt = d.get('format') or {}
        row = {}
        for k in ('codec_name', 'width', 'height', 'pix_fmt', 'sample_rate',
                  'channels', 'duration', 'bits_per_raw_sample'):
            if st.get(k) is not None:
                row[k] = st[k]
        if fmt.get('duration'):
            row['formatDuration'] = fmt['duration']
        return row or None
    except Exception:
        return None


def kind_for(rel):
    if rel.endswith('.png'):
        return 'frame'
    if rel.endswith('.wav'):
        return 'audio'
    if rel.endswith('.mjs') or rel.endswith('.py') or rel.endswith('.ts'):
        return 'probe'
    if rel.endswith('.jsonl'):
        return 'ledger'
    if rel.endswith('.diff'):
        return 'diff'
    if rel.endswith('.md'):
        return 'document'
    if rel.endswith('.json'):
        if rel.startswith('evidence/verification/'):
            return 'trace'
        if rel.startswith('evidence/score/'):
            return 'audio-measure'
        if rel.startswith('evidence/'):
            return 'artifact'
        return 'artifact'
    return 'artifact'


def slug(rel):
    return re.sub(r'[^a-z0-9]+', '-', rel.lower()).strip('-')


def describe(rel, kind):
    base = os.path.basename(rel)
    if kind == 'frame':
        parent = os.path.basename(os.path.dirname(rel))
        return f'captured PNG frame from {parent}: {base}'
    if kind == 'audio':
        return f'deterministic offline render: {base}'
    if kind == 'trace':
        return f'verification trace: {base}'
    if kind == 'probe':
        return f'probe source: {base}'
    if kind == 'document':
        return f'run document: {base}'
    if kind == 'ledger':
        return f'run ledger: {base}'
    if kind == 'diff':
        return f'implementation diff: {base}'
    return f'run artifact: {base}'


def main():
    entries = []
    for root, dirs, files in os.walk(RUN):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in sorted(files):
            p = os.path.join(root, f)
            rel = os.path.relpath(p, RUN)
            if rel == 'evidence-registry.json':
                continue
            kind = kind_for(rel)
            row = {
                'ref': f'{kind}:{slug(rel)}',
                'path': rel,
                'sha256': sha256(p),
                'kind': kind,
                'description': describe(rel, kind),
                'bytes': os.path.getsize(p),
            }
            if kind in ('frame', 'audio'):
                probe = ffprobe(p)
                if probe:
                    row['ffprobe'] = probe
            entries.append(row)
    entries.sort(key=lambda r: r['path'])
    reg = {
        'schema': 'paravoxia.evidenceRegistry.v1',
        'runId': '2026-08-11-ch10-station-introduction',
        'contractVersion': CONTRACT_VERSION,
        'contractSha256': CONTRACT_SHA,
        'sourceRevision': SOURCE_REVISION,
        'workingTree': WORKING_TREE,
        'compiledAt': datetime.now(timezone.utc).isoformat(),
        'mediaProbeRule': (
            'every media entry declares the exact ffprobe reading of its own '
            'bytes; trace, probe and document entries carry sha256 and byte '
            'length only. The registry is rebuilt from disk on every stamp, so '
            'a stale hash cannot survive a regenerated artifact.'),
        'rebuild': (
            'full rebuild from the run folder at draft-v7 final evidence pass; '
            'rows for artifacts that no longer exist are purged by construction'),
        'entries': entries,
    }
    with open(os.path.join(RUN, 'evidence-registry.json'), 'w') as f:
        json.dump(reg, f, indent=1)
        f.write('\n')
    counts = {}
    for e in entries:
        counts[e['kind']] = counts.get(e['kind'], 0) + 1
    print('entries', len(entries), counts)


if __name__ == '__main__':
    sys.exit(main())
