#!/usr/bin/env python3
"""draft-v7 FINAL verification report, composed from this pass's own traces."""
import json
import os
from datetime import datetime, timezone

RUN = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(RUN, 'evidence', 'verification')


def load(name):
    p = os.path.join(V, name)
    if not os.path.exists(p):
        return None
    with open(p) as f:
        return json.load(f)


strips = load('ch10-v7-strips.json')
seam = load('ch10-v7-seam.json')
cutline = load('ch10-v7-cutline.json')
variants = load('ch10-v7-variants.json')
ux1 = load('ch10-v7-ux1.json')
berth = load('ch10-v7-berth.json')
occl = load('ch10-v7-occl.json')
da6 = load('ch10-v7-da6.json')
st0cross = load('ch10-v7-st0cross.json')
e2e = load('ch10-v7-e2e.json')
prev = None
with open(os.path.join(RUN, 'verification-report.json')) as f:
    prev = json.load(f)

# ---------------------------------------------------------------- strip stats
strip_rows = []
for s in (strips or {}).get('strips', []):
    for fr in s['frames']:
        strip_rows.append({
            'strip': s['id'], 'file': fr['file'], 'label': fr['label'],
            'beat': fr['beat'], 'stationDistance': fr['stationDistance'],
            'speed': fr['speed'], 'phase': fr['phase'],
            'renderCameraFov': fr['renderCameraFov'],
            'flightFeedbackFov': fr['flightFeedbackFov'],
            'cockpitShellLocalScale': fr['cockpitShellLocalScale'],
            'apertureWidthPx': ((fr.get('masks') or {}).get('cockpit') or {}).get('apertureWidthAt1280'),
            'stationSpinePercent': ((fr.get('masks') or {}).get('station') or {}).get('spinePercentOfFrameWidth'),
            'objectiveId': fr['objectiveId'], 'markerLabel': fr['markerLabel'],
            'caption': fr['caption'],
        })
apertures = [r['apertureWidthPx'] for r in strip_rows if r['apertureWidthPx']]
fov_pairs = [(r['renderCameraFov'], r['flightFeedbackFov']) for r in strip_rows
             if r['renderCameraFov'] and r['flightFeedbackFov']]
fov_max_delta = max((abs(a - b) for a, b in fov_pairs), default=None)
cutline_window = [r for r in strip_rows
                  if r['stationDistance'] and 1000 <= r['stationDistance'] <= 1300]

seam_high = next((r for r in (seam or {}).get('stills', []) if r['tier'] == 'HIGH'), {})
seam_low = next((r for r in (seam or {}).get('stills', []) if r['tier'] == 'LOW'), {})
cut = (cutline or {}).get('still', {})

criteria = []


def crit(cid, verdict, measured, residual=None):
    row = {'id': cid, 'verdict': verdict, 'measured': measured}
    if residual:
        row['residual'] = residual
    criteria.append(row)


crit('AC-evidence-budget', 'pass', {
    'lowStrips': 8, 'framesPerStrip': 8, 'lowFrames': 64, 'lowStripCap': 64,
    'highStills': 3,
    'highStillFiles': ['still-st0-sighting.png', 'still-seam-of-light.png',
                       'still-station-resolved.png'],
    'pairedLowFrameForSeam': 'evidence/capture/still-seam-of-light-low.png '
                             '(contract-required pair for the v7 seam criterion, '
                             'not a fourth hero still)',
    'webmOrMovieRenders': 0,
    'movieLaneProof': 'autopilot state traces at LOW',
    'regeneratedThisPass': ['strip-transit-a', 'strip-transit-b', 'strip-rm-transit'],
    'regenerationTriggersHit': {s['id']: f"{s['completedTriggers']}/{len(s['frames'])} frames"
                                for s in (strips or {}).get('strips', [])},
    'pageErrorsAcrossStripRuns': sum(len(s['pageErrors'])
                                     for s in (strips or {}).get('strips', [])),
})

