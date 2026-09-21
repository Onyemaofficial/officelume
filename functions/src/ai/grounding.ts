import type { KnowledgeContextItem } from './types';
import { SYSTEM_PROMPT } from './prompt';

export type GroundingViolation =
  | 'unsupported_price'
  | 'appointment_confirmation'
  | 'claims_human_or_licensed'
  | 'prompt_or_secret_leak';

const PRICE_PATTERN = /\$\s?\d[\d,]*(?:\.\d+)?/g;
const PERCENT_DISCOUNT = /\b\d{1,2}\s?%\s*(off|discount)/gi;

const CONFIRMATION_PATTERNS: RegExp[] = [
  /\b(your|the)\s+(appointment|visit|service|technician\s+visit)\s+(is|has\s+been|was|is\s+now)\s+(confirmed|booked|scheduled|reserved|set)\b/i,
  /\bi('|’)?ve\s+(booked|scheduled|reserved|confirmed)\b/i,
  /\bwe('|’)?ve\s+(booked|scheduled|reserved|confirmed)\b/i,
  /\byou('|’)?re\s+(all\s+set|booked|confirmed|scheduled)\b/i,
];

const GUARANTEE_TOPIC = '(appointment|slot|time|availability|arrival|visit|service)';
const GUARANTEE_PATTERN = new RegExp(
  `\\bguarantee[sd]?\\b.*\\b${GUARANTEE_TOPIC}\\b|\\b${GUARANTEE_TOPIC}\\b.*\\bguarantee[sd]?\\b`,
  'i',
);
const NEGATION_PATTERN = /\b(not|no|never|cannot|can't|can’t|unable|without|don't|don’t|doesn't|doesn’t|isn't|isn’t|won't|won’t)\b/i;

/**
 * "We guarantee your appointment" is a violation; "this does not guarantee an appointment" is the
 * honest statement we want. Judge each sentence, and ignore guarantees that are negated.
 */
function makesAffirmativeGuarantee(answer: string): boolean {
  return answer
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => GUARANTEE_PATTERN.test(sentence) && !NEGATION_PATTERN.test(sentence));
}

const IDENTITY_VIOLATIONS: RegExp[] = [
  /\bi\s*(am|'m|’m)\s+(a\s+)?(human|real\s+person|licensed|certified\s+technician|hvac\s+technician)/i,
  /\bas\s+a\s+(licensed|certified)\s+(hvac\s+)?technician\b/i,
];

const SECRET_PATTERNS: RegExp[] = [/sk-ant-[a-z0-9_-]{8,}/i, /<approved_business_information>/i, /<customer_message>/i];

function normalizeMoney(value: string): string {
  return value.replace(/[\s,]/g, '');
}

/**
 * Deterministic post-generation checks. The model is instructed not to do these things, but
 * NFR/ethics requirements are enforced here in code rather than trusted to prompt compliance.
 */
export function checkGrounding(answer: string, context: KnowledgeContextItem[]): GroundingViolation[] {
  const violations: GroundingViolation[] = [];
  const contextText = context.map((c) => `${c.title} ${c.content}`).join(' ');

  const allowedMoney = new Set((contextText.match(PRICE_PATTERN) ?? []).map(normalizeMoney));
  const answerMoney = (answer.match(PRICE_PATTERN) ?? []).map(normalizeMoney);
  const discounts = answer.match(PERCENT_DISCOUNT) ?? [];
  const contextDiscounts = new Set((contextText.match(PERCENT_DISCOUNT) ?? []).map((d) => d.toLowerCase()));
  if (
    answerMoney.some((amount) => !allowedMoney.has(amount)) ||
    discounts.some((d) => !contextDiscounts.has(d.toLowerCase()))
  ) {
    violations.push('unsupported_price');
  }

  if (CONFIRMATION_PATTERNS.some((p) => p.test(answer)) || makesAffirmativeGuarantee(answer)) {
    violations.push('appointment_confirmation');
  }
  if (IDENTITY_VIOLATIONS.some((p) => p.test(answer))) violations.push('claims_human_or_licensed');

  const leaksPrompt =
    SECRET_PATTERNS.some((p) => p.test(answer)) || answer.includes(SYSTEM_PROMPT.slice(0, 60));
  if (leaksPrompt) violations.push('prompt_or_secret_leak');

  return violations;
}
