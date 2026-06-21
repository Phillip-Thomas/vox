#!/usr/bin/env python3
import argparse
import json
import os
import sys
import uuid
from pathlib import Path

import requests

API = "https://api.porkbun.com/api/json/v3"
DOMAIN = "paravoxia.com"

DESIRED = [
    {"name": "", "type": "A", "content": "199.36.158.100", "ttl": 600},
    {"name": "", "type": "TXT", "content": "hosting-site=paravox-game", "ttl": 600},
    {"name": "_acme-challenge", "type": "TXT", "content": "JACFWtOD5x2Y_uyOFCYEzaiqeUGOwACWAmjPRmtRCm4", "ttl": 600},
    {"name": "www", "type": "CNAME", "content": "paravox-game.web.app", "ttl": 600},
    {"name": "_acme-challenge.www", "type": "TXT", "content": "KFrplKT84lRZukihqStm7fSpQTJzAfhn3oohyx9GpQ8", "ttl": 600},
]

REMOVE = [
    {"name": "", "type": "ALIAS", "content": "uixie.porkbun.com"},
    {"name": "", "type": "A", "content": "44.230.85.241"},
    {"name": "", "type": "A", "content": "52.33.207.7"},
    {"name": "www", "type": "CNAME", "content": "uixie.porkbun.com"},
    {"name": "_acme-challenge.www", "type": "CNAME", "content": "uixie.porkbun.com"},
]


def normalize_name(record_name):
    if record_name in ("", DOMAIN):
        return ""
    suffix = f".{DOMAIN}"
    if record_name.endswith(suffix):
        return record_name[: -len(suffix)]
    return record_name


def request(method, path, api_key, secret_key, payload=None):
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
        "X-Secret-API-Key": secret_key,
        "Idempotency-Key": str(uuid.uuid4()),
    }
    response = requests.request(
        method,
        f"{API}{path}",
        headers=headers,
        json=payload or {},
        timeout=60,
    )
    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text}
    if response.status_code >= 400 or body.get("status") == "ERROR":
        raise RuntimeError(f"{method} {path} failed: HTTP {response.status_code} {body}")
    return body


def record_matches(record, target):
    return (
        normalize_name(record.get("name", "")) == target["name"]
        and record.get("type") == target["type"]
        and str(record.get("content", "")).rstrip(".") == target["content"].rstrip(".")
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually mutate Porkbun DNS records")
    parser.add_argument("--out", default="/tmp/paravox-porkbun-dns-result.json")
    args = parser.parse_args()

    api_key = os.environ.get("PORKBUN_API_KEY")
    secret_key = os.environ.get("PORKBUN_SECRET_API_KEY")
    if not api_key or not secret_key:
        print("Missing PORKBUN_API_KEY and/or PORKBUN_SECRET_API_KEY.", file=sys.stderr)
        return 2

    records_body = request("GET", f"/dns/retrieve/{DOMAIN}", api_key, secret_key)
    records = records_body.get("records", [])

    delete_records = [
        record
        for record in records
        for target in REMOVE
        if record_matches(record, target)
    ]
    create_records = [
        target
        for target in DESIRED
        if not any(record_matches(record, target) for record in records)
    ]

    actions = {
        "apply": args.apply,
        "delete": delete_records,
        "create": create_records,
        "kept_existing": [
            target
            for target in DESIRED
            if any(record_matches(record, target) for record in records)
        ],
    }

    if args.apply:
        for record in delete_records:
            request("POST", f"/dns/delete/{DOMAIN}/{record['id']}", api_key, secret_key)
        for target in create_records:
            payload = {
                "name": target["name"],
                "type": target["type"],
                "content": target["content"],
                "ttl": target["ttl"],
            }
            request("POST", f"/dns/create/{DOMAIN}", api_key, secret_key, payload)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(actions, indent=2, sort_keys=True) + "\n")
    print(json.dumps(actions, indent=2, sort_keys=True))
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
