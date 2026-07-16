import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStationAccessSource,
  getAccessibleStations,
  resetStationAccessSources,
  setStationAccessSource,
  subscribeStationAccess
} from './stations.ts';

describe('runtime station access sources', () => {
  beforeEach(() => resetStationAccessSources());
  afterEach(() => resetStationAccessSources());

  it('is hand-only by default and unions live sources in canonical order', () => {
    expect(getAccessibleStations()).toEqual(['hand']);

    setStationAccessSource('wreck-bench', ['assembler', 'smelter']);
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler']);

    setStationAccessSource('survey-site', ['survey_console']);
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler', 'survey_console']);

    clearStationAccessSource('wreck-bench');
    expect(getAccessibleStations()).toEqual(['hand', 'survey_console']);
    clearStationAccessSource('survey-site');
    expect(getAccessibleStations()).toEqual(['hand']);
  });

  it('notifies consumers only when a source state changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStationAccess(listener);

    setStationAccessSource('wreck-bench', ['smelter', 'assembler']);
    setStationAccessSource('wreck-bench', ['smelter', 'assembler']);
    clearStationAccessSource('missing');
    expect(listener).toHaveBeenCalledTimes(1);

    clearStationAccessSource('wreck-bench');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
