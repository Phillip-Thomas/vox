import { describe, expect, it } from 'vitest';
import { KEY_CODES } from '../../utils/mobileInput.ts';
import {
  dpadActionForBeat,
  dpadActiveKeys,
  dpadDirectionKey,
  dpadEraTheme,
  FEED_DPAD_INK
} from './TouchDPad.model.ts';
import { storyUsesEarlyTouchDpad, type StorySnapshot } from '../../story/storyState.ts';

const snap = (over: Partial<StorySnapshot>): StorySnapshot => ({
  active: true,
  chapter: 'ch1',
  beat: 'ch1-fixed',
  runId: 0,
  ...over
});

describe('early touch D-PAD mount predicate', () => {
  it('mounts only on the interactive monochrome-ladder beats', () => {
    for (const beat of ['ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso'] as const) {
      expect(storyUsesEarlyTouchDpad(snap({ beat }))).toBe(true);
    }
  });

  it('never mounts on the frozen "plays" cutscenes or the descent', () => {
    for (const beat of ['descent', 'ch1-track', 'ch1-lift'] as const) {
      expect(storyUsesEarlyTouchDpad(snap({ beat }))).toBe(false);
    }
  });

  it('never mounts on the prologue overlays', () => {
    for (const beat of ['crawl', 'manifest', 'voyage', 'deflect', 'crash'] as const) {
      expect(storyUsesEarlyTouchDpad(snap({ chapter: 'prologue', beat }))).toBe(false);
    }
  });

  it('never mounts from the embodied survey (ch1-anomaly) onward', () => {
    expect(storyUsesEarlyTouchDpad(snap({ beat: 'ch1-anomaly' }))).toBe(false);
    expect(storyUsesEarlyTouchDpad(snap({ chapter: 'ch2', beat: 'ch2-color' }))).toBe(false);
    expect(storyUsesEarlyTouchDpad(snap({ chapter: 'ch3', beat: 'ch3-gather' }))).toBe(false);
  });

  it('never mounts when the story is inactive or beatless', () => {
    expect(storyUsesEarlyTouchDpad(snap({ active: false }))).toBe(false);
    expect(storyUsesEarlyTouchDpad(snap({ beat: null }))).toBe(false);
  });
});

describe('D-PAD discrete direction → WASD synthesis', () => {
  it('maps each cardinal direction to the controllers\' movement code', () => {
    expect(dpadDirectionKey('up')).toBe(KEY_CODES.forward);
    expect(dpadDirectionKey('down')).toBe(KEY_CODES.backward);
    expect(dpadDirectionKey('left')).toBe(KEY_CODES.left);
    expect(dpadDirectionKey('right')).toBe(KEY_CODES.right);
  });

  it('holds two adjacent codes for a multitouch diagonal (8-way, no analog)', () => {
    const codes = dpadActiveKeys(['up', 'right']);
    expect(codes).toContain(KEY_CODES.forward);
    expect(codes).toContain(KEY_CODES.right);
    expect(codes).toHaveLength(2);
  });

  it('de-duplicates repeated directions and yields nothing when idle', () => {
    expect(dpadActiveKeys(['left', 'left'])).toEqual([KEY_CODES.left]);
    expect(dpadActiveKeys([])).toEqual([]);
  });
});

describe('D-PAD contextual action', () => {
  it('offers an EXTRACT button wired to the desktop harvest key on the harvest/quota beats', () => {
    for (const beat of ['ch1-fixed', 'ch1-raster'] as const) {
      const action = dpadActionForBeat(beat);
      expect(action?.id).toBe('extract');
      expect(action?.code).toBe(KEY_CODES.mine); // 'KeyE'
    }
  });

  it('shows no action button on the pure traversal beats', () => {
    for (const beat of ['ch1-depth', 'ch1-nav', 'ch1-iso'] as const) {
      expect(dpadActionForBeat(beat)).toBeNull();
    }
  });
});

describe('D-PAD era theming', () => {
  it('sources the monochrome regulation-feed ink for the whole ch1 ladder', () => {
    for (const beat of ['ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso'] as const) {
      const eraTheme = dpadEraTheme(beat);
      expect(eraTheme.monochrome).toBe(true);
      expect(eraTheme.ink).toBe(FEED_DPAD_INK);
      // Never the cyan HUD accent — the CCTV era is black-and-white.
      expect(eraTheme.ink).not.toContain('125,211,252');
    }
  });
});
