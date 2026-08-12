#!/usr/bin/env python3
"""verification-report.json — the judge's copy, final proof round.

Every criterion is stamped explicitly against draft-v5
(sha ae0f6dd4242cc704a1fddb6f3a204af9180fccd91b7ffe8251c67200a3465446) as
pass / fail / deviation / residual. Measured facts only; the verdict text names
what was measured and against which number.
"""
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
        return default if default is not None else {}
    with open(p) as fh:
        return json.load(fh)


ask = load("ch10-final-ask.json")
full = load("ch10-final-full.json")
td = load("ch10-final-transit-deeplink.json")
strip_a = load("ch10-closing-strip-ask-a.json")
cutline = load("ch10-closing-cutline.json")
st0 = load("ch10-closing-st0.json")
st0_trace = load("ch10-closing-st0-phase-trace.json")
vtrans = load("ch10-closing-variant-transit.json")
marker = load("ch10-closing-marker-invariant.json")
marker_contended = load("ch10-closing-marker-invariant-contended.json")
variant6 = load("ch10-variant-anchor-trace.json")
tcap = load("ch10-transit-captures.json")
draw = load("ch10-drawcall-fps.json")
frames = load("frame-defect-scan.json")

askruns = ask.get("runs", [])
asksum = ask.get("summary", {})
fullr = (full.get("runs") or [{}])[0]
tdr = (td.get("runs") or [{}])[0]

cap = os.path.join(RUN, "evidence", "capture")
strip_counts = {d: len([f for f in os.listdir(os.path.join(cap, d)) if f.endswith(".png")])
                for d in sorted(os.listdir(cap)) if os.path.isdir(os.path.join(cap, d))}
low_total = sum(strip_counts.values())
high_stills = sorted(f for f in os.listdir(cap) if f.startswith("still-") and f.endswith(".png"))

# ---------------------------------------------------------------- item 1
landfall = [r["legDurations"].get("landfall-origin") for r in askruns]
claim_clock = asksum.get("claimBeatClock", [])
item1 = {
    "url": "http://localhost:5176/?story=ch10-ask&movie=1&profile=LOW",
    "required": 3, "executed": len(askruns),
    "completed": sum(1 for r in askruns if r.get("completed")),
    "verdict": "pass" if sum(1 for r in askruns if r.get("completed")) == 3 else "fail",
    "legsPerRun": [f"{len(r.get('legs', {}))}/14" for r in askruns],
    "totalWallSecondsPerRun": asksum.get("totalWallSeconds"),
    "claimBeatClockPerRun": claim_clock,
    "beatTimeoutSeconds": 320,
    "worstClaimBeatClockVsTimeout": (max([c for c in claim_clock if c is not None] or [0]), 320),
    "timeoutRescues": asksum.get("rescues"),
    "pageErrors": sum(len(r.get("pageErrors", [])) for r in askruns),
    "landfallLegSecondsThisPass": landfall,
    "perLegWallSeconds": asksum.get("perLegWallSeconds"),
    "runToRunVariance": {
        "totalWallSpreadSeconds": round(max(asksum.get("totalWallSeconds") or [0])
                                        - min(asksum.get("totalWallSeconds") or [0]), 2),
        "landfallLegSpreadSeconds": round(max([x for x in landfall if x is not None] or [0])
                                          - min([x for x in landfall if x is not None] or [0]), 2),
        "dominantVarianceSource": ("the on-foot relay walk (anchor-relay-ask leg: "
                                   + ", ".join(str(r["legDurations"].get("anchor-relay-ask")) for r in askruns)
                                   + " s), not the crossing"),
    },
    "d12PostFixSample": {
        "engineerBatch": {"runs": 4, "completed": 4, "landfallLegSeconds": [5.1, 5.2, 6.1, 7.1],
                          "note": "one run's 70 s watch expired later during the on-foot relay walk, a watch budget, not a hang"},
        "verifierBatch": {"runs": 3, "completed": 3, "landfallLegSeconds": landfall},
        "combinedPostFix": {"runs": 7, "completed": 7,
                            "landfallLegSecondsRange": [min([5.1, 5.2, 6.1, 7.1] + [x for x in landfall if x is not None]),
                                                        max([5.1, 5.2, 6.1, 7.1] + [x for x in landfall if x is not None])]},
        "preFixRate": "2 of 4 crossing attempts hung, worst 89.4 s, per the predecessor verification-report entries",
        "deletedArtifact": ("ch10-ask-leg-prefix-baseline.json was deleted by the engineer: it held post-fix data "
                            "under a pre-fix name (self-caught). The pre-fix rate stands only in the predecessor "
                            "report entries, not in a probe artifact."),
        "residual": ("closed on frequency: 7 of 7 post-fix crossings landed, landfall 5.1-7.8 s against a pre-fix "
                     "9.1-11.1 s with one 89.4 s hang. The residual is that no post-fix run has been observed on "
                     "hardware other than this headless SwiftShader box."),
    },
}

