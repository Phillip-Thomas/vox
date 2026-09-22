#!/bin/bash
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/manual-credit-finale-verifier
OUT=$R/verifier/captures/manual-credit-finale/entry-crossing-run4
mkdir -p "$LOG"
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "story-verifier-manual-credit-finale resume" ]; then
  echo "$(date -u +%H:%M:%SZ) REFUSED: control says '$ROLE'" | tee -a "$LOG/launcher.log"; exit 3
fi
echo "$(date -u +%H:%M:%SZ) GPU granted; acquiring inherited exclusive fd9" >> "$LOG/launcher.log"
exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 60 -x 9; then echo "$(date -u +%H:%M:%SZ) LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) exclusive fd9 flock held" >> "$LOG/launcher.log"
node $R/verifier/probes/manual-credit-finale/common-entry-crossing/common-entry-crossing-probe.mjs \
  --url http://127.0.0.1:37395/ \
  --heavy-lock-fd 9 \
  --expect-source-manifest 8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962 \
  --out $OUT >> "$LOG/entry-crossing-probe.log" 2>&1
rc=$?
echo "$(date -u +%H:%M:%SZ) probe exit=$rc" >> "$LOG/launcher.log"
flock -u 9
exit $rc
