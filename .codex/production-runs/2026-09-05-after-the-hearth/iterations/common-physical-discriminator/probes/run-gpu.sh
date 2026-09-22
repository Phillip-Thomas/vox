#!/bin/bash
# Serialized GPU launcher. Waits for the ROOT handoff, then runs the HEADED probe
# under the inherited EXCLUSIVE fd 9 shared heavy lock. Headless is FORBIDDEN.
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
LOG=$R/verifier/logs/common-physical-discriminator
OUT=$R/verifier/captures/common-physical-discriminator/run1
DEADLINE=$(date -u -d '2026-09-06T20:18:30Z' +%s)
while [ "$(date -u +%s)" -lt "$DEADLINE" ]; do
  ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
  echo "$(date -u +%H:%M:%SZ) $ROLE" >> $LOG/launcher.log
  if [ "$ROLE" = "common-physical-discriminator continue" ]; then
    echo "$(date -u +%H:%M:%SZ) GPU GRANTED - launching headed probe" >> $LOG/launcher.log
    exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
    if ! flock -w 60 -x 9; then echo "LOCK CONTENDED" >> $LOG/launcher.log; exit 3; fi
    echo "$(date -u +%H:%M:%SZ) exclusive fd9 flock held" >> $LOG/launcher.log
    node $R/verifier/probes/common-physical-discriminator/common-physical-discriminator-probe.mjs \
      --url http://127.0.0.1:34413/ \
      --heavy-lock-fd 9 \
      --expect-source-manifest 6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6 \
      --out $OUT >> $LOG/probe.log 2>&1
    echo "$(date -u +%H:%M:%SZ) probe exit=$?" >> $LOG/launcher.log
    flock -u 9
    exit 0
  fi
  sleep 15
done
echo "$(date -u +%H:%M:%SZ) DEADLINE reached without GPU handoff" >> $LOG/launcher.log
exit 4
