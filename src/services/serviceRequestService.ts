import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { RequestStatus, ServiceRequest } from '../types';
import type { ServiceRequestFormData } from '../validation/schemas';
import { toAppError, AppError } from '../utils/errors';
import { callFunction } from './callables';
import { mapServiceRequest } from './mappers';

const COLLECTION = 'serviceRequests';

/** Public: submit a service request. Returns the reference number. */
export async function submitServiceRequest(data: ServiceRequestFormData): Promise<{ requestNumber: string }> {
  return callFunction('submitServiceRequest', data);
}

/** Admin: most recent requests (rules only permit this for authenticated administrators). */
export async function listServiceRequests(max = 200): Promise<ServiceRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map(mapServiceRequest);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getServiceRequest(id: string): Promise<ServiceRequest> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) throw new AppError('not-found', 'That service request could not be found.');
    return mapServiceRequest(snap);
  } catch (error) {
    throw toAppError(error);
  }
}

/** Admin: change status and/or add an internal note via the audited Cloud Function. */
export async function updateServiceRequest(input: {
  requestId: string;
  status?: RequestStatus;
  note?: string;
}): Promise<{ status: RequestStatus; changed: boolean }> {
  return callFunction('updateServiceRequestAdmin', input);
}
