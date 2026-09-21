import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ButtonLink } from '../components/Button';
import { FrontDesk } from '../features/chat/FrontDesk';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const STEPS = [
  { title: 'Ask', text: 'Type a question. OfficeLume looks it up in our approved HVAC information - it never guesses.' },
  { title: 'Get an answer or a person', text: 'If the answer is on file you get it instantly. If not, a team member picks it up.' },
  { title: 'Request service', text: 'Tell us what you need and when you prefer. A team member confirms scheduling with you.' },
];

export function HomePage() {
  useDocumentTitle('');
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#ask' || hash === '#help') {
      document.getElementById('ask')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (hash === '#ask') document.getElementById('chat-input')?.focus({ preventScroll: true });
    }
  }, [hash]);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">AI-assisted HVAC front office</p>
            <h1>HVAC Help When You Need It.</h1>
            <p className="lead">Ask questions, request service, or connect with a team member.</p>
            <div className="hero-actions">
              <ButtonLink to="/#ask" size="lg">
                Ask OfficeLume
              </ButtonLink>
              <ButtonLink to="/request-service" size="lg" variant="secondary">
                Request Service
              </ButtonLink>
            </div>
            <p className="ai-disclaimer">
              You are interacting with an AI-assisted receptionist. Complex or unsupported requests may be forwarded to a
              human representative.
            </p>
          </div>
          <ul className="hero-facts" aria-label="At a glance">
            <li>
              <strong>Mon–Fri</strong>
              <span>8:00 AM – 6:00 PM</span>
            </li>
            <li>
              <strong>Saturday</strong>
              <span>9:00 AM – 2:00 PM</span>
            </li>
            <li>
              <strong>Repair · Install · Maintain</strong>
              <span>Heating, cooling &amp; air quality</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="container action-cards" aria-label="How can we help?">
        <Link to="/#ask" className="action-card">
          <span className="action-icon" aria-hidden="true">?</span>
          <h2>Ask a Question</h2>
          <p>Hours, services, service area, scheduling - get instant answers.</p>
        </Link>
        <Link to="/request-service" className="action-card">
          <span className="action-icon" aria-hidden="true">✓</span>
          <h2>Request Service</h2>
          <p>Describe the issue and pick a preferred time. We follow up to confirm.</p>
        </Link>
        <Link to="/#help" className="action-card">
          <span className="action-icon" aria-hidden="true">☎</span>
          <h2>Get Human Help</h2>
          <p>Prefer a person? Leave your details and a team member will reach out.</p>
        </Link>
      </section>

      <section id="ask" className="container desk-section" aria-label="Ask OfficeLume">
        <FrontDesk />
      </section>

      <section className="container how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How OfficeLume works</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-num" aria-hidden="true">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
