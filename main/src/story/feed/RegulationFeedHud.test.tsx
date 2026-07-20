import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setInteraction } from '../../game/systems/interactionSystem.ts';
import { clearStoryText } from '../storyText.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  observeGuidedStoryMarker
} from '../ux/objectiveDirector.ts';
import RegulationFeedHud from './RegulationFeedHud.tsx';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

afterEach(() => {
  clearGuidedStoryObjective();
  clearStoryText();
  setInteraction(null);
});

describe('regulation feed objective presentation', () => {
  it('exposes the pre-embodiment work order through the shared objective contract', () => {
    activateGuidedStoryObjective({
      id: 'ch1:depth:recover-pods',
      kind: 'travel',
      markerLabel: 'SUPPLY POD',
      workOrder: ['FOLLOW THE SUPPLY POD MARKER.', 'RECOVER THE PROJECTED POD.']
    });
    observeGuidedStoryMarker('SUPPLY POD');

    const markup = renderToStaticMarkup(<RegulationFeedHud />);
    expect(markup).toContain('aria-label="Current story objective"');
    expect(markup).toContain('data-objective-id="ch1:depth:recover-pods"');
    expect(markup).toContain('data-objective-marker-label="SUPPLY POD"');
    expect(markup).toContain('data-objective-health="ready"');
    expect(markup).toContain('data-objective-requires-marker="true"');
    expect(markup).toContain('RECOVER THE PROJECTED POD.');
    expect(markup).toContain('data-regulation-objective-marker="true"');
  });

  it('retains feed and redaction chrome while yielding objective and marker ownership', () => {
    activateGuidedStoryObjective({
      id: 'ch1:anomaly:classify',
      kind: 'interact',
      markerLabel: 'UNCHARTED MASS',
      workOrder: ['FOLLOW THE SURVEY MARKER.', '[F] CLASSIFY THE UNCHARTED MASS.']
    });

    const markup = renderToStaticMarkup(
      <RegulationFeedHud embodiedGuidanceActive />
    );
    expect(markup).toContain('data-regulation-feed-chrome="true"');
    expect(markup).toContain('data-redaction-box="true"');
    expect(markup).toContain('data-redaction-indicator="true"');
    expect(markup).not.toContain('aria-label="Current story objective"');
    expect(markup).not.toContain('data-regulation-objective-marker="true"');
    expect(markup).not.toContain('[F] CLASSIFY THE UNCHARTED MASS.');
  });

  it('publishes the same primary prompt contract under the regulation owner', () => {
    setInteraction({ id: 'story-anomaly', verb: 'Touch' });

    const markup = renderToStaticMarkup(<RegulationFeedHud />);
    expect(markup).toContain('id="paravoxia-primary-interaction-prompt"');
    expect(markup).toContain('data-interaction-prompt="primary"');
    expect(markup).toContain('data-interaction-id="story-anomaly"');
    expect(markup).toContain('data-interaction-owner="regulation-feed"');
    expect(markup.match(/data-interaction-prompt=/g)).toHaveLength(1);
  });
});
