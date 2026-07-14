import { describe, expect, it } from 'vitest';
import { CRAWL_LINES } from '../storyScript.ts';
import {
  regulationCrawlDurationSeconds,
  regulationCrawlScreenTargets,
  solveRegulationCrawlOffset
} from './regulationCrawlTiming.ts';

describe('regulation crawl timing', () => {
  it('derives one brisk but readable clock from the complete notice', () => {
    expect(CRAWL_LINES).toHaveLength(44);
    expect(regulationCrawlDurationSeconds(CRAWL_LINES)).toBe(68);
  });

  it('starts low and finishes high inside every viewport', () => {
    const desktop = regulationCrawlScreenTargets(720);
    expect(desktop.firstLineCenter).toBeCloseTo(518.4, 5);
    expect(desktop.lastLineCenter).toBeCloseTo(201.6, 5);

    const mobile = regulationCrawlScreenTargets(844);
    expect(mobile.firstLineCenter).toBeCloseTo(607.68, 5);
    expect(mobile.lastLineCenter).toBeCloseTo(236.32, 5);
  });

  it('solves responsive transform offsets without assuming a fixed viewport', () => {
    const sampleCenter = (offset: number) => 100 + offset * 0.5;
    expect(solveRegulationCrawlOffset(350, 0, 1000, sampleCenter)).toBeCloseTo(500, 5);
    expect(solveRegulationCrawlOffset(-20, 0, 1000, sampleCenter)).toBe(0);
    expect(solveRegulationCrawlOffset(700, 0, 1000, sampleCenter)).toBe(1000);
  });
});
