import type { ChatTurn, KnowledgeCategory } from '../shared/types';

/** A retrieved, approved knowledge item passed to the model as controlled context. */
export interface KnowledgeContextItem {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
}

export interface AIProviderRequest {
  /** Customer message with obvious personal identifiers already redacted. */
  message: string;
  /** Recent prior turns (also redacted). Oldest first. */
  history: ChatTurn[];
  /** Only approved, active, relevance-filtered knowledge. */
  context: KnowledgeContextItem[];
}

/**
 * Provider abstraction: implementations return the model's raw JSON text. Parsing, validation and
 * grounding checks are done centrally by the orchestrator so every provider is held to the same rules.
 * Providers have NO access to Firestore or any administrative capability.
 */
export interface AIProvider {
  readonly name: string;
  generate(request: AIProviderRequest): Promise<string>;
}

export type AIProviderErrorKind = 'timeout' | 'api' | 'refusal' | 'truncated' | 'empty' | 'unconfigured';

export class AIProviderError extends Error {
  constructor(
    public readonly kind: AIProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
