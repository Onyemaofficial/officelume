import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/Spinner';
import { resolveAdminAccess } from './accessDecision';
import { useAuth } from './useAuth';

/** Route guard: wraps every /admin route except /admin/login. */
export function RequireAdmin() {
  const { state } = useAuth();
  const location = useLocation();

  switch (resolveAdminAccess(state)) {
    case 'wait':
      return (
        <div className="fullpage-center">
          <Spinner label="Checking your session…" />
        </div>
      );
    case 'allow':
      return <Outlet />;
    case 'login':
      return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
}
