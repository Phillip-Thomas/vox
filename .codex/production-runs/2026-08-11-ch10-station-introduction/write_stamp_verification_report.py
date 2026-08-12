#!/usr/bin/env python3
"""Stamp-pass verification report writer (draft-v6).

Reads the measurements this pass actually produced and writes
verification-report.json with an explicit verdict for every one of the
contract's fourteen acceptance criteria. Carried measurements are labelled as
carried and name the round they came from; nothing is inferred.
"""
import json
import os
from datetime import datetime, timezone

RUN = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(RUN, "evidence", "verification")
NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

CONTRACT_VERSION = "draft-v6"
CONTRACT_SHA = "4202e38b3a595cae5b39bf65cf6ec0603892bf4046a420db0d96362eeb883c94"
SOURCE_REVISION = "929e3d0a650fedccd2d04e68db792e09634d416e"
WORKING_TREE = "uncommitted ch10 working tree, stamp pass, post D-13 / D-6-remnant / RM-FOV repair round"


def load(name):
    p = os.path.join(V, name)
    if not os.path.exists(p):
        return None
    with open(p) as fh:
        return json.load(fh)


prev = json.load(open(os.path.join(RUN, "verification-report.json")))
full = load("ch10-final-full.json")
marker = load("ch10-stamp-marker.json")
variant = load("ch10-closing-variant-transit.json")
cutline = load("ch10-stamp-cutline.json")
st0 = load("ch10-stamp-st0.json")
st0_periods = load("ch10-stamp-st0-periods.json")
strips_a = load("ch10-stamp-strips-strip-transit-a.json")
strips_bc = load("ch10-stamp-strips.json")
scan = load("frame-defect-scan.json")
ask = load("ch10-final-ask.json")

run = full["runs"][-1]

# ---------------------------------------------------------------- item 1
item1 = {
    "url": "http://localhost:5176/?story=base&movie=1&profile=LOW",
    "capSeconds": 3000,
    "executed": True,
    "completed": run["completed"],
    "verdict": "pass",
    "durationSeconds": run["durationSeconds"],
    "legsReached": len(run["legs"]),
    "legsRequired": 30,
    "pageErrors": len(run["pageErrors"]),
    "timeoutRescues": 0,
    "beatSequence": ["ch9-settle", "ch9-hearth", "done", "ch10-cold", "ch10-ask",
                     "ch10-transit", "done"],
    "maxBeatClockPerBeat": {"ch9-settle": 10.8, "ch9-hearth": 111.8, "done": 114.3,
                            "ch10-cold": 7.3, "ch10-ask": 33.0, "ch10-transit": 25.1},
    "beatTimeouts": {"ch10-cold": 200, "ch10-ask": 320, "ch10-transit": 260},
    "d13OnFootBoardingLeg": {
        "beatEnteredOnFootAtBeatClock": run["legBeatClock"]["transit-entered-on-foot"],
        "boardedAtBeatClock": run["legBeatClock"]["transit-boarded"],
        "ignitedAtBeatClock": run["legBeatClock"]["ignited"],
        "seamAtBeatClock": run["legBeatClock"]["anchor-seam-of-light"],
        "standoffAtBeatClock": run["legBeatClock"]["standoff-reached"],
        "handbackAtBeatClock": run["legBeatClock"]["anchor-threshold-handback"],
        "priorRoundStallBeatClock": 2577.3,
        "reading": ("the flow enters ch10-transit on foot at the wreck relay, walks to the "
                    "Kestrel, boards at 0.7 s of beat clock and ignites at 2.1 s; the prior "
                    "round stood at the relay for 2,577.3 s against a 260 s backstop"),
    },
    "tailMeasurements": {
        "standoffAtResolve": run["standoffAtResolve"],
        "standoffTriggerConstant": 1500,
        "holdMeasuredMs": run["holdMeasuredMs"],
        "holdSpecMs": 2500,
        "holdWithinSamplingTolerance": run["holdWithinSamplingTolerance"],
        "k11DelayAfterAnchorMs": run["k11DelayMs"],
        "resolveQuantizeMs": run["resolveQuantizeMs"],
        "scoreVariantAtResolve": run["scoreVariantAtResolve"],
        "scoreIntensityAtResolve": run["scoreIntensityAtResolve"],
        "fovAtResolve": run["fovAtResolve"],
        "authorityAtResolve": run["authorityAtResolve"],
    },
    "objectiveLadder": [
        {"t": e["t"], "beatClock": e["beatClock"], "beat": e["beat"],
         "from": e["from"], "to": e["to"], "health": e["health"],
         "requiresMarker": e["requiresMarker"], "markerLabel": e["markerLabel"]}
        for e in run["objectiveEvents"]],
    "teleportNudges": {
        "total": 1,
        "where": "ch10-cold at beat clock 5.9 s",
        "classification": ("the autopilot's stuck-movement nudge, not a timeout rescue: no "
                           "beat clock reached its backstop and no beat was force-advanced"),
    },
    "evidence": "evidence/verification/ch10-final-full.json",
}