# ---------------------------------------------------------------- item 2
stall_beat_clock = fullr.get("lastBeatClock")
item2 = {
    "url": "http://localhost:5176/?story=base&movie=1&profile=LOW",
    "executed": True, "completed": fullr.get("completed", False),
    "verdict": "fail",
    "durationSeconds": fullr.get("durationSeconds"),
    "capSeconds": 3000,
    "legsReached": len(fullr.get("legs", {})),
    "legsRequired": 28,
    "legs": fullr.get("legs"),
    "pageErrors": len(fullr.get("pageErrors", [])),
    "timeoutRescues": 0,
    "stall": {
        "enteredBeat": "ch10-transit",
        "enteredAtSeconds": fullr.get("legs", {}).get("beat-ch10-transit"),
        "standingRung": "station:transit:ignite",
        "beatClockAtCap": stall_beat_clock,
        "beatTimeoutSeconds": 260,
        "beatClockOverBackstop": (round(stall_beat_clock / 260, 1) if stall_beat_clock else None),
        "rescuesFired": 0,
        "controlModeDuringStall": "fps",
        "autopilotKeysDuringStall": [],
        "playerPositionDuringStall": [-2.01, 52.79, -4.15],
        "cause": ("main/src/story/autopilot.ts case 'ch10-transit' gates every control on "
                  "flight.controlMode === 'flight' (controls.jump and controls.forward both) and the branch "
                  "contains no reboard step. The flow enters ch10-transit on foot at the wreck relay after the "
                  "bearing claim, so no key is ever asserted. The ?story=ch10-transit deep link seeds the pilot "
                  "already in flight, which is why the deep-link tail passes and the flow tail hangs."),
        "defectId": "D-13",
    },
}

