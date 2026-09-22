import fs from 'node:fs';
import path from 'node:path';
import { requireThat, sha } from './contract.mjs';
import { checkRef, readJson, inside } from './store.mjs';

// Migration imports creative decisions, never acceptance. The renewed allowance
// is explicitly recorded alongside, rather than replacing, historical spend.
export function continuation(repo, brief) {
  const c = brief.continuation;
  if (!c) return null;
  const authority = readJson(checkRef(repo, c.authority));
  requireThat(authority.schema === 'paravoxia.chapterLoopResumeAuthority.v1' && authority.chapter === brief.chapter,
    'Continuation needs a chapter-specific owner resume receipt');
  requireThat(authority.instruction === 'now continue using this new workflow' && authority.resume === true && authority.newBoundedAllowance === true,
    'Migration does not infer a new allowance from an old stop');
  const contract = readJson(checkRef(repo, c.contract));
  requireThat(contract.status === 'frozen', 'Only a frozen creative contract can be imported');
  const directors = new Set();
  for (const ref of c.signoffs) {
    const signoff = readJson(checkRef(repo, ref));
    requireThat(signoff.contractSha256 === c.contract.sha256 && ['approve', 'approve-with-notes'].includes(signoff.disposition), 'Imported creative signoff is stale or unapproved');
    directors.add(signoff.director);
  }
  requireThat(directors.size === 3, 'All three creative peers must have signed this exact contract');
  const manifest = readJson(checkRef(repo, c.sourceManifest));
  requireThat(manifest.contractSha256 === c.contract.sha256 && Object.keys(manifest.hashes ?? {}).length > 0, 'Missing source/contract binding');
  for (const [name, hash] of Object.entries(manifest.hashes)) requireThat(sha(fs.readFileSync(inside(repo, name))) === hash, `Continuation source changed: ${name}`);
  const historical = readJson(checkRef(repo, c.priorUsage));
  requireThat(historical.totals && Number.isFinite(historical.totals.turns), 'Historical usage receipt is required');
  return {
    refs: [c.authority, c.contract, ...c.signoffs, c.sourceManifest, c.priorUsage],
    prior: { run: path.dirname(c.contract.path), usage: historical.totals, scope: historical.scope, retained: true },
    recipe: { schema: 'paravoxia.chapterRecipe.v1', chapter: brief.chapter, imported: true, contract: c.contract, signoffs: c.signoffs,
      anchors: contract.syncAnchors.map(x => ({ id: x.id, event: x.event ?? x.trigger })),
      lanes: {
        plan: Object.fromEntries(['purpose', 'emotionalBefore', 'emotionalAfter', 'intendedAmbiguity', 'nonNegotiableCanon'].map(k => [k, contract.story[k]])),
        cinema: { direction: contract.cinematography, palette: contract.palette },
        'score-plan': { direction: contract.score },
      },
      scope: { title: contract.scope.title, beats: contract.scope.beats },
      note: 'Exact approved direction imported. Existing implementation and evidence remain provisional until the new loop verifies them.' },
  };
}
