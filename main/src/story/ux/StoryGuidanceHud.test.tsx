import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StoryGuidanceHud, { getStoryGuidanceHudPlacement } from './StoryGuidanceHud.tsx';
import { STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX } from './storyHudLayout.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  observeGuidedStoryMarker
} from './objectiveDirector.ts';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

afterEach(() => clearGuidedStoryObjective());

describe('free-era story guidance HUD', () => {
  it('keeps the current directive visible after the regulation feed is gone', () => {
    activateGuidedStoryObjective({
      id: 'settle:install-core',
      kind: 'interact',
      markerLabel: 'CHOSEN SITE · INSTALL HABITAT CORE',
      workOrder: ['RETURN TO THE CHOSEN FOUNDATION.', '[F] INSTALL HABITAT CORE.']
    });
    observeGuidedStoryMarker('CHOSEN SITE · INSTALL HABITAT CORE');

    const markup = renderToStaticMarkup(<StoryGuidanceHud />);
    expect(markup).toContain('CURRENT OBJECTIVE');
    expect(markup).toContain('CHOSEN SITE · INSTALL HABITAT CORE');
    expect(markup).toContain('[F] INSTALL HABITAT CORE.');
    expect(markup).toContain('data-objective-id="settle:install-core"');
    expect(markup).toContain('data-objective-marker-label="CHOSEN SITE · INSTALL HABITAT CORE"');
    expect(markup).toContain('data-objective-health="ready"');
    expect(markup).toContain('data-objective-requires-marker="true"');
    expect(markup).not.toContain('ROUTE RECALIBRATING');
  });

  it('publishes missing-marker health instead of presenting an unverified route as ready', () => {
    activateGuidedStoryObjective({
      id: 'maw:recover-field-kit',
      kind: 'interact',
      markerLabel: 'W-7744 FIELD PACK · RECOVER KIT',
      workOrder: ['FOLLOW THE FIELD PACK MARKER.', '[F] RECOVER THE FIELD KIT.']
    });

    const markup = renderToStaticMarkup(<StoryGuidanceHud />);
    expect(markup).toContain('data-objective-id="maw:recover-field-kit"');
    expect(markup).toContain('data-objective-health="missing-marker"');
    expect(markup).toContain('data-objective-requires-marker="true"');
    expect(markup).toContain('ROUTE RECALIBRATING');
  });

  it('explicitly marks objectives that do not require a directional marker', () => {
    activateGuidedStoryObjective({
      id: 'maw:purpose-gap',
      kind: 'wait',
      markerLabel: 'REPAIRED MAW · LISTEN',
      workOrder: ['WAIT. LISTEN BEFORE ASSIGNING IT A PURPOSE.'],
      requiresMarker: false
    });

    const markup = renderToStaticMarkup(<StoryGuidanceHud />);
    expect(markup).toContain('data-objective-id="maw:purpose-gap"');
    expect(markup).toContain('data-objective-health="ready"');
    expect(markup).toContain('data-objective-requires-marker="false"');
  });

  it('renders nothing when no guided chapter objective is active', () => {
    expect(renderToStaticMarkup(<StoryGuidanceHud />)).toBe('');
  });

  it('keeps the mobile card above the movement joystick and inside device safe areas', () => {
    const placement = getStoryGuidanceHudPlacement(true);
    expect(placement.bottom).toContain(`${STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX}px`);
    expect(placement.bottom).toContain('safe-area-inset-bottom');
    expect(placement.left).toContain('safe-area-inset-left');
    expect(placement.width).toContain('safe-area-inset-right');
  });

  it('does not repeat a single-line action as its own context', () => {
    activateGuidedStoryObjective({
      id: 'reconstruct:ready',
      kind: 'interact',
      markerLabel: 'KESTREL HATCH · BOARD',
      workOrder: ['[F] ENTER THROUGH THE HATCH.']
    });

    const markup = renderToStaticMarkup(<StoryGuidanceHud />);
    expect(markup.match(/\[F\] ENTER THROUGH THE HATCH\./g)).toHaveLength(1);
  });
});