# ---------------------------------------------------------------- item 3
st0_still = st0.get("still") or {}
cut_still = cutline.get("still") or {}
item3 = {
    "strip-ask-a": {
        "verdict": "pass",
        "framesOnDisk": strip_counts.get("strip-ask-a"),
        "required": 8,
        "frames": [{"file": f["file"], "label": f["label"], "beat": f["beat"], "t": f["t"],
                    "objectiveId": f["objectiveId"], "flight": f["flight"],
                    "activePlanetId": (f.get("system") or {}).get("activePlanetId"),
                    "targetWorldId": (f.get("system") or {}).get("targetWorldId"),
                    "shipToRelay": f.get("shipToRelay")}
                   for f in strip_a.get("frames", [])],
        "wreckRelayFramed": {
            "relayHandle": next((f.get("relayHandle") for f in strip_a.get("frames", []) if f.get("relayHandle")), None),
            "shipToRelayAtLandfall": next((f.get("shipToRelay") for f in strip_a.get("frames", [])
                                           if f["label"] == "landfall-at"), None),
            "reading": "the origin-side descent now puts the ship inside ~71 m of the wreck relay at landfall, and the WRECK SITE / WRECK RELAY marker is in frame in both landfall frames",
        },
        "note": ("the movie lane boards within ~0.2 s of beat entry, so the reboard-before frame had to be shot at "
                 "the gate check itself; it is a genuine on-foot frame standing on station:return:reboard"),
    },
    "still-station-resolved": {
        "verdict": "deviation",
        "file": "evidence/capture/still-station-resolved.png",
        "tier": cut_still.get("tier"),
        "method": cutline.get("method"),
        "secondsHighWarmBeforeShutter": cut_still.get("secondsHighWarmBeforeShutter"),
        "shutterTrigger": "cut-line predicate (K11 painted AND work order cleared), not a fixed settle",
        "criterionTerms": {
            "standoff 1,500": {"measuredAtAnchor": (cutline.get("atResolve") or {}).get("distance"),
                               "measuredAtShutter": cut_still.get("stationDistance"),
                               "verdict": "fail"},
            "FOV 70": {"measured": (cutline.get("atResolve") or {}).get("fov"), "verdict": "pass"},
            "K11 painted lower-center": {"measured": cut_still.get("k11Painted"), "verdict": "pass"},
            "work order cleared": {"measured": cut_still.get("workOrderCleared"), "verdict": "pass"},
            "no galaxy, planet or home fire in frame": {
                "automatedFlags": {"objectNamedGalaxyInFrustum": cut_still.get("galaxyInFrame"),
                                   "systemCompanionBodyInFrustum": cut_still.get("planetsInFrame")},
                "frameReading": "the aperture visibly carries nebula colouration and one lit spherical body at the right",
                "verdict": "unresolved-by-measurement",
                "note": ("the automated frustum test only covers objects named galaxy* and system-companion-body-*; "
                         "the body in this frame matches neither, so the term is reported with the frame as its "
                         "evidence rather than as a machine verdict")},
            "spine ~31% of frame width on the left golden-section band": {
                "measured": None, "verdict": "not-measured",
                "note": "no mechanical spine-extent measurement exists in this harness; the frame is the evidence"},
            "amber window rows the brightest values": {
                "measured": None, "verdict": "not-measured",
                "note": "the brightest region in the frame is the lit body at the right, not the window rows; recorded as an observation, not a machine verdict"},
        },
        "structuralConflict": ("'standoff 1,500' and 'work order cleared' are not jointly satisfiable in the shipped "
                              "flight: the anchor fires at 1,440-1,491 and the hand-back is 2,581 ms later while the "
                              "ship is still closing at ~80 u/s, so the earliest possible cut-line frame is ~1,230. "
                              "The measured shutter landed at 1,088 because each page.evaluate at HIGH costs seconds."),
        "improvementOverPredecessor": "1,088 with K11 painted and the order cleared, versus 955 with K11 already expired",
    },
    "still-st0-sighting": {
        "verdict": "deviation",
        "file": "evidence/capture/still-st0-sighting.png",
        "tier": st0_still.get("tier"),
        "criterionTerms": {
            "capture at crossing peak (phase-telemetry latitude maximum)": {
                "peakAltitudeTrackedDeg": st0_still.get("peakAltitudeTracked"),
                "altitudeAtShutterDeg": st0_still.get("altitudeAtShutter"),
                "shutterOnMaximum": st0_still.get("shutterOnMaximum")},
            "yaw to the station bearing azimuth +-2deg": {
                "bearingAzimuthDeg": st0.get("bearingAzimuthDeg"),
                "cameraAzimuthDeg": st0_still.get("cameraAzDeg"),
                "yawErrorDeg": st0_still.get("yawErrorVsBearingDeg")},
            "pitch = peak elevation - 15deg": {
                "targetDeg": st0_still.get("pitchTargetDeg"),
                "cameraPitchDeg": st0_still.get("cameraAltDeg"),
                "errorDeg": st0_still.get("pitchErrorDeg")},
            "FOV 75": {"measured": st0_still.get("avFov")},
            "dot on the upper-third line +-5% frame height": {
                "st0Ndc": st0_still.get("st0Ndc"),
                "errorFrameHeightPct": st0_still.get("st0NdcYErrorFrameHeightPct")},
            "moon excluded via <=+-10deg yaw": {
                "yawOffsetAppliedDeg": st0.get("yawOffsetAppliedDeg"),
                "moonInFrame": st0_still.get("moonInFrame")},
            "ST-0 visible / night": {"st0Visible": st0_still.get("st0Visible"),
                                     "st0Opacity": st0_still.get("st0Opacity"),
                                     "isNight": st0_still.get("isNight"),
                                     "daylight": st0_still.get("daylight")},
        },
        "renderedDotCheck": {
            "cropAtReportedNdc": "a single amber point of roughly 2-3 device pixels sits at the reported NDC; it reads as sub-moon and above the brightest star, and does NOT read as a disc",
            "verdict": "pass",
            "method": "the still cropped 120x120 px around the ST-0 NDC the runtime reports and inspected at 4x",
        },
        "phaseTelemetryTrace": {
            "source": "evidence/verification/ch10-closing-st0-phase-trace.json (420 s window)",
            "traceSamples": st0_trace.get("traceSamples"),
            "peaks": [{"t": p["t"], "altitudeDeg": p["alt"], "azimuthDeg": p["az"]} for p in (st0_trace.get("peaks") or [])],
            "peakIntervalsSeconds": st0_trace.get("peakIntervalsSeconds"),
            "periodSpecSeconds": 90,
            "maxPeriodErrorPct": 0.35,
            "consecutivePeriodsProven": st0_trace.get("consecutivePeriodsProven"),
            "consecutivePeriodsRequired": 3,
            "peakAltitudeDeg": st0_trace.get("peakAltitudeDeg"),
            "bearingAzimuthDeg": st0_trace.get("bearingAzimuthDeg"),
            "azimuthSwingDeg": st0_trace.get("azimuthSwingDeg"),
            "verdict": "pass",
            "method": ("live ST-0 quad sampled at 2 Hz with the world clock held at night across the whole window, so "
                       "the track is continuous rather than reconstructed"),
            "note": ("the measured peak elevation 16.32 deg reproduces to three decimals on all five crossings and "
                     "matches the v5 clause's own arithmetic (pitch = peak - 15 = +1.3 deg)"),
        },
    },
    "variantAnchorsRemaining": {
        "verdict": "pass",
        "anchors": vtrans.get("anchors"),
        "byVariant": {vid: {"profile": v.get("profile"), "viewport": v.get("viewport"),
                            "reducedMotion": v.get("reducedMotion"), "isMobile": v.get("isMobile"),
                            "anchorsCaptured": v.get("anchorsCaptured"),
                            "missingAnchors": v.get("missingAnchors"),
                            "order": v.get("order"),
                            "seamStrictlyBeforeResolved": v.get("seamStrictlyBeforeResolved"),
                            "pageErrors": len(v.get("pageErrors", [])),
                            "appliedFovAtAnchors": sorted({s.get("fov") for s in (v.get("byAnchor") or {}).values()
                                                           if s.get("fov") is not None}),
                            "resetAtHandback": (v.get("byAnchor") or {}).get("anc.ch10.threshold-handback", {}).get("reset"),
                            "objectiveAtHandback": (v.get("byAnchor") or {}).get("anc.ch10.threshold-handback", {}).get("objectiveId")}
                      for vid, v in (vtrans.get("variants") or {}).items()},
        "parityDeviation": ("desktop-medium-reduced-motion reports appliedFovDeg 75 at every transit anchor where "
                            "HIGH, LOW and POTATO report 70; the contract names FOV 70 at the cut line"),
        "samplingCaveat": ("at HIGH and MEDIUM the settle outran the ignite and seam anchors, so those two rows are "
                           "first-observation-after-fire rather than at-fire; LOW and POTATO caught them separately"),
    },
    "markerInvariantSpotCheck": {
        "verdict": "fail",
        "method": ("MutationObserver installed through addInitScript before the HUD mounts, plus a per-frame "
                   "rAF backstop, so the publication instant itself is measured rather than a 250-700 ms sample"),
        "paths": {pid: {"url": p.get("url"), "reachedBearingClaim": p.get("reachedBearingClaim"),
                        "mandatoryRungs": p.get("mandatoryRungs"),
                        "violationCount": p.get("violationCount"),
                        "worstViolationDwellMs": p.get("worstViolationDwellMs"),
                        "violations": [{"objectiveId": v["id"], "health": v["health"],
                                        "markerLabel": v["marker-label"], "dwellMs": v["dwellMs"],
                                        "atMs": v["at"]} for v in p.get("missingMarkerViolations", [])],
                        "events": p.get("events")}
                  for pid, p in (marker.get("paths") or {}).items()},
        "reproducibility": ("the deep-link reboard violation measured 3,400.8 ms clean and 3,366.9 ms under load "
                            "(ch10-closing-marker-invariant-contended.json): a stable state, not a sampling artifact"),
    },
}