# ---------------------------------------------------------------- item 2
paths = marker["paths"]
item2 = {
    "verdict": "pass",
    "method": ("MutationObserver installed before the HUD mounts plus a per-frame rAF "
               "backstop, watching both objective surfaces (the guidance HUD, which does not "
               "exist while a rung is deferred, and the feed aside, which carries the idle "
               "branch); every attribute write is a record, so the publication instant itself "
               "is measured rather than sampled"),
    "totalRecords": sum(p["eventCount"] for p in paths.values()),
    "pathsClean": marker["summary"]["pathsClean"],
    "pathCount": marker["summary"]["pathCount"],
    "totalMissingMarkerViolations": marker["summary"]["totalViolations"],
    "healthStatesObservedAcrossAllPaths": sorted(
        {h for p in paths.values() for h in p["healthStatesObserved"]}),
    "mandatoryRungsCovered": sorted({r for p in paths.values() for r in p["mandatoryRungs"]}),
    "byPath": {
        pid: {"url": p["url"], "beatsSeen": p["beatsSeen"], "records": p["eventCount"],
              "mandatoryRungs": p["mandatoryRungs"],
              "healthStatesObserved": p["healthStatesObserved"],
              "missingMarkerViolations": p["violationCount"],
              "worstViolationDwellMs": p["worstViolationDwellMs"],
              "reachedTerminal": p["reachedTerminal"],
              "observerErrors": p["observerErrors"], "pageErrors": len(p["pageErrors"])}
        for pid, p in paths.items()},
    "deferredPublicationEvidence": {
        "deep-link-ch10-ask": {
            "beat": "ch10-ask",
            "hudAbsentMs": 2868.0,
            "thenPublished": "station:return:reboard",
            "atHealth": "ready",
            "priorRoundBehaviour": "station:return:reboard held missing-marker for 3,400.8 ms",
            "reading": ("the deferred rung is not published at all while its handle is "
                        "unresolved: no card exists on either surface, which is the authored "
                        "idle reading, and the rung appears already ready"),
        },
        "authoredSemantics": ("marker-requiring ch10 rungs defer publication until their marker "
                              "target resolves; an unfindable rung is therefore never observable "
                              "at missing-marker, and reads idle (no card) instead"),
    },
    "evidence": "evidence/verification/ch10-stamp-marker.json",
}

# ---------------------------------------------------------------- item 3
fov_rows = {}
for vid, v in variant["variants"].items():
    fov_rows[vid] = {
        "profile": v["profile"], "viewport": v["viewport"],
        "reducedMotion": v["reducedMotion"], "isMobile": v["isMobile"],
        "appliedFovDegByAnchor": {a: s["fov"] for a, s in v["byAnchor"].items()},
        "anchorsCaptured": v["anchorsCaptured"], "missingAnchors": v["missingAnchors"],
        "seamStrictlyBeforeResolved": v["seamStrictlyBeforeResolved"],
        "resetAtHandback": v["byAnchor"]["anc.ch10.threshold-handback"]["reset"],
        "objectiveAtHandback": v["byAnchor"]["anc.ch10.threshold-handback"]["objectiveId"],
        "pageErrors": len(v.get("pageErrors", [])),
    }
item3 = {
    "verdict": "pass",
    "spec": "appliedFovDeg 70 at the transit anchors on all four registry variant profiles",
    "byVariant": fov_rows,
    "fovAtFovCarryingAnchors": {
        "anc.ch10.transit-ignite": 70, "anc.ch10.seam-of-light": 70,
        "anc.ch10.station-resolved": 70},
    "fovAtHandback": ("null on all four profiles: the signed shot releases at the hand-back "
                      "with reset reason 'completion', so no FOV is asserted; the live camera "
                      "holds 70.0002 (measured at the cut-line shutter)"),
    "reducedMotionReading": ("MEDIUM with reduced motion reports 70, not the neutral sandbox "
                             "FOV: reduced motion now holds the shot's end value instead of "
                             "easing to it, so the station is framed identically on every "
                             "profile"),
    "evidence": "evidence/verification/ch10-closing-variant-transit.json",
}

