#!/bin/bash
# COMMON MOVIE CANDIDATE — 3 sequential COLD runs of the SHIPPED movie/autopilot
# lane. PREPARED, NEVER EXECUTED by the preparing role.
#
# What this runs: the byte-exact private copy of
# verifier/probes/arrival-common-verifier/journey-probe.mjs, at the SAME folder
# depth, so its `../lib/*` and `../../../../../../main/tools/lib/evidence.mjs`
# imports resolve unchanged. The movie lane is the harness's OWN shipped lane:
# `--lane movie` makes it request `?movie=1`, which is exactly what the shipped
# readState reports back as `lane: "movie"`, and the traversal is driven by the
# game's own autopilot (`window.__autopilot`).
#
# What this deliberately does NOT run: the manual common-entry-crossing /
# common-passage probes. Ordinary WASD completion is NOT a movie run and is
# never reported as one. No setters, teleports, rail grants, forced [F] or
# rescue exist in this path; the harness's own no-rescue and stall/timeout
# failure behaviour is preserved untouched.
#
# GPU/browser: run ONLY when root has handed the baton to
# common-movie-candidate-runtime with action=continue.
set -u
set -o pipefail

RUN=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth
PROBES=$RUN/verifier/probes/common-movie-candidate
LOG=$RUN/logs/common-movie-candidate-runtime
LOCK=/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock

ROLE=common-movie-candidate-runtime
ACTION=continue
MANIFEST=8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962
INDEX_SHA=a9b880389deff7717b3d76b0f4a962beff1031a2ffa44fde427a5f0022353d8f
BUNDLE_SHA=68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b

# Original per-run bound. No retained recipe specifies a different existing
# bound for `--beat ch13-common --lane movie`, so the original 100s stands.
SECONDS_PER_RUN=100

# Real headed GPU only: this makes evidence.mjs pick headless SwiftShader if set.
unset PARAVOXIA_ALLOW_SWIFTSHADER

mkdir -p "$LOG"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LAUNCHER_LOG=$LOG/launcher-$STAMP.log
say() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" | tee -a "$LAUNCHER_LOG"; }

say "launcher start stamp=$STAMP role=$ROLE"

cd "$RUN" || { say "FATAL cannot cd $RUN"; exit 2; }

# ------------------------------------------------------------- role gate ----
# Read the LIVE control file. The current finale role MUST be refused here.
CTL=$(python3 -c "import json;d=json.load(open('$RUN/verifier-control.json'));print(d.get('activeRole'),d.get('action'))") || {
  say "FATAL verifier-control.json unreadable"; exit 2; }
if [ "$CTL" != "$ROLE $ACTION" ]; then
  say "REFUSED: verifier-control is '$CTL', not '$ROLE $ACTION' — no lock taken, no browser launched"
  exit 3
fi
say "control gate passed: '$CTL'"

# --------------------------------------------------------- heavy lock fd9 ----
# fd 9 is opened HERE and INHERITED by every child, so the preflight can prove
# ownership of this exact open file description via /proc/self/fdinfo/9.
exec 9<>"$LOCK" || { say "FATAL cannot open $LOCK"; exit 4; }
if ! flock -w 60 -x 9; then
  say "FLOCK-CONTENDED-TIMEOUT after 60s — another owner holds the shared heavy lock; exiting without a browser"
  exec 9>&-
  exit 4
fi
say "exclusive flock held on fd9 inode=$(stat -c %i "$LOCK")"

OVERALL=0
for i in 1 2 3; do
  ATTEMPT="attempt-$STAMP-run$i"                      # fresh, unique, never reused
  OUTNAME="common-movie-candidate/$ATTEMPT"           # journey-probe resolves this under verifier/captures
  OUTABS="$RUN/verifier/captures/$OUTNAME"
  RUNLOG=$LOG/$ATTEMPT.log

  say "RUN $i preflight -> $OUTABS"
  node "$PROBES/movie-preflight.mjs" \
    --expect-role "$ROLE" --expect-action "$ACTION" \
    --expect-source-manifest "$MANIFEST" \
    --expect-index-sha "$INDEX_SHA" --expect-bundle-sha "$BUNDLE_SHA" \
    --expect-gpu GB10 \
    --heavy-lock "$LOCK" --heavy-lock-fd 9 \
    --out "$OUTABS" >>"$RUNLOG" 2>&1
  PRE=$?                                              # recorded IMMEDIATELY
  say "RUN $i preflight exit=$PRE"
  if [ "$PRE" -ne 0 ]; then
    say "RUN $i ABORT: preflight refused (see $RUNLOG). Sequence stopped — no repeated identical failure."
    OVERALL=5
    break
  fi

  # COLD: a brand-new browser per run, opened and closed by the probe's own
  # owned-session guard (its `finally` stops the probe-owned browser). The
  # root-owned preview is NEVER stopped.
  say "RUN $i movie lane start (seconds=$SECONDS_PER_RUN)"
  node "$PROBES/journey-probe.mjs" \
    --beat ch13-common \
    --lane movie \
    --until-beat done \
    --seconds "$SECONDS_PER_RUN" \
    --sample-ms 100 \
    --strip-s 5 \
    --percept \
    --stall-fail-ms 20000 \
    --control-ms 10000 \
    --out "$OUTNAME" >>"$RUNLOG" 2>&1
  EC=$?                                               # recorded IMMEDIATELY, before any echo
  say "RUN $i probe exit=$EC out=$OUTABS log=$RUNLOG"
  if [ "$EC" -ne 0 ]; then OVERALL=$EC; fi

  # Fail fast on INSTRUMENTATION error (not on a gameplay verdict): a module
  # resolution or harness crash would repeat identically three times.
  if grep -qE "ERR_MODULE_NOT_FOUND|Cannot find (module|package)|SyntaxError" "$RUNLOG"; then
    say "RUN $i ABORT: instrumentation error in harness (module resolution/syntax). Sequence stopped."
    OVERALL=6
    break
  fi

  # Per-run cleanup evidence. Ownership is asserted ONLY by the probe's own
  # owned-session guard receipt (createOwnedSessionGuard closes the browser it
  # opened, in its finally). The pgrep below is a GLOBAL census of this uid and
  # is NOT an ownership claim: foreign chromium may appear in it. Nothing is
  # killed here and the root preview daemon (pid from preview-ownership.json)
  # is never touched.
  say "RUN $i owned-session guard receipts: $(grep -ohE '\"(ownedSessionGuard|closedOwnedBrowser|browserPid)\"[^,}]*' "$OUTABS"/*.json 2>/dev/null | tr '\n' ' ')"
  say "RUN $i GLOBAL uid chromium census (NOT an ownership claim): $(pgrep -u "$(id -u)" -f 'chrome|chromium' | tr '\n' ' ')"
done

flock -u 9
exec 9>&-
say "sequence done overall=$OVERALL (captures preserved; nothing deleted)"
exit $OVERALL
