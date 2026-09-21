import { describe, expect, it } from 'vitest';
import {
  buildServiceRequestSchema,
  escalationSchema,
  inquirySchema,
  knowledgeSaveSchema,
  updateServiceRequestSchema,
} from '../src/shared/validation';

const NOW = new Date('2026-06-15T12:00:00Z');

const validRequest = {
  customerName: '  Jordan Rivera ',
  phone: '(555) 010-2345',
  email: 'Jordan@Example.com ',
  address: '12 Elm Street',
  city: 'Riverton',
  zipCode: '40101',
  serviceType: 'ac_repair',
  issueDescription: 'The AC is blowing warm air since yesterday.',
  preferredDate: '2026-06-20',
  preferredTime: 'morning',
  preferredContactMethod: 'phone',
  consent: true,
};

describe('customer inquiry validation', () => {
  it('trims and accepts a normal question', () => {
    const result = inquirySchema.safeParse({ message: '  What areas do you service?  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe('What areas do you service?');
  });

  it('rejects empty, oversized, and markup-containing questions', () => {
    expect(inquirySchema.safeParse({ message: '   ' }).success).toBe(false);
    expect(inquirySchema.safeParse({ message: 'a'.repeat(501) }).success).toBe(false);
    expect(inquirySchema.safeParse({ message: '<script>alert(1)</script>' }).success).toBe(false);
    expect(inquirySchema.safeParse({ message: 'hello <img src=x onerror=alert(1)>' }).success).toBe(false);
  });

  it('allows ordinary uses of the less-than sign', () => {
    expect(inquirySchema.safeParse({ message: 'Is it OK if the temp is < 60 degrees?' }).success).toBe(true);
  });

  it('rejects malformed session ids', () => {
    expect(inquirySchema.safeParse({ message: 'hi there', sessionId: '../../etc' }).success).toBe(false);
  });
});

describe('service request validation', () => {
  const schema = buildServiceRequestSchema(() => NOW);

  it('accepts a complete valid request and normalizes fields', () => {
    const result = schema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerName).toBe('Jordan Rivera');
      expect(result.data.email).toBe('jordan@example.com');
    }
  });

  it.each([
    ['missing name', { customerName: '' }],
    ['invalid email', { email: 'not-an-email' }],
    ['short phone', { phone: '12345' }],
    ['invalid zip', { zipCode: '4010' }],
    ['unknown service type', { serviceType: 'roof_repair' }],
    ['short description', { issueDescription: 'broken' }],
    ['bad time window', { preferredTime: 'midnight' }],
    ['bad contact method', { preferredContactMethod: 'fax' }],
    ['no consent', { consent: false }],
    ['past date', { preferredDate: '2026-05-01' }],
    ['far-future date', { preferredDate: '2028-01-01' }],
    ['impossible date', { preferredDate: '2026-02-31' }],
    ['script in description', { issueDescription: 'Please <script>steal()</script> fix my AC' }],
    ['honeypot filled', { website: 'http://spam.example' }],
  ])('rejects %s', (_label, override) => {
    expect(schema.safeParse({ ...validRequest, ...override }).success).toBe(false);
  });

  it('accepts today (timezone slack) as a preferred date', () => {
    expect(schema.safeParse({ ...validRequest, preferredDate: '2026-06-15' }).success).toBe(true);
  });

  it('does not accept a role or status supplied by the client to override server fields', () => {
    const result = schema.safeParse({ ...validRequest, status: 'completed', role: 'admin' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('status' in result.data).toBe(false);
      expect('role' in result.data).toBe(false);
    }
  });
});

describe('escalation validation', () => {
  const valid = {
    customerName: 'Sam Lee',
    phone: '555-010-9999',
    email: 'sam@example.com',
    preferredContactMethod: 'email',
    originalQuestion: 'Do you offer a warranty on repairs?',
    consent: true,
  };

  it('accepts a valid escalation with optional details omitted', () => {
    expect(escalationSchema.safeParse(valid).success).toBe(true);
  });

  it('requires consent and a real question', () => {
    expect(escalationSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(escalationSchema.safeParse({ ...valid, originalQuestion: 'hi' }).success).toBe(false);
  });
});

describe('admin input validation', () => {
  it('requires a known status or a note', () => {
    expect(updateServiceRequestSchema.safeParse({ requestId: 'abc123' }).success).toBe(false);
    expect(updateServiceRequestSchema.safeParse({ requestId: 'abc123', status: 'deleted' }).success).toBe(false);
    expect(updateServiceRequestSchema.safeParse({ requestId: 'abc123', status: 'contacted' }).success).toBe(true);
    expect(updateServiceRequestSchema.safeParse({ requestId: 'abc123', note: 'Called customer.' }).success).toBe(true);
  });

  it('rejects path-like record ids', () => {
    expect(updateServiceRequestSchema.safeParse({ requestId: 'a/b', status: 'new' }).success).toBe(false);
  });

  it('validates knowledge articles', () => {
    const ok = { title: 'Hours', category: 'hours', content: 'Open Monday to Friday.', active: true };
    expect(knowledgeSaveSchema.safeParse(ok).success).toBe(true);
    expect(knowledgeSaveSchema.safeParse({ ...ok, category: 'secrets' }).success).toBe(false);
    expect(knowledgeSaveSchema.safeParse({ ...ok, content: 'short' }).success).toBe(false);
  });
});
