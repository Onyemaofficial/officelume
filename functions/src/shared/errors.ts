import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import type { ZodType } from 'zod';
import { flattenIssues } from './validation';

/** Parse callable input with a schema, throwing a clean `invalid-argument` error on failure. */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors = flattenIssues(result.error);
    const first = Object.values(fieldErrors)[0] ?? 'Invalid request.';
    throw new HttpsError('invalid-argument', first, { fieldErrors });
  }
  return result.data;
}

/**
 * Log a technical error without leaking it (or customer data) to the caller, then return a generic
 * HttpsError. Existing HttpsErrors pass through unchanged.
 */
export function toSafeError(error: unknown, context: string): HttpsError {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : 'unknown error';
  logger.error(`${context} failed`, { message });
  return new HttpsError('internal', 'Something went wrong on our side. Please try again in a moment.');
}
