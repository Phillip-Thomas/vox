#!/usr/bin/env python3
"""Exact-byte private backup of dirty source before mutation. No Git, ever."""
import hashlib, json, os, shutil, sys, datetime
ROOT = '/home/thomasphillip/Projects/vox'
BAK = os.path.join(ROOT, '.codex/production-runs/2026-09-05-after-the-hearth/evidence/integration-world-repair/backup')
IDX = os.path.join(BAK, 'index.json')

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def main(paths):
    os.makedirs(BAK, exist_ok=True)
    idx = json.load(open(IDX)) if os.path.exists(IDX) else {}
    for rel in paths:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            idx[rel] = {'existedBefore': False, 'beforeSha256': None}
            print(f'ABSENT {rel} (new allowed file, beforeSha256=null)')
            continue
        flat = rel.replace('/', '__')
        dst = os.path.join(BAK, flat)
        if rel in idx and idx[rel].get('existedBefore'):
            print(f'KEEP  {rel} (backup already taken {idx[rel]["beforeSha256"][:12]})')
            continue
        shutil.copy2(src, dst)
        idx[rel] = {'existedBefore': True, 'beforeSha256': sha(src),
                    'backup': os.path.relpath(dst, ROOT),
                    'backupSha256': sha(dst),
                    'takenAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        assert idx[rel]['beforeSha256'] == idx[rel]['backupSha256']
        print(f'BACKUP {rel} {idx[rel]["beforeSha256"]}')
    json.dump(idx, open(IDX, 'w'), indent=1, sort_keys=True)

if __name__ == '__main__':
    main(sys.argv[1:])
