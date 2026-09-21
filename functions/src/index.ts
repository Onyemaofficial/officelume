import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { createAIProvider } from './ai/providerFactory';
import { handleChat } from './ai/chatHandler';
import { recordAdminLogin } from './auth/adminLoginHandler';
import { createEscalation, updateEscalation } from './escalations/escalationHandlers';
import { saveKnowledgeArticle } from './knowledge/knowledgeHandlers';
import { createServiceRequest, updateServiceRequest } from './serviceRequests/serviceRequestHandlers';
import { AI_PROVIDER, ANTHROPIC_API_KEY, BASE_OPTIONS, CLAUDE_MODEL } from './shared/config';
import { getDb } from './shared/db';
import { toSafeError } from './shared/errors';

/**
 * Callable HTTPS functions form the controlled application layer. Browsers never write to
 * Firestore directly (see firestore.rules); every mutation passes through validation,
 * rate limiting / authorization, and audit logging here.
 */

function readAnthropicKey(): string | undefined {
  try {
    return ANTHROPIC_API_KEY.value() || undefined;
  } catch {
    return undefined; // secret not configured (e.g. local emulator) -> mock provider
  }
}

async function run<T>(name: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw toSafeError(error, name);
  }
}

// ---------- Public (customer) ----------

export const askOfficeLume = onCall(
  { ...BASE_OPTIONS, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, memory: '256MiB' },
  (request: CallableRequest<unknown>) =>
    run('askOfficeLume', () => {
      const provider = createAIProvider({
        mode: AI_PROVIDER.value(),
        apiKey: readAnthropicKey(),
        model: CLAUDE_MODEL.value(),
      });
      return handleChat(getDb(), request, provider);
    }),
);

export const submitServiceRequest = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('submitServiceRequest', () => createServiceRequest(getDb(), request)),
);

export const submitEscalation = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('submitEscalation', () => createEscalation(getDb(), request)),
);

// ---------- Authentication events ----------

export const recordAdminLoginEvent = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('recordAdminLoginEvent', () => recordAdminLogin(getDb(), request)),
);

// ---------- Administrator only (role verified inside each handler) ----------

export const updateServiceRequestAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('updateServiceRequestAdmin', () => updateServiceRequest(getDb(), request)),
);

export const updateEscalationAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('updateEscalationAdmin', () => updateEscalation(getDb(), request)),
);

export const saveKnowledgeArticleAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('saveKnowledgeArticleAdmin', () => saveKnowledgeArticle(getDb(), request)),
);
