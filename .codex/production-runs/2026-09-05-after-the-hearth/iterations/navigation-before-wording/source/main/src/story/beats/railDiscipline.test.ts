import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// --- Rail discipline -----------------------------------------------------------------
//
// A screening rail may move, look and act. It may NEVER grant an item, mark a
// milestone or advance a beat. Those are exactly the backstops that kept every
// ch1 movie run green on 2026-09-04 while a real player was stuck at
// `FIBER 4/6`; a rail that cannot make progress must report itself stuck so
// the run goes RED, not quietly succeed on the player's behalf.
//
// Enforced as a source scan because the repo has no ESLint config. It scans
// `src/story/beats/**/rail*.ts`; until Batch 5 lands rails there, it passes
// vacuously — but it is wired now so the rule is reviewed before it bites.

const FORBIDDEN = [
  /\baddItem\s*\(/,
  /\brequestPlayerNudge\s*\(/,
  /\bseed[A-Za-z]*Collected\s*\(/,
  /\bseedNavWaypointsReached\s*\(/,
  /\badvanceToBeat\s*\(/,
  /\bmarkMilestone\s*\(/,
  /\bgrantMissingCampfireMaterials\s*\(/
];

function railFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...railFiles(full));
    else if (/rail.*\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('rail discipline', () => {
  it('no rail module grants, marks or advances on the player\'s behalf', () => {
    const files = railFiles(new URL('.', import.meta.url).pathname);
    expect(files.length).toBe(29);
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('the autopilot has no force-grant or forced progression calls', () => {
    for (const file of ['../autopilot/primitives.ts', '../autopilot/resourceGathering.ts', '../emergentMovieRuntime.ts']) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(FORBIDDEN.filter(pattern => pattern.test(source)), file).toEqual([]);
    }
  });
});
