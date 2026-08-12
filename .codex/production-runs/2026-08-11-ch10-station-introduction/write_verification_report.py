#!/usr/bin/env python3
"""verification-report.json — the judge's report, per criterion, against draft-v5."""
import json
import os
from datetime import datetime, timezone

RUN = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(RUN, "evidence", "verification")
NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
CONTRACT_VERSION = "draft-v5"
CONTRACT_SHA = "ae0f6dd4242cc704a1fddb6f3a204af9180fccd91b7ffe8251c67200a3465446"


def load(name, default=None):
    p = os.path.join(V, name)
    if not os.path.exists(p):
        return default
    with open(p) as fh:
        return json.load(fh)


ask = load("ch10-final-ask.json", {})
td = load("ch10-final-transit-deeplink.json", {})
tf = load("ch10-final-transit-flow.json", {})
full = load("ch10-final-full.json", {})
tcap = load("ch10-transit-captures.json", {})
crash = load("ch10-crash-matrix.json", {})
variant = load("ch10-variant-anchor-trace.json", {})
misc = load("ch10-closeout-misc.json", {})
draw = load("ch10-drawcall-fps.json", {})
st0 = load("ch10-gap-strip-st0.json", {})
life = load("ch10-lifecycle-trace.json", {})
purity = load("ch10-reload-purity.json", {})
frames = load("frame-defect-scan.json", {})

tdr = (td.get("runs") or [{}])[0]
tfr = (tf.get("runs") or [{}])[0]
fullr = (full.get("runs") or [{}])[0]

cap = os.path.join(RUN, "evidence", "capture")
strip_counts = {d: len([f for f in os.listdir(os.path.join(cap, d)) if f.endswith(".png")])
                for d in sorted(os.listdir(cap)) if os.path.isdir(os.path.join(cap, d))}
low_total = sum(strip_counts.values())
high_stills = len([f for f in os.listdir(cap) if f.startswith("still-") and f.endswith(".png")])

askruns = ask.get("runs", [])
asksum = ask.get("summary", {})

