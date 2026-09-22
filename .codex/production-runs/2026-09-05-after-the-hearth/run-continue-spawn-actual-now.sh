#!/usr/bin/env bash
set -euo pipefail
cd /home/thomasphillip/Projects/vox
export PVX_URL=http://127.0.0.1:34825/
export PVX_MANIFEST=2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63
export PVX_OUT=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/captures/continue-spawn-candidate/actual-now-20260906T2341Z
RUN_PATH=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
SECONDS_LEFT=$(python3 -c "import datetime;print(max(1,int((datetime.datetime.fromisoformat('2026-09-06T23:45:06+00:00')-datetime.datetime.now(datetime.timezone.utc)).total_seconds())))")
mkdir -p "$RUN_PATH/logs/continue-spawn-verifier/actual-now-probe-snapshot"
cp -a "$RUN_PATH/verifier/probes/continue-spawn-candidate/." "$RUN_PATH/logs/continue-spawn-verifier/actual-now-probe-snapshot/"
timeout --signal=INT --kill-after=10s "${SECONDS_LEFT}s" npm --prefix main run creative:repair:check -- --plan "$RUN_PATH/verifier/probes/continue-spawn-candidate/repair-check-plan.json" --out "$RUN_PATH/logs/continue-spawn-verifier/actual-now-repair-check" --final