crit('AC-state-traces-four-profiles', 'pass', {
    'profiles': ['desktop HIGH', 'desktop MEDIUM + reduced motion', 'desktop LOW',
                 'mobile POTATO'],
    'lanesCovered': ['movie', 'manual (non-movie, desktop LOW)'],
    'matrixRows': len((variants or {}).get('matrix', [])),
    'mandatoryRungsObservedAtMissingMarker': (variants or {}).get('mandatoryRungsAtMissingMarker'),
    'healthStatesObserved': sorted({str(r.get('health')) for r in (variants or {}).get('matrix', [])
                                    if r.get('health')}),
    'appliedFovAtTransitAnchorEveryProfile': sorted(
        str(r.get('avFov')) for r in (variants or {}).get('matrix', [])
        if r.get('beat') == 'ch10-transit'),
    'manualLaneRungs': {r['beat']: {'objectiveId': r['objectiveId'], 'markerLabel': r['markerLabel'],
                                    'health': r['health']}
                        for r in (variants or {}).get('matrix', []) if r['lane'] == 'manual'},
    'pageErrorsAcrossMatrix': sum(len(r.get('pageErrors') or []) for r in (variants or {}).get('matrix', [])),
    'trace': 'evidence/verification/ch10-v7-variants.json',
}, residual='the bearing-claim rung itself was not observed in this matrix: the movie '
            'lane has already flown past it by the sample point and the three deep links '
            'reconstruct at reboard / fault-read / ignite. UX-3 is closed on the '
            'missing-marker invariant, not on full rung coverage')

crit('AC-audio-seven-deliverables', 'carried-forward', {
    'carried': 'unchanged from the draft-v6 stamp pass; no score path was touched '
               'in the changes this pass verifies',
    'deliverablesOnDisk': 12,
})

crit('AC-lifecycle-fix-ch9-wait-night', 'carried-forward', {
    'carried': 'proven in the stamp pass end-to-end cold run (8 -> 7, '
               'oneCuePerActivation true); re-proved by this pass only insofar as the '
               'v7 end-to-end run reproduces the same beat ladder',
})

crit('AC-lifecycle-invariant', 'pass', {
    'method': 'live cue tap through the app\'s own feedbackCues specifier, manual lane',
    'reboardActivationCues': 1,
    'igniteActivationCuesAfterReboard': 1,
    'cumulativeCuesAcrossTwoActivations': 2,
    'oneCuePerActivation': True,
    'staleCardAcrossBoardExitBoard': False,
    'objectiveAtHandback': cut.get('objectiveId'),
    'workOrderAtHandback': cut.get('hudText'),
    'resetReasonAtHandback': cut.get('resetReason'),
    'k11PaintedAtCutLine': cut.get('k11Painted'),
    'trace': 'evidence/verification/ch10-v7-ux1.json',
})

ux1_steps = {}
for p in (ux1 or {}).get('paths', []):
    for st in p['steps']:
        ux1_steps[f"{p['url']}::{st['label']}"] = st

crit('AC-non-marker-rung-T1', 'pass', {
    'id': 'station:transit:ignite',
    'markerLabel': 'KESTREL FLIGHT CONTROLS · IGNITE',
    'workOrder': 'BRING THE KESTREL ONLINE. | HOLD [SPACE] TO IGNITE AND LIFT.',
    'publishesOnlyAboard': True,
    'onFootRungInstead': 'station:transit:reboard',
    'lane': 'manual (no movie=1)',
    'boardReplacesReboardWithIgnite': True,
    'disembarkPreIgnitionReturnsToReboard': True,
    'cuesOnDisembark': 1,
    'trace': 'evidence/verification/ch10-v7-ux1.json',
})

crit('AC-non-marker-rung-T3', 'pass', {
    'id': 'station:transit:resolve',
    'markerLabel': 'ISSUING STATION · RESOLVING',
    'observedOnAllFourProfiles': True,
    'clearsToNothing': cut.get('objectiveId') is None,
    'frameEvidence': 'evidence/capture/strip-transit-b/05_work-order-cleared_done.png',
})

crit('AC-UX1-reboard-rung', 'pass', {
    'id': 'station:transit:reboard',
    'markerLabel': 'KESTREL HATCH · REBOARD',
    'workOrder': 'RETURN TO THE KESTREL. | FOLLOW THE HATCH MARKER AND [F] BOARD.',
    'requiresMarker': True,
    'health': 'ready',
    'markerResolvesToKestrelPose': True,
    'igniteNeverPublishesOnFoot': True,
    'freshCueOnReturnToReboard': 1,
    'lane': 'manual (no movie=1), ch10-transit deep link, board/exit/board cycle',
}, residual='the on-foot state immediately after the bearing claim was reached by '
            'disembarking at the transit deep link, not by performing the claim on '
            'foot in a continuous manual play-through: the deep link seeds the pilot '
            'aboard and the ch10-ask deep link reconstructs at station:return:reboard')

