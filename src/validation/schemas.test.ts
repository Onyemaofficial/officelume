import { describe, expect, it } from 'vitest';
import {
  buildServiceRequestSchema,
  escalationSchema,
  inquirySchema,
  knowledgeSchema,
  loginSchema,
} from './schemas';

const NOW = () => new Date(2026, 5, 15, 12, 0, 0); // 15 Jun 2026, local time

const validRequest = {
  customerName: 'Jordan Rivera',
  phone: '(555) 010-2345',
  email: 'jordan@example.com',
  address: '12 Elm Street',
  city: 'Riverton',
  zipCode: '40101',
  serviceType: 'ac_repair',
  issueDescription: 'The AC is blowing warm air since yesterday.',
  preferredDate: '2026-06-20',
  preferredTime: 'morning',
  preferredContactMethod: 'phone',
  consent: true,
  website: '',
};

describe('customer inquiry validation', () => {
  it('accepts and trims a normal question', () => {
    const result = inquirySchema.safeParse({ message: '  Do you repair air conditioners?  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe('Do you repair air conditioners?');
  });

  it('rejects blank, oversized, and markup questions with readable messages', () => {
    const blank = inquirySchema.safeParse({ message: '   ' });
    expect(blank.success).toBe(false);
    expect(inquirySchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
    const markup = inquirySchema.safeParse({ message: '<script>alert(1)</script>' });
    expect(markup.success).toBe(false);
    if (!markup.success) expect(markup.error.issues[0]?.message).toMatch(/HTML or script/i);
  });
});

describe('service request form validation', () => {
  const schema = buildServiceRequestSchema(NOW);

  it('accepts a complete request', () => {
    expect(schema.safeParse(validRequest).success).toBe(true);
  });

  it('requires every mandatory field with a helpful message', () => {
    const result = schema.safeParse({
      ...validRequest,
      customerName: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      zipCode: '',
      serviceType: '',
      issueDescription: '',
      preferredDate: '',
      preferredTime: '',
      preferredContactMethod: '',
      consent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = new Set(result.error.issues.map((i) => i.path[0]));
      for (const field of [
        'customerName', 'phone', 'email', 'address', 'city', 'zipCode', 'serviceType',
        'issueDescription', 'preferredDate', 'preferredTime', 'preferredContactMethod', 'consent',
      ]) {
        expect(fields.has(field), field).toBe(true);
      }
    }
  });

  it.each([
    ['invalid email', { email: 'nope' }],
    ['short phone', { phone: '123' }],
    ['bad zip', { zipCode: 'ABCDE' }],
    ['past date', { preferredDate: '2026-06-01' }],
    ['script injection', { customerName: '<img src=x onerror=alert(1)>' }],
    ['unchecked consent', { consent: false }],
  ])('rejects %s', (_name, override) => {
    expect(schema.safeParse({ ...validRequest, ...override }).success).toBe(false);
  });

  it('allows today as the preferred date', () => {
    expect(schema.safeParse({ ...validRequest, preferredDate: '2026-06-15' }).success).toBe(true);
  });
});

describe('escalation and admin form validation', () => {
  it('requires consent and contact method for human help', () => {
    const base = {
      customerName: 'Sam Lee',
      phone: '555-010-9999',
      email: 'sam@example.com',
      preferredContactMethod: 'email',
      originalQuestion: 'Do you offer a warranty on repairs?',
      consent: true,
    };
    expect(escalationSchema.safeParse(base).success).toBe(true);
    expect(escalationSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(escalationSchema.safeParse({ ...base, preferredContactMethod: '' }).success).toBe(false);
  });

  it('validates login and knowledge forms', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'admin', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: '' }).success).toBe(false);
    expect(knowledgeSchema.safeParse({ title: 'Hours', category: 'hours', content: 'Open Monday to Friday.', active: true }).success).toBe(true);
    expect(knowledgeSchema.safeParse({ title: 'Hours', category: 'bogus', content: 'Open Monday to Friday.', active: true }).success).toBe(false);
  });
});
