import { ButtonLink } from '../components/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function AboutPage() {
  useDocumentTitle('About');
  return (
    <div className="container page page-narrow">
      <header className="page-header">
        <p className="eyebrow">About OfficeLume</p>
        <h1>Less admin. More service.</h1>
        <p className="lead">
          OfficeLume is an AI-assisted digital front office for small HVAC service businesses. It handles the routine
          questions and paperwork so people can focus on the work.
        </p>
      </header>

      <section className="prose">
        <h2>What it does</h2>
        <ul>
          <li>Answers common questions using information the business has approved.</li>
          <li>Captures service requests with the details a technician needs.</li>
          <li>Hands anything unusual to a human team member instead of guessing.</li>
          <li>Gives staff one place to review requests, follow-ups, and approved knowledge.</li>
        </ul>

        <h2>How we use AI - responsibly</h2>
        <ul>
          <li><strong>It says it is AI.</strong> The receptionist never claims to be a person or a licensed technician.</li>
          <li><strong>It sticks to approved facts.</strong> Answers come only from the business’s approved information. If it isn’t there, OfficeLume says so and offers a human.</li>
          <li><strong>No invented promises.</strong> It does not make up prices, discounts, warranties, or appointment confirmations.</li>
          <li><strong>Safety first.</strong> It will not give instructions for electrical, refrigerant, gas, or combustion work - those need a qualified professional.</li>
          <li><strong>Humans decide.</strong> The AI cannot change records, approve anything, or schedule visits. Only authorized staff can.</li>
          <li><strong>Your data.</strong> We collect only what’s needed to help you, and only authorized staff can see it.</li>
        </ul>

        <p className="muted small">The company details on this site (hours, service area, services) are fictional sample data for a capstone demonstration.</p>
      </section>

      <div className="form-actions">
        <ButtonLink to="/#ask">Ask OfficeLume</ButtonLink>
        <ButtonLink to="/request-service" variant="secondary">Request Service</ButtonLink>
      </div>
    </div>
  );
}