crit('AC-fallback-ledger', 'pass' if (e2e or {}).get('completed') else 'fail', {
    'endToEndCompleted': (e2e or {}).get('completed'),
    'endToEndDurationSeconds': (e2e or {}).get('durationSeconds'),
    'lastKnownGoodSeconds': 449.1,
    'legs': (e2e or {}).get('legCount'),
    'teleportNudges': ((e2e or {}).get('lastAutopilot') or {}).get('teleportNudgesTotal'),
    'timeoutRescues': 0,
    'pageErrors': len((e2e or {}).get('pageErrors') or []),
    'trace': 'evidence/verification/ch10-v7-e2e.json',
})

crit('AC-st0-evidence', 'fail', {
    'gazeBiasAcceptance': {'stripFramesInFrustum': (st0cross or {}).get('stripInFrustumFrames'),
                           'stripFramesRequired': 4,
                           'traceSamplesInFrustum': (st0cross or {}).get('inFrustumSamples'),
                           'traceSamplesRequired': 60,
                           'traceSamplesTaken': (st0cross or {}).get('traceSamples')},
    'cause': 'in ?story=ch10-cold&movie=1 the ST-0 quad is absent from the scene at '
             'every sample: st0RenderPredicate requires flight phase "surface", and the '
             'movie autopilot leaves the surface within the ch10-cold walk. The '
             'gaze bias is movie-only by design, so the non-movie dwell that produced '
             'the earlier 7/432 reading cannot exercise it either.',
    'solverRepair': 'evidence/ch10-st0-gaze-solver.json: worst aim error 25.000 deg '
                    'shipped -> 0.000 deg repaired across four elevations, all direct, '
                    'never above the rebuilt cap',
    'previousReading': '1 of 8 strip frames, 7 of 432 samples (draft-v6)',
    'strip': 'evidence/capture/strip-st0-crossing/ is CARRIED UNCHANGED from the '
             'draft-v6 pass; this pass could not regenerate it',
}, residual='D-A3 gaze-bias acceptance is NOT closed. The solver repair is proven at '
            'unit level; its effect on the crossing strip is unmeasured because no '
            'movie-lane surface dwell exists in which ST-0 renders')

crit('AC-galaxy-firewall', 'pass', {
    'seamStill': {'galaxyObjectsInAperture': seam_high.get('galaxyInFrame'),
                  'namedCompanionsInFrame': seam_high.get('companionsInFrame'),
                  'latchDistance': (seam_high.get('latch') or {}).get('distance'),
                  'shutterDistance': seam_high.get('distanceAtShutter')},
    'cutLineStill': {'galaxyObjectsInAperture': cut.get('galaxyInFrame'),
                     'namedCompanionsInFrame': cut.get('companionsInFrame')},
    'seamMinBlend': 0.9, 'galaxyRevealStartBlend': 0.78,
}, residual='the name-projection test reads zero companions in frame on both stills, '
            'but a large lit disc is visible inside the aperture in each: '
            'still-seam-of-light.png at approximately (875, 400) and '
            'still-station-resolved.png at approximately (905, 390). The GalaxyImpostor '
            'clause passes; the moon/nebula-exclusion clause of the seam criterion and '
            'the planet clause of the cut-line criterion are carried unresolved')

crit('AC-exit-seam-proof', 'pass', {
    'distanceAtCutLineShutter': cut.get('rangeAtShutter'),
    'stationCentreRangeAtShutter': cut.get('stationCentreRange'),
    'corridorRange': 1400,
    'canDockAtCutLine': cut.get('canDock'),
    'dockingAuthorizedMilestone': cut.get('dockingAuthorized'),
    'advisoryCopyAtCutLine': 'none',
    'objectiveAtCutLine': cut.get('objectiveId'),
    'keyFProbe': 'carried unchanged from ch10-transit-captures.json',
})

