import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FreeMarker from './FreeMarker.tsx';

describe('free-era directional marker accessibility', () => {
  it('keeps the floating visual marker out of the screen-reader tree', () => {
    const markup = renderToStaticMarkup(<FreeMarker />);

    expect(markup).toContain('data-story-free-marker="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-marker-layout="pending"');
    expect(markup).toContain('visibility:hidden');
  });
});
