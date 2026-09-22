#!/bin/bash
# RUN-ONCE endpoint-negative. Real-headed GB10 via the existing owned helper.
# FD9 on the shared heavy lock is acquired by THIS launcher shell and INHERITED
# by the node probe. No new server, no headless, no foreign kill.
set -u
R=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
P=$R/verifier/probes/manual-credit-finale/endpoint-negative-candidate
LOG=$R/verifier/logs/manual-endpoint-negative-runtime
OUT="$1"
mkdir -p "$LOG"
ROLE=$(python3 -c "import json;d=json.load(open('$R/verifier-control.json'));print(d['activeRole'],d['action'])")
if [ "$ROLE" != "manual-endpoint-negative-runtime continue" ]; then
  echo "$(date -u +%H:%M:%SZ) REFUSED: control says '$ROLE'" | tee -a "$LOG/launcher.log"; exit 3
fi
echo "$(date -u +%H:%M:%SZ) control ok; acquiring inherited exclusive fd9" >> "$LOG/launcher.log"
exec 9>>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
if ! flock -w 60 -x 9; then echo "$(date -u +%H:%M:%SZ) LOCK CONTENDED" >> "$LOG/launcher.log"; exit 4; fi
echo "$(date -u +%H:%M:%SZ) exclusive fd9 flock held by launcher pid $$" >> "$LOG/launcher.log"
# kernel + contender proof, recorded from the lock-holding shell itself
{ echo "--- kernel fd9 proof (launcher pid $$) ---"; ls -l /proc/$$/fd/9;
  echo "--- flock -n contender must FAIL while held ---";
  flock -n -x 9 -c true 2>&1; echo "same-fd-reentrant-rc=$?";
  ( exec 8>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
    if flock -n -x 8; then echo "CONTENDER-ACQUIRED-UNEXPECTED"; else echo "CONTENDER-BLOCKED-AS-REQUIRED rc=$?"; fi ) 2>&1
} >> "$LOG/lock-proof.log" 2>&1
# Explicitly NOT swiftshader: the owned helper runs headed on the real adapter.
unset PARAVOXIA_SWIFTSHADER SWIFTSHADER
CUT_MODE=1 node "$P/common-entry-crossing-probe.mjs" \
  --url http://127.0.0.1:34825/ \
  --heavy-lock-fd 9 \
  --expect-source-manifest 2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63 \
  --out "$OUT" >> "$LOG/probe.log" 2>&1
rc=$?
echo "$(date -u +%H:%M:%SZ) probe exit=$rc" >> "$LOG/launcher.log"
flock -u 9
exit $rc
