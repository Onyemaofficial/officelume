import type { ReactNode } from 'react';

interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Errors use role="alert" so screen readers announce them immediately. */
export function Alert({ tone = 'info', title, children, action }: AlertProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  return (
    <div className={`alert alert-${tone}`} role={role}>
      <div className="alert-body">
        {title && <strong className="alert-title">{title}</strong>}
        <div>{children}</div>
      </div>
      {action && <div className="alert-action">{action}</div>}
    </div>
  );
}
