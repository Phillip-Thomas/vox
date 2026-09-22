#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/finale-authority-seam-live-audio
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
NAME=authority-seam-live-audio-unique
MAXS=${1:-60}
mkdir -p "$LOG"
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "finale-authority-seam-live-audio continue" ]; then
  echo "$(date -u +%H:%M:%SZ) REFUSED: control='$ROLE'" >> "$LOG/launcher.log"; exit 3
fi
exec 9>"$LOCK"
if ! flock -w 10 -x 9; then echo "$(date -u +%H:%M:%SZ) LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) $NAME fd9 held inode=$(stat -c %i "$LOCK")" >> "$LOG/launcher.log"
OUT=$R/verifier/captures/manual-credit-finale/$NAME
mkdir -p "$OUT"
SEAM_SCENARIO=normal-expiry node $R/verifier/probes/manual-credit-finale/finale-authority-seam/finale-window-runtime.mjs \
  --out "$OUT" --heavy-lock-fd 9 --heavy-lock "$LOCK" --max-session-s "$MAXS" >> "$LOG/$NAME.log" 2>&1
echo "$(date -u +%H:%M:%SZ) $NAME exit=$?" >> "$LOG/launcher.log"
flock -u 9
