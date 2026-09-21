/** Text hygiene helpers. React escapes output too; this is defence in depth on the server. */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MARKUP = /<\s*\/?\s*[a-z!?]/i;

export function normalizeWhitespace(input: string): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when the text looks like HTML/script markup, which customers have no reason to send. */
export function containsMarkup(input: string): boolean {
  return MARKUP.test(input) || /javascript\s*:/i.test(input);
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\s().-]{0,2}){9,15}\d/g;

/**
 * Replace obvious personal identifiers before text is stored in chat logs or sent to the AI provider.
 * Best-effort data minimisation (NFR-05), not a guarantee.
 */
export function redactPersonalData(input: string): string {
  return input.replace(EMAIL_PATTERN, '[email removed]').replace(PHONE_PATTERN, '[phone removed]');
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}
