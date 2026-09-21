import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AuditLog } from '../types';
import { toAppError } from '../utils/errors';
import { mapAuditLog } from './mappers';

export async function listAuditLogs(max = 200): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(max)));
    return snap.docs.map(mapAuditLog);
  } catch (error) {
    throw toAppError(error);
  }
}
