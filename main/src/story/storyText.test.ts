import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuditLine,
  clearStoryText,
  getStoryText,
  getStoryTextVersion,
  showAuditLine,
  showCaption,
  subscribeStoryText
} from './storyText.ts';

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The single ch7 exit string this production run changed, owner-approved
 * 2026-08-10. The retired parenthetical must not survive anywhere in the
 * client the player is served.
 */
// Assembled rather than written out: this file is inside the scanned tree, and
// a literal here would be the very occurrence the scan must not find.
const RETIRED_CH7_EXIT_LINE = `(the scar remains. now it can carry ${'you'}.)`;
const APPROVED_CH7_EXIT_LINE = `the scar remains. now it can carry ${'me'}.`;

function walkSourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(path, found);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|json|css|html)$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe('story text bands', () => {
  beforeEach(() => {
    clearStoryText();
  });

  it('carries the approved ch7 exit line and no trace of the retired one', () => {
    const offenders: string[] = [];
    let approvedOccurrences = 0;
    for (const path of walkSourceFiles(SRC_ROOT)) {
      const source = readFileSync(path, 'utf8');
      if (source.includes(RETIRED_CH7_EXIT_LINE)) offenders.push(path);
      if (source.includes(APPROVED_CH7_EXIT_LINE)) approvedOccurrences++;
    }
    expect(offenders).toEqual([]);
    expect(approvedOccurrences).toBeGreaterThan(0);
  });

  it('holds exactly one caption and one audit line, replaced by cut rather than queued', () => {
    // The cadence in the story director IS the scheduler; these bands have no
    // queue, so a later line always replaces the one before it.
    showCaption('first');
    showCaption('second');
    expect(getStoryText().caption?.text).toBe('second');

    showAuditLine('ROW ONE', 'AUDIT NETWORK');
    showAuditLine('ROW TWO', 'AUDIT NETWORK');
    expect(getStoryText().audit).toMatchObject({ text: 'ROW TWO', header: 'AUDIT NETWORK' });
  });

  it('keeps the regulation header beside its body and clears both bands independently', () => {
    showCaption('the voice answers.');
    showAuditLine('POWER BUS LIVE · TRANSPONDER ARMED', 'WRECK RELAY');
    expect(getStoryText().audit).toMatchObject({
      text: 'POWER BUS LIVE · TRANSPONDER ARMED',
      header: 'WRECK RELAY'
    });

    clearAuditLine();
    expect(getStoryText().audit).toBeNull();
    expect(getStoryText().caption?.text).toBe('the voice answers.');
  });

  it('publishes a version change for every emission so recorders cannot miss a line', () => {
    const seen: string[] = [];
    const stop = subscribeStoryText(() => {
      const audit = getStoryText().audit;
      if (audit) seen.push(audit.text);
    });
    const before = getStoryTextVersion();
    showAuditLine('AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED', 'AUDIT NETWORK');
    showAuditLine('CONTACT LOGGED.', 'AUDIT NETWORK');
    stop();
    expect(seen).toEqual([
      'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED',
      'CONTACT LOGGED.'
    ]);
    expect(getStoryTextVersion()).toBeGreaterThan(before);
  });
});