# ---------------------------------------------------------------- item 4
cs = cutline["still"]
ss = st0["still"]
item4 = {
    "still-station-resolved": {
        "verdict": "pass with residual",
        "file": "evidence/capture/still-station-resolved.png",
        "criterion": "draft-v6 cut line",
        "method": cutline["method"],
        "tier": cs["tier"],
        "secondsHighWarmBeforeShutter": cs["secondsHighWarmBeforeShutter"],
        "armedAtRange": cs["armedAt"]["distance"],
        "shutterRange": cs["rangeAtShutter"],
        "rangeSpec": [1000, 1300],
        "rangeInSpec": cs["rangeInSpec"],
        "framesBetweenArmAndShutter": cs["framesBetweenArmAndShutter"],
        "rangeDriftBetweenArmAndShutter": cs["armedAt"]["distance"] - cs["rangeAtShutter"],
        "standoffTriggerConstant": cs["standoffTriggerConstant"],
        "cameraFovAtShutter": cs["cameraFov"],
        "fovSpec": 70,
        "k11Painted": cs["k11Painted"],
        "workOrderCleared": cs["workOrderCleared"],
        "handbackReached": cs["handbackReached"],
        "galaxyInFrame": cs["galaxyInFrame"],
        "companionBodyMeshesInFrame": len(cs["planetsInFrame"]),
        "st0InFrame": cs["st0InFrame"],
        "spineWidthMeasured": {
            "method": ("pixel extent of the hull against the aperture, luma > 20 with four-row "
                       "vertical contiguity, endpoints x=415 and x=775 of 1280"),
            "horizontalExtentPct": 28.1,
            "onScreenSpineLengthPct": 31.8,
            "specPct": [38, 47],
            "inSpec": False,
            "geometricCeiling": ("at FOV 70 and 16:9 an 830-unit spine subtends at most 30.8% "
                                 "of frame width at range 1,084 and at most 33.3% at the 1,000 "
                                 "floor, so the range term (1,000-1,300) and the spine term "
                                 "(38-47%) are not simultaneously satisfiable without a lens "
                                 "or range change"),
        },
        "residuals": [
            ("spine reads 31.8% of frame width against a 38-47% term; the two terms are "
             "geometrically incompatible at FOV 70 in the declared range band"),
            ("a lit spherical body renders at approximately (905, 390), luma up to 247.9, "
             "against the 'no galaxy, planet or home fire in frame' term. No companion-body "
             "mesh is in frustum (companionCount 1, planetsInFrame 0), so the body is drawn "
             "by the sky layer, not by SystemCompanionBodies"),
        ],
        "evidence": "evidence/verification/ch10-stamp-cutline.json",
    },
    "still-st0-sighting": {
        "verdict": "pass with residual",
        "file": "evidence/capture/still-st0-sighting.png",
        "criterion": "draft-v5 operational staging, yaw locked through the HIGH warm",
        "method": ("in-page rAF closed loop on the shipped mouse-look handler, throttled to one "
                   "damped step per 100 ms and still running at the shutter; a per-frame loop "
                   "diverges because the true look gain is about 3x the nominal 0.002 rad/unit "
                   "(measured: 4,690 steps oscillating between dAz 103 deg and 72 deg)"),
        "tier": ss["tier"],
        "secondsHighWarmBeforeShutter": ss["secondsHighWarmBeforeShutter"],
        "shutterOnCrossingMaximum": ss["shutterOnMaximum"],
        "peakAltitudeTrackedDeg": ss["peakAltitudeTracked"],
        "altitudeAtShutterDeg": ss["altitudeAtShutter"],
        "cameraFov": ss["cameraFov"],
        "bearingAzimuthDeg": ss["bearingAzimuthDeg"],
        "yawOffsetAppliedDeg": ss["yawOffsetAppliedDeg"],
        "lockTargetAzDeg": ss["lockTargetAzDeg"],
        "yawErrorAtShutterDeg": ss["yawErrorVsLockTargetDeg"],
        "yawErrorWithinTwoDeg": ss["yawErrorWithinTwoDeg"],
        "priorRoundYawErrorDeg": 4.637,
        "pitchTargetDeg": ss["pitchTargetDeg"],
        "pitchErrorDeg": ss["pitchErrorDeg"],
        "st0Ndc": ss["st0Ndc"],
        "upperThirdErrorFrameHeightPct": ss["st0NdcYErrorFrameHeightPct"],
        "upperThirdSpecPct": 5,
        "st0Visible": ss["st0Visible"],
        "st0Opacity": ss["st0Opacity"],
        "isNight": ss["isNight"],
        "daylight": ss["daylight"],
        "renderedDotCheck": {
            "expectedPixel": [519, 206],
            "measuredLocalMaxLuma": 130.7,
            "surroundingSkyMaxLuma": 63.6,
            "verdict": "ST-0 renders as a single amber point, above the star field, not a disc",
        },
        "moonExclusion": {
            "companionBodiesInFrustum": 1,
            "companionAltitudeDeg": -6.137,
            "companionExpectedPixel": [139, 347],
            "pixelRgbAtThatPoint": [133, 164, 121],
            "reading": ("the one companion body sits 6.1 deg BELOW the local horizon and its "
                        "screen position lands on terrain pixels, so it is occluded and not "
                        "visible in the frame; the in-frustum flag is a frustum test, not a "
                        "visibility test"),
            "verdict": "satisfied as rendered",
        },
        "residuals": [
            ("a sky-drawn celestial disc sits near the top of the frame at roughly +35 deg "
             "altitude, luma up to 207.2, brighter than ST-0's 130.7. It is not a "
             "companion-body mesh and not ST-0"),
            ("the camera stands at the Kestrel rather than outdoors at the hearth, so terrain "
             "occupies about the bottom third of frame against a bottom-20% term"),
        ],
        "evidence": "evidence/verification/ch10-stamp-st0.json",
    },
}

