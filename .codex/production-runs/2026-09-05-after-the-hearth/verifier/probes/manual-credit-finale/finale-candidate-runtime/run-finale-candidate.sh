#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/finale-candidate-runtime
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
NAME=${1:-finale-candidate-1}
MAXS=${2:-135}
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "finale-candidate-runtime resume" ]; then
  echo "$(date -u +%H:%M:%SZ) FINALE REFUSED: control='$ROLE'" >> "$LOG/launcher.log"; exit 3
fi
exec 9>"$LOCK"
if ! flock -w 30 -x 9; then echo "$(date -u +%H:%M:%SZ) FINALE LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) $NAME fd9 held inode=$(stat -c %i "$LOCK")" >> "$LOG/launcher.log"
OUT=$R/verifier/captures/manual-credit-finale/$NAME
mkdir -p "$OUT"
node $R/verifier/probes/manual-credit-finale/finale-window-fr/finale-window-runtime.mjs \
  --out "$OUT" --heavy-lock-fd 9 --heavy-lock "$LOCK" --max-session-s "$MAXS" >> "$LOG/$NAME.log" 2>&1
echo "$(date -u +%H:%M:%SZ) $NAME exit=$?" >> "$LOG/launcher.log"
flock -u 9
