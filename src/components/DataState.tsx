import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { isAuthFailure, type AppError } from '../utils/errors';
import { useAuth } from '../features/auth/useAuth';

interface DataStateProps {
  loading: boolean;
  error: AppError | null;
  onRetry: () => void;
  children: ReactNode;
}

/** Standard loading / error presentation for admin data. Auth failures offer a re-sign-in. */
export function DataState({ loading, error, onRetry, children }: DataStateProps) {
  const { signOut } = useAuth();

  if (loading) {
    return (
      <div className="data-state">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <Alert
        tone="error"
        title={isAuthFailure(error) ? 'Access problem' : 'We could not load this data'}
        action={
          isAuthFailure(error) ? (
            <Button size="sm" variant="secondary" onClick={() => void signOut()}>
              Sign in again
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          )
        }
      >
        {error.message}
      </Alert>
    );
  }
  return <>{children}</>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
