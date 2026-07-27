import { describe, expect, it } from 'vitest';
import { KEY_CODES } from '../../utils/mobileInput.ts';
import {
  dpadActionForBeat,
  dpadActiveKeys,
  dpadArmsForBeat,
  dpadDirectionKey,
  dpadEraTheme,
  dpadJumpForBeat,
  dpadSpecForBeat,
  dpadStaleHeldActionIds,
  dpadStaleHeldDirections,
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

describe('D-PAD per-beat arm sets', () => {
  it('exposes ONLY left/right on the pure 2D side-scroller eras', () => {
    for (const beat of ['ch1-fixed', 'ch1-raster', 'ch1-depth'] as const) {
      expect(dpadArmsForBeat(beat)).toEqual(['left', 'right']);
    }
  });

  it('opens the second axis (all four arms) on the top-down / iso eras', () => {
    for (const beat of ['ch1-nav', 'ch1-iso'] as const) {
      const arms = dpadArmsForBeat(beat);
      expect(new Set(arms)).toEqual(new Set(['up', 'down', 'left', 'right']));
      expect(arms).toHaveLength(4);
    }
  });
});

describe('D-PAD jump button', () => {
  it('rides every interactive monochrome-ladder beat and synthesizes Space', () => {
    for (const beat of ['ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso'] as const) {
      const jump = dpadJumpForBeat(beat);
      expect(jump?.id).toBe('jump');
      expect(jump?.label).toBe('JUMP');
      expect(jump?.code).toBe(KEY_CODES.jump);
      expect(jump?.code).toBe('Space'); // the desktop jump key.
    }
  });

  it('offers no jump off the early ladder', () => {
    for (const beat of ['ch1-anomaly', 'ch2-color', null] as const) {
      expect(dpadJumpForBeat(beat)).toBeNull();
    }
  });
});

describe('D-PAD combined per-beat spec', () => {
  it('2D beats: left/right + JUMP, and EXTRACT only on the harvest/quota beats', () => {
    const fixed = dpadSpecForBeat('ch1-fixed');
    expect(fixed.arms).toEqual(['left', 'right']);
    expect(fixed.jump?.label).toBe('JUMP');
    expect(fixed.action?.id).toBe('extract');

    const depth = dpadSpecForBeat('ch1-depth');
    expect(depth.arms).toEqual(['left', 'right']);
    expect(depth.jump?.label).toBe('JUMP');
    expect(depth.action).toBeNull(); // no invented verb on ch1-depth.
  });

  it('top-down/iso beats: four arms + JUMP, no extract verb', () => {
    for (const beat of ['ch1-nav', 'ch1-iso'] as const) {
      const spec = dpadSpecForBeat(beat);
      expect(spec.arms).toHaveLength(4);
      expect(spec.jump?.code).toBe(KEY_CODES.jump);
      expect(spec.action).toBeNull();
    }
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

describe('D-PAD held-control reconciliation (disappear-while-held)', () => {
  it('releases a held EXTRACT when the beat drops the verb (ch1-raster → ch1-depth)', () => {
    // The reported bug: EXTRACT (KeyE) held as the beat advances to ch1-depth,
    // where the button no longer exists — JUMP survives, EXTRACT is stale.
    const stale = dpadStaleHeldActionIds(['extract', 'jump'], dpadSpecForBeat('ch1-depth'));
    expect(stale).toEqual(['extract']);
  });

  it('keeps a held JUMP across a side-scroller beat change (it rides the ladder)', () => {
    expect(dpadStaleHeldActionIds(['jump'], dpadSpecForBeat('ch1-depth'))).toEqual([]);
    expect(dpadStaleHeldActionIds(['jump', 'extract'], dpadSpecForBeat('ch1-raster'))).toEqual([]);
  });

  it('releases a held vertical arm when the pad closes the second axis', () => {
    // Holding ▲ (up) into a one-axis side beat: up is gone, right stays.
    const stale = dpadStaleHeldDirections(['up', 'right'], dpadSpecForBeat('ch1-depth'));
    expect(stale).toEqual(['up']);
  });

  it('keeps held arms that the new beat still renders', () => {
    expect(dpadStaleHeldDirections(['left', 'right'], dpadSpecForBeat('ch1-depth'))).toEqual([]);
    expect(dpadStaleHeldDirections(['up', 'left'], dpadSpecForBeat('ch1-nav'))).toEqual([]);
  });

  it('is a no-op when nothing is held', () => {
    expect(dpadStaleHeldDirections([], dpadSpecForBeat('ch1-depth'))).toEqual([]);
    expect(dpadStaleHeldActionIds([], dpadSpecForBeat('ch1-depth'))).toEqual([]);
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
