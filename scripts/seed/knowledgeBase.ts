/**
 * Default approved knowledge base for the fictional "OfficeLume HVAC Services" business.
 * All business details below are SAMPLE DATA for demonstration - not a real company.
 * Pure data (no imports) so it can be used by the seed script and by the unit tests.
 *
 * Writing guidance for administrators: keep each article to one topic, state only facts the
 * business has approved, and never include prices, discounts, or guarantees unless they are real
 * and current. The AI can only repeat what is written here.
 */

export interface SeedKnowledgeArticle {
  id: string;
  title: string;
  category: 'hours' | 'services' | 'service_area' | 'pricing' | 'scheduling' | 'emergency' | 'policies' | 'other';
  content: string;
  active: boolean;
}

export const DEFAULT_KNOWLEDGE_BASE: SeedKnowledgeArticle[] = [
  {
    id: 'kb-hours',
    title: 'Business hours',
    category: 'hours',
    content:
      'OfficeLume HVAC Services office hours - opening and closing times: Monday through Friday we open at 8:00 AM and close at 6:00 PM. Saturday hours are 9:00 AM to 2:00 PM. Sunday: closed. The weekend schedule is limited to Saturday. Service requests submitted outside office hours are reviewed when the office reopens.',
    active: true,
  },
  {
    id: 'kb-services-overview',
    title: 'Services overview',
    category: 'services',
    content:
      'OfficeLume HVAC Services provides AC repair, HVAC maintenance, heating repair, AC installation, heating installation, thermostat troubleshooting, and indoor air quality services for homes. A team member confirms whether a specific service fits your situation after reviewing your service request.',
    active: true,
  },
  {
    id: 'kb-ac-repair',
    title: 'Air conditioning (AC) repair',
    category: 'services',
    content:
      'OfficeLume HVAC Services repairs residential air conditioning (AC) systems, including units that are not cooling, are blowing warm air, or are making unusual noises. A technician diagnoses the problem before any repair is recommended. To get started, submit a service request describing the issue.',
    active: true,
  },
  {
    id: 'kb-heating-repair',
    title: 'Heating repair',
    category: 'services',
    content:
      'OfficeLume HVAC Services repairs residential heating systems, including furnaces and heaters that are not producing heat or that turn on and off repeatedly. A technician diagnoses the problem before any repair is recommended. Submit a service request to get started.',
    active: true,
  },
  {
    id: 'kb-maintenance',
    title: 'HVAC maintenance',
    category: 'services',
    content:
      'HVAC maintenance: seasonal tune-ups and inspections help keep heating and cooling equipment running reliably. You can request a maintenance visit through the service request form, and a team member confirms the details with you.',
    active: true,
  },
  {
    id: 'kb-installation',
    title: 'AC and heating installation',
    category: 'services',
    content:
      'OfficeLume HVAC Services installs new and replacement AC systems and heating systems for homes. Installation details depend on your home and equipment, so a team member reviews each installation request.',
    active: true,
  },
  {
    id: 'kb-thermostat',
    title: 'Thermostat troubleshooting',
    category: 'services',
    content:
      'Thermostat troubleshooting: we help with thermostats that are unresponsive, show incorrect temperatures, or do not control heating or cooling as expected. Submit a service request and include the thermostat brand and model if you know it.',
    active: true,
  },
  {
    id: 'kb-indoor-air-quality',
    title: 'Indoor air quality services',
    category: 'services',
    content:
      'Indoor air quality services: OfficeLume HVAC Services offers indoor air quality services such as air filter guidance, duct-related concerns, and air purification options. A team member can discuss which options are appropriate for your home.',
    active: true,
  },
  {
    id: 'kb-brands',
    title: 'Equipment brands',
    category: 'services',
    content:
      'Equipment brands: our technicians work on most major residential AC and heating brands. Whether we can service a specific brand, make, or model, and whether parts are available, is confirmed by a team member after reviewing your request.',
    active: true,
  },
  {
    id: 'kb-service-area',
    title: 'Service area',
    category: 'service_area',
    content:
      'Service area (sample data): OfficeLume HVAC Services serves the communities of Riverton, Oak Hollow, Maple Heights, Cedar Grove, and Lakeside. This assistant cannot confirm service for addresses outside these communities; submit a service request and a team member will follow up about your location.',
    active: true,
  },
  {
    id: 'kb-pricing',
    title: 'Repair pricing',
    category: 'pricing',
    content:
      'Repair costs depend on the diagnosis, parts, labor, and equipment involved. A team member can provide additional information after reviewing your service request. This assistant does not quote prices or discounts.',
    active: true,
  },
  {
    id: 'kb-pricing-installation',
    title: 'Installation pricing',
    category: 'pricing',
    content:
      'Installation costs depend on your home, the size and type of equipment, and the work required. A team member can discuss options after reviewing your installation request. This assistant cannot provide quotes.',
    active: true,
  },
  {
    id: 'kb-scheduling',
    title: 'Appointments and availability',
    category: 'scheduling',
    content:
      'Scheduling: you can submit preferred dates and time windows through the service request form. This assistant cannot book appointments, check live availability, or promise same-day or next-day service. Submitting a request does not guarantee an appointment; a team member follows up using your preferred contact method to discuss scheduling.',
    active: true,
  },
  {
    id: 'kb-emergency',
    title: 'Emergency service',
    category: 'emergency',
    content:
      'Emergency service: you can submit a service request and choose Emergency Service so the team can review it as soon as the office is open. OfficeLume HVAC Services does not run a 24/7 emergency dispatch line through this assistant, and response times are not guaranteed. If there is a gas smell, smoke, fire, or a carbon monoxide alarm, leave the building and call 911 or your gas utility.',
    active: true,
  },
  {
    id: 'kb-request-process',
    title: 'What happens after you submit a request',
    category: 'policies',
    content:
      'What happens after you submit a request: submitting a request through this website is not a confirmed appointment. Team members review requests during office hours and contact you using the method you chose. Information you submit is used only to process your request or connect you with a team member.',
    active: true,
  },
  {
    id: 'kb-contact',
    title: 'How to contact the team',
    category: 'other',
    content:
      'Contact: the fastest way to reach the team is to submit a service request or ask for human help on this website. A team member responds using the contact method you choose, phone or email.',
    active: true,
  },
  {
    id: 'kb-company',
    title: 'About the company',
    category: 'other',
    content:
      'About OfficeLume HVAC Services: a small residential HVAC service company (a fictional sample business used for demonstration). The front office uses OfficeLume, an AI-assisted receptionist, and team members handle anything the AI cannot answer.',
    active: true,
  },
];