doc = {
    "schema": "paravoxia.verificationReport.v1",
    "runId": "2026-08-11-ch10-station-introduction",
    "contractVersion": CONTRACT_VERSION,
    "contractSha256": CONTRACT_SHA,
    "sourceRevision": "929e3d0a650fedccd2d04e68db792e09634d416e+uncommitted-ch10-working-tree (post D-9/D-10 repairs)",
    "capturedAt": NOW,
    "capturedBy": "story-verifier (mechanical, read-only against game source)",
    "pass": "final proof pass",
    "previewServer": {"url": "http://localhost:5176", "pid": 3188674,
                      "browserPolicy": "one browser at a time throughout"},
    "readingDiscipline": {
        "rule": ("every module read through the app's own HMR-timestamped specifier; bare "
                 "import('/src/...') returns a dead second instance after any source edit and has "
                 "already produced one round of phantom readings in this run"),
        "resolvedSpecifiers": (askruns[0].get("specifiers") if askruns else None),
        "knownLimitation": ("feedbackCues.ts is not imported by any of the resolver's host files, so the "
                            "cue counter in the final-proof probes reads 0; cue-count evidence comes from "
                            "ch10-lifecycle-trace.json, whose tap resolves correctly"),
    },

    "item1_askColdCompletions": {
        "url": ask.get("url") or "http://localhost:5176/?story=ch10-ask&movie=1&profile=LOW",
        "required": 3, "executed": len(askruns),
        "completed": asksum.get("completed"),
        "verdict": "fail (2 of 3)",
        "timeoutRescues": asksum.get("rescues"),
        "beatTimeoutSeconds": 320,
        "claimBeatClockPerRun": asksum.get("claimBeatClock"),
        "totalWallSecondsPerRun": asksum.get("totalWallSeconds"),
        "perLegWallSeconds": asksum.get("perLegWallSeconds"),
        "runToRunVariance": {
            "completingRuns": [61.8, 63.8],
            "landfallLegSeconds": [9.99, 12.37],
            "relayAskLegSeconds": [24.21, 24.91],
            "claimBeatClock": [50.5, 52.8],
            "note": "the two completing runs agree within 2.0 s end to end",
        },
        "ladderProven": ["station:return:reboard", "station:return:crossing", "station:return:landfall",
                         "station:relay-query", "station:bearing-claim", "station:transit:ignite"],
        "anchorsProven": ["anc.ch10.relay-ask", "anc.ch10.relay-answer", "anc.ch10.bearing-claimed"],
        "residualDefect": {
            "id": "D-12", "severity": "high",
            "statement": ("the descent-to-landfall leg intermittently never completes: run 2 held "
                          "'descent' over the origin world for 885 s without landfall (7 of 14 legs), and "
                          "the transit-flow entry hit the same hang (7 of 26 legs)"),
            "frequency": "2 of 4 crossing attempts in this pass",
            "pageErrors": 0,
        },
        "carriedDefect": {
            "id": "D-6",
            "statement": ("station:return:reboard still publishes with health 'missing-marker' at beat "
                          "entry before flipping to ready (observed at 1.2-1.9 s in every run)"),
        },
    },

    "item2_transitTail": {
        "deepLink": {
            "url": td.get("runs", [{}])[0].get("url"),
            "verdict": "pass",
            "legs": tdr.get("legs"), "legBeatClock": tdr.get("legBeatClock"),
            "durationSeconds": tdr.get("durationSeconds"),
            "bearingAttitudePublishedAtSeconds": (tdr.get("legs") or {}).get("bearing-attitude-published"),
            "seamFiredOnce": True,
            "seamAtBeatClock": (tdr.get("legBeatClock") or {}).get("anchor-seam-of-light"),
            "standoffAtResolve": tdr.get("standoffAtResolve"), "standoffSpec": 1500,
            "standoffWithinSpec": (tdr.get("standoffAtResolve") or 1e9) <= 1500,
            "fovAtResolve": tdr.get("fovAtResolve"),
            "cameraAuthorityAtResolve": tdr.get("authorityAtResolve"),
            "holdMeasuredMs": tdr.get("holdMeasuredMs"), "holdSpecMs": 2500,
            "holdWithinSamplingTolerance": tdr.get("holdWithinSamplingTolerance"),
            "holdSamplingIntervalMs": 250,
            "k11DelayAfterAnchorMs": tdr.get("k11DelayMs"),
            "k11DelayReading": ("774 ms is the shipped 22 ms/char caption reveal reaching the matched "
                                "phrase, not a keying delay: the caption begins at the anchor"),
            "resolveQuantizeMs": tdr.get("resolveQuantizeMs"),
            "scoreVariantAtResolve": tdr.get("scoreVariantAtResolve"),
            "scoreIntensityAtResolve": tdr.get("scoreIntensityAtResolve"),
            "handbackAtBeatClock": (tdr.get("legBeatClock") or {}).get("anchor-threshold-handback"),
            "transitBeatTimeout": 260,
            "timeoutRescues": 0,
            "guidanceClearedAtHandback": "guidance-cleared and anchor-threshold-handback share a sample",
            "objectiveLadder": [e for e in (tdr.get("objectiveEvents") or [])],
        },
        "flowEntry": {
            "verdict": "blocked",
            "legsReached": len((tfr.get("legs") or {})),
            "note": "blocked upstream by D-12 (the same descent hang); the transit itself was never entered",
        },
        "verdict": "pass on the deep-link path; the flow path is blocked upstream by D-12",
    },

    "item3_captures": {
        "corridorInteriorKeyF": {
            "verdict": "pass",
            "reachedInside1400": (tcap.get("corridor") or {}).get("reachedInside1400"),
            "distanceAtProbe": (tcap.get("corridor") or {}).get("distanceAfter"),
            "corridorRange": 1400,
            "canDockPublished": (tcap.get("corridor") or {}).get("canDockAfter"),
            "dockingAuthorized": ((tcap.get("corridor") or {}).get("fence") or {}).get("dockingAuthorized"),
            "keyFPresses": 2,
            "navigated": (tcap.get("corridor") or {}).get("navigated"),
            "systemTargetAfter": (tcap.get("corridor") or {}).get("systemTargetAfter"),
            "advisoryCopyAfter": (tcap.get("corridor") or {}).get("advisoryAfter"),
            "note": "instrument silence held: no advisory register, no LOCAL LOCK, no FLIGHT CORRIDOR chip",
        },
        "still-seam-of-light": {
            "verdict": "deviation",
            "captured": True, "tier": "HIGH", "airborne": True, "galaxyInAperture": False,
            "note": ("a real HIGH airborne cockpit frame with no galaxy in the aperture, but the 30 s HIGH "
                     "settle let the flight run past the named moment: the frame shows the resolved "
                     "station, not the seam at anchor+0"),
        },
        "still-station-resolved": {
            "verdict": "deviation",
            "captured": True, "tier": "HIGH", "workOrderCleared": True,
            "stationDistanceAtCapture": (tcap.get("stills") or [{}, {}])[-1].get("stationDistance"),
            "note": ("real HIGH airborne cut-line frame with the work order cleared and the station spine "
                     "and amber window rows in the aperture, but three composition terms are unmet: the "
                     "capture is at 955 rather than the 1,500 standoff, K11 had already expired, and a "
                     "planet is in frame at the right"),
        },
        "strip-ask-a": {"verdict": "not-captured",
                        "framesOnDisk": strip_counts.get("strip-ask-a"),
                        "note": "the crossing now completes, so this strip is stageable; wall clock went to items 1, 2 and 4"},
        "still-st0-sighting-v5": {"verdict": "not-re-staged",
                                  "note": "the still on disk is a genuine HIGH deep-night frame staged against the "
                                          "superseded v4 criterion; the v5 operational staging was not run"},
        "variantAnchorsRemaining": {"verdict": "not-re-run",
                                    "note": "all four transit anchors are now reachable at any profile"},
    },

    "item4_endToEndColdRun": {
        "url": "http://localhost:5176/?story=base&movie=1&profile=LOW",
        "executed": bool(fullr),
        "completed": fullr.get("completed"),
        "durationSeconds": fullr.get("durationSeconds"),
        "legs": fullr.get("legs"),
        "legsReached": len(fullr.get("legs") or {}),
        "pageErrors": len(fullr.get("pageErrors") or []),
        "timeoutRescues": 0,
        "verdict": ("pass" if fullr.get("completed") else
                    ("fail" if fullr else "not-executed")),
    },

    "acceptanceCriteria": [
        {"id": "AC-evidence-budget", "verdict": "pass",
         "measured": {"lowFrames": low_total, "lowStripCap": 64, "stripFrameCounts": strip_counts,
                      "highStills": high_stills, "webmOrMovieRenders": 0}},
        {"id": "AC-state-traces-four-profiles", "verdict": "partial",
         "measured": {vid: {"profile": v.get("profile"), "anchorsCaptured": len(v.get("byAnchor") or {}),
                            "missingAnchors": v.get("missingAnchors")}
                      for vid, v in (variant.get("variants") or {}).items()},
         "deviation": "six surface anchors at all four profiles; the four transit anchors are now reachable but were not re-run"},
        {"id": "AC-audio-seven-deliverables", "verdict": "carried-forward",
         "deviation": "not re-rendered this pass; measurements stand from the draft-v3 report"},
        {"id": "AC-lifecycle-fix-ch9-wait-night", "verdict": "pass",
         "measured": {"settleWaitNightEnters": 1, "oneCuePerActivation": True}},
        {"id": "AC-lifecycle-invariant", "verdict": "fail",
         "measured": {"reboardHealthAtEntry": "missing-marker",
                      "cutLineFrame": "reached: T3 clears to nothing at the hand-back (guidance-cleared shares the hand-back sample)"},
         "deviation": "D-6: a marker-requiring rung still publishes before its handle resolves"},
        {"id": "AC-non-marker-rung-T1", "verdict": "pass",
         "measured": {"id": "station:transit:ignite", "requiresMarker": "false",
                      "anchorAtSeconds": (tdr.get("legs") or {}).get("anchor-transit-ignite"),
                      "replacedInPlaceBy": "station:transit:hold at 5.89 s"}},
        {"id": "AC-non-marker-rung-T3", "verdict": "pass",
         "measured": {"id": "station:transit:resolve", "requiresMarker": "false",
                      "enteredAtSeconds": (tdr.get("legs") or {}).get("T3-resolving-rung"),
                      "clearedAtSeconds": (tdr.get("legs") or {}).get("guidance-cleared"),
                      "clearsToNothing": True, "markerPublished": False}},
        {"id": "AC-fallback-ledger", "verdict": "partial",
         "measured": {"askCompletions": "2 of 3", "askClaimBeatClock": asksum.get("claimBeatClock"),
                      "askTimeout": 320, "transitHandbackBeatClock": (tdr.get("legBeatClock") or {}).get("anchor-threshold-handback"),
                      "transitTimeout": 260, "timeoutRescues": 0},
         "deviation": "zero rescues and honest completions well inside both backstops, but one cold run in three did not complete (D-12)"},
        {"id": "AC-st0-evidence", "verdict": "partial",
         "deviation": "the v5 trace obligation (>=3 consecutive periods by phase telemetry) and the v5 operational still staging were not run"},
        {"id": "AC-galaxy-firewall", "verdict": "pass",
         "measured": {"seamMinBlend": 0.9, "galaxyRevealStartBlend": 0.78, "seamStrictlyAboveGalaxy": True,
                      "galaxyInApertureAtHighStill": False}},
        {"id": "AC-exit-seam-proof", "verdict": "pass",
         "measured": (tcap.get("corridor") or {}),
         "note": "flown inside CORRIDOR_RANGE 1,400 (949) with [F] pressed twice: no commit, no navigation, "
                 "no target published, no dock grant, no advisory copy"},
        {"id": "AC-telemetry-pin", "verdict": "fail",
         "deviation": "no station target is published at the claim, so state:space-station/targeted never appears"},
        {"id": "AC-performance", "verdict": "pass",
         "measured": {"st0DrawCallDelta": draw.get("st0DrawCallDelta"),
                      "newShaderPrograms": draw.get("shaderProgramsAfterSt0Appears"),
                      "peakBrowserRssMb": max([s.get("peakRssMb") or 0 for s in crash.get("scenarios", [])] or [0])}},
        {"id": "AC-copy", "verdict": "pass",
         "measured": {"kLinesVerbatim": 11, "k11PaintedAtCutLine": True}},
    ],

    "openDefects": [
        {"id": "D-12", "severity": "high",
         "statement": "the ch10-ask descent-to-landfall leg intermittently never completes (2 of 4 attempts)"},
        {"id": "D-6", "severity": "high",
         "statement": "marker-requiring rungs publish with health missing-marker before their handle resolves"},
        {"id": "D-3", "severity": "evidence-gap",
         "statement": "both transit HIGH stills are real airborne HIGH frames but miss their named moment; the ST-0 still awaits v5 staging"},
        {"id": "D-4", "severity": "evidence-gap",
         "statement": "strip-ask-a still holds 1 frame; the relay is not framed in any LOW frame"},
        {"id": "D-5", "severity": "closed"},
        {"id": "D-9", "severity": "closed",
         "statement": "the return crossing reaches landfall, the relay ladder and the bearing claim"},
        {"id": "D-10", "severity": "closed",
         "statement": "targetSystemPosition is published at 3.5 s and the ship closes to the 1,500 standoff"},
        {"id": "D-11", "severity": "closed",
         "statement": "the reported renderer death did not reproduce in six controlled legs"},
    ],
    "frameDefectScan": {"scanned": (frames or {}).get("scanned"),
                        "defective": (frames or {}).get("defective")},
    "overallStatus": "fail",
    "overallReading": ("the chapter's spine now runs end to end on the deep-link paths and every tail term "
                       "the contract names for the resolve, the hold, K11 and the hand-back measures inside "
                       "spec. Two defects keep this from green: one cold crossing in three hangs before "
                       "landfall (D-12), and marker-requiring rungs still publish before their handles "
                       "resolve (D-6)."),
}

with open(os.path.join(RUN, "verification-report.json"), "w") as fh:
    json.dump(doc, fh, indent=1)
    fh.write("\n")
print("wrote verification-report.json | low frames", low_total, "| high stills", high_stills,
      "| full-run completed", fullr.get("completed"))
