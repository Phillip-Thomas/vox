import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { setInteraction } from '../../game/systems/interactionSystem.ts';
import InteractionPrompt from './InteractionPrompt.tsx';

afterEach(() => setInteraction(null));

describe('primary interaction prompt contract', () => {
  it('publishes one stable embodied owner with its interaction identity', () => {
    setInteraction({ id: 'story-ship-repair', verb: 'Repair Hull' });
    const markup = renderToStaticMarkup(<InteractionPrompt />);

    expect(markup).toContain('id="paravoxia-primary-interaction-prompt"');
    expect(markup).toContain('data-interaction-prompt="primary"');
    expect(markup).toContain('data-interaction-id="story-ship-repair"');
    expect(markup).toContain('data-interaction-owner="embodied-hud"');
    expect(markup).toContain('data-interaction-scope="story"');
    expect(markup.match(/data-interaction-prompt=/g)).toHaveLength(1);
  });
});