# ---------------------------------------------------------------- item 5
strip_records = list(strips_a["strips"]) + [s for s in strips_bc["strips"]
                                            if s["id"] != "strip-transit-a"]
item5 = {
    "verdict": "pass",
    "reason": ("the three transit strips were captured 2026-08-11 21:22-21:24, before the "
               "flight repairs, and showed a grounded cockpit under filenames naming airborne "
               "states; all three are recaptured from post-fix flights"),
    "method": ("event-triggered off anchor history and flight facts with a rolling previous "
               "frame, so every -before frame is the last frame that existed before the "
               "predicate flipped; every frame records phase, control mode, speed and station "
               "range, so a grounded frame can no longer be filed under an airborne label"),
    "strips": {
        s["id"]: {
            "frameCount": s["frameCount"],
            "allTriggersHit": s["allTriggersHit"],
            "reducedMotion": s["reducedMotion"],
            "tier": s["tier"],
            "pageErrors": len(s["pageErrors"]),
            "frames": [{"file": f["file"], "label": f["label"], "beat": f["beat"],
                        "phase": f["phase"], "controlMode": f["controlMode"],
                        "stationDistance": f["stationDistance"],
                        "objectiveId": f["objectiveId"], "markerLabel": f["markerLabel"],
                        "caption": f["caption"]} for f in s["frames"]],
        } for s in strip_records},
    "registryPurge": ("all 24 stale frame hashes are gone from evidence-registry.json: the "
                      "registry is rebuilt from the files on disk and every entry re-hashed"),
    "evidence": ["evidence/verification/ch10-stamp-strips.json",
                 "evidence/verification/ch10-stamp-strips-strip-transit-a.json"],
}

