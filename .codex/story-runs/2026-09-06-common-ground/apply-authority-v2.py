from pathlib import Path
import json, hashlib, datetime, difflib

repo = Path('/home/thomasphillip/Projects/vox')
run = repo / '.codex/story-runs/2026-09-06-common-ground'
hash_bytes = lambda b: hashlib.sha256(b).hexdigest()
hash_file = lambda p: hash_bytes(p.read_bytes())
candidate_hash = hash_file(run / 'story-authority-candidate.md')
owner = json.loads((run / 'owner-story-decision.json').read_text())
assert owner['candidateSha256'] == candidate_hash and owner['disposition'] == 'approve'
assert owner['personallyReviewedByUser'] is False
for role in ['chapter', 'score', 'cinematography']:
    sig = json.loads((run / f'{role}-story-signoff.json').read_text())
    assert sig['candidateSha256'] == candidate_hash
    assert sig['disposition'] in ['approve', 'approve-with-notes']
expected = json.loads((run / 'docs-v2-expected-before.json').read_text())
for name, sha in expected.items():
    assert hash_file(repo / name) == sha, f'Concurrent edit: {name}'

def replace_one(text, old, new):
    assert text.count(old) == 1, old[:100]
    return text.replace(old, new, 1)

name = 'main/PARAVOXIA_STORY_BIBLE.md'
text = (repo / name).read_text()
text = replace_one(text,
    'route he can repeat independently, or use a shorter bend requiring exchanged\nwitness positions. Both routes are complete choices with different retained\ngeometry and repeatability; neither receives a moral or musical rank. These\nare required future route classes: the continuous-reference outer route is not\nyet established by measurement. Failure to establish it reopens the bounded\narena decision before scene geometry can be signed.',
    'route he can repeat independently, or use a shorter span requiring an occupied\nwitness. Both routes are complete choices with different retained geometry and\nrepeatability; neither receives a moral or musical rank. Council-v2 selects one\nnew passive, visibly opaque-backed survey instrument with a constant 12-unit\nsocket-to-socket range. Its visible solids also govern walking collision and\nreference occlusion; there is no invisible directional cone. The measured CPU\nbasis establishes a 16-unit short route with a 14-unit reference shadow and a\nfully supported 36-unit long route, with all trace caps retained. This proves\nthe proposed route-class distinction, not a playable or rendered scene. Exact\nconnected-head and nonoverlapping actor staging belong to the scene contract;\ncurrent terrain edits and live interaction must still be verified.')
text = replace_one(text,
    'Both choices require the reversal: W-7744 holds a reference while Terra makes\nthe reciprocal crossing. After the earned comparison and physical clearance,\nhe makes the final grounded test on his own responsibility.',
    'Both choices require the reversal. Terra first mistakes having crossed for\nhaving finished the proof: `i walked it. i thought that finished the proof.`\nHer wanted comparison needs W-7744 to maintain a separate reference while she\nmoves through the part the fixed instrument cannot support. Actual completion\nof that passage earns `i needed the end he held.` She then explicitly offers\nand occupies a separate safe far reference. He makes the final grounded test\non his own responsibility under the same live range, solid sight, grounding,\noccupancy and body-clearance rules; retained proof is not unlimited sensing.')
text = replace_one(text,
    'and occupied position, never camera gaze, waiting, optional foliage density,\nmusic or interpretation. The trace reveals only walked ground.',
    'and occupied position, never camera gaze, waiting, optional foliage density,\nmusic or interpretation. The trace reveals only walked ground. Continuous\ndrawing keeps one quiet standing instruction, without a prompt or chime for\neach point or turn. Range failure, actual solid occlusion, unsafe footing and\ntemporary reference vacancy remain distinct and reversible.')
(repo / name).write_text(text)

name = 'main/PARAVOXIA_STORY_EXECUTION_PLAN.md'
text = (repo / name).read_text()
text = replace_one(text, 'Authority is the three-director `council-v1` candidate', 'Authority is the three-director `council-v2` candidate')
start = text.index('Before exact scene geometry is signed, establish two actual dry route/reference')
end = text.index('\nAcceptance is the run', start)
text = text[:start] + '''The council's measured geometry basis selects a 12-unit reference range and a
single passive backed instrument. The short route is 16 units with a 14-unit
housing shadow; the fixed-reference-supported longer route is 36 units (61
samples), 20 units and 125 percent longer. The common 18-unit passage has full
held-reference coverage and a real eight-unit contiguous portion outside the
fixed reference's useful coverage. The two route classes are therefore grounded
in CPU evidence; no playable, rendered or hardware result is implied.

The scene contract must bind the final connected head and separate near-end
body positions: Terra cannot start inside the worker who holds her reference.
After her actual comparison she explicitly offers and occupies the separate
far reference for his independently initiated test. All current range, solid
sight, grounding, occupancy and body-clearance rules remain active throughout.
The tested survey class and her earned comparison are separate saved facts.

Both independent caps (128 samples and 120 walked units) apply simultaneously;
a winding path may hit the point cap first. Neither cap may be silently relaxed
or a tested corner decimated. Keep one quiet instruction while tracing and
distinguish range, solid, footing and temporary vacancy holds. Exact scene
placement is bound before runtime; new interaction, day/night, actual terrain
edits, supported-tier and headed hardware proof follows signed implementation.
''' + text[end:]
(repo / name).write_text(text)

name = 'main/STORY.md'
text = (repo / name).read_text()
text = replace_one(text,
    'and revises a walked route; the two exchange witness positions before his\nindependent final test. The retained local result admits an incomplete model.',
    'and revises a walked route around one finite-range backed survey instrument.\n+Both the longer independently repeatable route and the shorter witnessed route\n+are complete choices. Terra must rely on his held reference to finish her own\n+comparison, then explicitly hold the far end for his independent final test.\n+The retained local result admits an incomplete model.'.replace('\n+', '\n'))
(repo / name).write_text(text)

receipt = json.loads((run / 'authority-patch-receipt.json').read_text())
receipt['candidateSha256'] = candidate_hash
receipt['decisionsSha256'] = hash_file(run / 'canon-decision-register.json')
receipt['iteration'] = 3
receipt['repairedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt['runtimeMutated'] = False
receipt['revision'] = 'council-v2'
diff = []
for entry in receipt['files']:
    name = entry['path']
    before = run / 'authority-before' / name
    after = repo / name
    entry['afterSha256'] = hash_file(after)
    destination = run / 'authority-after' / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(after.read_bytes())
    if before.read_bytes() != after.read_bytes():
        diff.append(f'diff --git a/{name} b/{name}\n')
        diff.extend(difflib.unified_diff(before.read_text().splitlines(True), after.read_text().splitlines(True), fromfile=f'a/{name}', tofile=f'b/{name}'))
(run / 'authority-patch-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
(run / 'implementation-diff.patch').write_text(''.join(diff))
print(json.dumps({'iteration': 3, 'candidateSha256': candidate_hash, 'files': len(receipt['files']), 'runtimeMutated': False}))
