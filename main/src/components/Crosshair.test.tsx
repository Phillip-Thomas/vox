import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Crosshair from './Crosshair.tsx';

describe('crosshair layer ownership', () => {
  it('stays in the HUD band so menus can cover it', () => {
    const markup = renderToStaticMarkup(<Crosshair />);
    expect(markup).toContain('z-index:21');
    expect(markup).not.toContain('z-index:1000');
  });
});
