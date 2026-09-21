import { ButtonLink } from '../components/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const SERVICES = [
  { title: 'Air conditioning repair', text: 'Diagnosis and repair for residential AC systems that are not cooling, blowing warm air, or making unusual noises.' },
  { title: 'Heating repair', text: 'Repairs for furnaces and heaters that are not producing heat or that cycle on and off.' },
  { title: 'HVAC maintenance', text: 'Seasonal tune-ups and inspections to help keep heating and cooling equipment running reliably.' },
  { title: 'AC installation', text: 'Installation of new and replacement air conditioning systems for homes.' },
  { title: 'Heating installation', text: 'Installation of new and replacement heating systems for homes.' },
  { title: 'Thermostat troubleshooting', text: 'Help with unresponsive thermostats or ones that do not control heating and cooling as expected.' },
  { title: 'Indoor air quality', text: 'Air filter guidance, duct-related concerns, and air purification options.' },
];

export function ServicesPage() {
  useDocumentTitle('Services');
  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">What we do</p>
        <h1>HVAC services</h1>
        <p className="lead">Residential heating, cooling, and air quality service. Submit a request and a team member will review the details with you.</p>
      </header>

      <ul className="service-grid">
        {SERVICES.map((s) => (
          <li key={s.title} className="service-card">
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </li>
        ))}
      </ul>

      <aside className="notice-box">
        <strong>Good to know</strong>
        <p>
          Repair and installation costs depend on the diagnosis, parts, labor, and equipment involved, so OfficeLume does not
          quote prices online. A team member can provide more information after reviewing your request. Submitting a request
          does not guarantee an appointment.
        </p>
      </aside>

      <div className="cta-band">
        <div>
          <h2>Ready to get started?</h2>
          <p>Tell us what’s going on and when you’d prefer a visit.</p>
        </div>
        <ButtonLink to="/request-service" size="lg">
          Request Service
        </ButtonLink>
      </div>
    </div>
  );
}
