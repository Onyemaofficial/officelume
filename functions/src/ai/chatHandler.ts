import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { writeAuditLog } from '../audit/audit';
import { COLLECTIONS, LIMITS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import { RATE_LIMITS, enforceRateLimit } from '../shared/rateLimit';
import { redactPersonalData } from '../shared/sanitize';
import type { AICategory, ChatTurn, KnowledgeArticle } from '../shared/types';
import { inquirySchema } from '../shared/validation';
import { answerInquiry } from './orchestrator';
import type { AIProvider } from './types';

/** What the browser receives. `reason` stays server-side (audit + chat log). */
export interface ChatResult {
  sessionId: string;
  answer: string;
  supported: boolean;
  requiresEscalation: boolean;
  category: AICategory;
}

async function loadActiveKnowledge(db: Firestore): Promise<KnowledgeArticle[]> {
  const snap = await db.collection(COLLECTIONS.knowledgeBase).where('active', '==', true).limit(200).get();
  return snap.docs.map((doc) => {
    const data = doc.data() as Omit<KnowledgeArticle, 'id'>;
    return { id: doc.id, title: data.title, category: data.category, content: data.content, active: data.active };
  });
}

async function loadHistory(db: Firestore, sessionId: string): Promise<ChatTurn[]> {
  const snap = await db
    .collection(COLLECTIONS.chatSessions)
    .doc(sessionId)
    .collection(COLLECTIONS.messages)
    .orderBy('createdAt', 'desc')
    .limit(6)
    .get();
  return snap.docs
    .map((d) => d.data() as { role?: string; content?: string })
    .flatMap((m) =>
      (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
        ? [{ role: m.role, content: m.content } as ChatTurn]
        : [],
    )
    .reverse();
}

/**
 * Customer inquiry workflow (FR-01 .. FR-04, FR-14, FR-15):
 * validate -> rate limit -> retrieve approved knowledge -> AI orchestration -> persist chat -> audit.
 * The AI provider is only ever handed text; every write below is performed by this controlled function.
 */
export async function handleChat(
  db: Firestore,
  request: Pick<CallableRequest<unknown>, 'data' | 'rawRequest'>,
  provider: AIProvider,
): Promise<ChatResult> {
  const input = parseInput(inquirySchema, request.data);
  await enforceRateLimit(db, request, RATE_LIMITS.chat);

  const sessionRef = input.sessionId
    ? db.collection(COLLECTIONS.chatSessions).doc(input.sessionId)
    : db.collection(COLLECTIONS.chatSessions).doc();
  const isNewSession = !input.sessionId;

  let history: ChatTurn[] = [];
  if (!isNewSession) {
    const session = await sessionRef.get();
    if (!session.exists) {
      throw new HttpsError('not-found', 'This chat has expired. Please start a new conversation.');
    }
    const count = Number((session.data() as { messageCount?: number }).messageCount ?? 0);
    if (count >= LIMITS.maxMessagesPerSession) {
      throw new HttpsError(
        'resource-exhausted',
        'This conversation has reached its length limit. Please request human help or start a new chat.',
      );
    }
    history = await loadHistory(db, sessionRef.id);
  }

  const articles = await loadActiveKnowledge(db);
  const safeMessage = redactPersonalData(input.message);

  const startedAt = Date.now();
  const outcome = await answerInquiry({ message: safeMessage, history, articles, provider });
  const latencyMs = Date.now() - startedAt;
  const { response } = outcome;

  const nowMs = Date.now();
  const batch = db.batch();
  batch.set(
    sessionRef,
    {
      ...(isNewSession ? { createdAt: Timestamp.fromMillis(nowMs) } : {}),
      updatedAt: Timestamp.fromMillis(nowMs),
      messageCount: FieldValue.increment(2),
      lastEscalationReason: response.requiresEscalation ? response.reason : FieldValue.delete(),
    },
    { merge: true },
  );
  const messages = sessionRef.collection(COLLECTIONS.messages);
  batch.set(messages.doc(), {
    role: 'user',
    content: safeMessage,
    createdAt: Timestamp.fromMillis(nowMs),
  });
  batch.set(messages.doc(), {
    role: 'assistant',
    content: response.answer,
    supported: response.supported,
    requiresEscalation: response.requiresEscalation,
    category: response.category,
    source: outcome.source,
    reason: response.reason,
    createdAt: Timestamp.fromMillis(nowMs + 1),
  });
  await batch.commit();

  await writeAuditLog(db, {
    eventType: response.requiresEscalation ? 'AI_RESPONSE_ESCALATED' : 'AI_RESPONSE_GENERATED',
    actorType: 'ai',
    actorUid: provider.name,
    targetType: 'chatSession',
    targetId: sessionRef.id,
    action: response.requiresEscalation ? 'ai_recommended_escalation' : 'ai_answered',
    metadata: {
      category: response.category,
      supported: response.supported,
      source: outcome.source,
      detail: outcome.detail,
      provider: provider.name,
      retrievedCount: outcome.retrievedCount,
      latencyMs,
    },
  });

  return {
    sessionId: sessionRef.id,
    answer: response.answer,
    supported: response.supported,
    requiresEscalation: response.requiresEscalation,
    category: response.category,
  };
}
