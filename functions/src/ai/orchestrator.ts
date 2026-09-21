import { ESCALATION_MESSAGE } from '../shared/constants';
import type { AICategory, AIResponse, ChatTurn, KnowledgeArticle } from '../shared/types';
import { truncate } from '../shared/sanitize';
import { checkGrounding } from './grounding';
import { parseAIResponse } from './parser';
import { detectCategoryHints, retrieveKnowledge, tokenize, toContextItems } from './retrieval';
import { evaluateSafety } from './safety';
import { AIProviderError, type AIProvider } from './types';

export type AnswerSource = 'safety' | 'no_knowledge' | 'model' | 'ungrounded' | 'invalid_output' | 'provider_error';

export interface InquiryOutcome {
  response: AIResponse;
  source: AnswerSource;
  /** Guard kind, grounding violations, or provider error kind - used for audit metadata only. */
  detail: string;
  retrievedCount: number;
}

export interface InquiryInput {
  /** Already validated and PII-redacted customer message. */
  message: string;
  history: ChatTurn[];
  /** All knowledge articles; inactive ones are filtered out during retrieval. */
  articles: KnowledgeArticle[];
  provider: AIProvider;
}

const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CHARS = 600;

const PROVIDER_UNAVAILABLE_ANSWER =
  "I'm having trouble looking that up right now. I can send your request to a team member, or you can try again in a moment.";

function toAICategory(hints: ReturnType<typeof detectCategoryHints>): AICategory {
  const first = hints[0];
  return first && first !== 'policies' ? first : 'other';
}

/** Keep recent turns only, truncated, starting with a user turn (required by the model API). */
export function prepareHistory(history: ChatTurn[]): ChatTurn[] {
  const recent = history
    .filter((t) => t.content.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: truncate(t.content, MAX_HISTORY_CHARS) }));
  while (recent.length > 0 && recent[0]?.role !== 'user') recent.shift();
  return recent;
}

/** Short follow-ups ("what about Saturdays?") are retrieved together with the previous question. */
export function buildRetrievalQuery(message: string, history: ChatTurn[]): string {
  if (tokenize(message).length >= 3) return message;
  const lastUser = [...history].reverse().find((t) => t.role === 'user');
  return lastUser ? `${lastUser.content} ${message}` : message;
}

function escalation(reason: string, category: AICategory): AIResponse {
  return { answer: ESCALATION_MESSAGE, supported: false, requiresEscalation: true, category, reason };
}

/**
 * The AI orchestration pipeline (application layer). Pure with respect to storage:
 * it receives knowledge and history, and returns a validated response. It never writes anything,
 * which is what keeps the AI module away from administrative records.
 *
 *   1. deterministic safety guards        (injection, life safety, hazardous DIY, identity, greeting)
 *   2. retrieval of approved knowledge    (none relevant  -> escalate, model is not called)
 *   3. provider call with controlled context
 *   4. parse + validate structured output (invalid       -> escalate)
 *   5. grounding checks                   (invented prices / confirmations -> escalate)
 */
export async function answerInquiry(input: InquiryInput): Promise<InquiryOutcome> {
  const guard = evaluateSafety(input.message);
  if (guard) {
    return { response: guard.response, source: 'safety', detail: guard.kind, retrievedCount: 0 };
  }

  const history = prepareHistory(input.history);
  const query = buildRetrievalQuery(input.message, history);
  const retrieval = retrieveKnowledge(query, input.articles);
  const hintCategory = toAICategory(retrieval.categoryHints);

  if (retrieval.matches.length === 0) {
    return {
      response: escalation('No approved knowledge is relevant to this question.', hintCategory),
      source: 'no_knowledge',
      detail: 'no_relevant_articles',
      retrievedCount: 0,
    };
  }

  const context = toContextItems(retrieval.matches);

  let raw: string;
  try {
    raw = await input.provider.generate({ message: input.message, history, context });
  } catch (error) {
    const kind = error instanceof AIProviderError ? error.kind : 'api';
    return {
      response: {
        answer: PROVIDER_UNAVAILABLE_ANSWER,
        supported: false,
        requiresEscalation: true,
        category: hintCategory,
        reason: `AI provider unavailable (${kind}).`,
      },
      source: 'provider_error',
      detail: kind,
      retrievedCount: context.length,
    };
  }

  const parsed = parseAIResponse(raw);
  if (!parsed.ok) {
    return {
      response: escalation('The AI response could not be validated.', hintCategory),
      source: 'invalid_output',
      detail: 'parse_failed',
      retrievedCount: context.length,
    };
  }

  const violations = checkGrounding(parsed.response.answer, context);
  if (violations.length > 0) {
    return {
      response: escalation(`Answer withheld by grounding checks: ${violations.join(', ')}.`, parsed.response.category),
      source: 'ungrounded',
      detail: violations.join(','),
      retrievedCount: context.length,
    };
  }

  return { response: parsed.response, source: 'model', detail: 'ok', retrievedCount: context.length };
}

/** Business rule for the escalation module: should the UI offer/collect human help? */
export function shouldOfferHumanHelp(response: AIResponse): boolean {
  return response.requiresEscalation || !response.supported;
}