# ---------------------------------------------------------------- criteria
low_cap = 64


def crit(cid, verdict, measured=None, deviation=None, residual=None):
    d = {"id": cid, "verdict": verdict}
    if measured is not None:
        d["measured"] = measured
    if deviation:
        d["deviation"] = deviation
    if residual:
        d["residual"] = residual
    return d


criteria = [
    crit("AC-evidence-budget", "pass", {
        "lowFrames": low_total, "lowStripCap": low_cap, "stripFrameCounts": strip_counts,
        "highStills": len(high_stills), "highStillCap": 3, "highStillFiles": high_stills,
        "webmOrMovieRenders": 0,
        "movieLaneProof": "state traces at LOW only, zero rescues in the ask lane"}),
    crit("AC-state-traces-four-profiles", "pass", {
        "surfaceAnchorsAllFourProfiles": 6, "transitAnchorsAllFourProfiles": 4,
        "totalAnchorsPerProfile": 10,
        "seamStrictlyBeforeResolvedEveryVariant": all(
            v.get("seamStrictlyBeforeResolved") for v in (vtrans.get("variants") or {}).values()),
        "lowColdRunsCompletingWithZeroRescues": f"{item1['completed']} of {item1['executed']}",
        "movieRenders": 0,
        "byVariant": item3["variantAnchorsRemaining"]["byVariant"]},
        deviation=item3["variantAnchorsRemaining"]["parityDeviation"] + "; "
        + item3["variantAnchorsRemaining"]["samplingCaveat"]),
    crit("AC-audio-seven-deliverables", "carried-forward", None,
         deviation="not re-rendered this pass; measurements stand from the draft-v3 report",
         residual="the audio deliverables have not been re-measured against draft-v5"),
    crit("AC-lifecycle-fix-ch9-wait-night", "pass", {
        "settleWaitNightEnters": 1, "oneCuePerActivation": True,
        "reconfirmedIn": "the end-to-end cold run: settle:wait-night entered once at 11.89 s and held to 123.46 s"}),
    crit("AC-lifecycle-invariant", "fail", {
        "method": "mutation-level, both entry paths",
        "mandatoryRungsObservableAtMissingMarker": [
            {"objectiveId": "station:return:reboard", "path": "deep-link-ch10-ask", "dwellMs": 3400.8},
            {"objectiveId": "station:return:landfall", "path": "deep-link-ch10-ask", "dwellMs": 264.6},
            {"objectiveId": "station:return:landfall", "path": "flow-ch10-cold-to-ask", "dwellMs": 273.6}],
        "reboardOnFlowPath": {"health": "ready", "dwellMs": 166.5},
        "cutLineFrame": "T3 clears to nothing at the hand-back on all four variants (objectiveId null, reset 'completion')"},
        deviation="D-6: marker-requiring rungs still publish before their handles resolve; the deep-link reboard case holds missing-marker for 3.4 s, which is not a one-frame seam"),
    crit("AC-non-marker-rung-T1", "pass", {
        "id": "station:transit:ignite", "requiresMarker": "false",
        "replacedInPlaceBy": "station:transit:hold",
        "confirmedAtProfiles": ["LOW", "POTATO"],
        "note": "at LOW and POTATO the sample at anc.ch10.transit-ignite already shows station:transit:hold in place"}),
    crit("AC-non-marker-rung-T3", "pass", {
        "id": "station:transit:resolve", "requiresMarker": "false",
        "clearsToNothing": True, "markerPublished": False,
        "confirmedAtProfiles": ["HIGH", "MEDIUM+reduced-motion", "LOW", "POTATO"],
        "objectiveAtHandback": None, "resetReasonAtHandback": "completion"}),
    crit("AC-fallback-ledger", "fail", {
        "askColdRuns": f"{item1['completed']} of {item1['executed']}",
        "askClaimBeatClock": claim_clock, "askTimeout": 320, "askRescues": 0,
        "transitDeepLinkHandbackBeatClock": 24.7, "transitTimeout": 260,
        "endToEndTransitBeatClockAtCap": stall_beat_clock,
        "endToEndRescuesFired": 0},
        deviation=("the ask lane is clean (3 of 3 honest completions, worst claim at 45.3 s against a 320 s backstop, "
                   "zero rescues), but the end-to-end run let the ch10-transit beat clock reach 2,577.3 s against a "
                   "260 s backstop with zero rescue: the backstop is declared but does not fire"),
        residual="D-13"),
    crit("AC-st0-evidence", "partial", item3["still-st0-sighting"],
         deviation=("the v5 TRACE obligation is now met (4 consecutive periods, 89.66-90.21 s against the 90 s spec, "
                    "peak elevation 16.32 deg reproduced on all five crossings). The v5 OPERATIONAL STILL lands most "
                    "of its terms - real HIGH, deep night, ST-0 at full opacity at the crossing peak (16.03 of 16.32), "
                    "the dot on the upper third within 3.5% of frame height against a +-5% tolerance, FOV 75, pitch "
                    "within 0.25 deg of peak-15 - but three terms miss: yaw sits 4.64 deg off the bearing azimuth "
                    "against a +-2 deg tolerance, a bright sky body is in frame despite the -10 deg moon-exclusion "
                    "yaw, and the camera stands at the Kestrel 46 m from the hearth rather than at the hearth, so the "
                    "terrain horizon occupies about the bottom third instead of the bottom 20%."),
         residual=("the yaw and body-exclusion misses are drift: the aim converged to within 0.23 deg of the bearing "
                   "azimuth and cleared the body, then the camera drifted about 15 deg of yaw during the 30.9 s of "
                   "HIGH warm-up before the shutter. A staging that re-aims inside the last second before the peak "
                   "would close both.")),
    crit("AC-galaxy-firewall", "pass", {
        "seamMinBlend": 0.9, "galaxyRevealStartBlend": 0.78, "seamStrictlyAboveGalaxy": True,
        "galaxyInApertureAtSeamHighStill": False},
        deviation="carried from the seam still; the re-staged station-resolved HIGH still is a separate capture and its own 'no galaxy, planet or home fire in frame' term fails"),
    crit("AC-exit-seam-proof", "pass", {
        "reachedInside1400": True, "distanceAtProbe": 949, "corridorRange": 1400,
        "canDockPublished": False, "dockingAuthorized": False, "keyFPresses": 2,
        "navigated": False, "advisoryCopy": "none",
        "source": "carried unchanged from ch10-transit-captures.json"}),
    crit("AC-telemetry-pin", "fail", {
        "stationTargetAtBearingClaim": None,
        "stationTargetAtCh10TransitEntry": "-1,-1:a0",
        "delaySeconds": 1.3,
        "source": "the end-to-end cold run: target null at the claim (t=412.27), '-1,-1:a0' at the beat flip (t=413.57)"},
        deviation="no station target is published AT the claim; it appears 1.3 s later at the ch10-transit flip, so state:space-station/targeted never coincides with the claim"),
    crit("AC-performance", "pass", {
        "st0DrawCallDelta": 1, "newShaderPrograms": 0, "peakBrowserRssMb": 2003,
        "source": "carried unchanged from ch10-drawcall-fps.json"}),
    crit("AC-copy", "pass", {
        "kLinesVerbatim": 11, "k11PaintedAtCutLine": cut_still.get("k11Painted"),
        "k11Text": cut_still.get("caption")}),
]

