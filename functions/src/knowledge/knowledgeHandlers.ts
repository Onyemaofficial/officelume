import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { writeAuditLogInTransaction } from '../audit/audit';
import { requireAdmin } from '../auth/authorization';
import { COLLECTIONS } from '../shared/constants';
import { parseInput } from '../shared/errors';
import { knowledgeSaveSchema } from '../shared/validation';

type AdminRequest = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'rawRequest'>;

/**
 * FR-12: create or update an approved knowledge article. "Deactivate" is an update with
 * active=false - articles are never hard-deleted, so the audit history stays meaningful.
 */
export async function saveKnowledgeArticle(db: Firestore, request: AdminRequest): Promise<{ id: string }> {
  const admin = await requireAdmin(request, db);
  const input = parseInput(knowledgeSaveSchema, request.data);
  const collection = db.collection(COLLECTIONS.knowledgeBase);

  if (!input.id) {
    const ref = collection.doc();
    await db.runTransaction(async (tx) => {
      tx.create(ref, {
        title: input.title,
        category: input.category,
        content: input.content,
        active: input.active,
        createdBy: admin.uid,
        updatedBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeAuditLogInTransaction(db, tx, {
        eventType: 'KNOWLEDGE_CREATED',
        actorType: 'staff',
        actorUid: admin.uid,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetType: 'knowledgeArticle',
        targetId: ref.id,
        action: 'create',
        metadata: { category: input.category, active: input.active },
      });
    });
    return { id: ref.id };
  }

  const ref = collection.doc(input.id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Knowledge article not found.');
    const wasActive = (snap.data() as { active?: boolean }).active === true;

    tx.update(ref, {
      title: input.title,
      category: input.category,
      content: input.content,
      active: input.active,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLogInTransaction(db, tx, {
      eventType: wasActive && !input.active ? 'KNOWLEDGE_DEACTIVATED' : 'KNOWLEDGE_UPDATED',
      actorType: 'staff',
      actorUid: admin.uid,
      actorEmail: admin.email,
      actorRole: admin.role,
      targetType: 'knowledgeArticle',
      targetId: ref.id,
      action: wasActive && !input.active ? 'deactivate' : 'update',
      metadata: { category: input.category, active: input.active },
    });
  });
  return { id: ref.id };
}
