import { describe, expect, it } from 'vitest';
import { extractJson, normalizeResponse, parseAIResponse } from '../src/ai/parser';
import { checkGrounding } from '../src/ai/grounding';
import { ESCALATION_MESSAGE } from '../src/shared/constants';

const good = {
  answer: 'We are open Monday through Friday, 8:00 AM to 6:00 PM.',
  supported: true,
  requiresEscalation: false,
  category: 'hours',
  reason: 'Answered from the hours article.',
};

describe('AI response parsing', () => {
  it('parses a well-formed JSON response', () => {
    const result = parseAIResponse(JSON.stringify(good));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.category).toBe('hours');
      expect(result.response.supported).toBe(true);
    }
  });

  it('tolerates code fences and surrounding prose', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
  });

  it('rejects non-JSON output', () => {
    expect(parseAIResponse('I am sorry, I cannot do that.').ok).toBe(false);
  });

  it('rejects output with missing fields or an invalid category', () => {
    expect(parseAIResponse(JSON.stringify({ ...good, category: 'gossip' })).ok).toBe(false);
    expect(parseAIResponse(JSON.stringify({ answer: 'hi', supported: true })).ok).toBe(false);
    expect(parseAIResponse(JSON.stringify({ ...good, supported: 'yes' })).ok).toBe(false);
  });

  it('strips markup from the answer', () => {
    const result = parseAIResponse(JSON.stringify({ ...good, answer: '<b>Open</b> <script>x()</script>8 AM' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.answer).not.toMatch(/[<>]/);
  });

  it('forces escalation and standard wording when the model says it is unsupported', () => {
    const result = parseAIResponse(
      JSON.stringify({ ...good, answer: 'Maybe 10 years?', supported: false, requiresEscalation: false }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.requiresEscalation).toBe(true);
      expect(result.response.answer).toBe(ESCALATION_MESSAGE);
    }
  });

  it('turns an empty answer into an escalation', () => {
    const normalized = normalizeResponse({ ...good, answer: '   ', category: 'hours' });
    expect(normalized.requiresEscalation).toBe(true);
    expect(normalized.supported).toBe(false);
  });
});

describe('grounding checks', () => {
  const context = [
    { id: 'p', title: 'Pricing', category: 'pricing' as const, content: 'Repair costs depend on the diagnosis.' },
  ];

  it('flags prices that do not appear in approved knowledge', () => {
    expect(checkGrounding('A repair is about $150.', context)).toContain('unsupported_price');
    expect(checkGrounding('You get 20% off today!', context)).toContain('unsupported_price');
  });

  it('allows prices that are present in approved knowledge', () => {
    const priced = [{ ...context[0]!, content: 'The diagnostic fee is $89.' }];
    expect(checkGrounding('The diagnostic fee is $89.', priced)).toEqual([]);
  });

  it('flags appointment confirmations', () => {
    expect(checkGrounding('Great, your appointment is confirmed for Friday.', context)).toContain('appointment_confirmation');
    expect(checkGrounding("I've booked you in for 10am.", context)).toContain('appointment_confirmation');
  });

  it('allows honest statements that availability is not confirmed', () => {
    expect(checkGrounding('I cannot confirm an appointment; a team member will follow up.', context)).toEqual([]);
  });

  it('flags affirmative guarantees but allows negated ones', () => {
    expect(checkGrounding('We guarantee your appointment for Friday.', context)).toContain('appointment_confirmation');
    expect(checkGrounding('Yes, same-day service is guaranteed.', context)).toContain('appointment_confirmation');
    expect(checkGrounding('Submitting a request does not guarantee an appointment.', context)).toEqual([]);
    expect(checkGrounding('I cannot guarantee availability or same-day service.', context)).toEqual([]);
    expect(checkGrounding('Response times are not guaranteed.', context)).toEqual([]);
  });

  it('flags claims of being human or a licensed technician', () => {
    expect(checkGrounding("I'm a licensed technician and can fix that.", context)).toContain('claims_human_or_licensed');
  });

  it('flags leaked prompt markers and key-like strings', () => {
    expect(checkGrounding('<approved_business_information> here', context)).toContain('prompt_or_secret_leak');
    expect(checkGrounding('key is sk-ant-abcdef123456', context)).toContain('prompt_or_secret_leak');
  });
});