tally = {}
for c in criteria:
    tally[c["verdict"]] = tally.get(c["verdict"], 0) + 1

open_defects = [
    {"id": "D-13", "severity": "high", "status": "open",
     "statement": ("ch10-transit entered from the flow leaves the pilot on foot at the wreck relay: every control in "
                   "the autopilot's ch10-transit branch is gated on controlMode === 'flight' and no reboard step "
                   "exists, so the T1 ignite rung stands forever. Measured: beat clock 2,577.3 s against a 260 s "
                   "backstop, zero rescues, zero page errors."),
     "evidence": "evidence/verification/ch10-final-full.json"},
    {"id": "D-6", "severity": "high", "status": "open",
     "statement": ("marker-requiring rungs publish before their handles resolve. Mutation-level: "
                   "station:return:reboard holds missing-marker for 3,400.8 ms on the ch10-ask deep link; "
                   "station:return:landfall holds it for 264.6 ms (deep link) and 273.6 ms (flow)."),
     "evidence": "evidence/verification/ch10-closing-marker-invariant.json"},
    {"id": "D-3", "severity": "evidence-gap", "status": "partially-closed",
     "statement": ("still-station-resolved is now shot at its named state (K11 painted, work order cleared, real HIGH, "
                   "17.4 s warm) but three composition terms remain unmet, two of them structurally. "
                   "still-st0-sighting: see AC-st0-evidence."),
     "evidence": "evidence/verification/ch10-closing-cutline.json, evidence/verification/ch10-closing-st0.json"},
    {"id": "D-4", "severity": "closed",
     "statement": "strip-ask-a now holds all eight criterion frames and the wreck relay is framed at 71 m in both landfall frames"},
    {"id": "D-12", "severity": "closed-on-frequency", "status": "residual: sample only on this headless box",
     "statement": ("origin-side descent now aims at the derivable wreck site. Post-fix: 7 of 7 completions "
                   "(engineer 4, verifier 3), landfall leg 5.1-7.8 s. Pre-fix: 2 of 4 hung, worst 89.4 s. "
                   "ch10-ask-leg-prefix-baseline.json was deleted by the engineer because it held post-fix data "
                   "under a pre-fix name (self-caught), so the pre-fix rate now stands only in the predecessor report."),
     "evidence": "evidence/verification/ch10-final-ask.json"},
    {"id": "D-5", "severity": "closed"},
    {"id": "D-9", "severity": "closed"},
    {"id": "D-10", "severity": "closed"},
    {"id": "D-11", "severity": "closed"},
]

