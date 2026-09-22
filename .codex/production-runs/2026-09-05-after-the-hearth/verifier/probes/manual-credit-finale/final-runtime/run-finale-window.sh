#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/manual-credit-finale-final-runtime
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "story-verifier-manual-credit-finale-final-runtime resume" ]; then
  echo "$(date -u +%H:%M:%SZ) FINALE REFUSED: control='$ROLE'" >> "$LOG/launcher.log"; exit 3
fi
exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 45 -x 9; then echo "$(date -u +%H:%M:%SZ) FINALE LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) FINALE fd9 held inode=$(stat -c %i /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock)" >> "$LOG/launcher.log"
OUT=$R/verifier/captures/manual-credit-finale/finale-window-fr5
mkdir -p "$OUT"
node $R/verifier/probes/manual-credit-finale/finale-window-fr/finale-window-runtime.mjs \
  --out "$OUT" --heavy-lock-fd 9 --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock --max-session-s 95 >> "$LOG/finale-window.log" 2>&1
echo "$(date -u +%H:%M:%SZ) FINALE exit=$?" >> "$LOG/launcher.log"
flock -u 9
