#!/bin/bash
set -eu
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
CTL=$(python3 -c 'import json;d=json.load(open("/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier-control.json"));print(d["activeRole"],d["action"])')
[ "$CTL" = "finale-authority-seam-runtime continue" ] || exit 3
exec 9<>"$LOCK"
flock -w 30 -x 9 || exit 4
exec env SEAM_SCENARIO=pause-button-cancel node "$R/verifier/probes/manual-credit-finale/finale-cancellation-candidate/finale-window-runtime.mjs" \
  --out "$R/verifier/captures/manual-credit-finale/pause-cancel-20260907T002300Z" \
  --heavy-lock-fd 9 --heavy-lock "$LOCK" --max-session-s 105
