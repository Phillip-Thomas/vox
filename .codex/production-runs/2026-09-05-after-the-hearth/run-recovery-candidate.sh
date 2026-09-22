#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG="$R/logs/manual-recovery-candidate-closure"
OUT="$R/verifier/captures/manual-credit-finale/recovery-candidate-run1"
mkdir -p "$LOG"
python3 - <<'GATE'
from pathlib import Path
import json
r=Path('/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth')
c=json.loads((r/'verifier-control.json').read_text())
assert c['activeRole']=='manual-recovery-candidate-runtime' and c['action']=='continue'
GATE
if [ "$?" -ne 0 ]; then exit 3; fi
exec 9>>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 20 -x 9; then echo LOCK_CONTENDED; exit 4; fi
CUT_MODE=1 node "$R/verifier/probes/manual-credit-finale/recovery-candidate/common-entry-crossing-probe.mjs" \
 --url http://127.0.0.1:37395/ \
 --heavy-lock-fd 9 \
 --expect-source-manifest 8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962 \
 --out "$OUT" > "$LOG/probe.log" 2>&1
rc=$?
flock -u 9
exit "$rc"
