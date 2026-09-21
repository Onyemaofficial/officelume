import { ClaudeProvider } from './claudeProvider';
import { MockProvider } from './mockProvider';
import type { AIProvider } from './types';

export interface ProviderSettings {
  /** `claude` or `mock`. */
  mode: string;
  apiKey: string | undefined;
  model: string;
}

/**
 * Choose the AI provider. Claude is used only when explicitly configured with a key;
 * otherwise the deterministic mock keeps the whole workflow usable in development.
 */
export function createAIProvider(settings: ProviderSettings): AIProvider {
  const key = settings.apiKey?.trim();
  if (settings.mode.toLowerCase() === 'mock' || !key) {
    return new MockProvider();
  }
  return new ClaudeProvider({ apiKey: key, model: settings.model });
}
