import type { StaffRole } from '../shared/types';

/** Pure business rules for staff account management (unit-testable, no Firebase). */

export type RuleResult = { ok: true } | { ok: false; message: string };

interface TargetState {
  role: StaffRole;
  active: boolean;
}

interface ChangeContext {
  actorUid: string;
  targetUid: string;
  target: TargetState;
  /** Number of ACTIVE admins right now (including the target if it is one). */
  activeAdminCount: number;
}

const isActiveAdmin = (t: TargetState) => t.role === 'admin' && t.active;

/** Would this change leave the organisation without any active administrator? */
function removesLastAdmin(ctx: ChangeContext, willStillBeActiveAdmin: boolean): boolean {
  return isActiveAdmin(ctx.target) && !willStillBeActiveAdmin && ctx.activeAdminCount <= 1;
}

export function validateRoleChange(ctx: ChangeContext, newRole: StaffRole): RuleResult {
  if (ctx.actorUid === ctx.targetUid) {
    return { ok: false, message: 'You cannot change your own role. Ask another administrator.' };
  }
  if (ctx.target.role === newRole) {
    return { ok: false, message: `This account is already a ${newRole}.` };
  }
  if (removesLastAdmin(ctx, newRole === 'admin' && ctx.target.active)) {
    return { ok: false, message: 'At least one active administrator must remain.' };
  }
  return { ok: true };
}

export function validateActiveChange(ctx: ChangeContext, active: boolean): RuleResult {
  if (ctx.actorUid === ctx.targetUid) {
    return { ok: false, message: 'You cannot deactivate your own account.' };
  }
  if (ctx.target.active === active) {
    return { ok: false, message: `This account is already ${active ? 'active' : 'inactive'}.` };
  }
  if (removesLastAdmin(ctx, ctx.target.role === 'admin' && active)) {
    return { ok: false, message: 'At least one active administrator must remain.' };
  }
  return { ok: true };
}
