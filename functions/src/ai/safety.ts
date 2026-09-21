import type { AIResponse } from '../shared/types';

/**
 * Deterministic pre-model guardrails. These run BEFORE any knowledge retrieval or model call so
 * that dangerous, adversarial, or identity questions get a consistent, safe answer regardless of
 * model behaviour.
 */

export type GuardKind = 'prompt_injection' | 'life_safety' | 'hazardous_diy' | 'identity' | 'greeting';

export interface GuardResult {
  kind: GuardKind;
  response: AIResponse;
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|messages?)/i,
  /disregard\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)?\s*(instructions?|prompts?|rules?|guidelines?)/i,
  /forget\s+(all\s+|everything\s+|your\s+)?(previous\s+|prior\s+)?(instructions?|rules?|training)/i,
  /(reveal|show|print|repeat|display|leak|tell me|share|output)\s+(me\s+)?(your\s+|the\s+)?(system\s+|hidden\s+|initial\s+|original\s+)?(prompt|instructions|configuration|config)/i,
  /system\s+prompt/i,
  /(api[\s_-]?key|secret\s+key|credentials?|password)s?\b.*\b(reveal|show|give|tell|share|what)|\b(reveal|show|give|tell|share|what('| i)?s)\b.*(api[\s_-]?key|secret\s+key|credentials?|password)/i,
  /\byou\s+are\s+now\b/i,
  /\bpretend\s+(to\s+be|you\s+are|you're)\b/i,
  /\bact\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?(unrestricted|admin|administrator|developer|root|dan|different|human)/i,
  /(developer|debug|admin|god|jailbreak|dan)\s+mode/i,
  /\bjailbreak/i,
  /(other|another|all|every)\s+customers?('s|s')?\s+(information|info|records?|data|addresses|phone|emails?|requests?|names?)/i,
  /(list|show|give|dump|export)\s+(me\s+)?(all\s+|every\s+)?(the\s+)?(customers?|service\s+requests?|escalations?|users?|admins?|administrators?|records|audit\s+logs?)/i,
  /(admin(istrator)?|internal|staff)\s+(notes?|panel|dashboard|password|account|records?|login)/i,
  /(delete|remove|drop|change|modify|update)\s+(the\s+|all\s+|my\s+)?(records?|database|(service\s+)?requests?|escalations?|users?|admin|status)/i,
  /(grant|give)\s+(me\s+)?(admin|administrator|elevated|full)\s+(access|rights|permissions?|privileges?)/i,
  /override\s+(your\s+|the\s+)?(rules?|polic(y|ies)|instructions?|safety)/i,
  /(approve|apply|give\s+me|authorize)\s+(a\s+|the\s+|my\s+)?(\d+%?\s*)?(discount|refund|free\s+(service|repair|install))/i,
];

const LIFE_SAFETY_PATTERNS: RegExp[] = [
  /(smell|smells|smelling|smelled)\s+(of\s+)?(natural\s+)?gas/i,
  /gas\s+(leak|smell|odor|odour)/i,
  /carbon\s+monoxide|\bco\s+(alarm|detector)\b|\bcarbon\s+monoxide\s+alarm/i,
  /(smell|see|seeing|there'?s|there\s+is)\s+(some\s+)?(smoke|fire|flames?|sparks?)/i,
  /(burning|electrical)\s+(smell|odor|odour)|smells?\s+like\s+(burning|smoke)/i,
  /\bon\s+fire\b|caught\s+fire|\bsparking\b/i,
];

const HAZARD_SUBJECT =
  /(refrigerant|freon|r[-\s]?(410a?|22|32)|gas\s+(line|valve|furnace|pipe|connection)|pilot\s+light|burner|heat\s+exchanger|capacitor|contactor|compressor|wiring|rewire|breaker|circuit|high[-\s]?voltage|230\s*v|240\s*v|flue|combustion)/i;
const HAZARD_INTENT =
  /(how\s+(do|can|should|would)\s+(i|we|you)|how\s+to|steps?\s+to|instructions?|walk\s+me\s+through|diy|myself|on\s+my\s+own|by\s+myself|bypass|jump|recharge|top\s+(it\s+)?off|refill|add\s+(more\s+)?(freon|refrigerant)|replace\s+(the\s+)?(it|capacitor|contactor|compressor)|fix\s+(it\s+)?(myself)?|can\s+i\s+(fix|repair|replace|install|open|remove))/i;

const IDENTITY_PATTERN =
  /(are\s+you|r\s+u|you\s+are|is\s+this)\s+(a\s+|an\s+|the\s+)?(real\s+)?(human|person|robot|bot|ai|machine|licensed|technician|hvac\s+tech|employee)/i;

const GREETING_PATTERN =
  /^\s*(hi|hello|hey|howdy|hiya|good\s+(morning|afternoon|evening)|thanks|thank\s+you|thx|ok|okay|great|got\s+it|bye|goodbye)(\s+(there|officelume|team))?\s*[!.?]*\s*$/i;

const REFUSAL_ANSWER =
  "I can only help with questions about OfficeLume's HVAC services, and I can't share internal information or change how I work. I'm happy to answer questions about hours, services, service areas, or scheduling - or connect you with a team member.";

const LIFE_SAFETY_ANSWER =
  'If you smell gas, suspect a carbon monoxide problem, or see smoke, fire, or sparks, please leave the building right away and call 911 or your gas utility from a safe location. Do not use switches, appliances, or your thermostat. Once everyone is safe, you can submit an Emergency Service request so a team member can follow up.';

const HAZARD_ANSWER =
  "For your safety, I can't provide repair instructions for electrical, refrigerant, gas, or combustion equipment. Those tasks require a qualified, licensed professional. I can help you submit a service request so a team member can follow up.";

const IDENTITY_ANSWER =
  "I'm OfficeLume, an AI-assisted receptionist - not a human, and not a licensed HVAC technician. I can answer questions from our approved business information, and I can send your request to a team member whenever you'd like.";

const GREETING_ANSWER =
  "Hello! I'm OfficeLume, an AI-assisted receptionist. I can answer questions about our hours, services, service area, and scheduling, or help you request service. How can I help today?";

function guard(kind: GuardKind, response: Omit<AIResponse, 'reason'> & { reason?: string }): GuardResult {
  return { kind, response: { reason: kind, ...response } };
}

/** Returns a deterministic response when the message trips a guardrail, otherwise null. */
export function evaluateSafety(message: string): GuardResult | null {
  const text = message.trim();

  // Life-safety first: never delay safety guidance behind anything else.
  if (LIFE_SAFETY_PATTERNS.some((p) => p.test(text))) {
    return guard('life_safety', {
      answer: LIFE_SAFETY_ANSWER,
      supported: true,
      requiresEscalation: true,
      category: 'emergency',
    });
  }

  if (INJECTION_PATTERNS.some((p) => p.test(text))) {
    return guard('prompt_injection', {
      answer: REFUSAL_ANSWER,
      supported: false,
      requiresEscalation: false,
      category: 'other',
    });
  }

  if (HAZARD_SUBJECT.test(text) && HAZARD_INTENT.test(text)) {
    return guard('hazardous_diy', {
      answer: HAZARD_ANSWER,
      supported: true,
      requiresEscalation: true,
      category: 'other',
    });
  }

  if (IDENTITY_PATTERN.test(text)) {
    return guard('identity', {
      answer: IDENTITY_ANSWER,
      supported: true,
      requiresEscalation: false,
      category: 'other',
    });
  }

  if (GREETING_PATTERN.test(text)) {
    return guard('greeting', {
      answer: GREETING_ANSWER,
      supported: true,
      requiresEscalation: false,
      category: 'other',
    });
  }

  return null;
}
