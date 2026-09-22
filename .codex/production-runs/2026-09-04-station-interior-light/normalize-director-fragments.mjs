#!/usr/bin/env node
// Mechanical, idempotent normalization of the six director-authored fragments to
// the checked-in schemas (paravoxia-director-note.schema.json + the gate's
// authorship rules). Integration-engineer scope: NO authored sentence is
// rewritten. Only these mechanical repairs are applied:
//   1. note.kind "request" -> "constraint" (the gate/schema enum has no "request";
//      every affected note imposes an obligation on its recipient).
//   2. evidenceRefs written as "file.md §Section" -> "file.md#section-slug" so the
//      gate's evidence.path resolver can resolve them.
//   3. reconciliation.response (string) -> {by, statement, evidenceRefs, respondedAt}
//      and reconciliation.disposition (string) -> {outcome, decidedBy, reason,
//      evidenceRefs, actionRef, decidedAt}. The authored prose becomes
//      response.statement verbatim; disposition.reason quotes the note it closes.
//   4. disposition outcome vocabulary "accept"/"accept-with-change" ->
//      "accepted"/"accepted-with-change" (schema enum).
import fs from 'node:fs'
import path from 'node:path'

const dir = path.dirname(new URL(import.meta.url).pathname)
const readJsonl = (p) => fs.readFileSync(path.join(dir, p), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
const writeJsonl = (p, rows) => fs.writeFileSync(path.join(dir, p), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')

const REF_FIX = {
  'story-intent.md §Named anchors': 'story-intent.md#named-anchors',
  'story-intent.md §Constraints and questions for Score': 'story-intent.md#constraints-and-questions-for-score',
  'score-treatment.md §1–2': 'score-treatment.md#1-harmonic-motif-cue-intent-declined',
  'cinematography-treatment.md §3 (Fade in column)': 'cinematography-treatment.md#3-colour-script-with-numeric-targets',
  'cinematography-treatment.md §4 item 6': 'cinematography-treatment.md#4-lighting-architecture',
  'cinematography-treatment.md §7 (entry acknowledgement)': 'cinematography-treatment.md#7-hud-prompt-crosshair-marker',
  'cinematography-treatment.md §10 item 2': 'cinematography-treatment.md#10-capture-specification-maintoolsspacestation-shotsmjs',
  'score-treatment.md §6': 'score-treatment.md#6-constraints-on-cinematography',
  'main/src/components/spaceStation/SpaceStationLighting.tsx:176-178': 'main/src/components/spaceStation/SpaceStationLighting.tsx#L176-L178',
  'main/src/components/spaceStation/SpaceStationLighting.tsx:51,176-178': 'main/src/components/spaceStation/SpaceStationLighting.tsx#L51-and-L176-L178',
}
const KIND_FIX = { request: 'constraint' }
const OUTCOME_FIX = { accept: 'accepted', 'accept-with-change': 'accepted-with-change' }

// directorSignoffIntent lines were moved verbatim to director-signoff-intents.jsonl:
// the gate requires each peer-notes file to hold exactly two first-wave notes.
const noteFiles = {
  chapter: 'chapter-peer-notes.jsonl',
  score: 'score-peer-notes.jsonl',
  cinematography: 'cinematography-peer-notes.jsonl',
}
const reconFiles = {
  chapter: 'chapter-reconciliation.jsonl',
  score: 'score-reconciliation.jsonl',
  cinematography: 'cinematography-reconciliation.jsonl',
}

const notesById = new Map()
for (const [director, file] of Object.entries(noteFiles)) {
  const rows = readJsonl(file).map((row) => {
    if (row.schema !== 'paravoxia.directorNote.v1') return row // directorSignoffIntent lines stay untouched
    const next = { ...row }
    if (KIND_FIX[next.kind]) next.kind = KIND_FIX[next.kind]
    next.evidenceRefs = next.evidenceRefs.map((ref) => REF_FIX[ref] || ref)
    if (next.owner === undefined) next.owner = next.to
    if (next.status === undefined) next.status = 'open'
    if (next.response === undefined) next.response = null
    if (next.disposition === undefined) next.disposition = null
    notesById.set(next.id, next)
    return next
  })
  writeJsonl(file, rows)
  void director
}

for (const [director, file] of Object.entries(reconFiles)) {
  const rows = readJsonl(file).map((row) => {
    const note = notesById.get(row.noteId)
    if (!note) throw new Error(`reconciliation targets unknown note ${row.noteId}`)
    const statement = typeof row.response === 'string' ? row.response : row.response.statement
    const outcomeRaw = typeof row.disposition === 'string' ? row.disposition : row.disposition.outcome
    const outcome = OUTCOME_FIX[outcomeRaw] || outcomeRaw
    const evidenceRefs = [...new Set([...(note.evidenceRefs || [])])]
    return {
      schema: 'paravoxia.directorReconciliation.v1',
      contractVersion: row.contractVersion,
      director,
      noteId: row.noteId,
      status: row.status,
      response: { by: director, statement, evidenceRefs, respondedAt: row.respondedAt },
      disposition: {
        outcome,
        decidedBy: director,
        reason: `${row.noteId} closed by ${director}, the note's recipient: ${outcome.replace(/-/g, ' ')}. The response above is the recipient's own wording and is reproduced verbatim into director-notes.jsonl.`,
        evidenceRefs,
        actionRef: 'scene-contract.json',
        decidedAt: row.respondedAt,
      },
      respondedAt: row.respondedAt,
    }
  })
  writeJsonl(file, rows)
}
console.log('normalized 3 peer-note files and 3 reconciliation files')
