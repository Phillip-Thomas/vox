import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import SoundCaption, {
  SOUND_CAPTION_DESKTOP_TOP_PX,
  SOUND_CAPTION_NARROW_WIDTH_PX,
  SOUND_CAPTION_TOUCH_GAP_PX,
  clearSoundCaptions,
  postSoundCaption,
  readSoundCaption,
  solveSoundCaptionPlacement,
  subscribeSoundCaptions
} from './SoundCaption.tsx';

afterEach(() => clearSoundCaptions());

describe('the sound-caption surface', () => {
  it('renders nothing until a cue is posted', () => {
    expect(renderToStaticMarkup(<SoundCaption />)).toBe('');
  });

  it('registers on the informational layer, never the caption layer', () => {
    postSoundCaption('alarm');
    const markup = renderToStaticMarkup(<SoundCaption />);
    expect(markup).toContain('data-hud-surface="sound-caption"');
    expect(markup).toContain('data-hud-layer="informational"');
    expect(markup).not.toContain('data-hud-layer="caption"');
  });

  it('renders the bracketed label in the audit band\'s mono type', () => {
    postSoundCaption('static');
    const markup = renderToStaticMarkup(<SoundCaption />);
    expect(markup).toContain('[STATIC]');
    expect(markup).toContain('font-size:12px');
    expect(markup).toContain('letter-spacing:0.14em');
    expect(markup).toContain('text-transform:uppercase');
  });

  it('refuses to raise a caption for a deliberately uncaptioned cue', () => {
    expect(postSoundCaption('narrator-utterance')).toBe(false);
    expect(postSoundCaption('objective-complete')).toBe(false);
    expect(postSoundCaption('marker-acquired')).toBe(false);
    expect(postSoundCaption('oxygen-pulse')).toBe(false);
    expect(readSoundCaption()).toBeNull();
    expect(renderToStaticMarkup(<SoundCaption />)).toBe('');
  });

  it('restarts the hold rather than stacking when the same cue repeats', () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeSoundCaptions(event => seen.push(event ? event.label : null));
    postSoundCaption('alarm');
    const first = readSoundCaption()!;
    postSoundCaption('alarm');
    const second = readSoundCaption()!;
    unsubscribe();

    expect(second.id).toBe('alarm');
    expect(second.token).toBeGreaterThan(first.token);
    expect(seen).toEqual(['[ALARM]', '[ALARM]']);
    // One caption on screen, not two.
    const markup = renderToStaticMarkup(<SoundCaption />);
    expect(markup.match(/data-sound-caption=/g)).toHaveLength(1);
  });

  it('drops the fade transition under reduced motion', () => {
    postSoundCaption('impact', { reducedMotion: true });
    const markup = renderToStaticMarkup(<SoundCaption />);
    expect(markup).toContain('data-sound-caption-reduced-motion="true"');
    expect(markup).toContain('transition:none');

    clearSoundCaptions();
    postSoundCaption('impact');
    expect(renderToStaticMarkup(<SoundCaption />)).toContain('transition:opacity 300ms linear');
  });

  it('places itself top-right on desktop', () => {
    const placement = solveSoundCaptionPlacement({
      viewportWidthPx: 1920,
      touch: false,
      touchControlClearancePx: 0
    });
    expect(placement.top).toBe(`${SOUND_CAPTION_DESKTOP_TOP_PX}px`);
    expect(placement.bottom).toBeNull();
    expect(placement.align).toBe('right');
  });

  it('clears the touch controls and never sits bottom-centre', () => {
    const placement = solveSoundCaptionPlacement({
      viewportWidthPx: 390,
      touch: true,
      touchControlClearancePx: 174
    });
    expect(placement.bottom).toBe(`${174 + SOUND_CAPTION_TOUCH_GAP_PX}px`);
    expect(placement.top).toBeNull();
    // Right-anchored: bottom-centre is the story captions' home.
    expect(placement.align).toBe('right');
    expect(placement.right).toBeTruthy();
  });

  it('uses the touch form on a narrow desktop viewport too', () => {
    const placement = solveSoundCaptionPlacement({
      viewportWidthPx: SOUND_CAPTION_NARROW_WIDTH_PX - 1,
      touch: false,
      touchControlClearancePx: 0
    });
    expect(placement.top).toBeNull();
  });
});
