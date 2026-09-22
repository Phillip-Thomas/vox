#!/bin/bash
# RUN-ONCE. No detached waiting loop, no pgrep kills: the agent polls
# verifier-control.json INLINE and invokes this only once GPU is granted.
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/logs/common-entry-crossing
OUT=$R/verifier/captures/common-entry-crossing/run1
mkdir -p "$LOG" "$OUT"
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "common-entry-crossing continue" ]; then
  echo "$(date -u +%H:%M:%SZ) REFUSED: control says '$ROLE'" | tee -a "$LOG/launcher.log"; exit 3
fi
echo "$(date -u +%H:%M:%SZ) GPU granted; acquiring inherited exclusive fd9" >> "$LOG/launcher.log"
exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 60 -x 9; then echo "$(date -u +%H:%M:%SZ) LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) exclusive fd9 flock held" >> "$LOG/launcher.log"
node $R/verifier/probes/common-entry-crossing/common-entry-crossing-probe.mjs \
  --url http://127.0.0.1:34413/ \
  --heavy-lock-fd 9 \
  --expect-source-manifest 6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6 \
  --out $OUT >> "$LOG/probe.log" 2>&1
rc=$?
echo "$(date -u +%H:%M:%SZ) probe exit=$rc" >> "$LOG/launcher.log"
flock -u 9
exit $rc
