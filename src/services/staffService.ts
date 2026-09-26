import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { StaffProfile } from '../features/auth/auth.types';
import type { StaffRole } from '../types';
import { toAppError } from '../utils/errors';
import { callFunction } from './callables';
import { mapStaffProfile } from './mappers';

/** Admin only: the whole staff directory (Firestore rules allow this read for administrators only). */
export async function listStaff(): Promise<StaffProfile[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(500)));
    return snap.docs.map(mapStaffProfile).sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Provision a staff member. The Cloud Function creates the Firebase Auth user (with a random,
 * undisclosed password), sets the role claim, writes the profile, and audits it. The caller then
 * sends the password-setup email so the employee chooses their own password.
 */
export function createStaff(input: { displayName: string; email: string; role: StaffRole }): Promise<{ uid: string }> {
  return callFunction('createStaffUserAdmin', input);
}

export function changeStaffRole(uid: string, role: StaffRole): Promise<{ role: StaffRole }> {
  return callFunction('updateStaffRoleAdmin', { uid, role });
}

export function setStaffActive(uid: string, active: boolean): Promise<{ active: boolean }> {
  return callFunction('setStaffActiveStatusAdmin', { uid, active });
}
