import { Navigate, Outlet, useLocation } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { STAFF_ROLES, type StaffRole } from '../../types';
import { useAuth } from './useAuth';

export type RouteAccess = 'wait' | 'login' | 'denied' | 'allow';

/**
 * Pure routing decision:
 *   loading                  -> wait (render nothing sensitive until Firebase has restored the session)
 *   signed out / not staff   -> login
 *   signed in, wrong role    -> denied (access-denied page)
 *   signed in, allowed role  -> allow
 */
export function resolveRouteAccess(
  status: 'loading' | 'unauthenticated' | 'authenticated' | 'forbidden',
  role: StaffRole | null,
  allowed: readonly StaffRole[],
): RouteAccess {
  switch (status) {
    case 'loading':
      return 'wait';
    case 'unauthenticated':
    case 'forbidden':
      return 'login';
    case 'authenticated':
      return role !== null && allowed.includes(role) ? 'allow' : 'denied';
  }
}

export function AccessDenied() {
  return (
    <section className="access-denied" aria-labelledby="denied-title">
      <h1 id="denied-title">Access denied</h1>
      <p className="muted">Your account does not have permission to view this page. If you think this is a mistake, contact an administrator.</p>
      <ButtonLink to="/admin/dashboard">Back to the dashboard</ButtonLink>
    </section>
  );
}

interface ProtectedRouteProps {
  /** Roles allowed through. Defaults to every staff role. */
  roles?: readonly StaffRole[];
}

/**
 * Route guard used as a layout route. The UI check is a convenience only: Firestore rules and the
 * Cloud Functions enforce the same roles on the server.
 *
 *   <Route element={<ProtectedRoute roles={['staff', 'admin']} />}> ...staff pages... </Route>
 *   <Route element={<ProtectedRoute roles={['admin']} />}>        ...admin-only pages... </Route>
 */
export function ProtectedRoute({ roles = STAFF_ROLES }: ProtectedRouteProps) {
  const { status, role } = useAuth();
  const location = useLocation();

  switch (resolveRouteAccess(status, role, roles)) {
    case 'wait':
      return (
        <div className="fullpage-center">
          <Spinner label="Checking your session…" />
        </div>
      );
    case 'login':
      return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
    case 'denied':
      return <AccessDenied />;
    case 'allow':
      return <Outlet />;
  }
}
