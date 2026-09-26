import { getAuth } from 'firebase-admin/auth';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { createAIProvider } from './ai/providerFactory';
import { handleChat } from './ai/chatHandler';
import { createStaffUser, setStaffActiveStatus, updateStaffRole } from './auth/staffAdminHandlers';
import { recordStaffLogin, recordStaffLogout } from './auth/staffLoginHandler';
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

/** Admin SDK Auth handle; getDb() guarantees the app is initialised first. */
function authAdmin() {
  getDb();
  return getAuth();
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

// ---------- Staff authentication events ----------

export const recordStaffLoginEvent = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('recordStaffLoginEvent', () => recordStaffLogin(getDb(), request)),
);

export const recordStaffLogoutEvent = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('recordStaffLogoutEvent', () => recordStaffLogout(getDb(), request)),
);

// ---------- Staff and administrators (role verified inside each handler) ----------

export const updateServiceRequestStaff = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('updateServiceRequestStaff', () => updateServiceRequest(getDb(), request)),
);

export const updateEscalationStaff = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('updateEscalationStaff', () => updateEscalation(getDb(), request)),
);

// ---------- Administrators only ----------

export const saveKnowledgeArticleAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('saveKnowledgeArticleAdmin', () => saveKnowledgeArticle(getDb(), request)),
);

export const createStaffUserAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('createStaffUserAdmin', () => createStaffUser(getDb(), authAdmin(), request)),
);

export const updateStaffRoleAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('updateStaffRoleAdmin', () => updateStaffRole(getDb(), authAdmin(), request)),
);

export const setStaffActiveStatusAdmin = onCall(BASE_OPTIONS, (request: CallableRequest<unknown>) =>
  run('setStaffActiveStatusAdmin', () => setStaffActiveStatus(getDb(), authAdmin(), request)),
);
