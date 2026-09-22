from pathlib import Path
import datetime
import hashlib
import json
import difflib

repo = Path('/home/thomasphillip/Projects/vox')
run = Path(__file__).resolve().parent
read = lambda name: json.loads((run / name).read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
validation = read('candidate-validation.json')
assert validation['passed'], 'Validate exact signatures and delegated decision first'
assert any(c['id'] == 'owner-approved' and c['passed'] for c in validation['checks'])
decision = read('owner-story-decision.json')
assert decision['candidateSha256'] == sha((run / 'story-authority-candidate.md').read_bytes())
assert decision['decisionsSha256'] == sha((run / 'canon-decision-register.json').read_bytes())
assert decision['authorityKind'] == 'standing-user-delegation'

allowed = read('canon-decision-register.json')['documentationAllowedPaths']
before = {row['path']: row for row in read('authority-before.json')['files']}
original = {}
for name in allowed:
    data = (repo / name).read_bytes()
    assert sha(data) == before[name]['sha256'], f'Concurrent source change: {name}'
    original[name] = data.decode()

changed = dict(original)
bible = changed['main/PARAVOXIA_STORY_BIBLE.md']
bible = bible.replace('**Portable canon snapshot — 2026-07-15**', '**Portable canon snapshot — 2026-09-06; July 15 lineage retained**', 1)
bible = bible.replace('governs canon while the worktree runtime reaches `ch9-hearth` and the public\nrelease remains separately frozen at W-7744\'s arrival.', 'governs canon while the formal worktree runtime reaches `ch10-transit`, the\nseparate station/return sidecar restores the second hearth, and the public\nrelease remains separately frozen at W-7744\'s arrival.', 1)
bible = bible.replace('`ch9-hearth` worktree ceiling', '`ch10-transit` formal worktree ceiling', 1)
bible = bible.replace('This document is a self-contained account', (run / 'bible-addendum.md').read_text() + '\nThis document is a self-contained account', 1)
bible = bible.replace('- After the first “i—”, Terra\'s embodied interior voice must not return to\n  parenthetical grammar.', '- Historical blanket rule: after the first “i—”, Terra\'s embodied interior\n  voice must not return to parenthetical grammar. The 2026-09-06 `CG-D08`\n  addendum above explicitly supersedes this rule only for new ch13 sensory\n  thought versus deliberately owned intent; older copy is unchanged.', 1)
changed['main/PARAVOXIA_STORY_BIBLE.md'] = bible

plan = changed['main/PARAVOXIA_STORY_EXECUTION_PLAN.md']
plan = plan.replace('**Runtime status:** **CORE PATH REACHABLE THROUGH `ch9-hearth` — SIGNED PHYSICAL RAIL IMPLEMENTED — ACCEPTANCE EVIDENCE/PUBLISH GATED**', '**Runtime status:** **FORMAL PATH THROUGH `ch10-transit`; STATION/RETURN SIDECAR IMPLEMENTED; COMMON GROUND APPROVED DIRECTION — ACCEPTANCE/PUBLISH GATED**', 1)
plan = plan.replace('**Documentation status:** **runtime-reality reconciliation — CURRENT THROUGH 2026-07-15**', '**Documentation status:** **runtime-reality reconciliation — CURRENT THROUGH 2026-09-06; EARLIER DELIVERY LINEAGE RETAINED**', 1)
plan = plan.replace('## 1. Outcome contract', (run / 'execution-addendum.md').read_text() + '\n## 1. Outcome contract', 1)
changed['main/PARAVOXIA_STORY_EXECUTION_PLAN.md'] = plan

overview = changed['main/STORY.md']
overview = overview.replace('# Paravoxia — Story Mode (Prologue → Chapter 4\'s arrival)', '# Paravoxia — Story Mode and current production boundary', 1)
start = overview.index('**What this is.**')
end = overview.index('**Canon and future delivery.**')
overview = overview[:start] + '''**Current worktree — 2026-09-06.** The formal story registry runs from the
terminal prologue through `ch10-transit`, then `done`. Beyond that threshold,
the separate space-station application issues the bonded cell and the world
return sidecar installs it at Tidegarden's second hearth. Their durable
ch11/ch12 receipts remain distinct from formal chapter registration. Source
owners are `src/game/spaceStation/spaceStationStory.ts` and
`src/story/stationReturnStory.ts`. This source inventory is not a fresh
continuous movie or audiovisual acceptance claim.

**Approved next direction: Common Ground (ch13).** From a reliable restored
home, Terra may review the stored audit fault and choose to revisit Origin.
W-7744 repeats his own unresolved local measurement. The player demonstrates
and revises a walked route; the two exchange witness positions before his
independent final test. The retained local result admits an incomplete model.
This direction is approved through the exact three-director council and the
user's standing delegation in
`../.codex/story-runs/2026-09-06-common-ground/`. It is not yet implemented by
this documentation patch. The current station movie still stops inside;
authentic departure, return, installation and new-chapter continuity are part
of the next signed production packet. No route choice spends A5 or grants an
alliance, and the repaired home is preserved.

**Public release boundary.** The release surface remains Prologue → Chapter
4's arrival (`ch4-arrival`). Later worktree implementation is authorized by the
owner's July 28 gate lift and separately contracted production; publication
remains a separate decision. The first-act guide below retains its historical
release scope, while current beat IDs and resume behavior come from
`src/story/storyState.ts` and the generated beat contracts.

''' + overview[end:]
overview = overview.replace('remains `../PARAVOXIA_DEMO_FOUNDATION_PLAN.md`; no post-arrival runtime work is\nauthorized while that demo lock is active.', 'remains `../PARAVOXIA_DEMO_FOUNDATION_PLAN.md`; the unchanged demo release\nceiling does not revoke the July 28 authorization to build later story through\nits Creative-Triad and registry gates.', 1)
overview = overview.replace('for EVERY beat (`crawl|manifest|voyage|deflect|crash|descent|', 'for the historical first-act entries listed here (`crawl|manifest|voyage|deflect|crash|descent|', 1)
changed['main/STORY.md'] = overview

manifest = json.loads(changed['main/story-authority.json'])
manifest['snapshotDate'] = '2026-09-06'
for source in ['src/story/beats/metadata.generated.ts', 'src/game/spaceStation/spaceStationStory.ts', 'src/story/stationReturnStory.ts', 'src/components/spaceStation/StationScreeningDriver.tsx', 'src/story/autopilot/primitives.ts']:
    assert (repo / 'main' / source).is_file(), source
    if source not in manifest['sources']['runtimeEvidence']:
        manifest['sources']['runtimeEvidence'].append(source)
changed['main/story-authority.json'] = json.dumps(manifest, indent=2) + '\n'
schema_path = 'docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json'
schema = json.loads(changed[schema_path])
schema['properties']['snapshotDate']['const'] = manifest['snapshotDate']
schema['properties']['sources']['const'] = manifest['sources']
changed[schema_path] = json.dumps(schema, indent=2) + '\n'

lock_path = run / 'production-lock.json'
(run / 'production-lock.inventory-only.json').write_bytes(lock_path.read_bytes())
(run / 'production-lock.inventory-only.md').write_bytes((run / 'production-lock.md').read_bytes())
lock = json.loads(lock_path.read_text())
lock['allowedPaths'] = list(dict.fromkeys(lock['allowedPaths'] + allowed))
lock['protectedPaths'] = [p for p in lock['protectedPaths'] if p not in allowed]
lock['documentationDecisionRef'] = 'owner-story-decision.json'
lock['documentationCandidateSha256'] = decision['candidateSha256']
lock['authorityHashSemantics'] = 'Pre-patch authority bytes preserved in authority-before; approved exact documentation delta only. Subsequent scene lock hashes resulting authority.'
lock_path.write_text(json.dumps(lock, indent=2) + '\n')
with (run / 'production-lock.md').open('a') as f:
    f.write('\n## Approved bounded documentation expansion\n\nThe exact candidate and delegated decision permit only the following authority/documentation paths in addition to run artifacts. Runtime, assets, audio and publication remain protected. Original lock and source bytes are preserved.\n\n' + '\n'.join('- `' + p + '`' for p in allowed) + '\n\nDecision: `owner-story-decision.json`; candidate SHA-256 `' + decision['candidateSha256'] + '`.\n')

diff = []
records = []
for name in allowed:
    assert changed[name] != original[name], f'No intended patch for {name}'
    diff.extend(difflib.unified_diff(original[name].splitlines(True), changed[name].splitlines(True), fromfile='before/' + name, tofile='after/' + name))
    (repo / name).write_text(changed[name])
    target = run / 'authority-after' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(changed[name])
    records.append({'path': name, 'beforeSha256': sha(original[name].encode()), 'afterSha256': sha(changed[name].encode())})
(run / 'implementation-diff.patch').write_text(''.join(diff))
(run / 'authority-patch-receipt.json').write_text(json.dumps({'appliedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'candidateSha256': decision['candidateSha256'], 'runtimeMutated': False, 'files': records}, indent=2) + '\n')
print(json.dumps({'patched': [p['path'] for p in records], 'runtimeMutated': False}))
