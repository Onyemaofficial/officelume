import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Escalation, EscalationStatus } from '../types';
import type { EscalationFormData } from '../validation/schemas';
import { toAppError } from '../utils/errors';
import { callFunction } from './callables';
import { mapEscalation } from './mappers';

const COLLECTION = 'escalations';

/** Public: ask for human help. `sessionId` lets the server look up why the AI escalated. */
export async function submitEscalation(
  data: EscalationFormData,
  sessionId?: string,
): Promise<{ escalationNumber: string }> {
  return callFunction('submitEscalation', { ...data, ...(sessionId ? { sessionId } : {}) });
}

export async function listEscalations(max = 200): Promise<Escalation[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map(mapEscalation);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateEscalation(input: {
  escalationId: string;
  status?: EscalationStatus;
  note?: string;
}): Promise<{ status: EscalationStatus; changed: boolean }> {
  return callFunction('updateEscalationStaff', input);
}
