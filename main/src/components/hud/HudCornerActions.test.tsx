import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as mobileInput from '../../utils/mobileInput.ts';
import HudCornerActions from './HudCornerActions.tsx';

const actions = {
  onToggleBuild: () => undefined,
  onOpenCrafting: () => undefined,
  onPause: () => undefined
};

afterEach(() => vi.restoreAllMocks());

describe('HUD corner actions', () => {
  it('preserves direct desktop build, fabricator, and pause actions', () => {
    vi.spyOn(mobileInput, 'isTouchDevice').mockReturnValue(false);
    const markup = renderToStaticMarkup(
      <HudCornerActions
        controlMode="fps"
        buildModeOpen={false}
        {...actions}
      />
    );

    expect(markup).toContain('aria-label="Open build editor"');
    expect(markup).toContain('aria-label="Open fabricator"');
    expect(markup).toContain('aria-label="Pause and open star map"');
    expect(markup).not.toContain('Open systems menu');
  });

  it('collapses secondary touch actions behind one systems trigger', () => {
    vi.spyOn(mobileInput, 'isTouchDevice').mockReturnValue(true);
    const markup = renderToStaticMarkup(
      <HudCornerActions
        controlMode="fps"
        buildModeOpen={false}
        {...actions}
      />
    );

    expect(markup).toContain('aria-label="HUD quick actions"');
    expect(markup).toContain('aria-label="Open systems menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('aria-label="Open fabricator"');
    expect(markup.match(/<button/g)).toHaveLength(1);
  });
});
