import { describe, expect, it } from 'vitest';
import { allowsMovieTeleportRecovery } from './autopilotSafety.ts';

describe('movie autopilot safety boundary', () => {
  it('forbids teleport recovery throughout the signed emergent rail', () => {
    for (const beat of [
      'ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale',
      'ch5-maw', 'ch6-dive', 'ch7-reconstruct', 'ch7-board',
      'ch8-launch', 'ch8-crossing', 'ch8-landfall', 'ch9-settle', 'ch9-hearth'
    ] as const) {
      expect(allowsMovieTeleportRecovery(beat)).toBe(false);
    }
  });

  it('keeps the legacy presentation-ladder development escape hatch separate', () => {
    expect(allowsMovieTeleportRecovery('ch3-gather')).toBe(true);
    expect(allowsMovieTeleportRecovery(null)).toBe(false);
  });
});
