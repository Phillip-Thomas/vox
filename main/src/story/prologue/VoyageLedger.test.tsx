import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  normalizeVoyageWorkerName,
  VoyageWorkerNameInput
} from './VoyageLedger.tsx';

describe('Voyage worker naming field', () => {
  it('normalizes the authored lowercase twelve-letter name contract', () => {
    expect(normalizeVoyageWorkerName('  SDG-sdg  ')).toBe('sdgsdg');
    expect(normalizeVoyageWorkerName('abcdefghijklmnop')).toBe('abcdefghijkl');
  });

  it('renders the real editable field inline instead of an off-screen proxy', () => {
    const markup = renderToStaticMarkup(
      <VoyageWorkerNameInput
        value="sdgsdg"
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(markup).toContain('data-voyage-worker-name-input="true"');
    expect(markup).toContain('value="sdgsdg"');
    expect(markup).toContain('enterKeyHint="done"');
    expect(markup).toContain('border-bottom:1px solid');
    expect(markup).not.toContain('pointer-events:none');
    expect(markup).not.toContain('left:-9999');
    expect(markup).not.toContain('opacity:0');
  });
});