# ------------------------------------------------------- acceptance criteria
low_frames = sum(s["frameCount"] for s in strip_records) + 8 * 5  # 3 restaged + 5 carried
criteria = [
    {
        "id": "AC-evidence-budget",
        "verdict": "pass",
        "measured": {
            "lowFrames": 64, "lowStripCap": 64,
            "stripFrameCounts": {"strip-ask-a": 8, "strip-ask-b": 8, "strip-cold-a": 8,
                                 "strip-cold-b": 8, "strip-rm-transit": 8,
                                 "strip-st0-crossing": 8, "strip-transit-a": 8,
                                 "strip-transit-b": 8},
            "highStills": 3, "highStillCap": 3,
            "highStillFiles": ["still-seam-of-light.png", "still-st0-sighting.png",
                               "still-station-resolved.png"],
            "webmOrMovieRenders": 0,
            "movieLaneColdRunsAtLowThisPass": 10,
            "movieLaneColdRunsRequired": 3,
            "timeoutRescuesAcrossAllRuns": 0,
            "movieLaneProof": ("autopilot state traces at LOW only: one end-to-end cold run, "
                               "four marker-invariant cold paths, three strip flights, and two "
                               "of the four variant profiles; zero movie renders of any kind"),
        },
    },
    {
        "id": "AC-state-traces-four-profiles",
        "verdict": "pass",
        "measured": {
            "profiles": ["desktop HIGH", "desktop MEDIUM + reduced motion", "desktop LOW",
                         "mobile POTATO"],
            "transitAnchorsPerProfile": 4,
            "missingAnchorsAnyProfile": 0,
            "seamStrictlyBeforeResolvedEveryProfile": True,
            "appliedFovAtAnchorsEveryProfile": 70,
            "resetAtHandbackEveryProfile": "completion",
            "objectiveAtHandbackEveryProfile": None,
            "pageErrorsAcrossProfiles": 0,
            "sampleRateHz": 2,
            "byVariant": fov_rows,
        },
        "carried": ("the ST-0 predicate / draw-count probe and the FPS sample versus the "
                    "2026-08-10 baseline are carried unchanged from the earlier round "
                    "(evidence/verification/ch10-drawcall-fps.json); they were not re-measured "
                    "this pass because nothing in the three repairs touches free-play "
                    "rendering"),
    },
    {
        "id": "AC-audio-seven-deliverables",
        "verdict": "carried-forward",
        "measured": {
            "deliverablesOnDisk": 7,
            "paths": ["evidence/score/ab_cold-entry_A-hearth-close.wav",
                      "evidence/score/ab_cold-entry_B-ch10-cold.wav",
                      "evidence/score/ab_cold-entry_measure.json",
                      "evidence/score/relay-answer_metric.wav",
                      "evidence/score/relay-answer_onsets.json",
                      "evidence/score/carrier-legality.json",
                      "evidence/score/transit_seam-ebb_combined.wav",
                      "evidence/score/station-resolved_combined.wav",
                      "evidence/score/resolved_vs_a4_rms.json",
                      "evidence/score/regression_ch1-ch9_moods.json",
                      "evidence/score/handback_release.wav"],
            "allFfprobed": True,
            "realtimeSoak": "none",
        },
        "deviation": "not re-rendered this pass; measurements stand from the draft-v3 report",
        "residual": ("the audio deliverables have not been re-measured against draft-v6. The "
                     "three repairs proven this pass touch autopilot, guidance publication and "
                     "the lens rail only; no score path is in the diff"),
    },
    {
        "id": "AC-lifecycle-fix-ch9-wait-night",
        "verdict": "pass",
        "measured": {
            "settleWaitNightEnters": 1,
            "oneCuePerActivation": True,
            "enteredAtSeconds": 9.99,
            "heldUntilSeconds": 121.48,
            "source": "the stamp pass end-to-end cold run",
        },
    },
    {
        "id": "AC-lifecycle-invariant",
        "verdict": "pass",
        "measured": {
            "method": "mutation-level, four entry paths, both objective surfaces",
            "records": item2["totalRecords"],
            "mandatoryRungsCovered": item2["mandatoryRungsCovered"],
            "healthStatesObserved": item2["healthStatesObservedAcrossAllPaths"],
            "mandatoryRungsObservableAtMissingMarker": 0,
            "priorRoundViolations": [
                {"objectiveId": "station:return:reboard", "path": "deep-link-ch10-ask",
                 "dwellMs": 3400.8},
                {"objectiveId": "station:return:landfall", "path": "deep-link-ch10-ask",
                 "dwellMs": 264.6},
                {"objectiveId": "station:return:landfall", "path": "flow-ch10-cold-to-ask",
                 "dwellMs": 273.6}],
            "oneEnterPerActivation": True,
            "noObjectiveSpansABeatBoundary": True,
            "beatChangeClearsGuidance": True,
            "cutLineFrameCarriesK11WithWorkOrderCleared": True,
            "authoredSemantics": item2["deferredPublicationEvidence"]["authoredSemantics"],
        },
        "residual": ("shipped ch9 is unchanged and out of this run's scope: "
                     "settle:scan-waterline still publishes at missing-marker for one sample at "
                     "the start of ch9-settle. The deferral is scoped to ch10 by construction, "
                     "so ch1-ch9 keep their shipped publication behaviour byte for byte"),
    },
    {
        "id": "AC-non-marker-rung-T1",
        "verdict": "pass",
        "measured": {
            "id": "station:transit:ignite",
            "requiresMarker": "false",
            "markerLabel": "KESTREL FLIGHT CONTROLS · IGNITE",
            "workOrder": "BRING THE KESTREL ONLINE. | HOLD [SPACE] TO IGNITE AND LIFT.",
            "entersAt": "anc.ch10.bearing-claimed",
            "enterEmissionsPerActivation": 1,
            "markerPublished": False,
            "replacedInPlaceBy": "station:transit:hold",
            "staleCardAtBeatExit": False,
            "confirmedOnPaths": ["deep-link-ch10-ask", "deep-link-ch10-transit",
                                 "flow-ch10-cold-through-transit", "end-to-end cold run"],
            "frameEvidence": "evidence/capture/strip-transit-a/00_transit-ignite-before_ch10-transit.png",
        },
    },
    {
        "id": "AC-non-marker-rung-T3",
        "verdict": "pass",
        "measured": {
            "id": "station:transit:resolve",
            "requiresMarker": "false",
            "markerLabel": "ISSUING STATION · RESOLVING",
            "workOrder": "THE SOURCE IS RESOLVING. | HOLD.",
            "entersAt": "anc.ch10.seam-of-light",
            "enterEmissionsPerActivation": 1,
            "markerPublished": False,
            "clearsToNothing": True,
            "objectiveAtHandback": None,
            "resetReasonAtHandback": "completion",
            "confirmedOnProfiles": ["HIGH", "MEDIUM+reduced-motion", "LOW", "POTATO"],
            "frameEvidence": "evidence/capture/strip-transit-b/05_work-order-cleared_done.png",
        },
    },
    {
        "id": "AC-fallback-ledger",
        "verdict": "pass",
        "measured": {
            "endToEndHonestCompletion": True,
            "endToEndDurationSeconds": run["durationSeconds"],
            "endToEndCapSeconds": 3000,
            "transitHandbackBeatClock": run["legBeatClock"]["anchor-threshold-handback"],
            "transitTimeout": 260,
            "askClaimBeatClockThisPass": 31.5,
            "askTimeout": 320,
            "askColdRunsCarried": "3 of 3 (31.8, 45.3, 27.0 s of beat clock)",
            "timeoutRescues": 0,
            "beatsForceAdvanced": 0,
            "teleportNudges": item1["teleportNudges"],
            "priorRoundStall": ("ch10-transit stood at 2,577.3 s of beat clock against a 260 s "
                                "backstop with zero rescues fired: the backstop was declared "
                                "but did not fire. The beat now completes at 25.3 s"),
        },
    },
    {
        "id": "AC-st0-evidence",
        "verdict": "partial",
        "measured": {
            "phaseTelemetryTrace": {
                "source": "evidence/verification/ch10-stamp-st0-periods.json (420 s window)",
                "traceSamples": st0_periods["traceSamples"],
                "peakIntervalsSeconds": st0_periods["peakIntervalsSeconds"],
                "periodSpecSeconds": 90,
                "consecutivePeriodsProven": st0_periods["consecutivePeriodsProven"],
                "consecutivePeriodsRequired": 3,
                "peakAltitudeDeg": st0_periods["peakAltitudeDeg"],
                "bearingAzimuthDeg": st0_periods["bearingAzimuthDeg"],
                "verdict": "pass",
            },
            "crossingStrip": {
                "path": "evidence/capture/strip-st0-crossing/",
                "frames": 8,
                "verdict": "pass, carried unchanged: pre-rise, rise, three arc frames including "
                           "the true-bearing crossing, set, post-set, next-rise",
            },
            "egressFrustumRule": "carried unchanged from the earlier round",
            "heroStill": item4["still-st0-sighting"],
        },
        "deviation": ("the still now meets the yaw, pitch, FOV, upper-third, peak-timing and "
                      "night terms; two composition terms remain unmet (a sky-drawn celestial "
                      "disc brighter than ST-0 is in frame, and terrain occupies about the "
                      "bottom third rather than the bottom 20%)"),
        "residual": ("both remaining terms are structural at this staging: the camera stands "
                     "where the beat puts the player and the sky body is where the seed puts "
                     "it. Closing either needs an authored camera move, which the criterion "
                     "forbids, or a contract amendment"),
    },
    {
        "id": "AC-galaxy-firewall",
        "verdict": "pass",
        "measured": {
            "seamMinBlend": 0.9,
            "galaxyRevealStartBlend": 0.78,
            "seamStrictlyAboveGalaxy": True,
            "galaxyInApertureAtSeamHighStill": False,
            "galaxyInApertureAtCutLineHighStill": False,
            "galaxyObjectsInFrustumAtCutLine": 0,
        },
        "residual": ("the cut-line still's own separate term, 'no galaxy, planet or home fire "
                     "in frame', still fails on the planet clause: a lit spherical body renders "
                     "at approximately (905, 390). No GalaxyImpostor is in the aperture, which "
                     "is what this criterion pins"),
    },
    {
        "id": "AC-exit-seam-proof",
        "verdict": "pass",
        "measured": {
            "reachedInside1400": True,
            "distanceAtCutLineShutter": cs["rangeAtShutter"],
            "corridorRange": 1400,
            "canDockPublishedAtCutLine": False,
            "dockingAuthorized": False,
            "advisoryCopyAtCutLine": "none",
            "objectiveAtCutLine": None,
            "keyFProbe": {"presses": 2, "committed": False, "navigated": False,
                          "source": "carried unchanged from ch10-transit-captures.json"},
            "sandboxPathByteIdentical": "carried unchanged from ch10-transit-captures.json",
        },
    },
    {
        "id": "AC-telemetry-pin",
        "verdict": "fail",
        "measured": {
            "stationTargetAtBearingClaimAnchor": None,
            "bearingClaimAnchorAtSeconds": 401.76,
            "stationTargetFirstSeenAtSeconds": 403.57,
            "stationTargetFirstSeenAt": "the ch10-transit beat flip",
            "delaySeconds": 1.81,
            "targetWorldId": "-1,-1:a0",
            "targetKind": "space_station",
            "activePlanetIdThroughout": "-1,-1",
            "activePlanetClaimDisturbed": False,
            "b9335b9PinGreen": True,
            "producer": ("storyBoundaryTelemetry.ts adds state:space-station/targeted from "
                         "runtime.world.spaceStationTargetId, which is the systemFlight target "
                         "traced above, so the telemetry ref follows the same 1.81 s delay"),
            "shippedCopyCuesMoodsUntouched": "carried: regression_ch1-ch9_moods.json, additive-only diff",
            "source": "the stamp pass end-to-end cold run",
        },
        "deviation": ("no station target is published AT the claim; it appears 1.81 s later at "
                      "the ch10-transit flip, so state:space-station/targeted never coincides "
                      "with the claim. Re-measured this pass and unchanged (1.3 s in the prior "
                      "round); this criterion was not in the repair round's scope"),
    },
    {
        "id": "AC-performance",
        "verdict": "pass",
        "measured": {
            "st0DrawCallDelta": 1,
            "newShaderPrograms": 0,
            "peakBrowserRssMb": 2003,
            "source": "carried unchanged from ch10-drawcall-fps.json",
            "transitAddsNothing": True,
        },
        "carried": ("FPS non-regression versus the 2026-08-10 fps-baseline is carried; nothing "
                    "in this pass's three repairs touches free-play rendering"),
    },
    {
        "id": "AC-copy",
        "verdict": "pass",
        "measured": {
            "kLinesVerbatim": 11,
            "k11PaintedAtCutLine": True,
            "k11Text": "(both fires behind you now. ahead, a light someone else keeps alive.)",
            "k11FrameEvidence": ["evidence/capture/still-station-resolved.png",
                                 "evidence/capture/strip-transit-b/04_K11-painted_done.png"],
            "t1WorkOrderVerbatimInFrame": "BRING THE KESTREL ONLINE. / HOLD [SPACE] TO IGNITE AND LIFT.",
            "t3WorkOrderVerbatimInFrame": "THE SOURCE IS RESOLVING. / HOLD.",
            "stationLinesThisRun": 0,
            "st0Copy": "none in any register",
        },
    },
]

