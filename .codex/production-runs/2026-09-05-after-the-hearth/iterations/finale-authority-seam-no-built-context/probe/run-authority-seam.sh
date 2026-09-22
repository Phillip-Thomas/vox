#!/bin/bash
# finale-authority-seam runtime launcher. Derived from the proven
# finale-candidate-runtime/run-finale-candidate.sh: same inherited shared-lock
# fd 9 discipline, same headed hardware route, private role rebound.
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/finale-authority-seam-runtime
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
NAME=${1:-authority-seam-1}
MAXS=${2:-115}
SCEN=${3:-normal-expiry}
mkdir -p "$LOG"
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "finale-authority-seam-runtime continue" ]; then
  echo "$(date -u +%H:%M:%SZ) SEAM REFUSED: control='$ROLE'" >> "$LOG/launcher.log"; exit 3
fi
exec 9>"$LOCK"
if ! flock -w 30 -x 9; then echo "$(date -u +%H:%M:%SZ) SEAM LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) $NAME fd9 held inode=$(stat -c %i "$LOCK") scenario=$SCEN" >> "$LOG/launcher.log"
OUT=$R/verifier/captures/manual-credit-finale/$NAME
mkdir -p "$OUT"
SEAM_SCENARIO=$SCEN node $R/verifier/probes/manual-credit-finale/finale-authority-seam/finale-window-probe.mjs \
  --out "$OUT" --unmuted --heavy-lock-fd 9 --heavy-lock "$LOCK" --probe-lock-contention \
  --max-session-s "$MAXS" >> "$LOG/$NAME.log" 2>&1
echo "$(date -u +%H:%M:%SZ) $NAME exit=$?" >> "$LOG/launcher.log"
flock -u 9
