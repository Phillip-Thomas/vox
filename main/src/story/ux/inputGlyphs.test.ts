import { describe, expect, it } from 'vitest';
import { presentInputGlyphs, presentStoryGuidanceLine } from './inputGlyphs.ts';

describe('inputGlyphs presenter', () => {
  it('passes every line through untouched on desktop', () => {
    for (const context of ['embodied', 'feed', 'prologue'] as const) {
      expect(presentInputGlyphs('[F] EAT.', false, context)).toBe('[F] EAT.');
      expect(presentInputGlyphs('TRAVERSE [A]/[D]', false, context)).toBe('TRAVERSE [A]/[D]');
    }
  });

  describe('embodied context (default) stays byte-identical to the shipped table', () => {
    it('maps the original six tokens exactly', () => {
      expect(presentStoryGuidanceLine('[F] EAT.', true)).toBe('[USE] EAT.');
      expect(presentStoryGuidanceLine('[G] EAT.', true)).toBe('[CONSUME] EAT.');
      expect(presentStoryGuidanceLine('HOLD [SPACE] TO LIFT.', true)).toBe('HOLD [THRUST] TO LIFT.');
      expect(presentStoryGuidanceLine('HOLD [E] TO EXTRACT.', true)).toBe('HOLD [MINE] TO EXTRACT.');
      expect(presentStoryGuidanceLine('[C] CRAFT A STONE HATCHET.', true)).toBe('[FABRICATOR] CRAFT A STONE HATCHET.');
      expect(presentStoryGuidanceLine('[B] PLACE A FOUNDATION.', true)).toBe('[BUILD] PLACE A FOUNDATION.');
    });

    it('names the run cue and chart hint the awakened captions carry', () => {
      expect(presentInputGlyphs('run. the legs already know the word. [SHIFT]', true))
        .toBe('run. the legs already know the word. [SPRINT]');
      expect(presentInputGlyphs('the view from above knows where the light pools. [M]', true))
        .toBe('the view from above knows where the light pools. [CHART]');
    });

    it('defaults to embodied when no context is given', () => {
      expect(presentInputGlyphs('[E] EAT.', true)).toBe('[MINE] EAT.');
    });
  });

  describe('feed context names the regulation-feed controls', () => {
    it('turns movement into d-pad arrows', () => {
      expect(presentInputGlyphs('WORK LINE LOCKED · [A]/[D]', true, 'feed'))
        .toBe('WORK LINE LOCKED · [◀]/[▶]');
      expect(presentInputGlyphs('VECTOR · [W]/[S]', true, 'feed')).toBe('VECTOR · [▲]/[▼]');
    });

    it('uses JUMP and EXTRACT, not flight thrust or MINE', () => {
      expect(presentInputGlyphs('ASCEND [SPACE] · THE STAIRS FACE THE STRIP', true, 'feed'))
        .toBe('ASCEND [JUMP] · THE STAIRS FACE THE STRIP');
      expect(presentInputGlyphs('TRAVERSE [A]/[D] · EXTRACT: HOLD [E]', true, 'feed'))
        .toBe('TRAVERSE [◀]/[▶] · EXTRACT: HOLD [EXTRACT]');
      expect(presentInputGlyphs('[F] MINE', true, 'feed')).toBe('[USE] MINE');
    });

    it('names the survey chart and does not disturb [SPACE]/[SHIFT] lookalikes', () => {
      expect(presentInputGlyphs('THIS VIEW WILL BE RETAINED AS: SURVEY CHART [M].', true, 'feed'))
        .toBe('THIS VIEW WILL BE RETAINED AS: SURVEY CHART [CHART].');
      // [S] must not eat [SPACE] or [SHIFT].
      expect(presentInputGlyphs('[SPACE] [SHIFT] [S]', true, 'feed')).toBe('[JUMP] [SPRINT] [▼]');
    });
  });

  describe('chartActionable option', () => {
    it('strips the [M]/chart token where the chart is not openable, with no stray space', () => {
      // The ch1-nav retained-tool line: no touch control opens the chart yet, so
      // it must not present [CHART] as an actionable button.
      const nav = presentInputGlyphs(
        'THIS VIEW WILL BE RETAINED AS: SURVEY CHART [M].',
        true,
        'feed',
        { chartActionable: false }
      );
      expect(nav).toBe('THIS VIEW WILL BE RETAINED AS: SURVEY CHART.');
      expect(nav).not.toContain('[CHART]');
      expect(nav).not.toContain('[M]');
    });

    it('leaves other tokens on the line intact when the chart is inert', () => {
      expect(presentInputGlyphs('TRAVERSE [A]/[D] · CHART [M]', true, 'feed', { chartActionable: false }))
        .toBe('TRAVERSE [◀]/[▶] · CHART');
    });

    it('still actionizes the chart when openable (default) and on the embodied day hint', () => {
      expect(presentInputGlyphs('SURVEY CHART [M].', true, 'feed', { chartActionable: true }))
        .toBe('SURVEY CHART [CHART].');
      expect(presentInputGlyphs('the view from above knows where the light pools. [M]', true, 'embodied', { chartActionable: false }))
        .toBe('the view from above knows where the light pools.');
    });

    it('never alters desktop output regardless of the flag', () => {
      expect(presentInputGlyphs('SURVEY CHART [M].', false, 'feed', { chartActionable: false }))
        .toBe('SURVEY CHART [M].');
    });
  });

  describe('prologue context', () => {
    it('collapses the deflection subtitle to its drag instruction', () => {
      expect(presentInputGlyphs('VECTOR THE INTAKE SHIELD · [MOUSE] OR [W]/[S]', true, 'prologue'))
        .toBe('DRAG TO VECTOR THE INTAKE SHIELD');
    });

    it('turns full-screen advance prompts into tap instructions', () => {
      expect(presentInputGlyphs('[F] BRACE FOR SURFACE', true, 'prologue')).toBe('TAP TO BRACE FOR SURFACE');
      expect(presentInputGlyphs('[TAB] SKIP TRANSMISSION', true, 'prologue')).toBe('TAP TO SKIP TRANSMISSION');
      expect(presentInputGlyphs('[ENTER] EXPEDITE PROCESSING', true, 'prologue')).toBe('TAP TO EXPEDITE PROCESSING');
      expect(presentInputGlyphs('[ENTER] CONTINUE', true, 'prologue')).toBe('TAP TO CONTINUE');
    });

    it('only rewrites the LEADING advance token, not mid-line brackets', () => {
      expect(presentInputGlyphs('HOLD [F] STEADY', true, 'prologue')).toBe('HOLD [F] STEADY');
    });
  });
});
