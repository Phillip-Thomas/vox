import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The screening advances the station transaction by clicking the story panel's
// OWN action buttons — it never calls a commit directly, so it cannot acquire
// the bonded cell by a route a player could not take.
//
// That only holds while the two lists agree. If the authored flow gains a step
// and the screening does not know its test id, the movie stalls at a panel with
// a button it never presses — which reads as a hang, the exact failure the
// screening exists to remove.

const panel = readFileSync(
  new URL('./StationStoryPanel.tsx', import.meta.url),
  'utf8'
);
const driver = readFileSync(
  new URL('./StationScreeningDriver.tsx', import.meta.url),
  'utf8'
);

function panelActionIds(): string[] {
  return [...panel.matchAll(/testId="([^"]+)"/g)].map(match => match[1]);
}

describe('station screening action coverage', () => {
  it('knows every action the authored story panel can offer', () => {
    const missing = panelActionIds().filter(id => !driver.includes(`'${id}'`));
    expect(missing).toEqual([]);
  });

  it('lists no action the panel cannot render', () => {
    const listed = [...driver.matchAll(/'(spaceStation-[a-z-]+)'/g)].map(m => m[1]);
    const unknown = listed.filter(id => !panelActionIds().includes(id));
    expect(unknown).toEqual([]);
  });

  it('advances by clicking, never by committing directly', () => {
    // The whole point: no commit seam is imported here.
    expect(driver).not.toContain('issueBondedCell');
    expect(driver).not.toContain('commitRegistryRecorded');
    expect(driver).not.toContain('commitDesignationPresented');
    expect(driver).toContain('action.click()');
  });
});
