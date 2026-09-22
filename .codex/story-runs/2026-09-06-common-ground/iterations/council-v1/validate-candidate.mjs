import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const checks = [];
const check = (id, passed, detail = '') => checks.push({ id, passed: Boolean(passed), detail });
const roles = ['chapter', 'score', 'cinematography'];

try {
  const candidateSha256 = hash('story-authority-candidate.md');
  const decisionsSha256 = hash('canon-decision-register.json');
  const signatures = read('director-signoffs.json');
  check('three-unique-directors', signatures.signoffs.length === 3
    && new Set(signatures.signoffs.map(s => s.director)).size === 3);
  for (const role of roles) {
    const original = read(`${role}-story-signoff.json`);
    const compiled = signatures.signoffs.find(s => s.director === role);
    check(`${role}-signature-lossless`, JSON.stringify(original) === JSON.stringify(compiled));
    check(`${role}-candidate-hash`, original.candidateSha256 === candidateSha256);
    check(`${role}-decisions-hash`, original.decisionsSha256 === decisionsSha256);
    check(`${role}-approves`, ['approve', 'approve-with-notes'].includes(original.disposition));
  }
  const compiledNotes = read('director-notes.json');
  const routes = new Set();
  const allIds = new Set();
  for (const role of roles) {
    const notes = read(`${role}-peer-notes.json`).notes;
    for (const note of notes) {
      check(`note-${note.id}-unique`, !allIds.has(note.id));
      allIds.add(note.id);
      routes.add(`${note.from}->${note.to}`);
      check(`note-${note.id}-authorship`, note.from === role && role !== note.to);
      const recipient = read(`${note.to}-reconciliation.json`).responses.find(r => r.noteId === note.id);
      check(`note-${note.id}-recipient`, recipient?.by === note.to);
      const row = compiledNotes.notes.find(n => n.id === note.id);
      check(`note-${note.id}-lossless`, JSON.stringify(row?.note) === JSON.stringify(note)
        && JSON.stringify(row?.response) === JSON.stringify(recipient));
      check(`note-${note.id}-blocking-closed`, !['critical', 'high', 'blocking', 'major'].includes(note.severity)
        || ['accepted', 'resolved', 'withdrawn-with-reason'].includes(recipient?.status));
    }
  }
  check('all-six-peer-routes', roles.every(a => roles.filter(b => b !== a).every(b => routes.has(`${a}->${b}`))));
  const blind = read('blind-invocation-receipt.json');
  check('blind-corpus-hash', blind.corpusSha256 === hash('shipped-copy-corpus.md'));
  check('blind-one-resource', JSON.stringify(blind.allowedResourceHashes) === JSON.stringify([blind.corpusSha256]));
  check('blind-no-tools', blind.tools.length === 0);
  check('blind-no-project-context', blind.projectContextLoaded === false && blind.canonExposure === false);
  check('blind-report-exists', fs.readFileSync(path.join(root, 'naive-reader-report.md'), 'utf8').length > 500);
  const decisions = read('canon-decision-register.json');
  check('no-inferred-owner-decisions', decisions.ownerOnlyChoicesInferred === 0);
  check('decisions-explicit', decisions.decisions.every(d => d.id && d.currentState && d.proposedState && d.authority));
  if (process.argv.includes('--owner')) {
    const owner = read('owner-story-decision.json');
    const standing = read('owner-standing-authority.json');
    check('owner-candidate-hash', owner.candidateSha256 === candidateSha256);
    check('owner-decision-hash', owner.decisionsSha256 === decisionsSha256);
    check('owner-standing-authority-hash', owner.authoritySha256 === hash('owner-standing-authority.json'));
    check('owner-authority-exact', standing.instructions.includes('yes continue, and please auto approve everything'));
    check('owner-honest-delegation', owner.authorityKind === 'standing-user-delegation' && owner.personallyReviewedByUser === false);
    check('owner-approved', owner.disposition === 'approve');
  }
} catch (error) {
  check('artifact-read', false, error.message);
}
const report = { schema: 'paravoxia.storyCandidateValidation.v1', checkedAt: new Date().toISOString(), passed: checks.every(c => c.passed), checks };
fs.writeFileSync(path.join(root, 'candidate-validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.passed, checks: checks.length, failures: checks.filter(c => !c.passed) }));
process.exitCode = report.passed ? 0 : 1;
