import { isFirebaseConfigured } from '../firebase/config';
import { Alert } from './Alert';

/** Friendly developer-facing banner when the Firebase web config has not been provided. */
export function ConfigNotice() {
  if (isFirebaseConfigured) return null;
  return (
    <div className="config-notice">
      <Alert tone="warning" title="Firebase is not configured">
        Copy <code>.env.example</code> to <code>.env.local</code> and add your Firebase web app values, or set{' '}
        <code>VITE_USE_EMULATORS=true</code> to use the local emulators. See the README for setup steps.
      </Alert>
    </div>
  );
}
