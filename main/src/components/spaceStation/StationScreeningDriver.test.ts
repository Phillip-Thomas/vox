import { describe, expect, it } from 'vitest';
import { stationScreeningTransactionComplete } from './StationScreeningDriver.tsx';

describe('station screening completion evidence', () => {
  it('requires both the accepted transaction and the carried bonded cell', () => {
    expect(stationScreeningTransactionComplete(false, 0)).toBe(false);
    expect(stationScreeningTransactionComplete(false, 1)).toBe(false);
    expect(stationScreeningTransactionComplete(true, 0)).toBe(false);
    expect(stationScreeningTransactionComplete(true, 1)).toBe(true);
  });
});
