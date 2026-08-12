#!/usr/bin/env python3
"""Stage 6 closeout artifact builder.

Mechanical only: hashes every file in the run directory into the evidence
registry, ffprobes every media file into the intent-free raw-audiovisual
inventory, scans every captured PNG for blank/black/flat-frame defects, and
assembles the objective lifecycle evidence from the captured traces.

verification-report.json is written by write_verification_report.py, which
carries the per-criterion verdicts; this file writes only measured facts.
"""
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

RUN = os.path.dirname(os.path.abspath(__file__))
CONTRACT_VERSION = "draft-v6"
CONTRACT_SHA = "4202e38b3a595cae5b39bf65cf6ec0603892bf4046a420db0d96362eeb883c94"
SOURCE_REVISION = "929e3d0a650fedccd2d04e68db792e09634d416e"
WORKING_TREE = "uncommitted ch10 working tree, stamp pass, post D-13 / D-6-remnant / RM-FOV repair round"
NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

MEDIA_EXT = {".png", ".wav", ".webm", ".mp4", ".jpg"}
SKIP_DIRS = {".git", "node_modules", "__pycache__"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rel(path):
    return os.path.relpath(path, RUN)


def walk_files():
    for root, dirs, files in os.walk(RUN):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in sorted(files):
            yield os.path.join(root, name)


def kind_for(relpath):
    if relpath.startswith("evidence/capture/") and relpath.endswith(".png"):
        return "frame"
    if relpath.startswith("evidence/baseline/") and relpath.endswith(".png"):
        return "frame"
    if relpath.endswith(".wav"):
        return "audio"
    if relpath.startswith("evidence/verification/"):
        return "trace"
    if relpath.startswith("evidence/score/"):
        return "audio-measure"
    if relpath.startswith("evidence/implementation/"):
        return "implementation"
    if relpath.endswith(".mjs") or relpath.endswith(".py"):
        return "probe"
    if relpath.endswith(".json"):
        return "artifact"
    if relpath.endswith(".md"):
        return "document"
    if relpath.endswith(".jsonl"):
        return "ledger"
    if relpath.endswith(".diff"):
        return "diff"
    return "file"


def ref_for(relpath, kind):
    slug = relpath.replace("/", "-").replace(".", "-").replace("_", "-").lower()
    return f"{kind}:{slug}"


def ffprobe(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=60)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None


KIND_DESCRIPTION = {
    "frame": "captured PNG frame",
    "audio": "rendered WAV excerpt",
    "audio-measure": "score measurement artifact",
    "trace": "probe state trace",
    "probe": "verification probe script",
    "artifact": "run artifact",
    "document": "run document",
    "ledger": "run ledger",
    "implementation": "implementation log",
    "diff": "implementation diff",
    "file": "run file",
}


def describe(relpath, kind):
    """A factual one-line description: what the bytes are and where they came from."""
    base = KIND_DESCRIPTION.get(kind, "run file")
    name = os.path.basename(relpath)
    if kind == "frame":
        beat = beat_label(relpath)
        parent = os.path.basename(os.path.dirname(relpath))
        where = f"strip {parent}" if parent.startswith("strip-") else parent
        stamp = f", beat {beat}" if beat else ""
        return f"{base} from {where}: {name}{stamp}"
    if kind == "trace":
        return f"{base}: {name}"
    return f"{base}: {name}"


def build_registry():
    entries = []
    for path in walk_files():
        r = rel(path)
        if r in ("evidence-registry.json",):
            continue
        kind = kind_for(r)
        entries.append({
            "ref": ref_for(r, kind),
            "path": r,
            "sha256": sha256(path),
            "kind": kind,
            "description": describe(r, kind),
            "bytes": os.path.getsize(path),
        })
    entries.sort(key=lambda e: e["path"])
    doc = {
        "schema": "paravoxia.evidenceRegistry.v1",
        "runId": "2026-08-11-ch10-station-introduction",
        "contractVersion": CONTRACT_VERSION,
        "contractSha256": CONTRACT_SHA,
        "sourceRevision": SOURCE_REVISION,
        "workingTree": WORKING_TREE,
        "compiledAt": NOW,
        "mediaProbeRule": ("every media entry declares the exact ffprobe reading of its own "
                           "bytes; trace and probe entries carry no probe field and are never ffprobed"),
        "entries": entries,
    }
    with open(os.path.join(RUN, "evidence-registry.json"), "w") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    return entries


def beat_label(relpath):
    """The beat stamp the capture wrote into the filename, verbatim."""
    name = os.path.basename(relpath)
    stem = name.rsplit(".", 1)[0]
    parts = stem.split("_")
    for p in parts:
        if p.startswith("ch") or p in ("done", "null", "base"):
            return p
    return None


def build_raw_av(entries):
    items = []
    for e in entries:
        ext = os.path.splitext(e["path"])[1].lower()
        if ext not in MEDIA_EXT:
            continue
        full = os.path.join(RUN, e["path"])
        probe = ffprobe(full)
        video = None
        audio = None
        fmt = None
        duration = None
        if probe:
            fmt = probe.get("format", {}).get("format_name")
            d = probe.get("format", {}).get("duration")
            duration = float(d) if d not in (None, "N/A") else 0
            for s in probe.get("streams", []):
                if s.get("codec_type") == "video" and video is None:
                    video = {"codec": s.get("codec_name"),
                             "width": s.get("width"), "height": s.get("height")}
                if s.get("codec_type") == "audio" and audio is None:
                    audio = {"codec": s.get("codec_name"),
                             "sampleRate": s.get("sample_rate"),
                             "channels": s.get("channels")}
        items.append({
            "path": e["path"],
            "sha256": e["sha256"],
            "bytes": e["bytes"],
            "formatName": fmt,
            "durationSeconds": duration,
            "video": video,
            "audio": audio,
            "label": os.path.basename(e["path"]).rsplit(".", 1)[0],
            "beatLabel": beat_label(e["path"]),
        })
    doc = {
        "schema": "paravoxia.rawAudiovisualEvidence.v1",
        "runId": "2026-08-11-ch10-station-introduction",
        "contractVersion": CONTRACT_VERSION,
        "contractSha256": CONTRACT_SHA,
        "sourceRevision": SOURCE_REVISION,
        "workingTree": WORKING_TREE,
        "compiledAt": NOW,
        "note": ("Playback metadata only: path, bytes, probed format, duration, and the beat or "
                 "context label recorded at capture. No interpretation."),
        "items": items,
    }
    with open(os.path.join(RUN, "raw-audiovisual-evidence.json"), "w") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    return items


def scan_frames():
    from PIL import Image
    import numpy as np
    results = []
    for root in (os.path.join(RUN, "evidence", "capture"), os.path.join(RUN, "evidence", "baseline")):
        for dirpath, _dirs, files in os.walk(root):
            for name in sorted(files):
                if not name.lower().endswith(".png"):
                    continue
                path = os.path.join(dirpath, name)
                img = Image.open(path).convert("RGB")
                a = np.asarray(img, dtype=np.float32)
                luma = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
                stats = {
                    "file": rel(path),
                    "width": img.width,
                    "height": img.height,
                    "meanLuma": round(float(luma.mean()), 3),
                    "minLuma": round(float(luma.min()), 3),
                    "maxLuma": round(float(luma.max()), 3),
                    "stdLuma": round(float(luma.std()), 3),
                    "nonBlackFraction": round(float((luma > 6).mean()), 5),
                }
                defects = []
                if stats["nonBlackFraction"] < 0.02:
                    defects.append("blank-or-black-frame")
                if stats["maxLuma"] - stats["minLuma"] < 4:
                    defects.append("flat-frame-no-contrast")
                if stats["stdLuma"] < 1.5:
                    defects.append("no-variation")
                stats["defects"] = defects
                results.append(stats)
    return results


def marker_stamp_summary(doc):
    """Collapse the per-frame mutation log into state runs, per path per surface."""
    if not doc:
        return None
    out = {}
    for pid, p in (doc.get("paths") or {}).items():
        surfaces = {}
        for surface in ("hud", "feed"):
            runs = []
            for e in p.get("events", []):
                if e.get("surface") != surface:
                    continue
                state = (e.get("id"), e.get("health"), e.get("requires-marker"),
                         e.get("marker-label"), e.get("beat"))
                if runs and runs[-1]["state"] == list(state):
                    runs[-1]["untilMs"] = e["at"]
                else:
                    runs.append({"state": list(state), "fromMs": e["at"], "untilMs": e["at"]})
            for r in runs:
                r["dwellMs"] = round(r["untilMs"] - r["fromMs"], 1)
            surfaces[surface] = runs
        out[pid] = {
            "url": p.get("url"), "reachedTerminal": p.get("reachedTerminal"),
            "beatsSeen": p.get("beatsSeen"), "eventCount": p.get("eventCount"),
            "observerErrors": p.get("observerErrors"), "pageErrors": p.get("pageErrors"),
            "mandatoryRungs": p.get("mandatoryRungs"),
            "healthStatesObserved": p.get("healthStatesObserved"),
            "missingMarkerViolationCount": p.get("violationCount"),
            "worstViolationDwellMs": p.get("worstViolationDwellMs"),
            "stateRuns": surfaces,
        }
    return {"summary": doc.get("summary"), "paths": out}


def build_lifecycle():
    vdir = os.path.join(RUN, "evidence", "verification")

    def load(name):
        p = os.path.join(vdir, name)
        if not os.path.exists(p):
            return None
        with open(p) as fh:
            return json.load(fh)

    life = load("ch10-lifecycle-trace.json")
    flow = load("ch10-flow2-trace.json")
    variant = load("ch10-variant-anchor-trace.json")
    fence = load("ch10-fence-reload-trace.json")

    transitions = []
    if life:
        for sc in life.get("scenarios", []):
            for t in sc.get("transitions", []):
                transitions.append(t)
    movie = []
    if flow:
        for run in flow.get("runs", []):
            for e in run.get("objectiveEvents", []):
                movie.append({"run": run["run"], "t": e["t"], "beat": e["beat"],
                              "from": e["from"], "to": e["to"], "markerLabel": e.get("markerLabel"),
                              "health": e.get("health"), "requiresMarker": e.get("requiresMarker"),
                              "workOrder": e.get("hudText"), "cumulativeCues": e.get("cues")})
    per_variant = {}
    if variant:
        for vid, v in variant.get("variants", {}).items():
            per_variant[vid] = {
                "profile": v.get("profile"), "reducedMotion": v.get("reducedMotion"),
                "isMobile": v.get("isMobile"),
                "byAnchor": {a: {"objectiveId": s.get("objectiveId"),
                                 "markerLabel": s.get("markerLabel"),
                                 "health": s.get("health"),
                                 "requiresMarker": s.get("requiresMarker"),
                                 "workOrder": s.get("hudText")}
                             for a, s in (v.get("byAnchor") or {}).items()},
                "missingAnchors": v.get("missingAnchors"),
            }
    doc = {
        "schema": "paravoxia.objectiveLifecycleEvidence.v1",
        "runId": "2026-08-11-ch10-station-introduction",
        "contractVersion": CONTRACT_VERSION,
        "contractSha256": CONTRACT_SHA,
        "sourceRevision": SOURCE_REVISION,
        "workingTree": WORKING_TREE,
        "capturedAt": NOW,
        "lane": ("deep-link rehearsal through the exported commit receipts (ch10-lifecycle-trace.json), "
                 "movie-lane objective events from three cold runs (ch10-flow2-trace.json), and the "
                 "per-anchor variant matrix (ch10-variant-anchor-trace.json)"),
        "transitions": transitions,
        "movieLaneObjectiveEvents": movie,
        "perVariantByAnchor": per_variant,
        "transitRungObservation": (fence or {}).get("t3Rung"),
        "transitRungObservationPostRepair": (load("ch10-transit-completion.json") or {}).get("objectiveEvents"),
        "askLaneObjectiveEventsPostRepair": [e for r in ((load("ch10-ask-completion.json") or {}).get("runs") or []) for e in r.get("objectiveEvents", [])],
        # Final proof round.
        "askLaneObjectiveEventsFinalProof": [
            {"run": r["id"], **e}
            for r in ((load("ch10-final-ask.json") or {}).get("runs") or [])
            for e in r.get("objectiveEvents", [])],
        "endToEndObjectiveEvents": [
            e for r in ((load("ch10-final-full.json") or {}).get("runs") or [])
            for e in r.get("objectiveEvents", [])],
        "markerInvariantMutationTrace": {
            pid: {"url": p.get("url"), "reachedBearingClaim": p.get("reachedBearingClaim"),
                  "mandatoryRungs": p.get("mandatoryRungs"),
                  "violationCount": p.get("violationCount"),
                  "worstViolationDwellMs": p.get("worstViolationDwellMs"),
                  "events": p.get("events")}
            for pid, p in ((load("ch10-closing-marker-invariant.json") or {}).get("paths") or {}).items()},
        "markerInvariantMutationTraceUnderLoad": {
            pid: {"violationCount": p.get("violationCount"),
                  "worstViolationDwellMs": p.get("worstViolationDwellMs")}
            for pid, p in ((load("ch10-closing-marker-invariant-contended.json") or {}).get("paths") or {}).items()},
        # Stamp pass. The raw mutation log is ~43,000 records across four paths
        # (both HUD surfaces, sampled every frame), so it is carried here as
        # collapsed state RUNS plus the invariant counts; the full log stays in
        # evidence/verification/ch10-stamp-marker.json.
        "markerInvariantStampPass": marker_stamp_summary(load("ch10-stamp-marker.json")),
        "endToEndStampPassLegs": {
            r["id"]: {"durationSeconds": r.get("durationSeconds"),
                      "completed": r.get("completed"),
                      "legs": r.get("legs"), "legBeatClock": r.get("legBeatClock"),
                      "pageErrors": r.get("pageErrors"),
                      "holdMeasuredMs": r.get("holdMeasuredMs"),
                      "standoffAtResolve": r.get("standoffAtResolve")}
            for r in ((load("ch10-final-full.json") or {}).get("runs") or [])},
        "transitAnchorsByVariantFinalProof": {
            vid: {"profile": v.get("profile"), "reducedMotion": v.get("reducedMotion"),
                  "isMobile": v.get("isMobile"), "order": v.get("order"),
                  "seamStrictlyBeforeResolved": v.get("seamStrictlyBeforeResolved"),
                  "missingAnchors": v.get("missingAnchors"),
                  "byAnchor": {a: {"objectiveId": s.get("objectiveId"),
                                   "markerLabel": s.get("markerLabel"),
                                   "health": s.get("health"),
                                   "requiresMarker": s.get("requiresMarker"),
                                   "workOrder": s.get("hudText"),
                                   "authority": s.get("authority"), "fov": s.get("fov"),
                                   "agency": s.get("agency"), "reset": s.get("reset")}
                               for a, s in (v.get("byAnchor") or {}).items()}}
            for vid, v in ((load("ch10-closing-variant-transit.json") or {}).get("variants") or {}).items()},
    }
    with open(os.path.join(RUN, "objective-lifecycle-evidence.json"), "w") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    return doc


if __name__ == "__main__":
    entries = build_registry()
    print(f"registry entries: {len(entries)}")
    items = build_raw_av(entries)
    print(f"raw av items: {len(items)}")
    frames = scan_frames()
    defective = [f for f in frames if f["defects"]]
    print(f"frames scanned: {len(frames)}, defective: {len(defective)}")
    with open(os.path.join(RUN, "evidence", "verification", "frame-defect-scan.json"), "w") as fh:
        json.dump({"scannedAt": NOW, "scanned": len(frames),
                   "defective": defective, "frames": frames}, fh, indent=1)
        fh.write("\n")
    life = build_lifecycle()
    print(f"lifecycle transitions: {len(life['transitions'])}, "
          f"movie events: {len(life['movieLaneObjectiveEvents'])}")
    # The registry must hash the files this run just wrote, so hash twice.
    entries = build_registry()
    print(f"registry entries (final): {len(entries)}")
