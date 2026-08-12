#!/usr/bin/env node
// Compiles director-notes.jsonl from the six director-authored sources without
// rewriting a single statement: each first-wave note is reproduced byte-level
// from its author's peer-notes file, then carries its recipient's
// reconciliation status/response/disposition verbatim (gate rule
// authorship.compiled-response). Orchestrator-run; deterministic.
import fs from 'node:fs'

const readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

const notes = [
  ...readJsonl('chapter-peer-notes.jsonl'),
  ...readJsonl('score-peer-notes.jsonl'),
  ...readJsonl('cinematography-peer-notes.jsonl'),
]
const reconciliations = [
  ...readJsonl('chapter-reconciliation.jsonl'),
  ...readJsonl('score-reconciliation.jsonl'),
  ...readJsonl('cinematography-reconciliation.jsonl'),
]

const reconByNote = new Map()
for (const r of reconciliations) {
  if (reconByNote.has(r.noteId)) throw new Error(`duplicate reconciliation for ${r.noteId}`)
  reconByNote.set(r.noteId, r)
}

const compiled = notes.map((note) => {
  const recon = reconByNote.get(note.id)
  if (!recon) throw new Error(`no reconciliation for ${note.id}`)
  if (recon.director !== note.to) throw new Error(`${note.id} reconciled by ${recon.director}, addressed to ${note.to}`)
  return { ...note, status: recon.status, response: recon.response, disposition: recon.disposition }
})

if (compiled.length !== 6) throw new Error(`expected 6 first-wave notes, got ${compiled.length}`)
fs.writeFileSync('director-notes.jsonl', compiled.map((n) => JSON.stringify(n)).join('\n') + '\n')
console.log(`compiled ${compiled.length} notes; ids: ${compiled.map((n) => n.id).join(', ')}`)