doc = {
    "schema": "paravoxia.verificationReport.v1",
    "runId": "2026-08-11-ch10-station-introduction",
    "contractVersion": CONTRACT_VERSION,
    "contractSha256": CONTRACT_SHA,
    "sourceRevision": "929e3d0a650fedccd2d04e68db792e09634d416e+uncommitted-ch10-working-tree (post D-6/D-12 repair round)",
    "capturedAt": NOW,
    "capturedBy": "story-verifier (mechanical, read-only against game source)",
    "pass": "final proof round (judge's copy)",
    "previewServer": {"url": "http://localhost:5176", "pid": 3188674,
                      "browserPolicy": "one browser at a time, except for a recorded overlap window"},
    "concurrencyDisclosure": {
        "window": "2026-08-12T04:00Z-04:09 local 04:00-04:09",
        "what": ("the strip-ask-a and first marker-invariant probes ran in a second browser while the end-to-end cold "
                 "run was still executing. The end-to-end run's stall is a state fact (controlMode fps, no keys "
                 "asserted) and is not timing-sensitive; the contended marker-invariant reading was re-run clean and "
                 "both readings agree within 1%. Every other measurement in this report was taken with a single "
                 "browser and nothing else running."),
    },
    "readingDiscipline": {
        "rule": ("every module read through the app's own HMR-timestamped specifier; a bare import('/src/...') returns "
                 "a dead second instance after any source edit"),
        "cameraRule": ("the world camera is selected by update-tick count with a lens/depth sanity gate. Selecting "
                       "'the last perspective camera seen' returns the post-processing pass's camera at HIGH, which "
                       "is how one still came back reporting fov -90 and azimuth 0."),
    },
    "item1_askColdCompletions": item1,
    "item2_endToEndColdRun": item2,
    "item3_remainingCaptures": item3,
    "item4_transitDeepLinkTail": {
        "verdict": "pass (carried)",
        "standoffAtResolve": 1459, "standoffSpec": 1500,
        "holdMeasuredMs": 2581, "holdSpecMs": 2500,
        "k11DelayAfterAnchorMs": 774, "resolveQuantizeMs": 0,
        "scoreVariantAtResolve": "station-resolved", "scoreIntensityAtResolve": 0.44,
        "handbackAtBeatClock": 24.7, "transitBeatTimeout": 260, "timeoutRescues": 0,
    },
    "acceptanceCriteria": criteria,
    "criteriaTally": tally,
    "openDefects": open_defects,
    "frameDefectScan": {"scanned": frames.get("scanned"), "defective": frames.get("defective")},
    "overallStatus": "fail",
    "overallReading": (
        "The ch10-ask lane is now clean: three of three cold crossings complete honestly, 27.0-45.3 s of beat clock "
        "against a 320 s backstop, zero rescues and zero page errors, and the landfall leg holds 6.2-7.8 s across a "
        "combined post-fix sample of seven runs. Every transit anchor now resolves at all four registry variants with "
        "seam-of-light strictly before station-resolved. Two defects block a green stamp. The end-to-end movie lane "
        "never ignites the transit: entered from the flow the pilot is on foot at the relay, the autopilot's "
        "ch10-transit branch asserts nothing unless controlMode is already 'flight', and the beat clock ran to "
        "2,577.3 s against its 260 s backstop with no rescue (D-13). Marker-requiring rungs still publish before "
        "their handles resolve, and at mutation resolution the deep-link reboard case holds missing-marker for "
        "3.4 s (D-6)."
    ),
}

with open(os.path.join(RUN, "verification-report.json"), "w") as fh:
    json.dump(doc, fh, indent=1)
    fh.write("\n")
print("criteria tally:", tally)
print("low frames:", low_total, "high stills:", len(high_stills))
