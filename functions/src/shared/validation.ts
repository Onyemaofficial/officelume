import { z } from 'zod';
import {
  AUDIT_EVENT_TYPES,
  CONTACT_METHODS,
  ESCALATION_STATUSES,
  KNOWLEDGE_CATEGORIES,
  LIMITS,
  REQUEST_STATUSES,
  SERVICE_TYPES,
  STAFF_ROLES,
  TIME_WINDOWS,
} from './constants';
import { containsMarkup, normalizeWhitespace } from './sanitize';

/** Trimmed, control-character-free text with length limits that rejects HTML/script markup. */
export function safeText(label: string, min: number, max: number) {
  // Empty input reads "is required"; a too-short value reads "at least N characters".
  let bounded = z.string();
  if (min >= 1) bounded = bounded.min(1, `${label} is required.`);
  if (min > 1) bounded = bounded.min(min, `${label} must be at least ${min} characters.`);
  return z
    .string({ error: `${label} is required.` })
    .transform(normalizeWhitespace)
    .pipe(
      bounded
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !containsMarkup(value), `${label} cannot contain HTML or script tags.`),
    );
}

export const emailSchema = z
  .string({ error: 'Email address is required.' })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .max(254, 'Email address is too long.')
      .regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/, 'Enter a valid email address.'),
  );

export const phoneSchema = z
  .string({ error: 'Phone number is required.' })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .regex(/^\+?[\d\s().-]{7,25}$/, 'Enter a valid phone number.')
      .refine((v) => {
        const digits = v.replace(/\D/g, '').length;
        return digits >= 10 && digits <= 15;
      }, 'Enter a valid phone number with area code.'),
  );

export const zipSchema = z
  .string({ error: 'ZIP code is required.' })
  .transform((v) => v.trim())
  .pipe(z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid 5-digit ZIP code.'));

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** A real calendar date in YYYY-MM-DD form. */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Preferred service date: a real date, not in the past (one day of slack covers client/server
 * timezone differences), and within the next year.
 */
export function preferredDateSchema(now: () => Date = () => new Date()) {
  return z
    .string({ error: 'Preferred date is required.' })
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .refine(isValidIsoDate, 'Enter a valid date.')
        .refine((value) => {
          const current = now();
          const today = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
          return Date.parse(`${value}T00:00:00Z`) >= today - DAY_MS;
        }, 'Preferred date cannot be in the past.')
        .refine(
          (value) => Date.parse(`${value}T00:00:00Z`) <= now().getTime() + 366 * DAY_MS,
          'Preferred date must be within the next year.',
        ),
    );
}

export const docIdSchema = z.string({ error: 'Record id is required.' }).regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid record id.');

const consentSchema = z.literal(true, { error: 'You must acknowledge the privacy notice to continue.' });
/** Honeypot: real users never see or fill this field. */
const honeypotSchema = z.string().max(0).optional();
const sessionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{10,40}$/, 'Invalid chat session.')
  .optional();

// ---------- Customer chat ----------

export const inquirySchema = z.object({
  message: safeText('Your question', 2, LIMITS.maxChatMessageLength),
  sessionId: sessionIdSchema,
});
export type InquiryInput = z.infer<typeof inquirySchema>;

// ---------- Service request ----------

export function buildServiceRequestSchema(now: () => Date = () => new Date()) {
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
    consent: consentSchema,
    website: honeypotSchema,
  });
}
export const serviceRequestSchema = buildServiceRequestSchema();
export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;

// ---------- Escalation ----------

export const escalationSchema = z.object({
  customerName: safeText('Name', 2, 100),
  phone: phoneSchema,
  email: emailSchema,
  preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'Choose a contact method.' }),
  originalQuestion: safeText('Your question', 5, 1000),
  additionalDetails: safeText('Additional details', 0, 1000).optional(),
  sessionId: sessionIdSchema,
  consent: consentSchema,
  website: honeypotSchema,
});
export type EscalationInput = z.infer<typeof escalationSchema>;

// ---------- Admin operations ----------

const noteSchema = safeText('Note', 1, 1000);

export const updateServiceRequestSchema = z
  .object({
    requestId: docIdSchema,
    status: z.enum(REQUEST_STATUSES).optional(),
    note: noteSchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, 'Provide a status change or a note.');
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;

export const updateEscalationSchema = z
  .object({
    escalationId: docIdSchema,
    status: z.enum(ESCALATION_STATUSES).optional(),
    note: noteSchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, 'Provide a status change or a note.');
export type UpdateEscalationInput = z.infer<typeof updateEscalationSchema>;

export const knowledgeSaveSchema = z.object({
  id: docIdSchema.optional(),
  title: safeText('Title', 3, 120),
  category: z.enum(KNOWLEDGE_CATEGORIES, { error: 'Choose a category.' }),
  content: safeText('Content', 10, 3000),
  active: z.boolean({ error: 'Active flag is required.' }),
});
export type KnowledgeSaveInput = z.infer<typeof knowledgeSaveSchema>;

export const recordStaffLoginSchema = z.object({
  outcome: z.enum(['success', 'failure']),
  reason: z.enum(['invalid_credentials', 'not_authorized', 'too_many_attempts', 'other']).optional(),
});
export type RecordStaffLoginInput = z.infer<typeof recordStaffLoginSchema>;

// ---------- Staff management (administrators only) ----------

export const staffRoleSchema = z.enum(STAFF_ROLES, { error: 'Choose a role.' });

export const createStaffSchema = z.object({
  displayName: safeText('Full name', 2, 100),
  email: emailSchema,
  role: staffRoleSchema,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffRoleSchema = z.object({
  uid: docIdSchema,
  role: staffRoleSchema,
});
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;

export const setStaffActiveSchema = z.object({
  uid: docIdSchema,
  active: z.boolean({ error: 'Active flag is required.' }),
});
export type SetStaffActiveInput = z.infer<typeof setStaffActiveSchema>;

export const auditEventTypeSchema = z.enum(AUDIT_EVENT_TYPES);

/** Flatten Zod issues into { field: firstMessage } for clients. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
