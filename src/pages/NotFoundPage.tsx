import { ButtonLink } from '../components/Button';
import { Logo } from '../components/Logo';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="fullpage-center not-found">
      <Logo />
      <h1>We couldn’t find that page</h1>
      <p className="muted">The link may be out of date or the page may have moved.</p>
      <ButtonLink to="/">Back to home</ButtonLink>
    </div>
  );
}
