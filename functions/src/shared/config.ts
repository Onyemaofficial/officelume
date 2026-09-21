import { defineSecret, defineString } from 'firebase-functions/params';

/** Region for every callable. Keep in sync with VITE_FUNCTIONS_REGION in the web app. */
export const REGION = 'us-central1';

/** Server-side Claude credential. Stored in Secret Manager, never in source or the browser bundle. */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** `claude` (default) or `mock` for local development without an API key. */
export const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'claude' });
export const CLAUDE_MODEL = defineString('CLAUDE_MODEL', { default: 'claude-opus-5' });

export const BASE_OPTIONS = {
  region: REGION,
  maxInstances: 10,
  cors: true,
} as const;
