#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/manual-credit-finale-final-runtime
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "story-verifier-manual-credit-finale-final-runtime resume" ]; then
  echo "$(date -u +%H:%M:%SZ) REFUSED: control='$ROLE'" | tee -a "$LOG/launcher.log"; exit 3
fi
exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 30 -x 9; then echo "$(date -u +%H:%M:%SZ) LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) fd9 exclusive held inode=$(stat -c %i /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock)" >> "$LOG/launcher.log"
for i in 1 2 3; do
  OUT=$R/verifier/captures/manual-credit-finale/cold-common-run$i
  mkdir -p "$OUT"
  echo "$(date -u +%H:%M:%SZ) COLD RUN $i start" >> "$LOG/launcher.log"
  node $R/verifier/probes/manual-credit-finale/cec-fr/common-entry-crossing-probe.mjs \
    --url http://127.0.0.1:37395/ --heavy-lock-fd 9 \
    --expect-source-manifest 8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962 \
    --out "$OUT" >> "$LOG/cold-common-run$i.log" 2>&1
  echo "$(date -u +%H:%M:%SZ) COLD RUN $i exit=$?" >> "$LOG/launcher.log"
done
flock -u 9
echo "$(date -u +%H:%M:%SZ) cold common sequence done" >> "$LOG/launcher.log"
