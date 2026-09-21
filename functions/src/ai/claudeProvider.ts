import Anthropic from '@anthropic-ai/sdk';
import { AI_OUTPUT_JSON_SCHEMA, SYSTEM_PROMPT, buildUserContent } from './prompt';
import { AIProviderError, type AIProvider, type AIProviderRequest } from './types';

export interface ClaudeProviderOptions {
  apiKey: string;
  model: string;
  /** Per-attempt timeout. Kept short so a slow API degrades to human escalation, not a hung page. */
  timeoutMs?: number;
}

/**
 * Production provider: Anthropic Claude via the official SDK.
 * Runs only inside Cloud Functions; the API key comes from Secret Manager.
 * No tools are declared, so the model cannot take any action - it can only return JSON text.
 */
export class ClaudeProvider implements AIProvider {
  readonly name: string;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeProviderOptions) {
    this.model = options.model;
    this.name = `claude:${options.model}`;
    this.client = new Anthropic({
      apiKey: options.apiKey,
      timeout: options.timeoutMs ?? 20_000,
      maxRetries: 1,
    });
  }

  async generate(request: AIProviderRequest): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      ...request.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: buildUserContent(request) },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        // Low effort keeps latency near the ~5s target for short, retrieval-grounded answers.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: AI_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown> },
        },
      });

      if (response.stop_reason === 'refusal') {
        throw new AIProviderError('refusal', 'The model declined to answer this request.');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new AIProviderError('truncated', 'The model response was cut off.');
      }

      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim();
      if (!text) throw new AIProviderError('empty', 'The model returned no text.');
      return text;
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

function toProviderError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIProviderError('timeout', 'The AI service timed out.');
  }
  if (error instanceof Anthropic.APIError) {
    // Status code only - never include request bodies or headers in logs.
    return new AIProviderError('api', `The AI service returned an error (status ${error.status ?? 'unknown'}).`);
  }
  return new AIProviderError('api', 'The AI service could not be reached.');
}
