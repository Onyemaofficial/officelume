import { z } from 'zod';
import { AI_CATEGORIES, ESCALATION_MESSAGE } from '../shared/constants';
import type { AIResponse } from '../shared/types';

const MAX_ANSWER_LENGTH = 1200;

const aiOutputSchema = z.object({
  answer: z.string(),
  supported: z.boolean(),
  requiresEscalation: z.boolean(),
  category: z.enum(AI_CATEGORIES),
  reason: z.string().optional().default(''),
});

export type ParseResult = { ok: true; response: AIResponse } | { ok: false; error: string };

/** Pull a JSON object out of raw model text, tolerating code fences or stray prose around it. */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const attempts: string[] = [text];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) attempts.push(text.slice(start, end + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

/** Strip anything that looks like markup so model output can never smuggle HTML to the client. */
export function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`#]{1,3}/g, '')
    .replace(/\s+\n/g, '\n')
    .trim();
}

/**
 * Enforce internal consistency on a validated response:
 *  - an unsupported answer always escalates, and shows the standard escalation wording
 *  - answers are length-limited
 */
export function normalizeResponse(response: AIResponse): AIResponse {
  let { answer, requiresEscalation } = response;
  const { supported } = response;

  answer = stripMarkup(answer).slice(0, MAX_ANSWER_LENGTH).trim();

  if (!supported) {
    requiresEscalation = true;
    answer = ESCALATION_MESSAGE;
  }
  if (answer.length === 0) {
    return { ...response, answer: ESCALATION_MESSAGE, supported: false, requiresEscalation: true };
  }

  return { answer, supported, requiresEscalation, category: response.category, reason: response.reason.slice(0, 300) };
}

/** Parse and validate raw provider output into a well-formed AIResponse. */
export function parseAIResponse(raw: string): ParseResult {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, error: 'Model output was not valid JSON.' };

  const parsed = aiOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: `Model output failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}` };
  }
  return { ok: true, response: normalizeResponse(parsed.data) };
}