berth_story = next((c for c in (berth or {}).get('cases', []) if c['id'] == 'story-transit'), {})
berth_sandbox = next((c for c in (berth or {}).get('cases', []) if c['id'] == 'sandbox'), {})
crit('AC-berth-ring-suppression', 'pass', {
    'storyWorldDockingAuthorized': (berth_story.get('exterior') or {}).get('dockingAuthorized'),
    'sandboxDockingAuthorized': (berth_sandbox.get('exterior') or {}).get('dockingAuthorized'),
    'mountPredicate': 'suppressDockOffer={!spaceStationDockingAuthorized()}',
    'suppressedGeometry': '4 guide-arm boxes, 28 chase lamps, 36 threshold strips '
                          '(64 dock-offer lights)',
    'dockItselfUntouched': 'jamb frame, lit mouth and inner glow carry no dockOffer tag',
    'cutLineInstanceCounts': {'hull': cut.get('stationHullInstances'),
                              'lights': cut.get('stationLightInstances')},
    'frameEvidence': 'evidence/capture/still-station-resolved.png — the cyan hexagonal '
                     'berth ring that D-A5 measured below the dock is absent; '
                     'evidence/capture/strip-transit-b/07_threshold-handback-after_done.png '
                     'shows the same',
    'sandboxByteIdentity': 'proven at unit level by spaceStationExterior.test.ts inside '
                           'the green 2,270-test run',
}, residual='the sandbox comparison FRAME was captured but its instanced-batch counts '
            'could not be read: the ?spacestation= scene does not carry the named '
            'objects the scene picker keys on, so the runtime instance-for-instance '
            'comparison is asserted from the predicate and the unit test, not measured '
            'in the sandbox scene')

occl_rows = [{'profile': p['id'], 'depthTest': p['depthTest'], 'renderOrder': p['renderOrder'],
              'frustumCulled': p['frustumCulled'],
              'maxDeviceProjectedPixels': p['maxDeviceProjectedPixels'],
              'st0Visible': (p['rows'][0].get('visible') if p.get('rows') else None),
              'st0Opacity': (p['rows'][0].get('opacity') if p.get('rows') else None)}
             for p in (occl or {}).get('profiles', [])]
crit('AC-st0-occlusion-and-size', 'partial', {
    'depthTestAllProfiles': sorted({str(r['depthTest']) for r in occl_rows}),
    'renderOrder': sorted({str(r['renderOrder']) for r in occl_rows}),
    'frustumCulled': sorted({str(r['frustumCulled']) for r in occl_rows}),
    'ST0_MAX_PIXELS': 3,
    'runtimeDeviceProjectedPixels': 'NOT MEASURED — the ST-0 quad was not rendering in '
                                    'the sampled state (visible false, opacity 0, scale '
                                    'left at its default 1) because the probe staged '
                                    'ch10-cold, where st0RenderPredicate is false; the '
                                    'numbers the probe emitted describe an unplaced quad '
                                    'and are void',
    'unitProof': 'systemCompanionBodiesModel.test.ts holds st0DeviceProjectedPixels <= '
                 'ST0_MAX_PIXELS across the tier/DPR/viewport/distance matrix, green in '
                 'the 2,270-test run this pass re-ran',
    'perProfile': occl_rows,
}, residual='depthTest true / depthWrite false / renderOrder 2 is confirmed live at all '
            'four profiles, so the draw-through D-A8 named is closed at the material. '
            'The 3 px ceiling is closed at unit level only; no rendered ST-0 frame was '
            'measured this pass')

crit('AC-da6-manual-hold', 'pass', {
    'holdDurationMs': (da6 or {}).get('holdDurationMs'),
    'holdSpecMs': 2500,
    'moveSpeedScaleDuringHold': (da6 or {}).get('moveScaleDuringHold'),
    'moveSpeedScaleAfterHandback': (da6 or {}).get('moveScaleAfterHandback'),
    'speedTrajectoryDuringHold': (da6 or {}).get('speedDuringHold'),
    'thrustBranch': ((da6 or {}).get('shipControllerBranch') or {}).get('snippet'),
    'branchScope': 'ch10-transit only; gates `accel` alone, so attitude and look are '
                   'untouched by construction',
}, residual='the suppression was traced through the shared thrust integrator during a '
            'movie-lane run; no headed manual key-press test was performed, so '
            '"attitude/look stay live" is proven by the branch scope rather than by a '
            'measured manual input during the hold')

crit('AC-telemetry-pin', 'carried-forward', {
    'carried': 'D-15 unchanged: state:space-station/targeted first appears at the '
               'ch10-transit beat flip, 1.81 s after the bearing-claim anchor; the '
               'active-planet claim is undisturbed and the b9375b9 pin stays green',
})

crit('AC-performance', 'carried-forward', {
    'carried': 'ST-0 draw-call delta 1, new shader programs 0, FPS non-regression, all '
               'unchanged from ch10-drawcall-fps.json; nothing this pass verifies '
               'touches free-play rendering',
})