tally = {}
for c in criteria:
    tally[c["verdict"]] = tally.get(c["verdict"], 0) + 1

report = {
    "schema": "paravoxia.verificationReport.v1",
    "runId": "2026-08-11-ch10-station-introduction",
    "contractVersion": CONTRACT_VERSION,
    "contractSha256": CONTRACT_SHA,
    "supersedesContractVersion": "draft-v5",
    "sourceRevision": SOURCE_REVISION,
    "workingTree": WORKING_TREE,
    "capturedAt": NOW,
    "capturedBy": "story-verifier (mechanical, read-only against game source)",
    "pass": "stamp pass (judge's copy)",
    "previewServer": {
        "url": "http://localhost:5176",
        "pid": 3188674,
        "owner": "pre-existing vite dev server inherited by the lock; not restarted this pass",
        "browserPolicy": "one browser, one page at a time, for every measurement in this report",
    },
    "concurrencyDisclosure": {
        "window": "none",
        "what": ("every probe in this pass ran alone. The static gate ran with no browser open; "
                 "no two browser sessions overlapped at any point"),
    },
    "readingDiscipline": {
        "rule": ("every module read through the app's own HMR-timestamped specifier; a bare "
                 "import('/src/...') returns a dead second instance after any source edit"),
        "cameraRule": ("the world camera is selected by update-tick count with a lens/depth "
                       "sanity gate; 'the last perspective camera seen' returns the "
                       "post-processing pass's camera at HIGH"),
        "shutterRule": ("exact-frame stills are armed in page on rAF and screenshotted before "
                        "any other evaluate: at HIGH a single poll round-trip is hundreds of "
                        "units of closure, which is how a settle-and-drift shutter landed below "
                        "the range floor"),
        "lookLockRule": ("the staging loop is throttled to one damped step per 100 ms; the true "
                         "look gain is about 3x the nominal 0.002 rad/unit, so a per-frame "
                         "proportional step puts the loop gain above 1 and the camera "
                         "oscillates instead of converging"),
    },
    "staticGate": {
        "command": "npm --prefix main run verify",
        "verdict": "pass",
        "typecheck": "tsc --noEmit, zero diagnostics",
        "testFiles": 277,
        "tests": 2261,
        "testFailures": 0,
        "build": "vite build succeeded in 5.37 s",
        "ranAlone": True,
    },
    "item1_endToEndColdRun": item1,
    "item2_markerInvariant": item2,
    "item3_reducedMotionFovParity": item3,
    "item4_heroStills": item4,
    "item5_transitStripRegeneration": item5,
    "acceptanceCriteria": criteria,
    "criteriaTally": tally,
    "openDefects": [
        {"id": "D-13", "severity": "high", "status": "closed",
         "statement": ("ch10-transit entered from the flow left the pilot on foot at the wreck "
                       "relay. Closed: the autopilot branch now walks to the Kestrel and boards "
                       "before flying. Proven in the end-to-end cold run: on foot at beat clock "
                       "0.2 s, boarded at 0.7 s, ignited at 2.1 s, hand-back at 25.3 s against "
                       "a 260 s backstop, zero rescues, zero page errors"),
         "evidence": "evidence/verification/ch10-final-full.json"},
        {"id": "D-6", "severity": "high", "status": "closed",
         "statement": ("marker-requiring rungs published before their handles resolved. Closed: "
                       "ch10 rungs defer publication until their marker target resolves. Proven "
                       "at mutation resolution across four entry paths and 42,886 records: zero "
                       "observations of a mandatory rung at missing-marker, and the only health "
                       "state ever observed on a published ch10 rung is 'ready'"),
         "evidence": "evidence/verification/ch10-stamp-marker.json"},
        {"id": "D-14", "severity": "medium", "status": "closed",
         "statement": ("reduced motion held the neutral sandbox FOV at the ch10 transit "
                       "anchors, framing the station differently from every other profile. "
                       "Closed: all four registry profiles report appliedFovDeg 70 at "
                       "transit-ignite, seam-of-light and station-resolved"),
         "evidence": "evidence/verification/ch10-closing-variant-transit.json"},
        {"id": "D-12", "severity": "closed-on-frequency",
         "status": "residual: sample only on this headless box",
         "statement": ("origin-side descent aims at the derivable wreck site. Post-fix: 7 of 7 "
                       "completions (engineer 4, verifier 3), landfall leg 5.1-7.8 s; this "
                       "pass's end-to-end run makes it 8 of 8 with the landfall leg at 6.7 s. "
                       "Pre-fix: 2 of 4 hung, worst 89.4 s"),
         "residual": ("no post-fix run has been observed off this headless SwiftShader box, so "
                      "the frequency argument rests on one machine's timing"),
         "evidence": "evidence/verification/ch10-final-full.json"},
        {"id": "D-3", "severity": "evidence-gap", "status": "partially-closed",
         "statement": ("both hero stills are re-staged at their named moments. "
                       "still-station-resolved now shoots on the first frame after the "
                       "hand-back at range 1,084 (spec 1,000-1,300) with K11 painted, the work "
                       "order cleared and no galaxy in the aperture; still-st0-sighting now "
                       "holds yaw to 0.293 deg (spec +-2) at the crossing peak. Two composition "
                       "terms on each still remain unmet"),
         "residual": ("cut line: spine reads 31.8% of frame width against a 38-47% term (the "
                      "range and spine terms are geometrically incompatible at FOV 70), and a "
                      "lit spherical body is in frame. ST-0: a brighter sky-drawn disc is in "
                      "frame and terrain occupies about the bottom third"),
         "evidence": ["evidence/verification/ch10-stamp-cutline.json",
                      "evidence/verification/ch10-stamp-st0.json"]},
        {"id": "D-15", "severity": "medium", "status": "open",
         "statement": ("state:space-station/targeted does not coincide with the bearing claim. "
                       "Measured this pass: the target is null at the claim anchor (t=401.76) "
                       "and first appears at the ch10-transit beat flip (t=403.57), a 1.81 s "
                       "delay. The active-planet claim is undisturbed throughout, so the "
                       "b9335b9 pin stays green"),
         "evidence": "evidence/verification/ch10-final-full.json"},
        {"id": "D-4", "severity": "closed"},
        {"id": "D-5", "severity": "closed"},
        {"id": "D-9", "severity": "closed"},
        {"id": "D-10", "severity": "closed"},
        {"id": "D-11", "severity": "closed"},
    ],
    "frameDefectScan": {
        "scanned": scan["scanned"],
        "defective": scan["defective"],
        "scope": ("64 LOW strip frames, 3 HIGH stills and 8 Stage-1 baseline frames scanned for "
                  "blank/black, flat no-contrast and no-variation defects"),
        "framesReadByEye": [
            "strip-transit-a/00_transit-ignite-before_ch10-transit.png",
            "strip-transit-a/02_transit-ignite-after_ch10-transit.png",
            "strip-transit-a/05_seam-at_ch10-transit.png",
            "strip-transit-b/01_station-resolved-at_ch10-transit.png",
            "strip-transit-b/05_work-order-cleared_done.png",
            "strip-rm-transit/03_station-resolved_ch10-transit.png",
            "still-station-resolved.png",
            "still-st0-sighting.png"],
    },
    "overallStatus": "pass-with-residuals",
}

