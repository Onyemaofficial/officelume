import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from '../src/audit/audit';
import { evaluateRateLimit } from '../src/shared/rateLimit';
import { formatReferenceNumber } from '../src/shared/numbering';
import { containsMarkup, redactPersonalData } from '../src/shared/sanitize';
import { createAIProvider } from '../src/ai/providerFactory';

describe('reference numbers', () => {
  it('formats SR and ESC numbers with zero padding', () => {
    expect(formatReferenceNumber('SR', 2026, 1)).toBe('SR-2026-000001');
    expect(formatReferenceNumber('ESC', 2026, 123)).toBe('ESC-2026-000123');
    expect(formatReferenceNumber('SR', 2027, 1234567)).toBe('SR-2027-1234567');
  });
});

describe('rate limiting policy', () => {
  const window = 60_000;

  it('allows the first call and counts up to the limit', () => {
    let state = evaluateRateLimit(undefined, 0, 3, window).next;
    expect(state.count).toBe(1);
    state = evaluateRateLimit(state, 1_000, 3, window).next;
    state = evaluateRateLimit(state, 2_000, 3, window).next;
    expect(state.count).toBe(3);
  });

  it('blocks once the limit is reached and reports retry-after', () => {
    const decision = evaluateRateLimit({ count: 3, windowStartMs: 0 }, 10_000, 3, window);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(50);
  });

  it('opens a fresh window after it expires', () => {
    const decision = evaluateRateLimit({ count: 3, windowStartMs: 0 }, window, 3, window);
    expect(decision.allowed).toBe(true);
    expect(decision.next.count).toBe(1);
  });
});

describe('audit metadata hygiene', () => {
  it('drops keys that could carry personal data or secrets', () => {
    const cleaned = sanitizeAuditMetadata({
      requestNumber: 'SR-2026-000001',
      email: 'a@b.com',
      customerName: 'Jane',
      password: 'x',
      apiKey: 'sk-ant-123',
      phone: '555',
      status: 'new',
    });
    expect(cleaned).toEqual({ requestNumber: 'SR-2026-000001', status: 'new' });
  });

  it('truncates very long values', () => {
    const cleaned = sanitizeAuditMetadata({ detail: 'x'.repeat(500) });
    expect(String(cleaned['detail']).length).toBe(200);
  });
});

describe('text sanitization', () => {
  it('detects markup but not normal punctuation', () => {
    expect(containsMarkup('<div>hi</div>')).toBe(true);
    expect(containsMarkup('</script>')).toBe(true);
    expect(containsMarkup('javascript:alert(1)')).toBe(true);
    expect(containsMarkup('AC under 5 < 6 tons & fine')).toBe(false);
  });

  it('redacts emails and phone numbers before they reach the AI provider', () => {
    const redacted = redactPersonalData('Call me at (555) 010-2345 or mail jane.doe@example.com please');
    expect(redacted).not.toContain('jane.doe@example.com');
    expect(redacted).not.toContain('010-2345');
    expect(redacted).toContain('[email removed]');
    expect(redacted).toContain('[phone removed]');
  });
});

describe('AI provider selection', () => {
  it('uses the mock provider when no key is configured', () => {
    expect(createAIProvider({ mode: 'claude', apiKey: undefined, model: 'm' }).name).toBe('mock');
    expect(createAIProvider({ mode: 'claude', apiKey: '   ', model: 'm' }).name).toBe('mock');
  });

  it('uses the mock provider when explicitly requested, even with a key', () => {
    expect(createAIProvider({ mode: 'mock', apiKey: 'sk-ant-x', model: 'm' }).name).toBe('mock');
  });

  it('uses Claude when a key is present', () => {
    expect(createAIProvider({ mode: 'claude', apiKey: 'sk-ant-test', model: 'claude-opus-5' }).name).toBe('claude:claude-opus-5');
  });
});