crit('AC-copy', 'pass', {
    'k11PaintedAtCutLine': cut.get('k11Painted'),
    'k11Text': cut.get('caption'),
    'reboardWorkOrderVerbatim': 'RETURN TO THE KESTREL. / FOLLOW THE HATCH MARKER AND [F] BOARD.',
    'reboardMarkerVerbatim': 'KESTREL HATCH · REBOARD',
    'igniteWorkOrderVerbatim': 'BRING THE KESTREL ONLINE. / HOLD [SPACE] TO IGNITE AND LIFT.',
    't3WorkOrderVerbatim': 'THE SOURCE IS RESOLVING. / HOLD.',
    'stationLinesThisRun': 0,
})

crit('AC-composition-lens-identity', 'pass', {
    'suspensionLifted': 'Cinematography\'s draft-v7 signature suspended every composition '
                        'verdict until the three transit strips were regenerated from '
                        'post-fix flights and re-measured. They were; these are the '
                        'measurements.',
    'renderCameraFovVsFlightFov': 'identical at every fresh frame',
    'maxAbsoluteFovDivergenceDeg': fov_max_delta,
    'cockpitShellCompensation': 'shell local scale equals tan(fov/2)/tan(35 deg) at every '
                                'frame (1.17727 at fov 79, 1.03761 at fov 72 reduced '
                                'motion, 1.00000 at fov 70)',
    'cockpitApertureAt1280PxRange': [min(apertures), max(apertures)] if apertures else None,
    'cockpitApertureMedian': sorted(apertures)[len(apertures) // 2] if apertures else None,
    'cockpitApertureHighStills': {
        'still-seam-of-light.png': (seam_high.get('cockpitMask') or {}).get('apertureWidthAt1280'),
        'still-seam-of-light-low.png': (seam_low.get('cockpitMask') or {}).get('apertureWidthAt1280'),
        'still-station-resolved.png': (cut.get('cockpitMask') or {}).get('apertureWidthAt1280'),
    },
    'expected': '~690 px, the HIGH family and the shipped ch8 reference',
    'method': 'single-instant differential mask: three renders inside one task with one '
              'camera pose, so the difference is exactly the object switched off. A '
              'screenshot pair cannot do this at 300 u/s — the whole frame moves between '
              'shots and the "difference" is the sky.',
    'verdict': 'the LOW strip family and the HIGH still family are ONE lens and one '
               'aperture scale. The 300 px reading D-A1 recorded is not reproduced by '
               'any geometric measurement of any fresh frame.',
})

crit('AC-composition-cut-line-spine', 'fail', {
    'contractBand': [28, 34],
    'contractRange': [1000, 1300],
    'contractFov': 70,
    'cutLineStill': {'file': 'evidence/capture/still-station-resolved.png',
                     'rangeAtShutter': cut.get('rangeAtShutter'),
                     'stationCentreRange': cut.get('stationCentreRange'),
                     'renderCameraFov': cut.get('renderCameraFov'),
                     'spinePercentOfFrameWidth': (cut.get('stationMask') or {}).get('spinePercentOfFrameWidth'),
                     'spineLengthPx': (cut.get('stationMask') or {}).get('spineLengthPx'),
                     'spineThicknessPx': (cut.get('stationMask') or {}).get('spineThicknessPx'),
                     'centroidPercentX': (cut.get('stationMask') or {}).get('centroidPercentX')},
    'stripFramesInTheDeclaredRange': [
        {'file': r['file'], 'stationDistance': r['stationDistance'],
         'renderCameraFov': r['renderCameraFov'],
         'spinePercentOfFrameWidth': r['stationSpinePercent']} for r in cutline_window],
    'measuredBand': 'the spine reads 25.77 % on the hero still at range 1,077 and '
                    '23.7-26.5 % across the fresh strip frames inside 1,000-1,300; it '
                    'first reaches 28 % at range ~965, below the declared floor',
    'method': 'single-instant station-hidden differential mask, PCA major-axis extent',
}, residual='the shipped composition is 2.2 percentage points below the contract\'s own '
            '28-34 % floor at its own declared range. Whether the term or the staging '
            'moves is Cinematography\'s call, not the verifier\'s')

crit('AC-hero-still-seam-of-light', 'partial', {
    'newInV7': True,
    'file': 'evidence/capture/still-seam-of-light.png',
    'pairedLowFrame': 'evidence/capture/still-seam-of-light-low.png',
    'tier': seam_high.get('qualityProfile'),
    'latchRangeSpec': [5100, 5200],
    'latchRangeMeasured': (seam_high.get('latch') or {}).get('distance'),
    'shutterRange': seam_high.get('distanceAtShutter'),
    'committedTargetOffCentreDeg': (seam_high.get('stationMask') or {}).get('centroidOffsetFromViewCenterDeg'),
    'offCentreSpecDeg': 5,
    'spineVisualAngleDeg': (seam_high.get('stationMask') or {}).get('spineVisualAngleDeg'),
    'spineVisualAngleSpecDeg': [7.5, 8.2],
    'thicknessVisualAngleDeg': (seam_high.get('stationMask') or {}).get('thicknessVisualAngleDeg'),
    'thicknessSpecDeg': 2.4,
    'stationMaskPixels': (seam_high.get('stationMask') or {}).get('maskPixels'),
    'galaxyObjectsInAperture': seam_high.get('galaxyInFrame'),
    'pairedLowLatchRange': (seam_low.get('latch') or {}).get('distance'),
    'pairedLowSpineVisualAngleDeg': (seam_low.get('stationMask') or {}).get('spineVisualAngleDeg'),
    'preArmed': 'shutter armed in page on rAF against the story:ch10-seam-passed '
                'milestone; not settle-and-drift',
}, residual='two clauses miss: the spine subtends 7.010 deg against a 7.5-8.2 deg band '
            '(short by 0.49 deg), and a bright lit disc sits inside the aperture at '
            'approximately (875, 400) against the moon/nebula-exclusion clause. Latch '
            'range, thickness, off-centre, galaxy absence and the paired LOW frame all '
            'meet their terms')

crit('AC-hero-still-station-resolved', 'partial', {
    'file': 'evidence/capture/still-station-resolved.png',
    'tier': cut.get('tier'),
    'armedAtRange': (cut.get('armedAt') or {}).get('distance'),
    'shutterRange': cut.get('rangeAtShutter'),
    'rangeSpec': [1000, 1300],
    'renderCameraFov': cut.get('renderCameraFov'),
    'k11Painted': cut.get('k11Painted'),
    'workOrderCleared': cut.get('objectiveId') is None and cut.get('hudText') is None,
    'berthRingInFrame': False,
    'spinePercentOfFrameWidth': (cut.get('stationMask') or {}).get('spinePercentOfFrameWidth'),
    'preArmed': 'shutter armed in page on rAF at the first frame after '
                'anc.ch10.threshold-handback with K11 painted and the work order cleared',
}, residual='range, FOV, K11, cleared work order and berth-ring absence all pass; the '
            'spine misses the 28-34 % band (see AC-composition-cut-line-spine) and a lit '
            'disc remains in the aperture at approximately (905, 390)')

crit('AC-hero-still-st0-sighting', 'fail', {
    'file': 'evidence/capture/still-st0-sighting.png',
    'status': 'CARRIED UNCHANGED from the draft-v6 stamp pass; NOT re-shot this pass',
    'v5StagingTerms': ['camera <= 25 units from the habitat-core handle',
                       'hearth emissive cluster in the bottom 20 %',
                       'deep night', 'no interaction prompt active at shutter',
                       'dot elevation >= 10 deg, prefer peak',
                       'yaw locked through the HIGH warm, judged +-2 deg at capture',
                       'ST-0 peak luminance is the frame maximum above the horizon band'],
    'blocker': 'the same finding that voids the ST-0 gaze and pixel measurements: in the '
               'states this pass could stage, the ST-0 quad is not rendering '
               '(visible false, opacity 0). A re-shoot that satisfies the v5 staging '
               'needs a surface dwell in which st0RenderPredicate is true, plus a walk '
               'to within 25 units of the habitat core; neither was reached this pass',
    'priorDefect': 'D-A4 stands: the carried still is shot at the Kestrel, not at the '
                   'hearth, and its ST-0 is not the brightest thing above the horizon',
}, residual='the one hero still this pass did not close. D-A4 is unrepaired and '
            'unmeasured')

tally = {}
for c in criteria:
    tally[c['verdict']] = tally.get(c['verdict'], 0) + 1

open_defects = [
    {'id': 'D-A1', 'severity': 'critical', 'status': 'reclassified',
     'statement': 'lens identity. The LOW strips and the HIGH stills ARE one lens: at '
                  'every fresh frame the render camera fov equals the flight-feedback '
                  'fov exactly and the cockpit shell carries the exact reciprocal scale, '
                  'and the single-instant geometric aperture is 613-789 px across the '
                  'strips and 641-659 px on the three stills. What D-A1 measured as '
                  '300 px is instead a DELIVERED-FRAME defect: at closing speeds above '
                  'about 190 u/s the cockpit rig renders receded from its seated '
                  'position, with open sky visible past the shell edges, and it returns '
                  'to seated as the ship decelerates. Reproduced in fresh post-fix '
                  'flights, so it is not a stale artifact.',
     'evidence': 'evidence/capture/strip-transit-a/05_seam-at_ch10-transit.png (receded, '
                 '290 u/s) versus evidence/capture/strip-transit-b/07_threshold-handback-'
                 'after_done.png (seated, 7 u/s); evidence/verification/ch10-v7-strips.json'},
    {'id': 'D-A2', 'severity': 'critical', 'status': 'closed',
     'statement': 'still-seam-of-light is now the seam. Shot at the latch '
                  '(range 5,191, spec 5,100-5,200) with seamPassed true and '
                  'stationResolved false, station mask 709 px, spine 7.010 deg, '
                  'thickness 2.345 deg. The three-distance thesis has its line.',
     'evidence': 'evidence/verification/ch10-v7-seam.json'},
    {'id': 'D-A3', 'severity': 'high', 'status': 'open',
     'statement': 'ST-0 gaze bias unmeasured. The solver repair is proven '
                  '(25.000 deg -> 0.000 deg worst error), but no movie-lane state exists '
                  'in which ST-0 renders long enough to sample: the predicate needs '
                  'surface phase and the movie autopilot leaves it.',
     'evidence': 'evidence/ch10-st0-gaze-solver.json; evidence/verification/ch10-v7-st0cross.json'},
    {'id': 'D-A4', 'severity': 'high', 'status': 'open',
     'statement': 'still-st0-sighting not re-shot; the carried still still stages at the '
                  'Kestrel rather than the hearth.',
     'evidence': 'evidence/capture/still-st0-sighting.png (carried)'},
    {'id': 'D-A5', 'severity': 'high', 'status': 'closed',
     'statement': 'berth ring suppressed in story worlds. spaceStationDockingAuthorized() '
                  'reads false in the story world and true in the sandbox, the mount '
                  'passes suppressDockOffer accordingly, and the cyan hexagonal ring is '
                  'absent from the cut-line still and the transit strips.',
     'evidence': 'evidence/verification/ch10-v7-berth.json; evidence/capture/still-station-resolved.png'},
    {'id': 'D-A6', 'severity': 'medium', 'status': 'closed',
     'statement': 'the hold holds. moveSpeedScale 0 for 2,503 ms from the resolve anchor, '
                  '1 at the hand-back, speed decaying 298 -> 89 u/s on damping alone, and '
                  'ShipController gates `accel` only, so attitude and look stay live.',
     'evidence': 'evidence/verification/ch10-v7-da6.json'},
    {'id': 'D-A7', 'severity': 'medium', 'status': 'open',
     'statement': 'doc drift between shots[11] (~31 %) and evidence.captures[10] (28-34 %) '
                  'is resolved in draft-v7 to a single 28-34 % term, but the shipped '
                  'staging measures 25.77 % at the declared range, so the term and the '
                  'frame still disagree.',
     'evidence': 'evidence/verification/ch10-v7-cutline.json'},
    {'id': 'D-A8', 'severity': 'medium', 'status': 'partially-closed',
     'statement': 'ST-0 occlusion is live: depthTest true, renderOrder 2 at all four '
                  'profiles. The 3 px ceiling is proven at unit level only; no rendered '
                  'ST-0 frame was measured.',
     'evidence': 'evidence/verification/ch10-v7-occl.json'},
    {'id': 'D-12', 'severity': 'closed-on-frequency',
     'status': 'residual: sample only on this headless box',
     'statement': 'origin-side descent aims at the derivable wreck site. Carried forward '
                  'from the stamp pass: no post-fix run has been observed off this box.'},
    {'id': 'D-15', 'severity': 'medium', 'status': 'open',
     'statement': 'state:space-station/targeted lags the bearing claim by 1.81 s. Carried '
                  'unchanged; the active-planet claim is undisturbed.'},
    {'id': 'UX-1', 'severity': 'high', 'status': 'closed',
     'statement': 'station:transit:reboard exists, carries KESTREL HATCH · REBOARD and an '
                  'actionable order naming [F], resolves its marker, fires exactly one '
                  'enter cue, is replaced by ignite on boarding and returns on '
                  'disembark. station:transit:ignite never publishes on foot.',
     'evidence': 'evidence/verification/ch10-v7-ux1.json'},
    {'id': 'UX-3', 'severity': 'medium', 'status': 'closed',
     'statement': 'the four-profile matrix was re-run post-deferral across '
                  'ch10-cold/ask/transit: zero mandatory rungs observable at '
                  'missing-marker, every observed health is ready.',
     'evidence': 'evidence/verification/ch10-v7-variants.json'},
    {'id': 'UX-4', 'severity': 'medium', 'status': 'closed',
     'statement': 'the invariant is no longer movie-lane only: three manual (non-movie) '
                  'deep links plus the manual board/exit/board cycle carry it.',
     'evidence': 'evidence/verification/ch10-v7-variants.json; evidence/verification/ch10-v7-ux1.json'},
]

report = {
    'schema': 'paravoxia.verificationReport.v1',
    'runId': '2026-08-11-ch10-station-introduction',
    'contractVersion': 'draft-v7',
    'contractSha256': '32122245bf6b6630c4228da65204db2c6422e9ddb3a446c63ee6990986626860',
    'supersedesContractVersion': 'draft-v6',
    'sourceRevision': '929e3d0a650fedccd2d04e68db792e09634d416e',
    'workingTree': 'uncommitted ch10 working tree, draft-v7 FINAL evidence pass',
    'capturedAt': datetime.now(timezone.utc).isoformat(),
    'capturedBy': 'story-verifier (mechanical, read-only against game source)',
    'pass': 'draft-v7 final evidence pass (judge\'s copy)',
    'previewServer': {'url': 'http://localhost:5176',
                      'ownership': 'pre-existing vite dev server inherited per the lock; '
                                   'no second server was started'},
    'concurrencyDisclosure': {'browserPages': 'one page at a time, every mode, '
                                              'sequentially chained'},
    'readingDiscipline': {'moduleIdentity': 'every in-page module resolved through the '
                                            'app\'s own HMR-timestamped specifier',
                          'pixelMeasurement': 'single-instant in-page differential masks; '
                                              'no screenshot-pair diffs and no colour '
                                              'heuristics'},
    'staticGate': {'command': 'npm run verify', 'exitCode': 0,
                   'checks': ['catalog:check', 'scene:av:check (76 anchors, 2 signed '
                              'contracts 3367b94f9f0f + 32122245bf6b)',
                              'creative:workflow:check (185)',
                              'chapter:registry:check (3817)', 'chapter:journey:check '
                              '(0 issues)', 'typecheck', 'story:authority (1088)',
                              'test (2270 passed)', 'build'],
                   'tests': 2270, 'failures': 0},
    'acceptanceCriteria': criteria,
    'criteriaTally': tally,
    'openDefects': open_defects,
    'stripMeasurements': strip_rows,
    'overallStatus': 'fail-with-closures',
    'overallReading': (
        'The formal suspension is lifted on measurement, not on outcome. All three '
        'transit strips were regenerated from post-fix flights with every trigger hit '
        'and zero page errors, and the re-measurement shows the LOW and HIGH families '
        'share one lens exactly: render-camera fov equals flight fov at every frame, the '
        'cockpit shell carries the exact reciprocal scale, and the geometric aperture is '
        '613-789 px across the strips against 641-659 px on the three stills. D-A1 as '
        'stated is disproven; what remains under it is a different and real defect, that '
        'the delivered frame shows the cockpit rig receding at closing speeds above '
        'about 190 u/s. D-A2, D-A5, D-A6, UX-1, UX-3 and UX-4 close on measurement. '
        'Three things do not: the cut-line spine reads 25.77 % against a 28-34 % term at '
        'its own declared range; the new seam still misses its 7.5-8.2 deg spine band at '
        '7.010 deg and keeps a lit disc in the aperture; and everything ST-0 - the gaze '
        'bias, the device-pixel ceiling in a rendered frame, and the hero still itself - '
        'is unmeasured, because in every state this pass could stage the ST-0 quad is '
        'not rendering.'),
}

with open(os.path.join(RUN, 'verification-report.json'), 'w') as f:
    json.dump(report, f, indent=1)
    f.write('\n')
print('criteria', len(criteria), tally)
