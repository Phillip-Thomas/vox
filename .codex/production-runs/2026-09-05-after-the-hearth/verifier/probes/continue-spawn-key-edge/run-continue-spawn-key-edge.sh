#!/usr/bin/env bash
# Owned SHELL LAUNCHER for the continue-spawn-key-edge runtime step.
# Acquires the SHARED heavy lock on FD9 HERE; the node probe INHERITS FD9 and
# proves kernel + contender ownership itself. No preview started/killed.
#
# EXIT GATE (verification-continue-spawn-exit-gate-addendum.txt): the inherited
# entry sets exitCode=1 only on exceptions, so it can exit 0 with
# requiredGates.allHeld=false / actualAcceptedNewAction=false. This launcher runs
# the REAL browser probe and THEN post-checks the SAME freshly written capture,
# returning nonzero on any unmet gate. The runtime step is the real probe; the
# post-check only converts an already-written verdict into a truthful status.
# It never manufactures a pass, weakens allHeld, or mutates game state.
set -uo pipefail
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${PVX_URL:?PVX_URL (current root-published preview URL) required}"
: "${PVX_MANIFEST:?PVX_MANIFEST (current source manifest sha256) required}"
: "${PVX_OUT:?PVX_OUT (absolute fresh capture dir) required}"

exec 9>>"$LOCK"
flock -x 9 || { echo "GATE-FAIL: could not acquire exclusive heavy lock on FD9"; exit 91; }

node "$D/earned-continue-3d-probe.mjs" \
  --url "$PVX_URL" \
  --expect-source-manifest "$PVX_MANIFEST" \
  --heavy-lock "$LOCK" --heavy-lock-fd 9 \
  --role continue-spawn-key-edge \
  --out "$PVX_OUT"
PROBE_STATUS=$?
echo "probe-exit=$PROBE_STATUS"

# Post-finally STRICT verdict gate over the SAME newly written capture.
# Requires (runtime-review items 1-4): existing mandatory newF/route-offered/
# noReplay identities, TRUE full point-object prefix equality, SCOPED
# centre-to-centre pose retention, post-finally cleanup receipt, and source
# stability across the capture. Missing proof FAILS; nothing is weakened.
node "$D/strict-verdict-gate.mjs" "$PVX_OUT" "$PROBE_STATUS"
GATE=$?
echo "gate-exit=$GATE"
exit $GATE
