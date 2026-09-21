import { Alert } from '../components/Alert';
import { ServiceRequestForm } from '../features/serviceRequests/ServiceRequestForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function RequestServicePage() {
  useDocumentTitle('Request Service');
  return (
    <div className="container page page-narrow">
      <header className="page-header">
        <p className="eyebrow">Service request</p>
        <h1 id="request-heading">Request HVAC service</h1>
        <p className="lead">Tell us what you need. A team member will review your request and follow up to discuss scheduling.</p>
      </header>

      <Alert tone="warning" title="Having a safety emergency?">
        If you smell gas, see smoke or fire, or a carbon monoxide alarm is sounding, leave the building and call 911 or your gas utility first. Do not wait for a reply here.
      </Alert>

      <ServiceRequestForm />
    </div>
  );
}
