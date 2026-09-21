import { ESCALATION_MESSAGE } from '../shared/constants';
import type { AICategory } from '../shared/types';
import { tokenize } from './retrieval';
import type { AIProvider, AIProviderRequest } from './types';

/**
 * Development fallback used when no Anthropic key is configured (or AI_PROVIDER=mock).
 * It is deliberately conservative and deterministic: it answers only when every meaningful term of
 * the question appears in the retrieved approved knowledge, otherwise it recommends escalation.
 * It exercises the same parsing, grounding, and escalation code paths as the Claude provider.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';

  async generate(request: AIProviderRequest): Promise<string> {
    const top = this.pickPrimary(request);
    if (!top) return this.escalate('no approved knowledge retrieved');

    const contextTerms = new Set(request.context.flatMap((c) => tokenize(`${c.title} ${c.content}`)));
    const unmatched = tokenize(request.message).filter((term) => !contextTerms.has(term));
    if (unmatched.length > 0) {
      return this.escalate(`question mentions terms not covered by approved knowledge: ${unmatched.slice(0, 3).join(', ')}`);
    }

    const category: AICategory = top.category === 'policies' ? 'other' : top.category;
    return JSON.stringify({
      answer: top.content,
      supported: true,
      requiresEscalation: false,
      category,
      reason: `Answered from approved article "${top.title}" (mock provider).`,
    });
  }

  /** For broad questions with no specific terms ("what services do you offer?"), prefer an overview article. */
  private pickPrimary(request: AIProviderRequest) {
    if (tokenize(request.message).length === 0) {
      const overview = request.context.find((c) => /overview/i.test(c.title));
      if (overview) return overview;
    }
    return request.context[0];
  }

  private escalate(reason: string): string {
    return JSON.stringify({
      answer: ESCALATION_MESSAGE,
      supported: false,
      requiresEscalation: true,
      category: 'other',
      reason: `${reason} (mock provider).`,
    });
  }
}
