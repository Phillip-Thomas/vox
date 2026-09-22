#!/usr/bin/env python3
"""Rehash the 99 manifest source files and the manifest itself. Read-only."""
import hashlib, json, sys, datetime, pathlib

RUN = pathlib.Path(__file__).resolve().parents[3]
REPO = RUN.parents[2]
MAN = RUN / "implementation-source-manifest.json"


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def main():
    label = sys.argv[1] if len(sys.argv) > 1 else "rehash"
    man = json.loads(MAN.read_bytes())
    out = {
        "label": label,
        "atUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "manifestSha256": sha(MAN),
        "filesChecked": 0,
        "mismatches": [],
        "missing": [],
    }
    for rel, expect in man["hashes"].items():
        p = REPO / rel
        if not p.exists():
            out["missing"].append(rel)
            continue
        out["filesChecked"] += 1
        actual = sha(p)
        if actual != expect:
            out["mismatches"].append({"path": rel, "expected": expect, "actual": actual})
    out["intact"] = not out["mismatches"] and not out["missing"]
    print(json.dumps(out, indent=2))
    return 0 if out["intact"] else 2


if __name__ == "__main__":
    sys.exit(main())
