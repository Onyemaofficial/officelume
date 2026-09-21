import { Timestamp, collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toAppError } from '../utils/errors';
import { startOfToday } from '../utils/format';

export interface DashboardStats {
  newRequests: number;
  openEscalations: number;
  requestsToday: number;
  completedRequests: number;
}

/** Server-side aggregate counts - no documents are downloaded just to be counted. */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const requests = collection(db, 'serviceRequests');
    const escalations = collection(db, 'escalations');
    const [newRequests, openEscalations, requestsToday, completedRequests] = await Promise.all([
      getCountFromServer(query(requests, where('status', '==', 'new'))),
      getCountFromServer(query(escalations, where('status', 'in', ['new', 'reviewing']))),
      getCountFromServer(query(requests, where('createdAt', '>=', Timestamp.fromDate(startOfToday())))),
      getCountFromServer(query(requests, where('status', '==', 'completed'))),
    ]);
    return {
      newRequests: newRequests.data().count,
      openEscalations: openEscalations.data().count,
      requestsToday: requestsToday.data().count,
      completedRequests: completedRequests.data().count,
    };
  } catch (error) {
    throw toAppError(error);
  }
}
