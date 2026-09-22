import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import AuditBand, {
  AUDIT_EMBER_COLOR,
  pulseAuditEmber,
  readAuditEmberToken,
  subscribeAuditEmber
} from './AuditBand.tsx';
import { clearAuditLine, showAuditLine } from './storyText.ts';

afterEach(() => clearAuditLine());

describe('the klaxon ember pulse', () => {
  it('is the audit family colour and nothing else', () => {
    expect(AUDIT_EMBER_COLOR).toBe('#ff5a3c');
  });

  it('publishes one token per klaxon, in order', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeAuditEmber(token => seen.push(token));
    const before = readAuditEmberToken();
    pulseAuditEmber();
    pulseAuditEmber();
    unsubscribe();
    expect(seen).toEqual([before + 1, before + 2]);
    pulseAuditEmber();
    expect(seen).toHaveLength(2);
  });

  it('leaves the band unlit until a klaxon fires', () => {
    showAuditLine('REGULATION ADVISORY.', 'AUDIT');
    const markup = renderToStaticMarkup(<AuditBand />);
    expect(markup).toContain('data-audit-ember="false"');
    expect(markup).not.toContain(AUDIT_EMBER_COLOR);
  });

  it('rides the band, so a klaxon with no band shows no ember', () => {
    pulseAuditEmber();
    expect(renderToStaticMarkup(<AuditBand />)).toBe('');
  });
});