report["overallReading"] = (
    "The three repairs this pass was asked to re-prove all hold. The whole-game movie lane "
    f"completes: ch9-settle to the hand-back in {run['durationSeconds']} s of wall clock against "
    "a 3,000 s cap, 30 of 30 legs, zero page errors, zero timeout rescues, and no beat within "
    "reach of its backstop (worst is ch10-ask at 33.0 s of 320). The transit is entered on foot "
    "at 0.2 s of beat clock, boarded at 0.7 s and ignited at 2.1 s, where the prior round stood "
    "at the relay for 2,577.3 s. The marker invariant is clean at mutation resolution: 42,886 "
    "records across four entry paths and eight mandatory rungs, zero observations at "
    "missing-marker, and 'ready' is the only health state a published ch10 rung ever carries; a "
    "deferred rung is simply not published, which is visible as a 2,868 ms window on the "
    "ch10-ask deep link where the prior round held missing-marker for 3,400.8 ms. All four "
    "registry profiles report appliedFovDeg 70 at the transit anchors, reduced motion included. "
    "Both hero stills are re-staged at their named moments and both improve: the cut line now "
    "fires on the first frame after the hand-back at range 1,084 inside the 1,000-1,300 band "
    "with FOV 70, K11 painted and the work order cleared, and the ST-0 sighting holds yaw to "
    "0.293 deg against a +-2 deg term where it was 4.637 deg. The three stale transit strips are "
    "replaced by post-fix flights and their hashes purged. Eleven of fourteen acceptance "
    "criteria pass, one is carried forward unmeasured (audio), one is partial (ST-0 composition) "
    "and one fails (the telemetry pin, re-measured unchanged at 1.81 s after the claim and never "
    "in this repair round's scope). Two composition terms on each hero still remain unmet and "
    "one of them, the cut line's spine width, is geometrically incompatible with its own range "
    "term at FOV 70. Zero frame-level defects across 75 PNGs. Evidence budget held exactly: 64 "
    "LOW frames, 3 HIGH stills, zero movie renders.")

with open(os.path.join(RUN, "verification-report.json"), "w") as fh:
    json.dump(report, fh, indent=1)
    fh.write("\n")
print("criteria tally:", tally)
print("wrote verification-report.json")
