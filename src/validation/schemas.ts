import { z } from 'zod';
import { CONTACT_METHODS, KNOWLEDGE_CATEGORIES, SERVICE_TYPES, TIME_WINDOWS } from '../types';

/**
 * Client-side validation for instant feedback. The Cloud Functions re-validate everything with the
 * same rules (functions/src/shared/validation.ts) - the server is the source of truth.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MARKUP = /<\s*\/?\s*[a-z!?]/i;

export function normalizeText(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function containsMarkup(value: string): boolean {
  return MARKUP.test(value) || /javascript\s*:/i.test(value);
}

export function safeText(label: string, min: number, max: number) {
  // Empty input reads "is required"; a too-short value reads "at least N characters".
  let bounded = z.string();
  if (min >= 1) bounded = bounded.min(1, `${label} is required.`);
  if (min > 1) bounded = bounded.min(min, `${label} must be at least ${min} characters.`);
  return z
    .string({ error: `${label} is required.` })
    .transform(normalizeText)
    .pipe(
      bounded
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((v) => !containsMarkup(v), `${label} cannot contain HTML or script tags.`),
    );
}

export const emailSchema = z
  .string({ error: 'Email address is required.' })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, 'Email address is required.')
      .max(254, 'Email address is too long.')
      .regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/, 'Enter a valid email address.'),
  );

export const phoneSchema = z
  .string({ error: 'Phone number is required.' })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, 'Phone number is required.')
      .regex(/^\+?[\d\s().-]{7,25}$/, 'Enter a valid phone number.')
      .refine((v) => {
        const digits = v.replace(/\D/g, '').length;
        return digits >= 10 && digits <= 15;
      }, 'Enter a valid phone number with area code.'),
  );

export const zipSchema = z
  .string({ error: 'ZIP code is required.' })
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'ZIP code is required.').regex(/^\d{5}(-\d{4})?$/, 'Enter a valid 5-digit ZIP code.'));

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const DAY_MS = 86_400_000;

export function preferredDateSchema(now: () => Date = () => new Date()) {
  return z
    .string({ error: 'Preferred date is required.' })
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, 'Preferred date is required.')
        .refine(isValidIsoDate, 'Enter a valid date.')
        .refine((value) => {
          const current = now();
          const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
          return Date.parse(`${value}T00:00:00Z`) >= today;
        }, 'Preferred date cannot be in the past.')
        .refine(
          (value) => Date.parse(`${value}T00:00:00Z`) <= now().getTime() + 366 * DAY_MS,
          'Preferred date must be within the next year.',
        ),
    );
}

const consent = z.literal(true, { error: 'Please acknowledge the privacy notice to continue.' });

export const inquirySchema = z.object({
  message: safeText('Your question', 2, 500),
});

export function buildServiceRequestSchema(now?: () => Date) {
  return z.object({
    customerName: safeText('Name', 2, 100),
    phone: phoneSchema,
    email: emailSchema,
    address: safeText('Service address', 5, 200),
    city: safeText('City', 2, 80),
    zipCode: zipSchema,
    serviceType: z.enum(SERVICE_TYPES, { error: 'Choose a service type.' }),
    issueDescription: safeText('Issue description', 10, 2000),
    preferredDate: preferredDateSchema(now),
    preferredTime: z.enum(TIME_WINDOWS, { error: 'Choose a preferred time window.' }),
    preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'Choose a contact method.' }),
    consent,
    website: z.string().max(0).optional(),
  });
}
export const serviceRequestSchema = buildServiceRequestSchema();
export type ServiceRequestFormData = z.infer<typeof serviceRequestSchema>;

export const escalationSchema = z.object({
  customerName: safeText('Name', 2, 100),
  phone: phoneSchema,
  email: emailSchema,
  preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'Choose a contact method.' }),
  originalQuestion: safeText('Your question', 5, 1000),
  additionalDetails: safeText('Additional details', 0, 1000).optional(),
  consent,
  website: z.string().max(0).optional(),
});
export type EscalationFormData = z.infer<typeof escalationSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(256),
});

export const knowledgeSchema = z.object({
  title: safeText('Title', 3, 120),
  category: z.enum(KNOWLEDGE_CATEGORIES, { error: 'Choose a category.' }),
  content: safeText('Content', 10, 3000),
  active: z.boolean(),
});
export type KnowledgeFormData = z.infer<typeof knowledgeSchema>;

export const noteSchema = safeText('Note', 1, 1000);

/** Flatten Zod issues to { field: firstMessage }. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
